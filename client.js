window.__ModuleLoader__.load({
  id: '@libraqg/dsh-workspace-memory',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    let appCtx = null
    /** Last Session that owned the main conversation view; the memory panel outlives it. */
    let lastActiveSessionId
    /** Number of mounted Hero inject buttons; when zero, the overlay fallback takes over. */
    let heroMounts = 0
    const heroListeners = new Set()

    /** Persisted UI language override: 'zh', 'en', or null to follow the host locale. */
    const LANGUAGE_STORAGE_KEY = 'dsh-workspace-memory.language'
    const languageListeners = new Set()
    let languageOverride = readLanguageOverride()

    /** localStorage that may be missing or blocked; null when it cannot be used. */
    function languageStorage() {
      try {
        return typeof window === 'undefined' ? null : window.localStorage ?? null
      } catch {
        return null
      }
    }

    function readLanguageOverride() {
      try {
        const value = languageStorage()?.getItem(LANGUAGE_STORAGE_KEY)
        return value === 'zh' || value === 'en' ? value : null
      } catch {
        return null
      }
    }

    function hostLanguage() {
      const id = appCtx?.locale?.getLocale?.()?.id
      return id && String(id).toLowerCase().startsWith('zh') ? 'zh' : 'en'
    }

    function currentLanguage() {
      return languageOverride ?? hostLanguage()
    }

    function setLanguage(next) {
      languageOverride = next === 'zh' || next === 'en' ? next : null
      try {
        const storage = languageStorage()
        if (languageOverride === null) storage?.removeItem(LANGUAGE_STORAGE_KEY)
        else storage?.setItem(LANGUAGE_STORAGE_KEY, languageOverride)
      } catch {
        // Private modes and sandboxed frames may refuse storage; the in-memory choice still applies.
      }
      for (const listener of languageListeners) listener()
    }

    function useLanguage() {
      return React.useSyncExternalStore(
        (listener) => {
          languageListeners.add(listener)
          return () => languageListeners.delete(listener)
        },
        currentLanguage,
      )
    }

    function LanguageToggle() {
      const language = useLanguage()
      const strings = STRINGS[language]
      return h(
        'div',
        {
          role: 'group',
          'aria-label': strings.language,
          title: strings.language,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 7,
            overflow: 'hidden',
            flex: 'none',
          },
        },
        ['zh', 'en'].map((id) =>
          h(
            'button',
            {
              key: id,
              type: 'button',
              'aria-pressed': language === id,
              onClick: () => setLanguage(id),
              style: {
                appearance: 'none',
                border: 'none',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 12,
                lineHeight: 1.2,
                padding: '4px 9px',
                background: language === id ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
                color:
                  language === id
                    ? 'var(--dsw-alias-label-primary)'
                    : 'var(--dsw-alias-label-secondary)',
                fontWeight: language === id ? 600 : 400,
              },
            },
            id === 'zh' ? '中文' : 'EN',
          ),
        ),
      )
    }

    function notifyHeroMounts() {
      for (const listener of heroListeners) listener()
    }

    function useHeroMounted() {
      return React.useSyncExternalStore(
        (listener) => {
          heroListeners.add(listener)
          return () => heroListeners.delete(listener)
        },
        () => heroMounts > 0,
      )
    }

    function markHeroMounted(mounted) {
      heroMounts = Math.max(0, heroMounts + (mounted ? 1 : -1))
      notifyHeroMounts()
    }

    const STRINGS = {
      en: {
        nav: 'Memory',
        inject: 'Inject memory',
        injectTitle: 'Inject project memory',
        confirmTitle: 'Curate first, then inject',
        confirmBody:
          'The plugin will call the curator model once, then inject the curated brief after your first message.',
        sources: 'Earlier conversations',
        sourceLine: (n) => `${n} earlier conversation${n === 1 ? '' : 's'} in this project`,
        compressed: 'has a compaction summary',
        model: 'Curator model',
        input: 'Input (estimate)',
        output: 'Output limit',
        injection: 'Injection (estimate)',
        tokens: (n) => `~${Math.round(n).toLocaleString()} tokens`,
        privacy: 'The project summary will be sent to this model provider.',
        confirm: 'Curate and inject',
        cancel: 'Cancel',
        curating: 'Curating...',
        prepared: 'Curated. It will be injected with your first message.',
        retry: 'Try again',
        failed: 'Failed',
        noModel: 'No curator model is available.',
        noSources: 'No earlier conversation with content in this project.',
        noNew: 'No new content since the last brief; this still calls the model once.',
        notBlank: 'This conversation already has a message.',
        pending: 'Waiting for your first message.',
        tooltipTitle: 'Project memory',
        tooltipNoCall: 'Clicking opens a confirmation. No model is called until you confirm.',
        panelTitle: 'Workspace Memory',
        panelEmpty: 'Open a conversation in a project to view its memory.',
        loading: 'Loading...',
        refresh: 'Refresh',
        brief: 'Current brief',
        noBrief: 'No brief has been generated for this project yet.',
        notes: 'Your notes',
        notesHint: 'Notes are inserted verbatim; the curator model never rewrites them.',
        save: 'Save notes',
        saved: 'Saved',
        route: 'Curator route',
        provider: 'Provider',
        modelId: 'Model',
        saveRoute: 'Save route',
        clearRoute: 'Use current conversation model',
        reset: 'Reset project memory',
        resetConfirm: 'Delete the saved brief and cache for this project? Your notes are kept.',
        confirmReset: 'Confirm reset',
        path: 'Storage path',
        copy: 'Copy',
        copied: 'Copied',
        last: 'Last injection',
        none: 'None',
        noSession: 'No active conversation.',
        onlyUser: 'The model is called only from Inject memory in a new conversation, after you confirm.',
        statusFailed: 'Memory status check failed',
        checking: 'Checking project memory…',
        memoryShort: 'Memory…',
        briefSavedNoInject:
          'The brief was saved, but this conversation already started; open a new conversation to inject it.',
        outputTokens: 'output tokens',
        maxTokensError:
          'The curator output hit its token limit before the brief was complete. Raise curator.maxTokens in the plugin config, then try again.',
        language: 'Language',
        routeSource: {
          project: 'project override',
          global: 'global config',
          session: 'current conversation model',
          default: 'default model',
        },
        routeLabel: (base, source) => `${base} (${source})`,
      },
      zh: {
        nav: '记忆',
        inject: '注入记忆',
        injectTitle: '注入项目记忆',
        confirmTitle: '先整理，再注入',
        confirmBody: '插件会先调用一次整理模型，再把整理后的 brief 在你发送第一条消息后注入当前对话。',
        sources: '较早的对话',
        sourceLine: (n) => `这个项目里有 ${n} 个较早的对话`,
        compressed: '有压缩摘要',
        model: '整理模型',
        input: '输入估算',
        output: '输出上限',
        injection: '注入估算',
        tokens: (n) => `约 ${Math.round(n).toLocaleString()} tokens`,
        privacy: '项目摘要会发送给该模型提供方。',
        confirm: '整理并注入',
        cancel: '取消',
        curating: '正在整理…',
        prepared: '已整理，将在你发送第一条消息时注入。',
        retry: '重试',
        failed: '失败',
        noModel: '没有可用的整理模型。',
        noSources: '这个项目里还没有其他有内容的对话。',
        noNew: '自上次 brief 以来没有新内容；这次仍会调用 1 次模型。',
        notBlank: '当前对话已经有消息了。',
        pending: '等待你发送第一条消息。',
        tooltipTitle: '项目记忆',
        tooltipNoCall: '点击后会先弹确认；确认之前不会调用模型。',
        panelTitle: '工作区记忆',
        panelEmpty: '打开一个项目对话后查看该项目的记忆。',
        loading: '加载中…',
        refresh: '刷新',
        brief: '当前简报',
        noBrief: '这个项目还没有生成 brief。',
        notes: '你的笔记',
        notesHint: '笔记会原样插入，整理模型不会改写。',
        save: '保存笔记',
        saved: '已保存',
        route: '整理路由',
        provider: 'Provider',
        modelId: '模型',
        saveRoute: '保存路由',
        clearRoute: '使用当前对话模型',
        reset: '重置项目记忆',
        resetConfirm: '删除这个项目已保存的 brief 和缓存？笔记会保留。',
        confirmReset: '确认重置',
        path: '存储路径',
        copy: '复制',
        copied: '已复制',
        last: '上次注入',
        none: '无',
        noSession: '没有活跃对话。',
        onlyUser: '整理模型只会在新对话点击“注入记忆”并确认后调用。',
        statusFailed: '记忆状态检查失败',
        checking: '正在检查项目记忆…',
        memoryShort: '记忆…',
        briefSavedNoInject: '记忆已保存，但当前对话已经开始；请新开一个对话再注入。',
        outputTokens: '输出 tokens',
        maxTokensError:
          '整理模型输出达到 token 上限，内容还没写完。请在插件配置里调高 curator.maxTokens 后重试。',
        language: '语言',
        routeSource: {
          project: '项目覆盖',
          global: '全局配置',
          session: '当前对话模型',
          default: '默认模型',
        },
        routeLabel: (base, source) => `${base}（${source}）`,
      },
    }

    function t() {
      return STRINGS[currentLanguage()]
    }

    async function runCommand(sessionId, line) {
      if (sessionId === undefined) throw new Error('no session')
      const result = await appCtx.remote.commands.execute(sessionId, line, [])
      if (!result || result.ok !== true) {
        const message = result?.error?.message ?? 'command failed'
        throw new Error(message)
      }
      const value = result.value
      if (value === undefined) throw new Error('command not found')
      if (value.result?.kind === 'error') throw new Error(value.result.text || 'command failed')
      return value.result?.text ?? ''
    }

    async function readStatus(sessionId, line) {
      const text = await runCommand(sessionId, line)
      return JSON.parse(text)
    }

    /** Short-lived, UI-only cache so the Hero, composer pill and panel share one status read. */
    const STATUS_TTL_MS = 30_000
    const statusCache = new Map()

    async function requestStatus(sessionId, line, kind, force = false) {
      if (sessionId === undefined) throw new Error('no session')
      const key = `${sessionId}:${kind}`
      const now = Date.now()
      const cached = statusCache.get(key)
      if (!force && cached !== undefined) {
        if (cached.value !== undefined && now - cached.at < STATUS_TTL_MS) return cached.value
        if (cached.promise !== undefined) return cached.promise
      }
      const promise = readStatus(sessionId, line)
        .then((value) => {
          statusCache.set(key, { at: Date.now(), value })
          return value
        })
        .catch((error) => {
          const current = statusCache.get(key)
          if (current?.promise === promise) statusCache.delete(key)
          throw error
        })
      statusCache.set(key, { at: now, promise })
      return promise
    }

    function formatNumber(value) {
      const number = Number(value)
      return Number.isFinite(number) ? number.toLocaleString() : '?'
    }

    /** Render a curator route in the active UI language instead of the host's Chinese label. */
    function formatModel(strings, model) {
      if (!model) return strings.noModel
      const base = `${model.provider ?? '?'}/${model.model ?? '?'}`
      const source = strings.routeSource?.[model.source]
      return source ? strings.routeLabel(base, source) : base
    }

    function Icon(props) {
      const size = props.size ?? 16
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          style: { display: 'block', flex: 'none' },
        },
        h('path', { d: 'M6 3h9a3 3 0 0 1 3 3v15l-6-3.5L6 21V3z' }),
        h('path', { d: 'M9 8h6M9 12h4' }),
      )
    }

    function rowStyle() {
      return {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '6px 0',
        borderBottom: '1px solid var(--dsw-alias-border-l1)',
        fontSize: 13,
      }
    }

    function buttonStyle(primary) {
      return {
        appearance: 'none',
        border: primary ? '1px solid var(--dsw-alias-brand-primary)' : '1px solid var(--dsw-alias-border-l2)',
        background: primary ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-bg-layer-1)',
        color: primary
          ? 'var(--dsw-alias-label-primary-inverted)'
          : 'var(--dsw-alias-label-primary)',
        borderRadius: 7,
        padding: '6px 11px',
        font: 'inherit',
        fontSize: 13,
        cursor: 'pointer',
        lineHeight: 1.2,
      }
    }

    function InjectMemoryButton(props) {
      const strings = STRINGS[useLanguage()]
      const sessionId = props.sessionId
      const useSessions = props.useSessions
      const blank = useSessions ? useSessions((state) => state?.byId?.[sessionId]?.blank) : undefined
      const priorCount = useSessions
        ? useSessions((state) => {
            const current = state?.byId?.[sessionId]
            if (!current?.cwd) return 0
            return Object.values(state?.byId ?? {}).filter(
              (row) => row?.id !== sessionId && row?.cwd === current.cwd && row?.blank === false,
            ).length
          })
        : 0
      const [status, setStatus] = React.useState(null)
      const [checking, setChecking] = React.useState(false)
      const [busy, setBusy] = React.useState(false)
      const [prepared, setPrepared] = React.useState(false)
      const [dialog, setDialog] = React.useState(false)
      const [error, setError] = React.useState(null)
      const [fatalError, setFatalError] = React.useState(null)
      const [tip, setTip] = React.useState(null)
      const buttonRef = React.useRef(null)

      React.useEffect(() => {
        if (props.overlay) return undefined
        markHeroMounted(true)
        return () => markHeroMounted(false)
      }, [props.overlay])

      React.useEffect(() => {
        if (!dialog) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape' && !busy) setDialog(false)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [dialog, busy])

      const ensureStatus = async (force = false) => {
        setChecking(true)
        try {
          const next = await requestStatus(sessionId, '/memory inject-status --json', 'inject', force)
          setStatus(next)
          setPrepared(next.pending === true)
          setFatalError(null)
          return next
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause)
          console.warn('[workspace-memory] inject-status failed:', cause)
          setFatalError(message)
          return undefined
        } finally {
          setChecking(false)
        }
      }

      if (blank === false) return null
      if (fatalError) {
        return h(
          'button',
          {
            type: 'button',
            title: fatalError,
            onClick: () => window.alert(`${strings.statusFailed}:\n\n${fatalError}`),
            style: {
              ...buttonStyle(false),
              color: 'var(--dsw-alias-state-error-primary)',
              cursor: 'pointer',
              fontSize: 12,
              maxWidth: 360,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          },
          `${strings.statusFailed}: ${fatalError}`,
        )
      }
      if (!(priorCount > 0 || status?.canInject === true || status?.pending === true || prepared)) return null
      if (status?.alreadyInjected === true) return null

      const showTip = () => {
        const node = buttonRef.current
        if (!node) return
        const rect = node.getBoundingClientRect()
        setTip({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 340)), top: rect.bottom + 8 })
        if (!checking) void ensureStatus(false)
      }

      const reasonText = (reason) => {
        if (reason === 'no-other-content') return strings.noSources
        if (reason === 'not-blank') return strings.notBlank
        if (reason === 'no-model') return strings.noModel
        if (reason === 'already-injected') return strings.pending
        return reason ?? strings.statusFailed
      }

      const openDialog = async () => {
        setError(null)
        setTip(null)
        const next = await ensureStatus(false)
        if (next === undefined) return
        if (next.canInject !== true && next.pending !== true) {
          setFatalError(reasonText(next.reason))
          return
        }
        setDialog(true)
      }

      const confirm = async () => {
        setBusy(true)
        setError(null)
        try {
          const result = JSON.parse(
            await runCommand(sessionId, `/memory inject --confirm ${status.confirmToken}`),
          )
          if (result.ok !== true) throw new Error(result.error ?? 'injection failed')
          if (result.pending === false) {
            setError(result.message ?? strings.briefSavedNoInject)
            setPrepared(false)
            setStatus((current) => (current === null ? current : { ...current, pending: false, model: null }))
            return
          }
          setPrepared(true)
          setDialog(false)
          setStatus((current) => (current === null ? current : { ...current, pending: true }))
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause)
          setError(/maxTokens|max-tokens|cut off/i.test(message) ? strings.maxTokensError : message)
        } finally {
          setBusy(false)
        }
      }

      const tooltip = tip
        ? h(
            'div',
            {
              role: 'tooltip',
              style: {
                position: 'fixed',
                left: tip.left,
                top: tip.top,
                width: 320,
                maxWidth: 'calc(100vw - 16px)',
                zIndex: 2000,
                padding: '10px 12px',
                borderRadius: 9,
                border: '1px solid var(--dsw-alias-border-l2)',
                background: 'var(--dsw-alias-bg-overlay)',
                color: 'var(--dsw-alias-label-primary)',
                boxShadow: '0 8px 26px rgba(0,0,0,.18)',
                fontSize: 12,
                lineHeight: 1.45,
                pointerEvents: 'none',
              },
            },
            h('div', { style: { fontWeight: 600, marginBottom: 4 } }, strings.tooltipTitle),
            status
              ? h(
                  React.Fragment,
                  null,
                  h('div', null, strings.sourceLine(status.sourceCount)),
                  h('div', null, `${strings.model}: ${formatModel(strings, status.model)}`),
                  h(
                    'div',
                    null,
                    `${strings.injection}: ${formatNumber(status.estimate.injectTokens)} tokens`,
                  ),
                  h('div', { style: { marginTop: 4, opacity: 0.8 } }, strings.tooltipNoCall),
                )
              : h('div', { style: { opacity: 0.8 } }, checking ? strings.checking : strings.tooltipNoCall),
          )
        : null

      const pending = status?.pending === true || prepared
      const buttonLabel = pending ? strings.pending : strings.inject
      const button = h(
        'button',
        {
          ref: buttonRef,
          type: 'button',
          disabled: busy || pending,
          onClick: openDialog,
          onMouseEnter: showTip,
          onMouseLeave: () => setTip(null),
          onFocus: showTip,
          onBlur: () => setTip(null),
          style: {
            ...buttonStyle(false),
            ...(props.composer === true
              ? {
                  background: 'var(--dsw-alias-bg-overlay)',
                  borderRadius: 999,
                  padding: '3px 10px',
                  fontSize: 12,
                  boxShadow: '0 4px 14px rgba(0,0,0,.16)',
                }
              : {}),
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            color: pending ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-primary)',
            cursor: busy || pending ? 'default' : 'pointer',
          },
          'aria-label': strings.inject,
        },
        h(Icon, { size: 15 }),
        h('span', null, buttonLabel),
      )

      const dialogNode = dialog
        ? h(
            'div',
            {
              role: 'presentation',
              onMouseDown: (event) => {
                if (event.target === event.currentTarget && !busy) setDialog(false)
              },
              style: {
                position: 'fixed',
                inset: 0,
                zIndex: 10050,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,.42)',
                padding: 16,
              },
            },
            h(
              'div',
              {
                role: 'dialog',
                'aria-modal': true,
                'aria-label': strings.confirmTitle,
                style: {
                  width: 540,
                  maxWidth: 'calc(100vw - 32px)',
                  maxHeight: 'calc(100vh - 32px)',
                  overflow: 'auto',
                  borderRadius: 13,
                  border: '1px solid var(--dsw-alias-border-l2)',
                  background: 'var(--dsw-alias-bg-overlay)',
                  color: 'var(--dsw-alias-label-primary)',
                  boxShadow: '0 24px 64px rgba(0,0,0,.28)',
                  padding: 20,
                },
              },
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 6,
                  },
                },
                h('div', { style: { fontSize: 16, fontWeight: 650 } }, strings.confirmTitle),
                h(LanguageToggle),
              ),
              h('div', { style: { fontSize: 13, opacity: 0.82, marginBottom: 14 } }, strings.confirmBody),
              h(
                'div',
                { style: { fontSize: 13, marginBottom: 10 } },
                h('strong', null, strings.sources),
                h(
                  'ul',
                  { style: { margin: '6px 0 0', paddingLeft: 18 } },
                  status.sources.slice(0, 6).map((source) =>
                    h(
                      'li',
                      { key: source.id, style: { marginBottom: 3 } },
                      source.title || source.id,
                      source.hasCompactionSummary ? ` · ${strings.compressed}` : '',
                    ),
                  ),
                ),
                status.sourceCount > 6
                  ? h('div', { style: { opacity: 0.7, marginTop: 4 } }, `+${status.sourceCount - 6}`)
                  : null,
              ),
              h(
                'div',
                { style: { ...rowStyle(), borderTop: '1px solid var(--dsw-alias-border-l1)' } },
                h('span', null, strings.model),
                h('span', { style: { fontWeight: 600 } }, formatModel(strings, status.model)),
              ),
              h(
                'div',
                { style: rowStyle() },
                h('span', null, strings.input),
                h('span', null, strings.tokens(status.estimate.inputTokens)),
              ),
              h(
                'div',
                { style: rowStyle() },
                h('span', null, strings.output),
                h('span', null, strings.tokens(status.estimate.outputMaxTokens)),
              ),
              h(
                'div',
                { style: rowStyle() },
                h('span', null, strings.injection),
                h('span', null, strings.tokens(status.estimate.injectTokens)),
              ),
              status.noNewContent
                ? h(
                    'div',
                    { style: { marginTop: 10, color: 'var(--dsw-alias-state-warn-primary)', fontSize: 12 } },
                    strings.noNew,
                  )
                : null,
              h(
                'div',
                { style: { marginTop: 12, color: 'var(--dsw-alias-state-warn-primary)', fontSize: 12 } },
                strings.privacy,
              ),
              error
                ? h(
                    'div',
                    {
                      role: 'alert',
                      style: {
                        marginTop: 12,
                        padding: '8px 10px',
                        borderRadius: 7,
                        background: 'var(--dsw-alias-bg-layer-2)',
                        color: 'var(--dsw-alias-state-error-primary)',
                        fontSize: 12,
                        wordBreak: 'break-word',
                      },
                    },
                    `${strings.failed}: ${error}`,
                  )
                : null,
              h(
                'div',
                { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 } },
                h(
                  'button',
                  {
                    type: 'button',
                    disabled: busy,
                    onClick: () => setDialog(false),
                    style: buttonStyle(false),
                  },
                  strings.cancel,
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    disabled: busy || status.model === null,
                    onClick: confirm,
                    style: buttonStyle(true),
                  },
                  busy ? strings.curating : error ? strings.retry : strings.confirm,
                ),
              ),
            ),
          )
        : null

      return h(React.Fragment, null, button, tooltip, dialogNode)
    }

    /**
     * Status pill anchored to the composer card's top-right corner. The slot is
     * rendered inside the input card, so the pill stays with the composer instead
     * of floating over the message list, and it only speaks for the session on
     * screen: a memory prepared in another blank conversation no longer shows up
     * here. While the Hero composer is mounted its own option row already carries
     * the button, so this copy stays out of the way.
     */
    function ComposerInject(props) {
      const heroMounted = useHeroMounted()
      const panel = props.usePanelInfo?.((info) => info.activePanelId)
      const sessionId = props.sessionId
      if (heroMounted || panel != null || sessionId === undefined) return null
      return h(
        'div',
        {
          style: {
            position: 'absolute',
            top: -14,
            right: 12,
            zIndex: 4,
            display: 'flex',
            alignItems: 'center',
            pointerEvents: 'auto',
          },
        },
        h(InjectMemoryButton, {
          sessionId,
          useSessions: props.useSessions,
          overlay: true,
          composer: true,
        }),
      )
    }

    function MemoryIcon(props) {
      const active = props.useSessions((state) => {
        const rows = Object.values(state?.byId ?? {})
        return rows.find((row) => (row?.retainedBy?.mainView ?? 0) > 0)?.id
      })
      if (active !== undefined) lastActiveSessionId = active
      const size = props?.size ?? 16
      return h(Icon, { size })
    }

    function MemoryPanel(props) {
      const strings = STRINGS[useLanguage()]
      const useSessions = props.useSessions
      const liveSessionId = useSessions
        ? useSessions((state) => {
            const rows = Object.values(state?.byId ?? {})
            return rows.find((row) => (row?.retainedBy?.mainView ?? 0) > 0)?.id
          })
        : undefined
      const sessionId = liveSessionId ?? lastActiveSessionId
      const [status, setStatus] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [notes, setNotes] = React.useState('')
      const [saved, setSaved] = React.useState(false)
      const [provider, setProvider] = React.useState('')
      const [model, setModel] = React.useState('')
      const [routeSaved, setRouteSaved] = React.useState(false)
      const [resetOpen, setResetOpen] = React.useState(false)
      const [copied, setCopied] = React.useState(false)
      const [loading, setLoading] = React.useState(false)

      const refresh = async (force = false) => {
        if (sessionId === undefined) return
        setLoading(true)
        setError(null)
        try {
          const next = await requestStatus(sessionId, '/memory status --json', 'panel', force === true)
          setStatus(next)
          setNotes(next.notes ?? '')
          setProvider(next.curatorOverride?.provider ?? '')
          setModel(next.curatorOverride?.model ?? '')
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setLoading(false)
        }
      }

      React.useEffect(() => {
        refresh()
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [sessionId])

      if (sessionId === undefined) {
        return h(
          'div',
          { style: { padding: 32, color: 'var(--dsw-alias-label-secondary)', fontSize: 14 } },
          strings.panelEmpty,
        )
      }

      const saveNotes = async () => {
        setSaved(false)
        try {
          const bytes = new TextEncoder().encode(notes)
          let binary = ''
          for (const byte of bytes) binary += String.fromCharCode(byte)
          await runCommand(sessionId, `/memory notes set ${btoa(binary)}`)
          statusCache.clear()
          setSaved(true)
          setError(null)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }

      const saveRoute = async () => {
        setRouteSaved(false)
        try {
          if (provider.trim().length === 0 || model.trim().length === 0) {
            await runCommand(sessionId, '/memory curator clear')
          } else {
            await runCommand(sessionId, `/memory curator set ${provider.trim()} ${model.trim()}`)
          }
          statusCache.clear()
          setRouteSaved(true)
          setError(null)
          await refresh(true)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }

      const reset = async () => {
        try {
          await runCommand(sessionId, '/memory reset --confirm')
          statusCache.clear()
          setResetOpen(false)
          await refresh(true)
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
      }

      const copyPath = async () => {
        try {
          await navigator.clipboard.writeText(status?.project?.memoryDir ?? '')
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {
          setError('clipboard unavailable')
        }
      }

      const card = (children, extra) =>
        h(
          'section',
          {
            style: {
              border: '1px solid var(--dsw-alias-border-l1)',
              background: 'var(--dsw-alias-bg-layer-1)',
              borderRadius: 10,
              padding: 14,
              marginBottom: 12,
              ...extra,
            },
          },
          children,
        )

      return h(
        'div',
        {
          style: {
            height: '100%',
            overflow: 'auto',
            padding: '48px 28px 40px',
            color: 'var(--dsw-alias-label-primary)',
            background: 'var(--dsw-alias-bg-base)',
          },
        },
        h(
          'div',
          { style: { maxWidth: 820, margin: '0 auto' } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 } },
            h('h1', { style: { fontSize: 20, margin: 0 } }, strings.panelTitle),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 8, flex: 'none' } },
              h(LanguageToggle),
              h(
                'button',
                { type: 'button', onClick: () => refresh(true), disabled: loading, style: buttonStyle(false) },
                loading ? strings.loading : strings.refresh,
              ),
            ),
          ),
          status
            ? h(
                'div',
                { style: { marginTop: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
                `${status.project.title} · ${status.project.root}`,
              )
            : null,
          h(
            'div',
            {
              style: {
                marginTop: 10,
                marginBottom: 14,
                fontSize: 12,
                color: 'var(--dsw-alias-state-warn-primary)',
              },
            },
            strings.onlyUser,
          ),
          error
            ? h(
                'div',
                {
                  role: 'alert',
                  style: {
                    marginBottom: 12,
                    padding: '8px 10px',
                    borderRadius: 7,
                    background: 'var(--dsw-alias-bg-layer-2)',
                    color: 'var(--dsw-alias-state-error-primary)',
                    fontSize: 12,
                  },
                },
                error,
              )
            : null,
          status
            ? h(
                React.Fragment,
                null,
                card(
                  h(
                    React.Fragment,
                    null,
                    h('div', { style: { fontWeight: 650, marginBottom: 8 } }, strings.brief),
                    status.hasBrief
                      ? h(
                          'pre',
                          {
                            style: {
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              margin: 0,
                              maxHeight: 260,
                              overflow: 'auto',
                              fontSize: 12,
                              lineHeight: 1.5,
                              color: 'var(--dsw-alias-label-primary)',
                            },
                          },
                          status.briefPreview || '',
                        )
                      : h(
                          'div',
                          { style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } },
                          strings.noBrief,
                        ),
                  ),
                ),
                card(
                  h(
                    React.Fragment,
                    null,
                    h('div', { style: { fontWeight: 650, marginBottom: 6 } }, strings.notes),
                    h(
                      'div',
                      { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginBottom: 8 } },
                      strings.notesHint,
                    ),
                    h('textarea', {
                      value: notes,
                      onChange: (event) => {
                        setNotes(event.target.value)
                        setSaved(false)
                      },
                      rows: 7,
                      style: {
                        width: '100%',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        borderRadius: 8,
                        border: '1px solid var(--dsw-alias-border-l2)',
                        background: 'var(--dsw-alias-bg-layer-2)',
                        color: 'var(--dsw-alias-label-primary)',
                        padding: 10,
                        font: 'inherit',
                        fontSize: 13,
                        lineHeight: 1.5,
                      },
                    }),
                    h(
                      'div',
                      { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 } },
                      h('button', { type: 'button', onClick: saveNotes, style: buttonStyle(true) }, strings.save),
                      saved
                        ? h(
                            'span',
                            { style: { fontSize: 12, color: 'var(--dsw-alias-state-success-primary)' } },
                            strings.saved,
                          )
                        : null,
                    ),
                  ),
                ),
                card(
                  h(
                    React.Fragment,
                    null,
                    h('div', { style: { fontWeight: 650, marginBottom: 8 } }, strings.route),
                    h(
                      'div',
                      { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)', marginBottom: 8 } },
                      `${strings.model}: ${formatModel(strings, status.model)}`,
                    ),
                    h(
                      'div',
                      { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                      h('input', {
                        value: provider,
                        onChange: (event) => {
                          setProvider(event.target.value)
                          setRouteSaved(false)
                        },
                        placeholder: strings.provider,
                        style: {
                          flex: '1 1 180px',
                          minWidth: 140,
                          padding: '7px 9px',
                          borderRadius: 7,
                          border: '1px solid var(--dsw-alias-border-l2)',
                          background: 'var(--dsw-alias-bg-layer-2)',
                          color: 'var(--dsw-alias-label-primary)',
                          font: 'inherit',
                          fontSize: 13,
                        },
                      }),
                      h('input', {
                        value: model,
                        onChange: (event) => {
                          setModel(event.target.value)
                          setRouteSaved(false)
                        },
                        placeholder: strings.modelId,
                        style: {
                          flex: '1 1 220px',
                          minWidth: 160,
                          padding: '7px 9px',
                          borderRadius: 7,
                          border: '1px solid var(--dsw-alias-border-l2)',
                          background: 'var(--dsw-alias-bg-layer-2)',
                          color: 'var(--dsw-alias-label-primary)',
                          font: 'inherit',
                          fontSize: 13,
                        },
                      }),
                    ),
                    h(
                      'div',
                      { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 } },
                      h('button', { type: 'button', onClick: saveRoute, style: buttonStyle(false) }, strings.saveRoute),
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: () => {
                            setProvider('')
                            setModel('')
                            setRouteSaved(false)
                          },
                          style: buttonStyle(false),
                        },
                        strings.clearRoute,
                      ),
                      routeSaved
                        ? h(
                            'span',
                            { style: { fontSize: 12, color: 'var(--dsw-alias-state-success-primary)' } },
                            strings.saved,
                          )
                        : null,
                    ),
                  ),
                ),
                card(
                  h(
                    React.Fragment,
                    null,
                    h(
                      'div',
                      { style: { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' } },
                      h(
                        'div',
                        null,
                        h('div', { style: { fontWeight: 650, marginBottom: 4 } }, strings.path),
                        h(
                          'div',
                          {
                            style: {
                              fontSize: 12,
                              color: 'var(--dsw-alias-label-secondary)',
                              wordBreak: 'break-all',
                            },
                          },
                          status.project.memoryDir,
                        ),
                      ),
                      h(
                        'button',
                        { type: 'button', onClick: copyPath, style: buttonStyle(false) },
                        copied ? strings.copied : strings.copy,
                      ),
                    ),
                    h(
                      'div',
                      { style: { marginTop: 10, fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
                      `${strings.last}: ${
                        status.lastInject?.at
                          ? `${status.lastInject.at} · ${status.lastInject.model ?? ''} · ${
                              status.lastInject.outputTokens ?? status.lastInject.usage?.outputTokens ?? '?'
                            } ${strings.outputTokens}`
                          : strings.none
                      }`,
                    ),
                    h(
                      'div',
                      { style: { marginTop: 12 } },
                      resetOpen
                        ? h(
                            React.Fragment,
                            null,
                            h(
                              'div',
                              { style: { fontSize: 12, color: 'var(--dsw-alias-state-warn-primary)', marginBottom: 8 } },
                              strings.resetConfirm,
                            ),
                            h(
                              'div',
                              { style: { display: 'flex', gap: 8 } },
                              h(
                                'button',
                                {
                                  type: 'button',
                                  onClick: reset,
                                  style: {
                                    ...buttonStyle(true),
                                    background: 'var(--dsw-alias-state-error-primary)',
                                    borderColor: 'var(--dsw-alias-state-error-primary)',
                                    color: '#fff',
                                  },
                                },
                                strings.confirmReset,
                              ),
                              h(
                                'button',
                                { type: 'button', onClick: () => setResetOpen(false), style: buttonStyle(false) },
                                strings.cancel,
                              ),
                            ),
                          )
                        : h(
                            'button',
                            {
                              type: 'button',
                              onClick: () => setResetOpen(true),
                              style: buttonStyle(false),
                            },
                            strings.reset,
                          ),
                    ),
                  ),
                ),
                status.sources.length > 0
                  ? card(
                      h(
                        React.Fragment,
                        null,
                        h('div', { style: { fontWeight: 650, marginBottom: 8 } }, strings.sources),
                        h(
                          'div',
                          { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
                          status.sources.map((source) =>
                            h(
                              'div',
                              { key: source.id, style: { padding: '4px 0', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
                              `${source.title || source.id}${
                                source.hasCompactionSummary ? ` · ${strings.compressed}` : ''
                              }`,
                            ),
                          ),
                        ),
                      ),
                    )
                  : null,
              )
            : h(
                'div',
                { style: { fontSize: 13, color: 'var(--dsw-alias-label-secondary)' } },
                loading ? strings.loading : strings.panelEmpty,
              ),
        ),
      )
    }

    return {
      inject: ['slots', 'remote', 'remote.commands', 'locale'],
      apply(ctx) {
        appCtx = ctx
        ctx.slots.inject('conversation.hero.options', () =>
          ctx.slots.register(
            {
              name: 'conversation.hero.options',
              id: 'workspace-memory-inject',
              order: 10,
              label: () => t().inject,
            },
            InjectMemoryButton,
          ),
        )
        ctx.slots.inject('conversation.input.overlay', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.overlay',
              id: 'workspace-memory-inject-composer',
              order: 40,
            },
            ComposerInject,
          ),
        )
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: 'workspace-memory',
              order: 20,
              label: () => t().nav,
            },
            MemoryIcon,
          ),
        )
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            {
              name: 'main',
              key: 'workspace-memory',
            },
            MemoryPanel,
          ),
        )
      },
    }
  },
})
