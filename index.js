import { createHash, randomUUID } from 'node:crypto'

import { resolveConfig } from './lib/config.js'
import { canonicalPath, memoryRoot, pathContains, projectKey, resolveProjectRoot } from './lib/paths.js'
import {
  getProjectRecord,
  loadState,
  projectPaths,
  readBrief,
  readNotes,
  resetProject,
  saveState,
  updateProjectRecord,
  withProjectLock,
  writeBrief,
  writeNotes,
} from './lib/store.js'
import { extractDigest } from './lib/digest.js'
import { callCurator, estimateTextTokens, resolveRoute } from './lib/curator.js'
import { buildInjectionText, createMemoryMessage, isMemoryMessage } from './lib/inject.js'
import { redact, truncateUtf8 } from './lib/redact.js'

const VERSION = '0.1.2'
const CONFIRM_TTL_MS = 10 * 60 * 1000
const DIGEST_CACHE_TTL_MS = 60 * 1000
const MAX_SCAN_SESSIONS = 25

const inflight = new Map()
const waitingSteps = new Set()
const pendingInjections = new Map()
const confirmations = new Map()
const injectedSessions = new Set()
const digestCache = new Map()

function nowIso() {
  return new Date().toISOString()
}

function hashShort(text) {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function safeError(error) {
  return error instanceof Error ? error.message : String(error)
}

function clip(text, max) {
  return truncateUtf8(String(text ?? ''), max)
}

function isSubagent(agent) {
  return agent?.session?.header?.origin === 'subagent'
}

function isBlank(agent) {
  try {
    const messages = agent.session.deriveMessages()
    return !messages.some((message) => message?.role === 'user' && message?.source?.kind === 'user')
  } catch {
    return true
  }
}

function hasMemoryMessage(agent) {
  try {
    return agent.session.deriveMessages().some((message) => message?.source?.kind === 'workspace-memory')
  } catch {
    return false
  }
}

async function readProject(ctx, agent, config, signal) {
  const project = await resolveProjectRoot(ctx, agent, config, signal)
  const root = memoryRoot(config)
  const key = projectKey(project.root)
  const paths = projectPaths(root, key)
  const record = await getProjectRecord(root, key, project.root, project.title)
  return { project, root, key, paths, record }
}

/**
 * Read other sessions in the project and produce bounded digests.
 * `force` bypasses the short in-memory cache for an explicit inject.
 */
async function scanSources(ctx, project, currentId, config, state, force) {
  const query = ctx.get('sessionQuery')
  if (query?.listSessions === undefined) {
    return { sources: [], scanned: 0, reason: 'sessionQuery is not available' }
  }
  let records
  try {
    records = await query.listSessions()
  } catch (error) {
    return { sources: [], scanned: 0, reason: safeError(error) }
  }
  if (!Array.isArray(records)) return { sources: [], scanned: 0, reason: 'session list is unavailable' }

  const candidates = []
  for (const record of records) {
    if (record?.header?.id === currentId) continue
    if (!config.includeSubagents && record.header.origin === 'subagent') continue
    if (typeof record.header.cwd !== 'string' || record.header.cwd.length === 0) continue
    const canonicalCwd = await canonicalPath(record.header.cwd)
    if (!pathContains(project.root, canonicalCwd)) continue
    candidates.push(record)
    if (candidates.length >= MAX_SCAN_SESSIONS) break
  }

  const sources = []
  for (const record of candidates) {
    if (sources.length >= config.maxSessions) break
    const id = record.header.id
    const cached = digestCache.get(id)
    const sinceSeq = Number.isSafeInteger(state.briefCovers[id]) ? state.briefCovers[id] : undefined
    if (
      force !== true &&
      cached !== undefined &&
      cached.sinceSeq === sinceSeq &&
      Date.now() - cached.at < DIGEST_CACHE_TTL_MS
    ) {
      if (cached.digest.hasAnyUserContent) sources.push(cached)
      continue
    }

    let snapshot
    try {
      snapshot = await query.readSession(id)
    } catch {
      continue
    }
    let title
    try {
      title = (await query.readTitle(id))?.title
    } catch {
      title = undefined
    }
    const digest = extractDigest(snapshot, {
      sinceSeq,
      maxTurns: config.maxTurnsPerSession,
      maxEvents: config.maxEventsPerSession,
      patterns: config.redactPatterns,
    })
    if (title !== undefined) digest.title = title
    const entry = { at: Date.now(), sinceSeq, digest }
    digestCache.set(id, entry)
    if (digest.hasAnyUserContent) sources.push(entry)
  }

  return { sources, scanned: candidates.length }
}

function sourceView(entry) {
  const digest = entry.digest
  return {
    id: digest.id,
    title: digest.title ?? digest.id,
    cwd: digest.cwd,
    updatedAt: digest.updatedAt,
    hasCompactionSummary: typeof digest.summary === 'string' && digest.summary.length > 0,
    hasNewContent: digest.hasNewContent,
    turns: digest.turns,
  }
}

function buildDossier(project, notes, brief, sources, config) {
  const redactedNotes = redact(clip(notes, config.maxNotesBytes), config.redactPatterns)
  const previousBrief = redact(clip(brief, config.maxBriefBytes), config.redactPatterns)
  const sessions = sources.map((entry) => {
    const digest = entry.digest
    return {
      id: digest.id,
      title: digest.title ?? digest.id,
      updatedAt: digest.updatedAt,
      hasCompactionSummary: typeof digest.summary === 'string' && digest.summary.length > 0,
      ...(digest.summary === undefined ? {} : { compactionSummary: clip(digest.summary, 6000) }),
      requests: digest.requests,
      outcomes: digest.outcomes,
      files: digest.files,
      errors: digest.errors,
      turns: digest.turns,
    }
  })

  const omitted = []
  const build = (count) => ({
    projectRoot: project.root,
    generatedAt: nowIso(),
    notes: redactedNotes,
    previousBrief,
    sessions: sessions.slice(0, count),
    omittedSessions: sessions.length - Math.min(count, sessions.length),
  })

  let count = sessions.length
  let dossier = build(count)
  let serialized = JSON.stringify(dossier)
  while (Buffer.byteLength(serialized, 'utf8') > config.curator.maxInputBytes && count > 0) {
    omitted.push(sessions[count - 1].id)
    count -= 1
    dossier = build(count)
    serialized = JSON.stringify(dossier)
  }
  if (Buffer.byteLength(serialized, 'utf8') > config.curator.maxInputBytes) {
    throw new Error('curator input is too large even after dropping older sessions')
  }
  return { dossier, included: sources.slice(0, count), omitted }
}

function injectionEstimate(ctx, project, notes, brief, route, sourceCount, config) {
  const notesTokens = estimateTextTokens(ctx, notes)
  const outputMax = config.curator.maxTokens
  if (brief.length > 0) {
    const { text } = buildInjectionText({
      root: project.root,
      notes,
      brief,
      modelLabel: route?.label ?? 'unassigned',
      sourceCount,
      createdAt: nowIso(),
      maxInjectBytes: config.maxInjectBytes,
    })
    return {
      injectTokens: estimateTextTokens(ctx, text),
      injectBytes: Buffer.byteLength(text, 'utf8'),
      outputMaxTokens: outputMax,
      notesTokens,
    }
  }
  return {
    injectTokens: notesTokens + outputMax + 80,
    injectBytes: null,
    outputMaxTokens: outputMax,
    notesTokens,
  }
}

async function buildStatus(ctx, agent, config, options = {}) {
  const sessionId = agent?.session?.id
  if (sessionId === undefined) throw new Error('no live session')
  const { project, root, key, paths, record } = await readProject(ctx, agent, config, options.signal)
  const state = await loadState(paths)
  const notes = await readNotes(paths)
  const brief = await readBrief(paths)
  const scanned = await scanSources(ctx, project, sessionId, config, state, options.force === true)
  const route = resolveRoute(ctx, agent, record, config)
  const sources = scanned.sources
  const usable = sources.filter((entry) => brief.length === 0 || entry.digest.hasNewContent)
  const noNewContent = brief.length > 0 && usable.length === 0
  const modelSources = (noNewContent ? sources : usable).slice(0, config.maxSessions)
  const { dossier, included, omitted } = buildDossier(project, notes, brief, modelSources, config)
  const estimate = injectionEstimate(ctx, project, notes, brief, route, sources.length, config)
  const inputTokens = estimateTextTokens(ctx, JSON.stringify(dossier)) + 900
  const blank = isBlank(agent)
  const subagent = isSubagent(agent)
  const alreadyInjected = injectedSessions.has(sessionId) || hasMemoryMessage(agent)
  const pending = pendingInjections.has(sessionId)
  const existingToken = confirmations.get(sessionId)
  const token =
    existingToken !== undefined && existingToken.expiresAt > Date.now()
      ? existingToken.token
      : randomUUID()
  confirmations.set(sessionId, { token, expiresAt: Date.now() + CONFIRM_TTL_MS })

  let reason
  if (subagent) reason = 'subagent'
  else if (!blank) reason = 'not-blank'
  else if (alreadyInjected) reason = 'already-injected'
  else if (sources.length === 0) reason = 'no-other-content'
  else if (route === undefined) reason = 'no-model'

  const canInject = reason === undefined && !pending
  return {
    ok: true,
    version: VERSION,
    sessionId,
    canInject,
    reason: canInject ? null : reason ?? (pending ? 'pending' : null),
    blank,
    subagent,
    pending,
    alreadyInjected,
    noNewContent,
    project: {
      key,
      root: project.root,
      title: project.title,
      source: project.source,
      memoryDir: paths.dir,
    },
    sources: sources.map(sourceView),
    sourceCount: sources.length,
    usableSourceCount: usable.length,
    omittedSessions: omitted.length,
    model: route === undefined ? null : { ...route },
    curatorOverride: record.curator,
    estimate: {
      inputTokens,
      outputMaxTokens: estimate.outputMaxTokens,
      injectTokens: estimate.injectTokens,
      injectBytes: estimate.injectBytes,
      notesTokens: estimate.notesTokens,
      method: 'heuristic',
    },
    hasBrief: brief.length > 0,
    briefPreview: brief.length > 0 ? clip(brief, 5000) : '',
    notes: clip(notes, config.maxNotesBytes),
    lastInject: {
      at: record.lastInjectAt,
      model: record.lastInjectModel,
      usage: record.lastInjectUsage,
      inputTokens: record.lastInjectInputTokens,
      outputTokens: record.lastInjectOutputTokens,
    },
    paths: { state: paths.state, brief: paths.brief, notes: paths.notes, dir: paths.dir },
    confirmToken: token,
    generatedAt: nowIso(),
  }
}

async function runInjection(ctx, agent, config, token, signal) {
  const sessionId = agent?.session?.id
  if (sessionId === undefined) throw new Error('no live session')
  if (isSubagent(agent)) throw new Error('subagent sessions do not inject memory')
  if (!isBlank(agent)) throw new Error('this conversation already has a message')
  if (injectedSessions.has(sessionId) || hasMemoryMessage(agent)) throw new Error('memory has already been injected into this conversation')
  if (inflight.has(sessionId)) throw new Error('memory injection is already running')

  const confirmation = confirmations.get(sessionId)
  if (confirmation === undefined || confirmation.token !== token || confirmation.expiresAt < Date.now()) {
    throw new Error('confirmation expired; refresh and confirm again')
  }

  const { project, root, key, paths, record } = await readProject(ctx, agent, config, signal)
  const route = resolveRoute(ctx, agent, record, config)
  if (route === undefined) throw new Error('no curator model route is available')

  const job = (async () => {
    const state = await loadState(paths)
    const notes = await readNotes(paths)
    const brief = await readBrief(paths)
    const scanned = await scanSources(ctx, project, sessionId, config, state, true)
    if (scanned.sources.length === 0) throw new Error('no other conversation with content in this project')
    const usable = scanned.sources.filter((entry) => brief.length === 0 || entry.digest.hasNewContent)
    const modelSources = (usable.length > 0 ? usable : scanned.sources).slice(0, config.maxSessions)
    const { dossier, included, omitted } = buildDossier(project, notes, brief, modelSources, config)
    const result = await callCurator(ctx, route, dossier, config, signal)
    const createdAt = nowIso()
    const notesSnapshot = clip(notes, config.maxNotesBytes)
    const injection = buildInjectionText({
      root: project.root,
      notes: notesSnapshot,
      brief: result.brief,
      modelLabel: route.label,
      sourceCount: scanned.sources.length,
      createdAt,
      maxInjectBytes: config.maxInjectBytes,
    })

    await withProjectLock(key, async () => {
      await writeBrief(paths, result.brief)
      for (const entry of included) {
        state.briefCovers[entry.digest.id] = entry.digest.lastSeq
        state.sessions[entry.digest.id] = {
          lastSeq: entry.digest.lastSeq,
          title: entry.digest.title ?? entry.digest.id,
          updatedAt: entry.digest.updatedAt,
        }
      }
      state.briefDigest = hashShort(result.brief)
      state.lastInject = {
        at: createdAt,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }
      delete state.pending[sessionId]
      await saveState(paths, state)
      await updateProjectRecord(root, key, (current) => ({
        ...current,
        root: project.root,
        title: project.title,
        lastInjectAt: createdAt,
        lastInjectModel: result.model,
        lastInjectUsage: result.usage ?? null,
        lastInjectInputTokens: result.inputTokens,
        lastInjectOutputTokens: result.outputTokens,
      }))
    })

    const canStillInject = isBlank(agent) || waitingSteps.has(sessionId)
    if (!canStillInject) {
      confirmations.delete(sessionId)
      return {
        ok: true,
        sessionId,
        pending: false,
        saved: true,
        message: 'The brief was saved, but this conversation already started; open a new conversation to inject it.',
        sourceCount: scanned.sources.length,
        omittedSessions: omitted.length,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        injectTokens: estimateTextTokens(ctx, injection.text),
        briefPreview: clip(result.brief, 2000),
        createdAt,
      }
    }
    pendingInjections.set(sessionId, {
      text: injection.text,
      createdAt,
      model: result.model,
      sourceCount: scanned.sources.length,
      omitted: omitted.length,
      source: {
        workspaceKey: key,
        briefDigest: hashShort(result.brief),
        model: result.model,
        createdAt,
      },
    })
    confirmations.delete(sessionId)
    return {
      ok: true,
      sessionId,
      pending: true,
      saved: true,
      sourceCount: scanned.sources.length,
      omittedSessions: omitted.length,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      injectTokens: estimateTextTokens(ctx, injection.text),
      briefPreview: clip(result.brief, 2000),
      createdAt,
    }
  })()

  inflight.set(sessionId, job)
  try {
    return await job
  } finally {
    if (inflight.get(sessionId) === job) inflight.delete(sessionId)
  }
}

function parseArgs(rawInput) {
  const text = String(rawInput ?? '').trim()
  if (text.length === 0) return []
  return text.split(/\s+/u)
}

function decodeBase64(text) {
  const normalized = String(text ?? '').replace(/\s+/gu, '')
  if (normalized.length === 0 || normalized.length % 4 !== 0) throw new Error('invalid base64 payload')
  const value = Buffer.from(normalized, 'base64')
  return value.toString('utf8')
}

function jsonResult(value) {
  return { kind: 'success', text: `${JSON.stringify(value)}\n` }
}

async function commandHandler(ctx, config, invocation) {
  const args = parseArgs(invocation.rawInput)
  const command = args[0] ?? 'status'
  const sessionId = invocation.agent?.session?.id

  try {
    if (command === 'inject-status') {
      const status = await buildStatus(ctx, invocation.agent, config, { signal: invocation.signal })
      return jsonResult(status)
    }
    if (command === 'status') {
      const status = await buildStatus(ctx, invocation.agent, config, { signal: invocation.signal })
      if (args.includes('--json')) return jsonResult(status)
      const lines = [
        `Workspace memory: ${status.project.title}`,
        `Root: ${status.project.root}`,
        `Blank conversation: ${status.blank ? 'yes' : 'no'}`,
        `Other conversations with content: ${status.sourceCount}`,
        `Memory brief: ${status.hasBrief ? `${status.briefPreview.split('\n').length} lines` : 'none'}`,
        `Curator model: ${status.model?.label ?? 'unavailable'}`,
        `Estimate: input ~${status.estimate.inputTokens} tokens, output <= ${status.estimate.outputMaxTokens}, injection ~${status.estimate.injectTokens}`,
        `Can inject: ${status.canInject ? 'yes' : `no (${status.reason})`}`,
        `Storage: ${status.project.memoryDir}`,
      ]
      return { kind: 'success', text: `${lines.join('\n')}\n` }
    }
    if (command === 'inject') {
      if (!args.includes('--confirm')) {
        return { kind: 'error', text: 'Use the Inject memory button in a new conversation, or /memory inject --confirm <token> after fetching inject-status.' }
      }
      const tokenIndex = args.indexOf('--confirm')
      const token = args[tokenIndex + 1]
      if (token === undefined) return { kind: 'error', text: 'missing confirmation token' }
      const result = await runInjection(ctx, invocation.agent, config, token, invocation.signal)
      return jsonResult(result)
    }
    if (command === 'notes') {
      if (args[1] === 'set') {
        const encoded = args.slice(2).join(' ')
        const text = encoded.length === 0 ? '' : decodeBase64(encoded)
        if (Buffer.byteLength(text, 'utf8') > config.maxNotesBytes) {
          return { kind: 'error', text: `notes exceed ${config.maxNotesBytes} bytes` }
        }
        const { paths } = await readProject(ctx, invocation.agent, config, invocation.signal)
        await writeNotes(paths, text)
        return { kind: 'success', text: 'Notes saved.\n' }
      }
      const { paths } = await readProject(ctx, invocation.agent, config, invocation.signal)
      const notes = await readNotes(paths)
      return { kind: 'success', text: notes.length > 0 ? notes : '(no notes)\n' }
    }
    if (command === 'curator') {
      const action = args[1]
      const { project, root, key, record } = await readProject(ctx, invocation.agent, config, invocation.signal)
      if (action === 'list') {
        let providers = []
        try {
          providers = ctx.get('llm')?.listProviders?.() ?? []
        } catch {
          providers = []
        }
        return jsonResult({
          project: record.curator,
          effective: resolveRoute(ctx, invocation.agent, record, config) ?? null,
          providers,
        })
      }
      if (action === 'set') {
        const provider = args[2]
        const model = args[3]
        if (!provider || !model) return { kind: 'error', text: 'Usage: /memory curator set <provider> <model>' }
        let providers = []
        try {
          providers = ctx.get('llm')?.listProviders?.() ?? []
        } catch {
          providers = []
        }
        if (Array.isArray(providers) && providers.length > 0) {
          const ids = new Set(providers.map((entry) => (typeof entry === 'string' ? entry : entry?.id)))
          if (!ids.has(provider)) {
            return { kind: 'error', text: `Unknown provider "${provider}". Use /memory curator list to see available providers.` }
          }
        }
        await updateProjectRecord(root, key, (current) => ({
          ...current,
          root: project.root,
          title: project.title,
          curator: { provider, model },
        }))
        return { kind: 'success', text: `Curator route set to ${provider}/${model} for this project.\n` }
      }
      if (action === 'clear') {
        await updateProjectRecord(root, key, (current) => ({
          ...current,
          root: project.root,
          title: project.title,
          curator: { provider: '', model: '' },
        }))
        return { kind: 'success', text: 'Project curator override cleared.\n' }
      }
      return { kind: 'error', text: 'Usage: /memory curator list|set <provider> <model>|clear' }
    }
    if (command === 'reset') {
      if (!args.includes('--confirm')) return { kind: 'error', text: 'Add --confirm to reset this project\'s memory.' }
      const { root, key, paths } = await readProject(ctx, invocation.agent, config, invocation.signal)
      await withProjectLock(key, async () => {
        await resetProject(paths)
        await updateProjectRecord(root, key, (current) => ({
          ...current,
          lastInjectAt: null,
          lastInjectModel: null,
          lastInjectUsage: null,
          lastInjectInputTokens: null,
          lastInjectOutputTokens: null,
        }))
      })
      pendingInjections.delete(sessionId)
      injectedSessions.delete(sessionId)
      confirmations.delete(sessionId)
      digestCache.clear()
      return { kind: 'success', text: 'Project memory reset.\n' }
    }
    if (command === 'path') {
      const { paths } = await readProject(ctx, invocation.agent, config, invocation.signal)
      return { kind: 'success', text: `${paths.dir}\n` }
    }
    return {
      kind: 'error',
      text: `Usage: /memory [status|inject-status|inject --confirm <token>|notes [set <base64>]|curator list|set <provider> <model>|clear|reset --confirm|path]`,
    }
  } catch (error) {
    ctx.logger?.warn?.(`workspace-memory: command failed: ${safeError(error)}`)
    return { kind: 'error', text: safeError(error) }
  }
}

function injectCommand(ctx, config) {
  return {
    name: 'memory',
    description: 'Project memory: inject a curated handoff from earlier conversations in this project.',
    input: { hint: '[status|inject-status|inject --confirm <token>|notes|curator|reset|path]' },
    recordInput: false,
    handler: (invocation) => commandHandler(ctx, config, invocation),
  }
}

/** Wait for a curation job without letting a wedged model call block a turn forever. */
function waitForJob(job, signal, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener?.('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, timeoutMs)
    if (signal?.aborted) {
      finish()
      return
    }
    signal?.addEventListener?.('abort', finish, { once: true })
    Promise.resolve(job).then(finish, finish)
  })
}

