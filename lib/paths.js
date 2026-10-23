import { createHash } from 'node:crypto'
import { access, realpath } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'

/** Process harness home, matching the Host's own DSH_HOME resolution. */
export function dshHome() {
  const configured = process.env.DSH_HOME
  return configured && configured.trim().length > 0 ? path.resolve(configured) : path.join(homedir(), '.dsh')
}

/** Resolve the configured memory root (empty means `$DSH_HOME/workspace-memory`). */
export function memoryRoot(config) {
  if (config.memoryRoot && config.memoryRoot.trim().length > 0) {
    return path.resolve(config.memoryRoot.trim())
  }
  return path.join(dshHome(), 'workspace-memory')
}

/** Canonical absolute path; falls back to `path.resolve` for missing paths. */
export async function canonicalPath(value) {
  const absolute = path.resolve(String(value))
  try {
    return await realpath(absolute)
  } catch {
    return absolute
  }
}

/** Whether `child` is `parent` or a descendant of it using platform path rules. */
export function pathContains(parent, child) {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

/** Stable short project key; the directory name never contains user path text. */
export function projectKey(root) {
  return createHash('sha256').update(root).digest('hex').slice(0, 16)
}

/** Read the canonical path out of a Workspace entity defensively. */
function workspacePath(workspace) {
  if (workspace === null || typeof workspace !== 'object') return undefined
  const candidates = [workspace.path, workspace.directory, workspace.record?.path]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.length > 0) return candidate
  }
  return undefined
}

/** Nearest ancestor containing a `.git` entry, or undefined. */
export async function findGitRoot(start) {
  let current = path.resolve(start)
  for (;;) {
    try {
      await access(path.join(current, '.git'))
      return current
    } catch {
      // keep walking
    }
    const parent = path.dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

/**
 * Resolve the project root for one agent.
 *
 * Order: exact registered workspace, longest registered ancestor, nearest git
 * root, then the current directory. `scope: 'cwd'` skips project grouping.
 *
 * @returns {{root: string, title: string, source: 'workspace'|'git'|'cwd'}}
 */
export async function resolveProjectRoot(ctx, agent, config, signal) {
  let cwd
  try {
    const workingDirectory = ctx.get('workingDirectory')
    if (workingDirectory?.ensure !== undefined) {
      cwd = await workingDirectory.ensure(agent, signal)
    }
  } catch {
    cwd = undefined
  }
  if (typeof cwd !== 'string' || cwd.length === 0) {
    cwd = agent?.session?.header?.cwd
  }
  if (typeof cwd !== 'string' || cwd.length === 0) cwd = process.cwd()
  const canonical = await canonicalPath(cwd)

  if (config.scope === 'cwd') {
    return { root: canonical, title: path.basename(canonical) || canonical, source: 'cwd' }
  }

  const registry = ctx.get('workspaceRegistry')
  if (registry !== undefined) {
    try {
      const exact = await registry.resolveByPath?.(canonical)
      const exactPath = workspacePath(exact)
      if (exactPath !== undefined) {
        return {
          root: await canonicalPath(exactPath),
          title: typeof exact?.title === 'string' && exact.title.length > 0 ? exact.title : path.basename(exactPath),
          source: 'workspace',
        }
      }
    } catch {
      // unowned directory or registry unavailable; fall through
    }
    try {
      const list = typeof registry.list === 'function' ? registry.list() : []
      const candidates = []
      for (const workspace of list) {
        const candidate = workspacePath(workspace)
        if (candidate === undefined) continue
        const canonicalCandidate = await canonicalPath(candidate)
        if (pathContains(canonicalCandidate, canonical)) {
          candidates.push({ root: canonicalCandidate, title: workspace.title })
        }
      }
      candidates.sort((left, right) => right.root.length - left.root.length)
      if (candidates.length > 0) {
        const winner = candidates[0]
        return {
          root: winner.root,
          title: typeof winner.title === 'string' && winner.title.length > 0 ? winner.title : path.basename(winner.root),
          source: 'workspace',
        }
      }
    } catch {
      // fall through to git/cwd
    }
  }

  try {
    const gitRoot = await findGitRoot(canonical)
    if (gitRoot !== undefined) {
      return { root: gitRoot, title: path.basename(gitRoot) || gitRoot, source: 'git' }
    }
  } catch {
    // fall through
  }

  return { root: canonical, title: path.basename(canonical) || canonical, source: 'cwd' }
}
