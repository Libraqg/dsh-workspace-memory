import assert from 'node:assert/strict'
import test from 'node:test'

test('client bundle registers hero, sidebar and main entries', async () => {
  let loaded
  globalThis.window = {
    __ModuleLoader__: {
      load(definition) {
        loaded = definition
      },
    },
  }

  await import(`${new URL('../client.js', import.meta.url).href}?test=1`)
  assert.ok(loaded, 'module loader received the bundle')
  assert.equal(loaded.id, 'dsh-workspace-memory')

  const React = {
    createElement() {
      return null
    },
    Fragment: 'fragment',
    useState() {
      return [undefined, () => {}]
    },
    useEffect() {},
    useRef() {
      return { current: null }
    },
  }
  const registrations = []
  const ctx = {
    slots: {
      inject(name, callback) {
        callback()
        return () => {}
      },
      register(options, component) {
        registrations.push({ options, component })
        return () => {}
      },
    },
    remote: {},
    locale: { getLocale: () => ({ id: 'zh' }) },
  }

  const app = loaded.factory((name) => {
    if (name === 'react') return React
    throw new Error(`unexpected require: ${name}`)
  })
  app.apply(ctx)

  const names = registrations.map((entry) => entry.options.name)
  assert.deepEqual(names.sort(), [
    'conversation.hero.options',
    'conversation.input.overlay',
    'main',
    'sidebar.panellist',
  ])
  const main = registrations.find((entry) => entry.options.name === 'main')
  assert.equal(main.options.key, 'workspace-memory')
  const sidebar = registrations.find((entry) => entry.options.name === 'sidebar.panellist')
  assert.equal(sidebar.options.id, 'workspace-memory')
  const hero = registrations.find((entry) => entry.options.name === 'conversation.hero.options')
  assert.equal(hero.options.id, 'workspace-memory-inject')
  const composerPill = registrations.find((entry) => entry.options.name === 'conversation.input.overlay')
  assert.equal(composerPill.options.id, 'workspace-memory-inject-composer')

  assert.equal(hero.options.label(), '注入记忆')
  assert.equal(sidebar.options.label(), '记忆')

  ctx.locale.getLocale = () => ({ id: 'en' })
  assert.equal(hero.options.label(), 'Inject memory')
  assert.equal(sidebar.options.label(), 'Memory')
})
