import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../index.js'

const BRIEF = '## Goal\ncontinue the login migration\n## Decisions\nuse the existing form\n## Current state\nlogin.ts updated; tests pending\n## Next steps\nrun tests\n## Key files\nsrc/login.ts\n## Open questions\n(none)'

test('status is local, one confirmed inject calls the model once and pre-step inserts the brief', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wm-test-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = path.join(root, 'dsh-home')

  try {
    let command
    let preStep
    let llmCalls = 0
    const currentId = 'session-current'
    const previousId = 'session-previous'

    const current = {
      id: currentId,
      header: { id: currentId, cwd: root, createdAt: 2 },
      deriveMessages: () => [],
      requestHeader: () => ({ config: { provider: 'test-provider', model: 'test-model' } }),
    }
    const agent = { id: currentId, session: current }

    const previousEvents = [
      {
        seq: 1,
        time: 1,
        type: 'user/message',
        data: {
          role: 'user',
          source: { kind: 'user' },
          content: [{ type: 'text', text: 'please build the login page' }],
        },
      },
      {
        seq: 2,
        time: 2,
        type: 'assistant/message',
        data: { message: { content: [{ type: 'text', text: 'implemented src/login.ts' }] } },
      },
      { seq: 3, time: 3, type: 'tool/call', data: { name: 'write', arguments: '{"file_path":"src/login.ts"}' } },
    ]

    const llm = {
      listProviders: () => [{ id: 'test-provider', name: 'Test' }],
      stream: async function* (options) {
        llmCalls += 1
        assert.equal(options.provider, 'test-provider')
        assert.equal(options.model, 'test-model')
        yield { type: 'text-delta', text: BRIEF }
        yield { type: 'usage', usage: { inputTokens: 120, outputTokens: 90 } }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    }

    const sessionQuery = {
      listSessions: async () => [
        { header: current.header, live: true, persisted: false },
        { header: { id: previousId, cwd: root, createdAt: 1 }, live: false, persisted: true },
      ],
      readSession: async (id) =>
        id === previousId
          ? { session: { id: previousId, cwd: root, createdAt: 1 }, events: previousEvents }
          : { session: current.header, events: [] },
      readTitle: async (id) => (id === previousId ? { title: 'Login work' } : undefined),
    }

    const ctx = {
      logger: { info() {}, warn() {} },
      commands: {
        register(definition) {
          command = definition
          return () => {}
        },
      },
      effect(fn) {
        return fn()
      },
      on(event, handler) {
        if (event === 'agent/pre-step') preStep = handler
        return () => {}
      },
      get(name) {
        if (name === 'sessionQuery') return sessionQuery
        if (name === 'llm') return llm
        if (name === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'test-provider', model: 'test-model' }) }
        if (name === 'workspaceRegistry') {
          return {
            resolveByPath: async () => undefined,
            list: () => [{ path: root, title: 'Test project' }],
          }
        }
        if (name === 'tokenMeter') {
          return { estimateMessage: (message) => Math.ceil(JSON.stringify(message).length / 4) }
        }
        return undefined
      },
      workingDirectory: { ensure: async () => root },
    }

    apply(ctx, { memoryRoot: path.join(root, 'memory'), maxInjectBytes: 8192, maxBriefBytes: 6144 })
    assert.ok(command, 'command registered')
    assert.ok(preStep, 'pre-step registered')

    const invocation = (rawInput) => ({
      commandId: 'c1',
      agent,
      rawInput,
      attachments: [],
      signal: new AbortController().signal,
    })

    const statusResult = await command.handler(invocation('inject-status --json'))
    assert.equal(statusResult.kind, 'success')
    const status = JSON.parse(statusResult.text)
    assert.equal(status.canInject, true)
    assert.equal(status.sourceCount, 1)
    assert.equal(llmCalls, 0, 'status must not call the model')
    assert.ok(status.confirmToken)

    const injected = await command.handler(
      invocation(`inject --confirm ${status.confirmToken}`),
    )
    assert.equal(injected.kind, 'success')
    assert.equal(llmCalls, 1, 'exactly one model call per confirmed inject')
    const injectedJson = JSON.parse(injected.text)
    assert.equal(injectedJson.ok, true)
    assert.equal(injectedJson.sourceCount, 1)

    const userMessage = {
      id: 'user-1',
      role: 'user',
      source: { kind: 'user' },
      content: [{ type: 'text', text: 'continue' }],
    }
    const decision = { kind: 'enter', messages: [userMessage] }
    const next = async () => decision
    const entered = await preStep({ agent, messages: [userMessage], step: 1, turn: 1, signal: new AbortController().signal }, next)
    assert.equal(entered.kind, 'enter')
    assert.equal(entered.messages.length, 2)
    const memory = entered.messages[1]
    assert.equal(memory.source.kind, 'workspace-memory')
    assert.match(memory.content[0].text, /workspace-memory/)
    assert.match(memory.content[0].text, /login migration/)
    assert.equal(llmCalls, 1, 'injection itself must not call the model')

    const after = await command.handler(invocation('inject-status --json'))
    const afterStatus = JSON.parse(after.text)
    assert.equal(afterStatus.canInject, false)
    assert.equal(afterStatus.alreadyInjected, true)
    assert.equal(llmCalls, 1)

    const reset = await command.handler(invocation('reset --confirm'))
    assert.equal(reset.kind, 'success')
    assert.equal(llmCalls, 1, 'reset must not call the model')
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    await rm(root, { recursive: true, force: true })
  }
})
