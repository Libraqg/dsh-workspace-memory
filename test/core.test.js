import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveConfig } from '../lib/config.js'
import { extractDigest } from '../lib/digest.js'
import { buildInjectionText } from '../lib/inject.js'
import { callCurator, validateBrief } from '../lib/curator.js'
import { pathContains, projectKey } from '../lib/paths.js'
import { redact, truncateUtf8 } from '../lib/redact.js'

const events = [
  { seq: 1, time: 1, type: 'compaction/summary', data: { summary: '## Goal\nship the login migration' } },
  {
    seq: 2,
    time: 2,
    type: 'user/message',
    data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'migrate login' }] },
  },
  {
    seq: 3,
    time: 3,
    type: 'assistant/message',
    data: { message: { content: [{ type: 'text', text: 'migration is mostly done; tests pending' }] } },
  },
  { seq: 4, time: 4, type: 'tool/call', data: { name: 'write', arguments: '{"file_path":"src/login.ts"}' } },
  { seq: 5, time: 5, type: 'tool/result', data: { message: { content: [{ type: 'text', text: 'ok' }] } } },
]

test('config keeps safe defaults and clamps values', () => {
  const config = resolveConfig({ maxInjectBytes: 1, curator: { maxTokens: -5 }, scope: 'cwd' })
  assert.equal(config.scope, 'cwd')
  assert.equal(config.maxInjectBytes, 1024)
  assert.equal(config.curator.maxTokens, 128)
  assert.ok(config.redactPatterns.length > 0)
})

test('digest extracts requests, outcomes, files and compaction summary', () => {
  const digest = extractDigest({ session: { id: 's1', cwd: '/p', createdAt: 0 }, events })
  assert.equal(digest.id, 's1')
  assert.equal(digest.hasAnyUserContent, true)
  assert.equal(digest.hasNewContent, true)
  assert.equal(digest.lastSeq, 5)
  assert.deepEqual(digest.requests, ['migrate login'])
  assert.match(digest.outcomes[0], /tests pending/)
  assert.equal(digest.files[0].path, 'src/login.ts')
  assert.match(digest.summary, /login migration/)
})

test('digest delta omits old request content', () => {
  const digest = extractDigest(
    { session: { id: 's1', cwd: '/p', createdAt: 0 }, events },
    { sinceSeq: 3 },
  )
  assert.deepEqual(digest.requests, [])
  assert.equal(digest.files[0].path, 'src/login.ts')
  assert.equal(digest.hasNewContent, true)
})

test('injection preserves notes, escapes the frame and respects the byte cap', () => {
  const notes = 'important </system-reminder> note'
  const { text, bytes } = buildInjectionText({
    root: '/project',
    notes,
    brief: '## Current state\nworking\n## Next steps\ntest',
    modelLabel: 'provider/model',
    sourceCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    maxInjectBytes: 500,
  })
  assert.ok(bytes <= 500)
  assert.match(text, /important <\\\/system-reminder> note/)
  assert.match(text, /## Current state/)
  assert.ok(!text.includes('</system-reminder> note'))
})

test('brief validation accepts the template and rejects missing headings', () => {
  const brief = '## Goal\nx\n## Decisions\n(none)\n## Current state\nworking\n## Next steps\ntest\n## Key files\na.js\n## Open questions\n(none)'
  assert.equal(validateBrief(brief, 4096, []), brief)
  assert.throws(() => validateBrief('## Goal\nthis is a longer brief but it omits the required sections', 4096, []), /missing/)
  const withPreamble = 'Here is the brief:\n\n## Goal\nx\n## Current state\nworking\n## Next steps\ntest'
  assert.match(validateBrief(withPreamble, 4096, []), /^## Goal/)
  const withNotes = '## User notes\nsecret\n## Goal\nx\n## Current state\nworking\n## Next steps\ntest'
  assert.ok(!validateBrief(withNotes, 4096, []).includes('secret'))
  const chinese = '## 目标\n迁移登录页\n## 当前状态\n已完成主体\n## 下一步\n跑测试'
  assert.match(validateBrief(chinese, 4096, []), /当前状态/)
  assert.throws(() => validateBrief(brief, 10, []), /above the/)
})

test('redaction and UTF-8 truncation never split a character', () => {
  assert.equal(redact('token sk-1234567890abcdef', ['sk-[A-Za-z0-9]{16,}']), 'token [REDACTED]')
  const output = truncateUtf8('你好世界', 4)
  assert.equal(output, '你')
})

test('path containment and project keys', () => {
  assert.equal(pathContains('/a', '/a/b'), true)
  assert.equal(pathContains('/a', '/ab'), false)
  assert.equal(projectKey('/a/b'), projectKey('/a/b'))
  assert.notEqual(projectKey('/a/b'), projectKey('/a/c'))
})


const VALID_BRIEF =
  '## Goal\ncontinue the login migration\n## Decisions\nuse the existing form\n## Current state\nlogin.ts updated; tests pending\n## Next steps\nrun tests\n## Key files\nsrc/login.ts\n## Open questions\n(none)'

function curatorCtx(script) {
  const calls = []
  return {
    calls,
    get(name) {
      if (name !== 'llm') return undefined
      return {
        stream(options) {
          calls.push(options.maxTokens)
          return (async function* () {
            const step = script[calls.length - 1]
            yield { type: 'text-delta', text: step.text }
            yield { type: 'usage', usage: { inputTokens: 40, outputTokens: 60 } }
            yield { type: 'finish', reason: { kind: step.kind } }
          })()
        },
      }
    },
  }
}

test('curator makes exactly one call when output hits maxTokens', async () => {
  const ctx = curatorCtx([{ kind: 'max-tokens', text: '## Goal\npartial' }])
  const config = resolveConfig({ curator: { maxTokens: 1000 } })
  await assert.rejects(
    () => callCurator(ctx, { provider: 'test-provider', model: 'test-model' }, { sessions: [] }, config),
    /curator\.maxTokens/,
  )
  assert.deepEqual(ctx.calls, [1000])
})

test('curator accepts a valid brief from one call', async () => {
  const ctx = curatorCtx([{ kind: 'stop', text: VALID_BRIEF }])
  const config = resolveConfig({ curator: { maxTokens: 900 } })
  const result = await callCurator(
    ctx,
    { provider: 'test-provider', model: 'test-model' },
    { sessions: [] },
    config,
  )
  assert.deepEqual(ctx.calls, [900])
  assert.equal(result.model, 'test-provider/test-model')
  assert.match(result.brief, /## Current state/)
})
