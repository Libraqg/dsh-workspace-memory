import { redact, truncateUtf8 } from './redact.js'

const REQUEST_LIMIT = 4
const OUTCOME_LIMIT = 4
const FILE_LIMIT = 20
const ERROR_LIMIT = 5
const SUMMARY_LIMIT = 6000

function contentText(content) {
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') parts.push(block.text)
  }
  return parts.join('\n').trim()
}

function directUserText(event) {
  if (event?.type !== 'user/message') return undefined
  const message = event.data
  if (message?.source?.kind !== 'user') return undefined
  const text = contentText(message.content)
  return text.length > 0 ? text : undefined
}

function assistantText(event) {
  if (event?.type !== 'assistant/message') return undefined
  const text = contentText(event.data?.message?.content)
  return text.length > 0 ? text : undefined
}

function parseArguments(value) {
  if (typeof value !== 'string' || value.length === 0) return undefined
  try {
    const parsed = JSON.parse(value)
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

function toolFile(event) {
  if (event?.type !== 'tool/call') return undefined
  const parsed = parseArguments(event.data?.arguments)
  if (parsed === undefined) return undefined
  const candidate =
    typeof parsed.file_path === 'string'
      ? parsed.file_path
      : typeof parsed.path === 'string'
        ? parsed.path
        : typeof parsed.notebook_path === 'string'
          ? parsed.notebook_path
          : undefined
  if (candidate === undefined || candidate.trim().length === 0) return undefined
  return {
    tool: typeof event.data.name === 'string' ? event.data.name : 'tool',
    path: candidate.trim(),
    detail:
      typeof parsed.command === 'string' && parsed.command.trim().length > 0
        ? truncateUtf8(parsed.command.trim(), 200)
        : undefined,
  }
}

function toolError(event) {
  if (event?.type !== 'tool/result') return undefined
  const data = event.data
  const error = data?.error
  if (error === undefined && data?.message?.isError !== true) return undefined
  const text = contentText(data?.message?.content)
  const label =
    error !== null && typeof error === 'object'
      ? [error.name, error.code, error.reason].filter((part) => typeof part === 'string' && part.length > 0).join(' ')
      : ''
  return truncateUtf8([label, text].filter(Boolean).join(': '), 300) || 'tool failed'
}

function latestCompactionSummary(events) {
  let latest
  for (const event of events) {
    if (event?.type !== 'compaction/summary') continue
    const summary = event.data?.summary
    if (typeof summary === 'string' && summary.trim().length > 0) latest = event
  }
  return latest
}

/**
 * Extract a bounded, structured handoff from one session log.
 *
 * @param {{session: object, events: readonly object[]}} snapshot readSession result.
 * @param {{sinceSeq?: number, maxTurns?: number, maxEvents?: number, patterns?: readonly string[]}} options
 */
export function extractDigest(snapshot, options = {}) {
  const header = snapshot?.session ?? {}
  const events = Array.isArray(snapshot?.events) ? snapshot.events : []
  const sinceSeq = Number.isSafeInteger(options.sinceSeq) ? options.sinceSeq : undefined
  const maxTurns = Math.max(1, Math.trunc(options.maxTurns ?? REQUEST_LIMIT))
  const maxEvents = Math.max(1, Math.trunc(options.maxEvents ?? 800))
  const patterns = options.patterns ?? []

  const summaryEvent = latestCompactionSummary(events)
  const summarySeq = summaryEvent?.seq
  const summary =
    summaryEvent !== undefined
      ? truncateUtf8(redact(summaryEvent.data.summary, patterns), SUMMARY_LIMIT)
      : undefined

  let window = sinceSeq === undefined ? events : events.filter((event) => event.seq > sinceSeq)
  if (window.length > maxEvents) window = window.slice(-maxEvents)

  const requests = []
  const outcomes = []
  const files = []
  const fileKeys = new Set()
  const errors = []
  let hasAnyUserContent = false
  let hasNewContent = false
  let turns = 0
  let lastTime = header.createdAt ?? 0
  let lastSeq = 0

  for (const event of events) {
    if (typeof event?.seq === 'number' && event.seq > lastSeq) lastSeq = event.seq
    if (typeof event?.time === 'number' && event.time > lastTime) lastTime = event.time
    if (directUserText(event) !== undefined) hasAnyUserContent = true
  }

  for (const event of window) {
    if (typeof event?.time === 'number' && event.time > lastTime) lastTime = event.time
    if (event?.type === 'turn/start') turns += 1
    const request = directUserText(event)
    if (request !== undefined) {
      hasNewContent = true
      requests.push(redact(truncateUtf8(request, 700), patterns))
    }
    const outcome = assistantText(event)
    if (outcome !== undefined) {
      hasNewContent = true
      outcomes.push(redact(truncateUtf8(outcome, 900), patterns))
    }
    const file = toolFile(event)
    if (file !== undefined) {
      hasNewContent = true
      const key = `${file.tool}:${file.path}`
      if (!fileKeys.has(key)) {
        fileKeys.add(key)
        files.push({
          tool: file.tool,
          path: redact(truncateUtf8(file.path, 300), patterns),
          ...(file.detail === undefined ? {} : { detail: redact(file.detail, patterns) }),
        })
      }
    }
    const error = toolError(event)
    if (error !== undefined) {
      hasNewContent = true
      errors.push(redact(error, patterns))
    }
  }

  if (summarySeq !== undefined && (sinceSeq === undefined || summarySeq > sinceSeq)) {
    hasNewContent = true
  }

  return {
    id: header.id,
    cwd: typeof header.cwd === 'string' ? header.cwd : undefined,
    createdAt: header.createdAt,
    updatedAt: lastTime,
    lastSeq,
    hasAnyUserContent,
    hasNewContent,
    turns,
    summary,
    summarySeq,
    requests: requests.slice(-maxTurns),
    outcomes: outcomes.slice(-maxTurns),
    files: files.slice(-FILE_LIMIT),
    errors: errors.slice(-ERROR_LIMIT),
  }
}

export { SUMMARY_LIMIT, REQUEST_LIMIT, OUTCOME_LIMIT, FILE_LIMIT, ERROR_LIMIT }
