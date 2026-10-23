import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const PROJECT_INDEX_VERSION = 1
const PROJECT_STATE_VERSION = 1

/** In-process per-project serialization; one Host process owns one memory root. */
const projectQueues = new Map()

/** Run `fn` after every earlier operation for the same project key. */
export async function withProjectLock(key, fn) {
  const previous = projectQueues.get(key) ?? Promise.resolve()
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => gate)
  projectQueues.set(key, tail)
  try {
    await previous
    return await fn()
  } finally {
    release()
    if (projectQueues.get(key) === tail) projectQueues.delete(key)
  }
}

export function projectPaths(root, key) {
  const dir = path.join(root, key)
  return {
    dir,
    index: path.join(root, 'index.json'),
    state: path.join(dir, 'state.json'),
    brief: path.join(dir, 'brief.md'),
    notes: path.join(dir, 'notes.md'),
  }
}

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true })
}

async function atomicWrite(file, content) {
  await ensureDir(path.dirname(file))
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`
  await writeFile(temporary, content, 'utf8')
  await rename(temporary, file)
}

async function readText(file, fallback = '') {
  try {
    return await readFile(file, 'utf8')
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback
    throw error
  }
}

async function backupBroken(file) {
  try {
    await rename(file, `${file}.bak-${Date.now()}`)
  } catch {
    // best effort; the next write replaces it
  }
}

async function readJson(file, fallback) {
  try {
    const text = await readFile(file, 'utf8')
    if (text.trim().length === 0) return fallback
    const parsed = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' ? parsed : fallback
  } catch (error) {
    if (error && error.code === 'ENOENT') return fallback
    await backupBroken(file)
    return fallback
  }
}

async function writeJson(file, value) {
  await atomicWrite(file, `${JSON.stringify(value, null, 2)}\n`)
}

export function emptyProjectState() {
  return {
    version: PROJECT_STATE_VERSION,
    sessions: {},
    briefCovers: {},
    briefDigest: null,
    pending: {},
    lastInject: null,
  }
}

export function emptyIndex() {
  return { version: PROJECT_INDEX_VERSION, projects: {} }
}

export async function loadIndex(memoryRoot) {
  const index = await readJson(path.join(memoryRoot, 'index.json'), emptyIndex())
  if (index.version !== PROJECT_INDEX_VERSION || typeof index.projects !== 'object' || index.projects === null) {
    return emptyIndex()
  }
  return index
}

export async function saveIndex(memoryRoot, index) {
  await writeJson(path.join(memoryRoot, 'index.json'), index)
}

export async function getProjectRecord(memoryRoot, key, root, title) {
  const index = await loadIndex(memoryRoot)
  const current = index.projects[key] ?? {}
  return {
    root: typeof current.root === 'string' && current.root.length > 0 ? current.root : root,
    title: typeof current.title === 'string' && current.title.length > 0 ? current.title : title,
    curator: {
      provider: typeof current.curator?.provider === 'string' ? current.curator.provider : '',
      model: typeof current.curator?.model === 'string' ? current.curator.model : '',
    },
    lastInjectAt: typeof current.lastInjectAt === 'string' ? current.lastInjectAt : null,
    lastInjectModel: typeof current.lastInjectModel === 'string' ? current.lastInjectModel : null,
    lastInjectUsage: current.lastInjectUsage ?? null,
    lastInjectInputTokens: current.lastInjectInputTokens ?? null,
    lastInjectOutputTokens: current.lastInjectOutputTokens ?? null,
  }
}

export async function updateProjectRecord(memoryRoot, key, mutate) {
  const index = await loadIndex(memoryRoot)
  const current = index.projects[key] ?? { root: '', title: '' }
  index.projects[key] = mutate({ ...current })
  await saveIndex(memoryRoot, index)
  return index.projects[key]
}

export async function loadState(paths) {
  const state = await readJson(paths.state, emptyProjectState())
  if (state.version !== PROJECT_STATE_VERSION || typeof state !== 'object') {
    return emptyProjectState()
  }
  return {
    version: PROJECT_STATE_VERSION,
    sessions: state.sessions !== null && typeof state.sessions === 'object' ? state.sessions : {},
    briefCovers: state.briefCovers !== null && typeof state.briefCovers === 'object' ? state.briefCovers : {},
    briefDigest: typeof state.briefDigest === 'string' ? state.briefDigest : null,
    pending: state.pending !== null && typeof state.pending === 'object' ? state.pending : {},
    lastInject: state.lastInject ?? null,
  }
}

export async function saveState(paths, state) {
  await writeJson(paths.state, state)
}

export async function readNotes(paths) {
  return await readText(paths.notes, '')
}

export async function writeNotes(paths, text) {
  await atomicWrite(paths.notes, text)
}

export async function readBrief(paths) {
  return await readText(paths.brief, '')
}

export async function writeBrief(paths, text) {
  await atomicWrite(paths.brief, text)
}

export async function resetProject(paths) {
  await rm(paths.state, { force: true })
  await rm(paths.brief, { force: true })
}

/** Reset the in-memory queue table; used by tests and plugin unload. */
export function clearProjectQueues() {
  projectQueues.clear()
}