/**
 * Host half of the workspace-memory bundle.
 *
 * The only model call in this file is reachable through the `/memory inject`
 * command, which requires a confirmation token issued by `inject-status`.
 * `agent/pre-step` never calls `ctx.llm`; it only inserts an already-generated
 * brief after the first claimed user message.
 */
export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  ctx.logger?.info?.(`workspace-memory ${VERSION}: ready`)

  ctx.effect(() => ctx.commands.register(injectCommand(ctx, config)), 'workspace-memory.commands')

  ctx.on('agent/pre-step', async (payload, next) => {
    const decision = await next()
    const agent = payload?.agent
    const sessionId = agent?.session?.id
    if (sessionId === undefined) return decision
    if (inflight.has(sessionId)) {
      waitingSteps.add(sessionId)
      await waitForJob(inflight.get(sessionId), payload?.signal, config.curator.timeoutMs + 5000)
      waitingSteps.delete(sessionId)
    }
    const pending = pendingInjections.get(sessionId)
    if (pending === undefined) return decision
    if (decision.kind !== 'enter') return decision
    if (injectedSessions.has(sessionId)) {
      pendingInjections.delete(sessionId)
      return decision
    }
    if (payload?.step !== 1) {
      pendingInjections.delete(sessionId)
      return decision
    }
    if (decision.messages.some(isMemoryMessage)) {
      pendingInjections.delete(sessionId)
      return decision
    }
    const memory = createMemoryMessage(pending.text, pending.source)
    const lastClaimed = decision.messages.findLastIndex((message) => payload.messages?.includes(message))
    const at = lastClaimed >= 0 ? lastClaimed + 1 : decision.messages.length
    const entered = decision.messages.toSpliced(at, 0, memory)
    injectedSessions.add(sessionId)
    pendingInjections.delete(sessionId)
    return { ...decision, messages: entered }
  })

  ctx.on('agent/disposed', ({ agent }) => {
    const sessionId = agent?.session?.id
    if (sessionId === undefined) return
    pendingInjections.delete(sessionId)
    confirmations.delete(sessionId)
    inflight.delete(sessionId)
    waitingSteps.delete(sessionId)
    injectedSessions.delete(sessionId)
    digestCache.delete(sessionId)
  })

  ctx.effect(() => () => {
    pendingInjections.clear()
    confirmations.clear()
    inflight.clear()
    waitingSteps.clear()
    injectedSessions.clear()
    digestCache.clear()
  }, 'workspace-memory.lifecycle')
}

export const name = 'workspace-memory'
export const inject = ['commands']
