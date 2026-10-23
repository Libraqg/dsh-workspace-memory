/**
 * Configuration normalization for the workspace-memory bundle.
 *
 * The bundle deliberately has no Config schema: it is installed from a local
 * directory and must not depend on DSH packages. Every value is validated here
 * and the normalized shape is the only shape the rest of the plugin sees.
 */

const DEFAULTS = {
  scope: 'project',
  memoryRoot: '',
  maxInjectBytes: 8192,
  maxBriefBytes: 6144,
  maxNotesBytes: 2048,
  maxSessions: 5,
  maxTurnsPerSession: 4,
  maxEventsPerSession: 800,
  includeSubagents: false,
  curator: {
    provider: '',
    model: '',
    maxTokens: 2000,
    temperature: 0.2,
    timeoutMs: 90000,
    maxInputBytes: 16384,
  },
  redactPatterns: ['sk-[A-Za-z0-9]{16,}', 'Bearer\\s+[A-Za-z0-9._-]+'],
}

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function string(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback
}

function integer(value, fallback, min, max) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  const rounded = Math.trunc(n)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

function number(value, fallback, min, max) {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  if (n < min) return min
  if (n > max) return max
  return n
}

function boolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

function patterns(value) {
  if (!Array.isArray(value)) return [...DEFAULTS.redactPatterns]
  const result = value
    .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim())
  return result.length > 0 ? result : [...DEFAULTS.redactPatterns]
}

/**
 * @param {unknown} raw loader-provided config (unvalidated by the bundle).
 * @returns normalized config with safe numeric and string bounds.
 */
export function resolveConfig(raw) {
  const c = object(raw)
  const curator = object(c.curator)
  const sync = object(c.sync)
  const inject = object(c.inject)
  const backfill = object(c.backfill)

  return {
    scope: c.scope === 'cwd' ? 'cwd' : 'project',
    memoryRoot: string(c.memoryRoot),
    maxInjectBytes: integer(c.maxInjectBytes, DEFAULTS.maxInjectBytes, 1024, 131072),
    maxBriefBytes: integer(c.maxBriefBytes, DEFAULTS.maxBriefBytes, 512, 65536),
    maxNotesBytes: integer(c.maxNotesBytes, DEFAULTS.maxNotesBytes, 256, 65536),
    maxSessions: integer(
      inject.maxSessions ?? sync.maxSessions ?? c.maxSessions,
      DEFAULTS.maxSessions,
      1,
      30,
    ),
    maxTurnsPerSession: integer(
      inject.maxTurnsPerSession ?? c.maxTurnsPerSession,
      DEFAULTS.maxTurnsPerSession,
      1,
      50,
    ),
    maxEventsPerSession: integer(
      inject.maxEventsPerSession ?? c.maxEventsPerSession,
      DEFAULTS.maxEventsPerSession,
      50,
      20000,
    ),
    includeSubagents: boolean(c.includeSubagents, DEFAULTS.includeSubagents),
    curator: {
      provider: string(curator.provider),
      model: string(curator.model),
      maxTokens: integer(curator.maxTokens, DEFAULTS.curator.maxTokens, 128, 8192),
      temperature: number(curator.temperature, DEFAULTS.curator.temperature, 0, 2),
      timeoutMs: integer(curator.timeoutMs, DEFAULTS.curator.timeoutMs, 1000, 600000),
      maxInputBytes: integer(
        curator.maxInputBytes,
        DEFAULTS.curator.maxInputBytes,
        1024,
        262144,
      ),
    },
    backfill: {
      maxSessions: integer(backfill.maxSessions, 10, 1, 100),
      maxEventsPerSession: integer(backfill.maxEventsPerSession, 500, 50, 20000),
    },
    redactPatterns: patterns(c.redactPatterns),
  }
}

export { DEFAULTS }
