/**
 * dsh-claude-code-desktop-theme — Client half.
 *
 * Applies a Claude Code desktop style palette to the Harness Web GUI by
 * stacking one alias-token override layer over the active theme. The values
 * come from the requested theme spec:
 *
 *   surface  #f5f3ee   ink #1d1b16   accent #da7756
 *   contrast 60        opaque windows
 *   fonts: embedded "DSH Serif UI", code "SF Mono"
 *   semantic: diffAdded #00c853, diffRemoved #ff5f38, skill #cc7d5e
 *   code theme "Absolutely" (light and dark variants)
 *
 * Every literal color becomes a `--dsw-*` / `--shiki-*` / `--dsh-*` token so
 * the rest of the UI keeps inheriting a single coherent palette. The override
 * layer is owned by this plugin's effect: unloading or disabling the bundle
 * restores the built-in theme.
 */

window.__ModuleLoader__.load({
  id: 'dsh-claude-code-desktop-theme',
  factory(require) {
    const PLUGIN_ID = 'dsh-claude-code-desktop-theme'
    const React = require('react')

// ── M0-S4 runtime scheduler ─────────────────────────────────────────────
    // One body MutationObserver + one ticker replace the per-feature observers
    // and intervals this plugin used to create (01 audit: 10 body observers /
    // 12 setInterval). Features register named tasks instead:
    //
    //   runtimeOnMutation('status-dots', apply)   // run after DOM mutations
    //   runtimeEvery('hero-layout', apply, 800)   // coalesced into one ticker
    //
    // Everything pauses while the page is hidden, and `dispose()` (owned by the
    // plugin instance) tears the observer, ticker and tasks down so HMR /
    // disable leaves no residue.
    const RUNTIME_TICK_MS = 200
    // Attribute mutations are narrowed to host-owned state that features need to
    // observe. Plugin-owned attributes/styles are deliberately excluded so a
    // task's own writes cannot re-trigger the observer in a loop.
    const RUNTIME_ATTRIBUTE_FILTER = [
      'class',
      'aria-selected',
      'aria-expanded',
      'aria-haspopup',
      'data-content-phase',
      'data-row-key',
      'data-sidebar-collapsed',
      'data-rightbar-collapsed',
      'data-rightbar-fullscreen',
      'data-dockkit-pane-active',
      'data-dockkit-float-active',
      'data-sidebar-right-panel',
      'data-sidebar-right-open',
      'data-sidebar-right-tab',
      'data-ds-dark-theme',
    ]

    function createRuntimeScheduler() {
      const mutationTasks = new Map()
      const intervalTasks = new Map()
      let observer = null
      let frame = 0
      let ticker = 0
      let hidden = false
      let disposed = false

      const runMutationTasks = () => {
        frame = 0
        if (hidden || disposed) return
        for (const [name, task] of mutationTasks) {
          if (hidden || disposed) return
          try {
            task()
          } catch (error) {
            console.warn('[dsh-claude-code-desktop-theme] runtime task failed: ' + name, error)
          }
        }
      }
      const requestMutationRun = () => {
        if (frame !== 0 || hidden || disposed) return
        frame = window.requestAnimationFrame(runMutationTasks)
      }
      const runTick = () => {
        if (hidden || disposed) return
        const now = performance.now()
        for (const [name, task] of intervalTasks) {
          if (task.next > now) continue
          task.next = now + task.ms
          try {
            task.fn()
          } catch (error) {
            console.warn('[dsh-claude-code-desktop-theme] runtime interval failed: ' + name, error)
          }
        }
      }
      const startTicker = () => {
        if (ticker !== 0 || disposed) return
        ticker = window.setInterval(runTick, RUNTIME_TICK_MS)
      }
      const stopTicker = () => {
        if (ticker === 0) return
        window.clearInterval(ticker)
        ticker = 0
      }
      const onVisibilityChange = () => {
        hidden = document.visibilityState === 'hidden'
        if (hidden) {
          stopTicker()
          if (frame !== 0) {
            window.cancelAnimationFrame(frame)
            frame = 0
          }
        } else {
          startTicker()
          requestMutationRun()
        }
      }

      observer = new MutationObserver(requestMutationRun)
      const root = document.body ?? document.documentElement
      if (root !== null) {
        observer.observe(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: RUNTIME_ATTRIBUTE_FILTER,
        })
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
      startTicker()

      return {
        onMutation(name, task) {
          mutationTasks.set(name, task)
          requestMutationRun()
          return () => {
            mutationTasks.delete(name)
          }
        },
        every(name, task, ms) {
          intervalTasks.set(name, { fn: task, ms: Math.max(ms, RUNTIME_TICK_MS), next: 0 })
          return () => {
            intervalTasks.delete(name)
          }
        },
        report() {
          return {
            tickMs: RUNTIME_TICK_MS,
            mutationTasks: [...mutationTasks.keys()],
            intervalTasks: [...intervalTasks.entries()].map(([name, task]) => ({ name, ms: task.ms })),
            hidden,
          }
        },
        dispose() {
          if (disposed) return
          disposed = true
          try {
            observer.disconnect()
          } catch (error) {
            // Already disconnected by a stale instance.
          }
          stopTicker()
          if (frame !== 0) {
            window.cancelAnimationFrame(frame)
            frame = 0
          }
          document.removeEventListener('visibilitychange', onVisibilityChange)
          mutationTasks.clear()
          intervalTasks.clear()
        },
      }
    }

    // The active instance's scheduler. Assembly creates it before mounting and
    // disposes it with the instance; features stay safe if they mount first.
    let activeRuntime = null

    function runtimeOnMutation(name, task) {
      return activeRuntime === null ? () => {} : activeRuntime.onMutation(name, task)
    }

    function runtimeEvery(name, task, ms) {
      return activeRuntime === null ? () => {} : activeRuntime.every(name, task, ms)
    }    // ── Merged usage overview card (formerly the dsh-usage-overview plugin) ──
    // The card, its host route and its model-catalog resolution now ship with
    // the theme plugin; there is no separate usage bundle any more.
    const usageOverviewPlugin = (() => {

    const React = require('react')
    const h = React.createElement

    const SUMMARY_ROUTES = [
      '/api/dsh-claude-code-desktop-theme/usage-summary',
      // Legacy route kept for migration builds that still run the old plugin.
      '/api/dsh-usage-overview/summary',
    ]
    const RANGES = [
      { id: 'all', label: { zh: '全部', en: 'All' } },
      { id: '30d', label: { zh: '30 天', en: '30d' } },
      { id: '7d', label: { zh: '7 天', en: '7d' } },
    ]
    const WEEK_COUNT = 26

    const LANGUAGE = (() => {
      const values = []
      try {
        const lang = document.documentElement.getAttribute('lang')
        if (typeof lang === 'string' && lang !== '') values.push(lang)
      } catch {
        // documentless or restricted environment
      }
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') values.push(navigator.language)
      } catch {
        // navigator unavailable
      }
      return values.join(',').toLowerCase().includes('zh') ? 'zh' : 'en'
    })()

    const TEXT = {
      zh: {
        overview: '概览',
        models: '模型',
        sessions: '会话',
        messages: '消息',
        tokens: '总 token',
        activeDays: '活跃天数',
        currentStreak: '当前连续',
        longestStreak: '最长连续',
        peakHour: '高峰时段',
        favoriteModel: '常用模型',
        day: (value) => `${value}天`,
        hour: (value) => `${value}时`,
        loading: '统计中…',
        empty: '还没有用量记录',
        requests: (value) => `${value} 次请求`,
        footer: (ratio, book) => `已用掉约 ${ratio} 倍${book}的 token 量`,
        footerBelow: (tokens) => `已累计消耗 ${tokens} tokens，还没到一本书的量`,
        heatmap: '每日 token 用量热力图',
        heatmapCaption: '过去 52 周 · 每日 token',
      },
      en: {
        overview: 'Overview',
        models: 'Models',
        sessions: 'Sessions',
        messages: 'Messages',
        tokens: 'Total tokens',
        activeDays: 'Active days',
        currentStreak: 'Current streak',
        longestStreak: 'Longest streak',
        peakHour: 'Peak hour',
        favoriteModel: 'Favorite model',
        day: (value) => `${value}d`,
        hour: (value) => `${String(value).padStart(2, '0')}:00`,
        loading: 'Loading…',
        empty: 'No usage recorded yet',
        requests: (value) => `${value} requests`,
        footer: (ratio, book) => `You've used ~${ratio}× more tokens than ${book}.`,
        footerBelow: (tokens) => `${tokens} tokens so far — less than one book's worth.`,
        heatmap: 'Daily token usage heatmap',
        heatmapCaption: 'Last 52 weeks · daily tokens',
      },
    }[LANGUAGE]

    const numberFormat = new Intl.NumberFormat(LANGUAGE === 'zh' ? 'zh-CN' : 'en-US')

    /** Real model display names from the Host catalog: raw id → catalog name. */
    const modelDisplayNames = new Map()
    const catalogSubscribers = new Set()

    function subscribeCatalog(listener) {
      catalogSubscribers.add(listener)
      return () => catalogSubscribers.delete(listener)
    }

    function resolveModelName(raw) {
      if (typeof raw !== 'string' || raw === '') return raw
      return modelDisplayNames.get(raw) ?? raw
    }

    /** Compact token formatting (3.1M, 12.4K, 981). */
    function formatTokens(value) {
      const tokens = typeof value === 'number' && Number.isFinite(value) ? value : 0
      if (tokens >= 1_000_000_000) return `${(tokens / 1_000_000_000).toFixed(1)}B`
      if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
      if (tokens >= 10_000) return `${(tokens / 1_000).toFixed(1)}K`
      return numberFormat.format(Math.round(tokens))
    }

    /** Days since the epoch for a YYYY-MM-DD key, in UTC to ignore DST. */
    function dayNumber(key) {
      const [year, month, day] = key.split('-').map(Number)
      return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
    }

    /** One UTC epoch-day back to a calendar key. */
    function keyOfNumber(value) {
      const date = new Date(value * 86_400_000)
      const year = String(date.getUTCFullYear()).padStart(4, '0')
      const month = String(date.getUTCMonth() + 1).padStart(2, '0')
      const day = String(date.getUTCDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    /** Shared fetch with a short module-level cache so tab mounts stay cheap. */
    const loader = { at: 0, value: undefined, pending: undefined }
    function loadSummary() {
      const now = Date.now()
      if (loader.value !== undefined && now - loader.at < 20_000) return Promise.resolve(loader.value)
      if (loader.pending !== undefined) return loader.pending
      loader.pending = (async () => {
        for (const route of SUMMARY_ROUTES) {
          try {
            const response = await fetch(route, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: '{}',
            })
            if (response.ok) return await response.json()
          } catch {
            // Try the next route.
          }
        }
        return undefined
      })()
        .then((body) => {
          if (body === undefined || body.ok !== true || body.value === undefined) return undefined
          loader.value = body.value
          loader.at = Date.now()
          return body.value
        })
        .catch(() => undefined)
        .finally(() => {
          loader.pending = undefined
        })
      return loader.pending
    }

    /** Heatmap levels from a day's token count relative to the observed maximum. */
    function heatLevel(tokens, maximum) {
      if (tokens <= 0 || maximum <= 0) return 0
      const share = tokens / maximum
      if (share > 0.66) return 4
      if (share > 0.36) return 3
      if (share > 0.14) return 2
      return 1
    }

    /** One KPI tile; `variant` lets long values (favorite model) wrap instead of truncating. */
    function Tile({ label, value, variant }) {
      const tileClass = variant === undefined ? 'duo-tile' : 'duo-tile duo-tile--' + variant
      const valueClass = variant === undefined ? 'duo-tile-value' : 'duo-tile-value duo-tile-value--' + variant
      return h('div', { className: tileClass }, [
        h('div', { className: 'duo-tile-label', key: 'label' }, label),
        h('div', { className: valueClass, key: 'value', title: typeof value === 'string' ? value : undefined }, value),
      ])
    }

    /**
     * The 52-week heatmap, laid out Github-style: one column per calendar
     * week (Sunday first), one row per weekday. The first column may start
     * before the data window and the last one ends after today; those cells
     * stay blank so the weekday rows never shift.
     */
    function Heatmap({ days, todayKey }) {
      const today = dayNumber(todayKey)
      // 0 = Sunday. Align columns to calendar weeks so the rows are always Sun..Sat.
      const weekday = new Date(today * 86_400_000).getUTCDay()
      const firstWeekStart = today - weekday - (WEEK_COUNT - 1) * 7
      const maximum = Math.max(
        0,
        ...Object.entries(days ?? {}).map(([key, value]) => {
          const number = dayNumber(key)
          return number >= firstWeekStart && number <= today ? (value?.tokens ?? 0) : 0
        }),
      )
      const cells = []
      for (let week = 0; week < WEEK_COUNT; week += 1) {
        for (let row = 0; row < 7; row += 1) {
          const number = firstWeekStart + week * 7 + row
          if (number > today) {
            cells.push(h('span', { key: `blank-${week}-${row}`, className: 'duo-heat-cell duo-heat-blank' }))
            continue
          }
          const key = keyOfNumber(number)
          const day = days?.[key]
          const tokens = day?.tokens ?? 0
          const messages = day?.messages ?? 0
          cells.push(
            h('span', {
              key,
              className: 'duo-heat-cell',
              'data-level': heatLevel(tokens, maximum),
              title: `${key} · ${formatTokens(tokens)} tokens · ${numberFormat.format(messages)} messages`,
            }),
          )
        }
      }
      return h('div', { className: 'duo-heatmap', role: 'img', 'aria-label': TEXT.heatmap }, cells)
    }

    /** Overview tab content. */
    function Overview({ metric, summary }) {
      const tiles = [
        { label: TEXT.sessions, value: numberFormat.format(metric.sessions ?? 0) },
        { label: TEXT.messages, value: numberFormat.format(metric.messages ?? 0) },
        { label: TEXT.tokens, value: formatTokens(metric.tokens ?? 0) },
        { label: TEXT.activeDays, value: numberFormat.format(metric.activeDays ?? 0) },
        { label: TEXT.currentStreak, value: TEXT.day(metric.currentStreak ?? 0) },
        { label: TEXT.longestStreak, value: TEXT.day(metric.longestStreak ?? 0) },
        { label: TEXT.peakHour, value: metric.peakHour === undefined ? '—' : TEXT.hour(metric.peakHour) },
        { label: TEXT.favoriteModel, value: metric.favoriteModel ?? '—', variant: 'model' },
      ]
      const footer = summary?.compare === undefined
        ? (metric.tokens > 0 ? TEXT.footerBelow(formatTokens(metric.tokens)) : undefined)
        : TEXT.footer(summary.compare.ratio, summary.compare.book[LANGUAGE])
      return h(React.Fragment, null, [
        h(
          'div',
          { className: 'duo-grid', key: 'grid' },
          tiles.map((tile, index) => h(Tile, { key: index, label: tile.label, value: tile.value })),
        ),
        h(
          'div',
          { className: 'duo-heat-block', key: 'heat-block' },
          [
            h(Heatmap, { key: 'heatmap', days: summary.heatmap, todayKey: summary.today }),
            footer === undefined
              ? null
              : h('p', { className: 'duo-footer', key: 'footer' }, [
                  h('span', { className: 'duo-spark', key: 'spark', 'aria-hidden': 'true' }, '✻'),
                  footer,
                ]),
          ],
        ),
      ])
    }

    /** Models tab content. */
    function Models({ metric }) {
      const models = Array.isArray(metric.models) ? metric.models : []
      const total = models.reduce((sum, item) => sum + (item.tokens ?? 0), 0)
      if (models.length === 0) return h('p', { className: 'duo-empty' }, TEXT.empty)
      return h(
        'div',
        { className: 'duo-model-list' },
        models.map((item) =>
          h('div', { className: 'duo-model-row', key: item.model }, [
            h('span', { className: 'duo-model-name', key: 'name', title: resolveModelName(item.model) }, resolveModelName(item.model)),
            h(
              'span',
              { className: 'duo-model-bar', key: 'bar' },
              h('span', {
                className: 'duo-model-fill',
                style: { width: `${total > 0 ? Math.max(2, Math.round(((item.tokens ?? 0) / total) * 100)) : 2}%` },
              }),
            ),
            h('span', { className: 'duo-model-tokens', key: 'tokens' }, formatTokens(item.tokens ?? 0)),
            h('span', { className: 'duo-model-requests', key: 'requests' }, TEXT.requests(item.requests ?? 0)),
          ]),
        ),
      )
    }

    /** The unframed card itself; mounted only while the Session is blank. */
    function UsageCard() {
      const [tab, setTab] = React.useState('overview')
      const [range, setRange] = React.useState('all')
      const [summary, setSummary] = React.useState(undefined)
      const [failed, setFailed] = React.useState(false)
      const [catalogVersion, setCatalogVersion] = React.useState(0)

      React.useEffect(() => subscribeCatalog(() => setCatalogVersion((value) => value + 1)), [])

      React.useEffect(() => {
        let alive = true
        loadSummary().then((value) => {
          if (!alive) return
          if (value === undefined) setFailed(true)
          else setSummary(value)
        })
        return () => {
          alive = false
        }
      }, [])

      if (failed) return null
      const metric = summary?.ranges?.[range]
      // catalogVersion only forces a re-render once the Host catalog resolves.
      const resolvedMetric = metric === undefined
        ? metric
        : { ...metric, favoriteModel: resolveModelName(metric.favoriteModel) }
      return h('section', { className: 'duo-card', 'aria-label': TEXT.overview }, [
        h('header', { className: 'duo-head', key: 'head' }, [
          h(
            'div',
            { className: 'duo-tabs', key: 'tabs', role: 'tablist' },
            [
              { id: 'overview', label: TEXT.overview },
              { id: 'models', label: TEXT.models },
            ].map((item) =>
              h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  role: 'tab',
                  'aria-selected': tab === item.id,
                  className: 'duo-tab',
                  'data-active': tab === item.id,
                  onClick: () => setTab(item.id),
                },
                item.label,
              ),
            ),
          ),
          h(
            'div',
            { className: 'duo-ranges', key: 'ranges' },
            RANGES.map((item) =>
              h(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  className: 'duo-range',
                  'data-active': range === item.id,
                  onClick: () => setRange(item.id),
                },
                item.label[LANGUAGE],
              ),
            ),
          ),
        ]),
        metric === undefined
          ? h('div', { className: 'duo-loading', key: 'loading' }, TEXT.loading)
          : tab === 'overview'
            ? Overview({ metric: resolvedMetric, summary })
            : Models({ metric }),
      ])
    }

    /** Blank-Session gate: render only while the hero is actually showing. */
    function UsageOverview(props) {
      const blank = props.useSession((snapshot) => snapshot?.blank === true && snapshot?.awaitingFirstTurn !== true && snapshot?.running !== true && snapshot?.promptAttempted !== true)
      return blank === true ? h(UsageCard) : null
    }

    const STYLES = `
.duo-card{--uo-bg:#F5F4ED;--uo-ink:#1A1918;--uo-muted:#87867F;--uo-empty:#E8E6DC;--uo-accent:#D97757;--uo-mono:var(--dsh-font-family-code,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace);width:100%;max-width:900px;margin:0 auto;min-width:0;box-sizing:border-box;flex:none;display:flex;flex-direction:column;gap:8px;padding:10px 14px;border:0;border-radius:12px;background:var(--uo-bg);box-shadow:0 4px 20px rgba(0,0,0,.04);color:var(--uo-ink);font-family:var(--dsw-font-family);font-size:12px;line-height:1.4;overflow:hidden}
body[data-ds-dark-theme] .duo-card{--uo-bg:#2b2825;--uo-ink:#f0ede4;--uo-muted:#9a9285;--uo-empty:#3a3732}
.duo-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;min-width:0}
.duo-tabs{display:inline-flex;align-items:center;gap:18px;padding:0;background:none}
.duo-tab{appearance:none;border:0;background:transparent;color:var(--uo-muted);font:inherit;font-size:13px;font-weight:500;line-height:20px;padding:0 0 7px;border-bottom:2px solid transparent;cursor:pointer}
.duo-tab:hover{color:var(--uo-ink)}
.duo-tab[data-active=true]{color:var(--uo-ink);font-weight:600;border-bottom-color:var(--uo-accent)}
.duo-tab,.duo-range{font-size:11px;line-height:16px;padding-bottom:3px}
.duo-ranges{display:inline-flex;align-items:center;gap:16px;flex:none;padding:0;background:none}
.duo-range{appearance:none;border:0;background:transparent;color:var(--uo-muted);font:inherit;font-size:13px;font-weight:500;line-height:20px;padding:0 0 7px;border-bottom:2px solid transparent;cursor:pointer}
.duo-range:hover{color:var(--uo-ink)}
.duo-range[data-active=true]{color:var(--uo-ink);font-weight:600;border-bottom-color:var(--uo-accent)}
.duo-heat-block{display:flex;flex-direction:column;flex:none;gap:8px;align-items:stretch;min-width:0}
.duo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;min-width:0;flex:none}
.duo-tile{min-width:0;background:var(--uo-tile,#ece7dd);border:0;border-radius:6px;padding:8px 10px}
.duo-tile-label{color:var(--uo-muted);font-size:10px;line-height:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.duo-tile-value{margin-top:3px;color:var(--uo-ink);font-family:var(--uo-mono);font-size:16px;line-height:20px;font-weight:500;font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.duo-tile--model .duo-tile-value{white-space:normal;overflow:visible;text-overflow:clip;overflow-wrap:break-word;word-break:break-word;font-size:12px;line-height:16px}
.duo-heatmap{display:grid;flex:none;width:100%;grid-template-columns:repeat(26,minmax(0,1fr));gap:2px}
.duo-heat-cell{width:100%;height:auto;aspect-ratio:1/1;min-width:0;min-height:0;border-radius:2px;background:var(--uo-empty)}
.duo-heat-cell[data-level="1"]{background:rgba(217,119,87,.18)}
.duo-heat-cell[data-level="2"]{background:rgba(217,119,87,.38)}
.duo-heat-cell[data-level="3"]{background:rgba(217,119,87,.62)}
.duo-heat-cell[data-level="4"]{background:var(--uo-accent)}
.duo-footer{display:flex;flex:none;align-items:center;gap:6px;margin:0;color:var(--uo-muted);font-size:10px;line-height:15px}
.duo-spark{color:var(--uo-accent);font-size:13px;line-height:1;flex:none}
.duo-loading{padding:0;color:var(--uo-muted);font-size:12px;line-height:18px}
.duo-empty{margin:0;padding:0;color:var(--uo-muted);font-size:12px;line-height:18px}
.duo-model-list{display:flex;flex-direction:column;gap:10px}
.duo-model-row{display:grid;grid-template-columns:minmax(90px,150px) minmax(0,1fr) auto auto;align-items:center;gap:12px;font-size:12px}
.duo-model-name{color:var(--uo-ink);font-weight:500;white-space:normal;overflow:visible;overflow-wrap:break-word}
.duo-model-bar{height:5px;border-radius:999px;background:var(--uo-empty);overflow:hidden;display:block}
.duo-model-fill{display:block;height:100%;border-radius:999px;background:var(--uo-accent)}
.duo-model-tokens{color:var(--uo-ink);font-family:var(--uo-mono);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.duo-model-requests{color:var(--uo-muted);white-space:nowrap}
@media (max-width:720px){.duo-card{padding:12px 14px;gap:10px}.duo-head{gap:10px}.duo-tabs,.duo-ranges{gap:12px}.duo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 12px}.duo-tile-value{font-size:16px;line-height:20px}.duo-heatmap{--uo-cell:7px}}
`

    return {
      inject: ['slots', 'remote', 'remote.session'],
      apply(ctx) {
        ctx.inject(['remote.session'], (scope) => {
          scope.effect(() => {
            let disposed = false
            const loadModelCatalog = async () => {
              try {
                const response = await scope.remote.session.modelCatalog()
              if (disposed || response?.ok !== true) return
              const groups = response.value?.groups
              if (!Array.isArray(groups)) return
              let changed = false
              for (const group of groups) {
                if (!Array.isArray(group?.models)) continue
                for (const model of group.models) {
                  if (typeof model?.id !== 'string' || typeof model?.name !== 'string') continue
                  if (model.id === '' || model.name === '') continue
                  if (modelDisplayNames.get(model.id) !== model.name) {
                    modelDisplayNames.set(model.id, model.name)
                    changed = true
                  }
                }
              }
                if (changed) for (const listener of catalogSubscribers) listener()
              } catch {
                // Catalog unavailable: raw ids stay visible.
              }
            }
            void loadModelCatalog()
            const offAdapters = scope.remote.$on('llm/adapters-updated', loadModelCatalog)
            return () => {
              disposed = true
              offAdapters?.()
            }
          }, 'dsh-claude-code-desktop-theme: usage model catalog')
        })

        ctx.effect(() => {
          const tag = document.createElement('style')
          tag.dataset.plugin = 'dsh-claude-code-desktop-theme'
          tag.textContent = STYLES
          document.head.appendChild(tag)
          return () => {
            tag.remove()
          }
        }, 'dsh-claude-code-desktop-theme: usage card styles')

        ctx.slots.inject('conversation.input.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.dock',
              id: 'dsh-theme-usage',
              order: 10,
            },
            UsageOverview,
          ),
        )
      },
    }
    })()
    // Claude Code desktop chrome + "Absolutely" code theme palette.
    const ACCENT = '#da7756'
    const ACCENT_HOVER = '#c4633f'
    const SURFACE = '#f5f3ee'
    const INK = '#1d1b16'
    const CODE_BG = '#2d2d2b'
    const CODE_FG_LIGHT = '#2d2d2b'
    const CODE_FG_DARK = '#f9f9f7'

    // ── Skeleton layer ──────────────────────────────────────────────────────
    // The token layer above carries the palette; this layer carries the shell
    // geometry that Claude desktop uses and tokens cannot express: the flat
    // 32px New Session button, the 2px selection rail at the sidebar's left
    // edge, the smaller serif hero and the airy composer card. Everything is
    // scoped to the light appearance and to the shell components, so the
    // transcript and the docked cards keep their existing surfaces.
    const SHELL = {
      sidebarFill: '#f5f3ee',
      navActiveFill: '#ece7dd',
      navActiveRail: '#da7756',
      newSessionFill: '#e3ddd1',
      newSessionHover: '#E0DDD2',
      heroInk: '#1d1b16',
      previewFill: '#e3ddd1',
      previewInk: '#7f7869',
      composerFill: '#f5f3ee',
      composerBorder: '#e3ddd1',
      composerShadow: '0 10px 30px rgba(29, 27, 22, 0.10), 0 2px 8px rgba(29, 27, 22, 0.04)',
      controlInk: '#7f7869',
      controlHover: 'rgba(0, 0, 0, 0.04)',
    }

    const LIGHT = 'body:not([data-ds-dark-theme])'
    const DARK = 'body[data-ds-dark-theme]'

    // ── Embedded hero serif ─────────────────────────────────────────────────
    // The 3.9 KB hero subset (SIL OFL 1.1) covers the Chinese headline
    // (探索未至之境) and is registered under the family name the reference
    // stack asks for, so the display face never depends on local font matching.
    const HERO_SERIF_BASE64 = 'AAEAAAASAQAABAAgQkFTRWv7eSkAAAOQAAAA3kdQT1NEdEx1AAABfAAAAB5HU1VCbSJZEAAAAowAAABAT1MvMp/DhaIAAALMAAAAYFNUQVR4kmzdAAACJAAAAC5jbWFwLzpCXQAAAywAAABkZ2FzcAAAABAAAAE0AAAACGdseWYd3ThdAAAGlAAACJRoZWFkLFRYOwAAAlQAAAA2aGhlYQwOB/EAAAHcAAAAJGhtdHgJRgDRAAABZAAAABZsb2NhCLMG5AAAATwAAAASbWF4cABIAmsAAAGcAAAAIG5hbWUsJ0oWAAAEcAAAAiRwb3N0/7gAMgAAAbwAAAAgcHJlcGgGjIUAAAEsAAAAB3ZoZWEMqhctAAACAAAAACR2bXR4B9sAgAAAAVAAAAASuAH/hbAEjQAAAQAB//8ADwAAACsAKwCVAYICYQK8A8MESgAAA+gAAANwACwAIQAqACoAKgA4AAAD6ABkAQAAAAPoACEAKQAjACEAKQAsAAAAAQAAAAoAHAAcAAFERkxUAAgABAAAAAD//wAAAAAAAAABAAAACAJqAD8AAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAD/tQAyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAABH/+4gAAC7j8G/1TC3EAAQAAAAAAAAAAAAAAAAAAAAMAARAAAfT+DAAAC7j/Qf1oC3EAAAABAAAAAAAAAAAAAAAAAAEAAQABAAgAAQAAABQAAQAAABwAAndnaHQBAQAAAAIAAwAAAAIAAgGQAAACvAAAAAAAAQAAAAIAxdCQvs1fDzz1AAMD6AAAAADix6C8AAAAAOLoct/8G/vnC3EHEQAAAAYAAgAAAAAAAAABAAAACgA+AD4ABkRGTFQAKmN5cmwAJmdyZWsAJmhhbmkAJmthbmEAJmxhdG4AJgAAAAAABAAAAAD//wAAAAAABAPhAZAABQAAAooCWAAAAEsCigJYAAABXgAyATQAAAICAgAAAAAAAAAgAACDKt88EAAAABYAAAAAR09PRwBAACCB8wNw/4gAAAR/AR5gBgEHAAAAAAICAtkAAAAgAAYAAAACAAAAAwAAABQAAwABAAAAFAAEAFAAAAAQABAAAwAAACBOS1iDY6JnKn0igfP//wAAACBOS1iDY6JnKn0igfP////hsbengJximNuC5H4UAAEAAAAAAAAAAAAAAAAAAAAAAAEAAQBqAAwAAAAAAMAABAAGREZMVAA4Y3lybAAmZ3JlawAmaGFuaQA4a2FuYQA4bGF0bgAmAAYAAAAAAAMABAAoACIAfAAeAAYAAAAAAAIABAAWABAAagAMAAEAeAADA78AAAADACkAAABiAAQABkRGTFQAOGN5cmwAJmdyZWsAJmhhbmkAOGthbmEAOGxhdG4AJgAGAAAAAAADAAQALAAmACIAHgAGAAAAAAACAAQAGgAUABAADAABAAAAAf+IAAMDRwAAAAP/sQAAAARpY2ZiaWNmdGlkZW9yb21uAAAAAAAJAHIAAwABBAkAAABYAVoAAwABBAkAAQAaAUAAAwABBAkAAgAOATIAAwABBAkAAwBCAPAAAwABBAkABAAqAMYAAwABBAkABQBeAGgAAwABBAkABgAmAEIAAwABBAkADgA2AAwAAwABBAkBAQAMAAAAVwBlAGkAZwBoAHQAaAB0AHQAcABzADoALwAvAG8AcABlAG4AZgBvAG4AdABsAGkAYwBlAG4AcwBlAC4AbwByAGcATgBvAHQAbwBTAGUAcgBpAGYAUwBDAC0AUgBlAGcAdQBsAGEAcgBWAGUAcgBzAGkAbwBuACAAMgAuADAAMAAzAC0ASAAxADsAaABvAHQAYwBvAG4AdgAgADEALgAxAC4AMQA7AG0AYQBrAGUAbwB0AGYAZQB4AGUAIAAyAC4ANgAuADAATgBvAHQAbwAgAFMAZQByAGkAZgAgAFMAQwAgAFIAZQBnAHUAbABhAHIAMgAuADAAMAAzAC0ASAAxADsARwBPAE8ARwA7AE4AbwB0AG8AUwBlAHIAaQBmAFMAQwAtAFIAZQBnAHUAbABhAHIAUgBlAGcAdQBsAGEAcgBOAG8AdABvACAAUwBlAHIAaQBmACAAUwBDACgAYwApACAAMgAwADEANwAtADIAMAAyADQAIABBAGQAbwBiAGUAIAAoAGgAdAB0AHAAOgAvAC8AdwB3AHcALgBhAGQAbwBiAGUALgBjAG8AbQAvACkALgAFAGT/iAOEA3AAAwAGAAkADAAPAAAXESERAQEhAQERASEBAREBZAMg/nABPv2EAV4BPv1kAnz+wv6iAT54A+j8GAIdAZn+Pv5nAzL8pQGZAcL8zgGZAAQAIf/BA74DRAAnADMAQwBHAAA3MhYXHgIzMjI3FQYGByoDIyIuAicmBgcOAgcWBgcnPgMTHgMGBicuAicFNxcGBiMOAgcnPgM3MxUhJ9kNDQkua41dVJRXFxsDIkRISilHblhKIwoPCAsmKRADAwY8Fzc3Kpo7SSUGEB8SBSc0GQGSMEoHExRDvuV9C1CilX0pHf1HCZYFCS8xEQUOAyAXDiM7LQsCCg80ORgHDARNES0tHQKuFjY1Lh8HDSFHQRflKkUHBFShjDIQKGt4gD4eHgAADgAp/7MDwANPAAoAFgA2AEMAUABUAF8AagB0AH8AgwCOAJUAnwAAAR4CDgInJiYnEw4DByc+AzczFBQVFRQWMzMyMjM2NzY2NzMXFhYVFAYGIyMiJiY1NQcUBgYjIxE1MRchFSElNxcGBgcVFAYGIyMRFxUhNRMeAg4CJyYmJwUGJwYGByM+AjcXMBYWFwYjISchNzAeAhcGIyEnIRMVITUFPgI3FwYGBwYHEwYGBxEHERcwFhYXBiMhJzMCPikuEQIUGw8DHxEiBhxFgGoMW2w3EwPRCRE9FB4HCgUGDQYNAw8IFjs5Sh8fC9cQGA4JRQFx/okBUCJMBBUNEhgLChv+eBYsNBcBERsPBSoXAYsIHxQ7HRYNGxkJhhslDwQW/a4IAfoQEBkcCwMX/ecIAb4U/nj+dBxngkQGLYNYAg6mAg8UP4sZIg0EFf7VCN0DTwogIh4SAQwbPRP9mStUTkUdER9GSUslBxAGrQkFAQkLOyJqBQ0IDREICxkV1ykDCwcBHR8fHh4lOgUKAtsDCQgBFWgeHgFSDCEkIBQDDB5DFBcUBRlAGhc8PBlfFh4QEB7xDBUZCxAe/hUdHVcKKjgeDCBbOBMIAvAKDgL9qhUCkLoVIA4QHQAADAAj/68DzQNGAAsAFwAjAC0AOABEAEgAUwBhAGwAhQCPAAABBgYnBgYHJz4CNxceAwYGJy4CJwMeAhcHBgcuAicHBgYHJz4CNzM3BgYHERQGBiMjEQMWDgMmJjc2NjcFFSE1ATAeAhcGIyEnIRM3FwYGBwYGByc+AjcBPgI3FwYGBwYHEwYGBxEUBgYHJiYnJiYnNTAeAjMyNjURFzAWFhcGIyEnMwKEBRQPLG02DR0+PBeKQFMsDAocEgw3Px0HHmFyNwErETNgThoMMrJ2DEFuVhtGPgIPEw8XDA2eDAEUGxsTAQwYHQEBwP5JAagRGh4MBBb9zQgB0RkqSwUTDhAxEg4ECwsD/MgbZoRDCDCKWgIPzgIREgwqKwIJCgolHh0nIwcNCnkZIg4EFv7SCOAChAcJBD5qJA0dUV4xDBw9OS8fBwsiTUkb/tVFfWIeCgUwJ3KOUgd1xUcPMX2MSKAKDgL9ygQLCQJzARQ2Sy8UAQ8aEQ9FNzQeHv60DRYZDBAdAYcpSQQEARQ+FAcRMzMR/jsMMkIjDCRnPhMJAkwKDgL88xsoGQUQGggJDAQRAgQCCQsDK6wVHg8QHQAFACH/sgPHA0YACgAWACEAKwA5AAATITcwHgIXBiMhNyE3MB4CFwYGIyElFwYGBxEUBgYjIwMzFQYGByc+AjceAxcHBgYHLgInMQL1MxMeIA0DF/ydRAJkMhIcIA0CDgv9MgFKZwIPFBAYDQ0qTEXqlwtVlXWdIF9xfT0CFSEJTZB1KAG9QA8XGwwQ7z0OFhoMCAjUCwoPA/yuBQ0JAgsPh+NOEDeOoVE/dGROGAoCHRkrgqdiAA0AKf+yA78DRgAVAC0ARABOAFcAZQBxAHUAfACJAJUAoQCtAAAlFAYGByYmJyYmJzUwHgIzMjY1NTM3BgYnNw4DByczBgYHJzA2Nz4DNycGBic3DgIHNTMGBgcnMDY3PgM3ATI+AjcXBgQHNz4CNxcGBgclNxcGBgcGBgcnPgI3JRYOAyYmNzY2NwUVITUlBgYHFSMRAwYGJw4CByc+AjcFHgMGBicuAic3HgMGBicuAicTMB4CFwYGIyEnIQIUDSgpAQYICSAcGCIeBgsIQd4GHxchK3+YoEwBIAQWDSAZCEOVj3kmjAUdFx0dYG80HgQUCx4SBSJKRjoS/sUriK3GaAFu/rrFISmHqFkCRtp+Al4tUQYSDxRCHwwLFBIE/VkICRsiIhcEDSI1BgLX/SoBowERE0BbBQ8QH11tOAowYVMZAVFSb0IcAxoWFVRhKydFWzMTCBkUDT5MI5YSHR8OAg4L/TsJAlsKGCUXBA0WBwYLAw4BAgEICNzEBwMOAhc4OjUUCh8gBVEDAhI7Q0EaFgcHDAMTLioPChweA0kDAQskKikP/sAEBgkFFA0hEd8BCAsHEg0iD+wtTgQFARxBFggVNzYULDhOMBYBDhoQD0k+LR4e8woOA+sBEf0pBwQEHT02Eg4ZRUshCQ8tMi8kDgciRz8U0xEvMi4gCgogRTwUAcAOFhoMCAgeAAAHACz/4wPBAzgAFwAhACwAOQBAAEsAVgAAAQYGJzcOAwcnMwYGBycwNjc+AzcFPgM3FwYEBwEwHgIXBiMhJyEDHgMGBicuAycHBgYHESMRBTAeAhcGIyEnIRMwHgIXBiMhJyECGAUeGB8bUWBlLwElBBgOJBcHKFdURRX+xy2OtMtqAXL+scsCxRMeIA4EFvyOCQMC0Fl1QxsGHBYOOUhNIhwBERJDATYTHSENAxf9SQgCSHYTHSAOBBf8vAgC1gKoCAgMBRg5OzQVCyImBVoEAxI6REIY9gEECQsHFBEnE/6ZDxcbDRAeApMfRUQ6Jw0LIUdFPBfxCg4E/nYBsWUPFxoNEB4COQ8XGgwQHQ=='

    const HERO_SERIF_FACE = '@font-face{font-family:"Noto Serif SC";font-style:normal;font-weight:400;font-display:swap;'
      + 'src:url(data:font/ttf;base64,' + HERO_SERIF_BASE64 + ') format("truetype")}'

    // ── External UI serif (D8 / M0-S6) ──────────────────────────────────────
    // The 2.6 MB GB2312 variable serif is no longer inlined. The Host half serves
    // it as a static asset over the authenticated Connection fetch route
    // (GET/HEAD /api/dsh-claude-code-desktop-theme/font). The client fetches the
    // bytes once, registers a FontFace, and degrades to the system serif stack if
    // the route, the FontFace API or the 8s budget is unavailable.
    const UI_SERIF_FAMILY = 'DSH Serif UI'
    const UI_SERIF_ROUTE = '/api/dsh-claude-code-desktop-theme/font'
    const UI_SERIF_TIMEOUT_MS = 8000
    const SYSTEM_SERIF_STACK = '"Noto Serif SC", "Songti SC", "SimSun", "STSong"'
    let uiSerifState = 'pending' // pending | external | fallback
    let uiSerifError = ''
    let uiSerifFace = null

    /** Diagnostics for `__dshClaudeThemeFontDebug()`: external vs fallback. */
    function fontDebugState() {
      return {
        source: uiSerifState,
        family: UI_SERIF_FAMILY,
        route: UI_SERIF_ROUTE,
        faceStatus: uiSerifFace === null ? null : uiSerifFace.status,
        error: uiSerifError,
      }
    }

    /** Publish the load state on <html> so screenshots/reports show the source. */
    function markFontState(state) {
      uiSerifState = state
      try {
        document.documentElement.setAttribute('data-dsh-font', state)
      } catch (error) {
        // Diagnostics only; a detached document must not break the theme.
      }
    }

    /** Drop FontFaces from previous instances (HMR re-applies the same plugin). */
    function dropStaleSerifFaces() {
      try {
        for (const face of [...document.fonts]) {
          if (typeof face.family === 'string' && face.family.includes(UI_SERIF_FAMILY)) document.fonts.delete(face)
        }
      } catch (error) {
        // The font set may be unavailable in exotic renderers.
      }
    }

    /**
     * Fetch the external GB2312 serif and register it as a FontFace.
     * Never throws: on any failure it logs one warning and leaves the system
     * serif fallback in place, so the page renders immediately and cannot hang.
     * @returns {Promise<boolean>} true when the external serif is active.
     */
    async function loadExternalSerif() {
      if (uiSerifState === 'external') return true
      const hasApi =
        typeof fetch === 'function' &&
        typeof FontFace === 'function' &&
        typeof document !== 'undefined' &&
        document.fonts !== undefined
      if (!hasApi) {
        uiSerifError = 'font-api-unavailable'
        markFontState('fallback')
        console.warn('[dsh-claude-code-desktop-theme] FontFace API unavailable; using the system serif fallback')
        return false
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      const timer = controller === null ? 0 : window.setTimeout(() => controller.abort(), UI_SERIF_TIMEOUT_MS)
      try {
        // Relative route: the shell routes it through the authenticated
        // Connection channel (same mechanism as the usage-summary fetch).
        const response = await fetch(UI_SERIF_ROUTE, {
          signal: controller === null ? undefined : controller.signal,
          cache: 'force-cache',
        })
        if (response.ok !== true) throw new Error('HTTP ' + String(response.status))
        const bytes = await response.arrayBuffer()
        if (bytes.byteLength === 0) throw new Error('empty font response')
        dropStaleSerifFaces()
        const face = new FontFace(UI_SERIF_FAMILY, bytes, {
          style: 'normal',
          weight: '200 900',
          display: 'swap',
        })
        await face.load()
        document.fonts.add(face)
        uiSerifFace = face
        markFontState('external')
        return true
      } catch (error) {
        const aborted = error !== null && typeof error === 'object' && error.name === 'AbortError'
        uiSerifError = aborted ? 'timeout' : String(error?.message ?? error)
        markFontState('fallback')
        console.warn(
          '[dsh-claude-code-desktop-theme] external UI serif unavailable (' +
            uiSerifError +
            '); using the system serif fallback',
        )
        return false
      } finally {
        if (timer !== 0) window.clearTimeout(timer)
      }
    }

    // ── Typography: one embedded, self-contained stack ──────────────────────
    const UI_FONT = '"DSH Serif UI", ' + SYSTEM_SERIF_STACK + ', "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif'
    const CODE_FONT = '"SF Mono", "Consolas", monospace'

    const SHELL_CSS = [
      HERO_SERIF_FACE,
      // New Session: every stroke removed, 32px tall, 6px corners. The host's
      // CSS-module hash changes every build (01 audit: the old sidebar hash was dead), so
      // this targets the stable *_newSession key on the button itself — the
      // spans inside it must keep their own geometry.
      `${LIGHT} button[class*="_newSession"]{border:0!important;background:${SHELL.newSessionFill}!important;height:32px;min-height:32px;padding:0 12px;border-radius:6px}`,
      `${LIGHT} button[class*="_newSession"]:hover{background:${SHELL.newSessionHover}!important}`,
      // Selected session row: cream fill plus a forced 2px terracotta rail on
      // the row's own left edge. A pseudo-element keeps it glued to the item
      // through scrolling, resizing and re-renders, with no runtime geometry.
      `${LIGHT} [class*="_sessionRow"][class*="_selected"]{background:${SHELL.navActiveFill}!important}`,
      `${LIGHT} [class*="_sessionRow"][class*="_selected"]:hover{background:${SHELL.navActiveFill}!important}`,
      `[class*="_sessionRow"][class*="_selected"]{position:relative!important}`,
      `[class*="_sessionRow"][class*="_selected"]::before{content:""!important;position:absolute!important;left:0!important;top:50%!important;transform:translateY(-50%)!important;width:2px!important;height:18px!important;border-radius:1px;background:${SHELL.navActiveRail}!important;pointer-events:none!important;z-index:2}`,
      // Status semantics (real layer): the dot is a CSS pseudo-element on the
      // host's own leading slot, driven by `data-dsh-status`. A pseudo-element
      // is computed style, not a React child, so a sidebar re-render can never
      // delete it -- the dot cannot blink out of existence.
      `[class*="_sessionRow"][data-dsh-status] [class*="_slot"]{display:inline-flex!important;flex:none;align-items:center!important;justify-content:center!important}`,
      `[class*="_sessionRow"][data-dsh-status]:not([data-dsh-status="busy"]) [class*="_slot"]::before{content:""!important;display:inline-block!important;width:6px!important;height:6px!important;min-width:6px!important;min-height:6px!important;box-sizing:border-box!important;border-radius:50%!important;background:#7f7869!important;opacity:.5!important;flex:none!important;pointer-events:none!important}`,
      `[class*="_sessionRow"][data-dsh-status="waiting"] [class*="_slot"]::before{background:#da7756!important;opacity:1!important}`,
      // Busy rows use the host's native rotating arc spinner (14px): keep it,
      // recolour it to the theme accent, and hide the pseudo dot instead.
      `[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]::before{display:none!important}`,
      `[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]>svg[data-state="ongoing"]{display:inline-block!important;flex:none!important;width:14px!important;height:14px!important;color:#da7756!important}`,
      `[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]>svg[data-state="ongoing"] circle{stroke:#da7756!important;stroke-width:2px!important}`,
      `[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]>svg[data-state="ongoing"] [class*="Track"]{stroke:rgba(218,119,86,.25)!important}`,
      `@media (prefers-reduced-motion:reduce){[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]>svg[data-state="ongoing"] *{animation:none!important}}`,
      // Hero: force the serif display face, a lighter and slightly smaller
      // headline, and the ink color (all !important so host sheets cannot win).
      `${LIGHT} [class*="_composerHero"] [class*="_headline"],${LIGHT} [class*="_composerHero"] [class*="_titleGroup"]>span:not([class]){color:${SHELL.heroInk}!important;font-family:${UI_FONT}!important;font-size:22px!important;font-weight:400!important;line-height:30px}`,
      `body[data-ds-dark-theme] [class*="_composerHero"] [class*="_headline"],body[data-ds-dark-theme] [class*="_composerHero"] [class*="_titleGroup"]>span:not([class]){font-family:${UI_FONT}!important;font-size:22px!important;font-weight:400!important;line-height:30px}`,
      `${LIGHT} [class*="_fish"]:not([class*="_fishHitbox"]){color:${SHELL.heroInk}!important}`,
      `${LIGHT} [class*="_previewBadge"]{background:${SHELL.previewFill}!important;border-color:transparent!important;color:${SHELL.previewInk}!important}`,
      // ── Hero dashboard layout ─────────────────────────────────────────────
      // Home layout: the usage card is pinned to the top-left of the chat area
      // (aligned with the composer card), and the composer itself is pushed to
      // the bottom of the window. Both positions are measured at runtime into
      // CSS vars, so they follow the host's sidebar/header geometry instead of
      // guessing. The title block is removed; the workspace row keeps the host
      // order right above the composer.
      `[class*="_composerHero"] [class*="_root"]:has([class*="_headline"]){display:none!important}`,
      `[class*="_composerHero"] .duo-card{position:fixed!important;left:var(--dsh-hero-left,280px)!important;top:var(--dsh-hero-top,72px)!important;width:var(--dsh-hero-width,720px)!important;max-width:var(--dsh-hero-width,720px)!important;max-height:calc(100vh - var(--dsh-hero-top,72px) - 340px)!important;overflow:auto!important;margin:0!important;z-index:6!important}`,
      `[class*="_composerHero"] .duo-card::-webkit-scrollbar{width:6px}`,
      `[class*="_composerHero"] .duo-card::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:999px}`,
      `html[data-dsh-hero="false"] .duo-card{display:none!important}`,
      // Usage card: favourite-model tile shows the full model name (wraps instead of ellipsis).
      `.duo-grid>.duo-tile:last-child .duo-tile-value{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:break-word!important;word-break:break-word!important;font-size:12px!important;line-height:16px!important}`,
      // Usage card model tile: a smaller dedicated font keeps long real model names on two lines.
      `.duo-grid>.duo-tile:last-child .duo-tile-value--model{font-size:12px!important;line-height:16px!important}`,
      `.duo-model-name{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}`,
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"]{position:relative!important;margin:0 0 8px!important;padding:0 16px!important;background:transparent!important;border:0!important;box-shadow:none!important;display:flex!important;align-items:center!important;gap:4px!important;min-height:26px!important;z-index:2}`,
      // Lightweight pill menus above the composer: transparent, gray text,
      // darker on hover; the host's background blocks are removed.
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_workspace"]:not([class*="_workspaceRow"]):not([class*="_workspaceLabel"]),[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_seat"]:not([class*="_seatIcon"]):not([class*="_seatLabel"]){background:transparent!important;border:0!important;box-shadow:none!important;color:#87867F!important;font-size:13px!important;font-weight:400!important;line-height:20px!important;padding:0 8px!important;border-radius:999px!important;min-height:26px!important;gap:4px!important}`,
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_workspace"]:not([class*="_workspaceRow"]):not([class*="_workspaceLabel"]):hover,[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_seat"]:not([class*="_seatIcon"]):not([class*="_seatLabel"]):hover,[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_workspace"]:not([class*="_workspaceRow"]):not([class*="_workspaceLabel"])[aria-expanded="true"],[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_seat"]:not([class*="_seatIcon"]):not([class*="_seatLabel"])[aria-expanded="true"]{background:transparent!important;color:#1d1b16!important}`,
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_folder"],[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_chevron"],[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_seatLabel"]{color:inherit!important}`,
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"] svg{color:inherit!important}`,
      // Composer: soft warm fill, hairline stroke, one very light float shadow.
      `${LIGHT} [class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]){background:${SHELL.composerFill}!important;border:1px solid ${SHELL.composerBorder}!important;box-shadow:${SHELL.composerShadow}!important}`,
      // Composer controls: no fills, muted glyphs.
      `${LIGHT} [class*="_root"]:has([data-lexical-editor="true"]) [class*="_add"]{background:transparent!important;color:${SHELL.controlInk}}`,
      `${LIGHT} [class*="_root"]:has([data-lexical-editor="true"]) [class*="_add"]:hover:not(:disabled){background:${SHELL.controlHover}!important}`,
      `${LIGHT} [class*="_triggerAnchor"] [class*="_trigger"]{background:transparent!important;color:${SHELL.controlInk}}`,
      `${LIGHT} [class*="_triggerAnchor"] [class*="_trigger"]:hover:not(:disabled){background:${SHELL.controlHover}!important}`,
      `${LIGHT} [class*="_trigger"]:has([class*="_triggerEffort"]),${LIGHT} [class*="_triggerEffort"],${LIGHT} [class*="_trigger"]:has([class*="_triggerEffort"]) [class*="_chevron"]{color:${SHELL.controlInk}}`,
      // Composer cleanup: keep the toolbar row as two clean ends. The 1017
      // model-version tag (from the model-label plugin), the voice trigger and
      // the old bottom stats tray are hidden; the HUD tray below the card
      // replaces the old bar.
      `[class*="_trigger"]:has([class*="_triggerEffort"]) span[class*="_tag_"]{display:none!important}`,
      // The official experimental Voice Input bundle mounts its microphone in
      // the activity slot. That slot is also where the old activity row used to
      // live, so only hide the legacy dock stats — never the whole activity row.
      `[class*="_triggerAnchor"]{flex:none;display:inline-flex;align-items:center}`,
      `html[data-dsh-realtime-voice="1"] [class*="_triggerAnchor"]{display:none!important}`,
      // Live voice button: fixed 30×30 footprint so recording can never change the
      // composer geometry. The recording state is painted by a rAF loop that only
      // writes transform/opacity (bars scaleY + expanding ring), never width,
      // height, margin or box-shadow.
      `.dsh-live-voice-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;order:999;contain:layout}`,
      `.dsh-live-voice{position:relative;width:30px;height:30px;padding:0;border:0;border-radius:999px;background:transparent;color:#7f7869;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;overflow:visible;transition:background-color .2s ease,color .2s ease}`,
      `.dsh-live-voice:hover{background:rgba(218,119,86,.10);color:#da7756}`,
      `body[data-ds-dark-theme] .dsh-live-voice{color:#b9b0a2}`,
      `.dsh-live-voice[data-recording="true"]{background:#da7756;color:#fff8f3}`,
      `.dsh-live-voice-ring{position:absolute;left:0;top:0;width:30px;height:30px;border-radius:999px;border:1.5px solid rgba(218,119,86,.55);opacity:0;pointer-events:none;will-change:transform,opacity}`,
      `.dsh-live-voice-icon{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;transition:opacity .15s ease}`,
      `.dsh-live-voice-bars{position:absolute;left:50%;top:50%;display:inline-flex;align-items:center;justify-content:center;gap:2.5px;width:20px;height:16px;margin:-8px 0 0 -10px;opacity:0;pointer-events:none;will-change:opacity}`,
      `.dsh-live-voice-bar{display:block;width:2.5px;height:14px;border-radius:999px;background:#fff8f3;transform-origin:center center;transform:scaleY(.16);transition:opacity .15s ease}`,
      `.dsh-live-voice[data-recording="true"] .dsh-live-voice-icon{opacity:0}`,
      `.dsh-live-voice[data-recording="true"] .dsh-live-voice-bars{opacity:1}`,
      `.dsh-live-voice-dot{position:absolute;right:2px;top:2px;width:6px;height:6px;border-radius:50%;background:#fff8f3;box-shadow:0 0 0 2px rgba(218,119,86,.5);pointer-events:none}`,
      `@media (prefers-reduced-motion:reduce){.dsh-live-voice,.dsh-live-voice-icon,.dsh-live-voice-bars,.dsh-live-voice-bar{transition:none!important}}`,
      `[class*="_triggerAnchor"] [class*="_trigger"]{width:30px;height:30px;padding:0;border-radius:999px;background:transparent!important;color:#7f7869!important;transition:background-color .15s ease,color .15s ease}`,
      `[class*="_triggerAnchor"] [class*="_trigger"]:hover:not(:disabled){background:rgba(218,119,86,.10)!important;color:#da7756!important}`,
      `[class*="_triggerAnchor"] [class*="_trigger"]:focus-visible{outline:2px solid rgba(218,119,86,.55)!important;outline-offset:2px}`,
      `[class*="_captureRow"]{align-items:center;gap:12px;padding:2px 2px 2px 4px;border-radius:999px;background:rgba(218,119,86,.07)}`,
      `[class*="_roundButton"]{width:32px;height:32px;background:#da7756!important;color:#fff8f3!important;box-shadow:0 2px 8px rgba(218,119,86,.28)}`,
      `[class*="_roundButton"]:hover:not(:disabled){background:#c4633f!important}`,
      `[class*="_waveform"]{color:#da7756!important}`,
      `[class*="_activityMessage"]{color:#7f7869!important;font-size:12px}`,
      `[class*="_captureRow"] [class*="_progress"]{accent-color:#da7756!important}`,
      `@keyframes dsh-voice-pulse{0%,100%{box-shadow:0 0 0 0 rgba(218,119,86,.25)}50%{box-shadow:0 0 0 5px rgba(218,119,86,.10)}}`,
      `[class*="_captureRow"] [class*="_roundButton"]:first-of-type{animation:dsh-voice-pulse 1.8s ease-in-out infinite}`,
      `@media (prefers-reduced-motion:reduce){[class*="_captureRow"] [class*="_roundButton"]:first-of-type{animation:none!important}}`,
      `[class*="_root"]:has([data-lexical-editor="true"]) [class*="_dock"]{display:none!important}`,
      // Composer HUD tray: one quiet 16px line directly below the composer card
      // (8px gap), two ends aligned, monospace 12px. It is injected as a
      // sibling of the card, so the card itself never grows.
      `.dsh-composer-tray{display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);margin:8px auto 0;padding:0 2px;overflow:hidden;contain:layout style;font-family:"SF Mono","Consolas",monospace;font-size:12px;line-height:16px;color:${SHELL.controlInk};white-space:nowrap;font-variant-numeric:tabular-nums}`,
      `.dsh-tray-group{display:inline-flex;align-items:center;min-width:0}`,
      `.dsh-tray-left{gap:14px;flex:none}`,
      `.dsh-tray-right{gap:8px;flex:0 1 auto;justify-content:flex-end;overflow:hidden}`,
      `.dsh-tray-sep{color:#b4ab99;flex:none}`,
      `.dsh-sidebar-footer-balance{flex:0 1 auto!important;min-width:0!important;align-self:center!important;margin-left:auto!important;padding-left:8px!important;max-width:52%!important;overflow:hidden!important;text-overflow:ellipsis!important;text-align:right!important;font-family:${UI_FONT}!important;font-size:12px!important;line-height:16px!important;color:#7f7869!important;white-space:nowrap!important;pointer-events:none!important}`,
      `[data-slot="settings.launcher"] button{overflow:hidden!important}`,
      `[data-collapsed="true"] .dsh-sidebar-footer-balance{display:none!important}`,
      `.dsh-hud-part{display:inline-flex;align-items:center;gap:6px;flex:none;min-width:0}`,
      // Numbers own a fixed-width, right-aligned slot: a value change updates
      // text only and cannot rewrap the row (no layout shift per tick).
      `.dsh-hud-num{display:inline-block;text-align:right;font-variant-numeric:tabular-nums;color:#1d1b16}`,
      `.dsh-hud-context-value{min-width:4.2ch}`,
      `.dsh-hud-cache-value{min-width:5.2ch}`,
      `.dsh-hud-tps-value{min-width:3.6ch}`,
      `.dsh-hud-cost-value{min-width:6.6ch}`,
      `.dsh-hud-tps-unit{color:inherit}`,
      `.dsh-hud-cost[data-price-source="none"] .dsh-hud-cost-value{opacity:.72}`,
      `@media (prefers-reduced-motion:reduce){.dsh-hud-num{transition:none}}`,
      `.dsh-hud-ring{display:block;flex:none}`,
      `.dsh-hud-ring-progress{transition:stroke-dashoffset .3s ease}`,
      `.dsh-hud-agents{display:inline-flex;align-items:center;gap:5px;flex:none}`,
      `.dsh-hud-agent-dot{width:5px;height:5px;border-radius:50%;background:${SHELL.navActiveRail};box-shadow:0 0 4px rgba(218,119,86,.9),0 0 8px rgba(218,119,86,.45);flex:none}`,
      // ── Diff micro-badge + review drawer ───────────────────────────────────
      `.dsh-diff-badge{margin-left:auto;flex:none;display:inline-flex;align-items:center;gap:6px;background:#ece7dd;border:0;border-radius:4px;padding:1px 7px;font-family:"SF Mono","Consolas",monospace;font-size:11px;line-height:16px;color:#7f7869;cursor:pointer;user-select:none}`,
      `.dsh-diff-badge:hover{background:#e3ddd1}`,
      `.dsh-diff-badge:focus-visible{outline:2px solid #da7756;outline-offset:1px}`,
      `.dsh-diff-add{color:#00c853}`,
      `.dsh-diff-del{color:#ff5f38}`,
      `.dsh-review-drawer{position:fixed;top:0;right:0;bottom:0;z-index:1200;display:flex;flex-direction:column;box-sizing:border-box;width:400px;max-width:100vw;background:#f5f3ee;color:#1d1b16;box-shadow:-4px 0 24px rgba(0,0,0,.08);transform:translateX(100%);transition:transform 200ms ease;will-change:transform;pointer-events:none;font-family:"SF Mono","Consolas",monospace}`,
      `.dsh-review-drawer[data-open="true"]{transform:translateX(0);pointer-events:auto}`,
      `.dsh-review-overlay{position:fixed;inset:0;z-index:1199;background:rgba(0,0,0,.1);opacity:0;pointer-events:none;transition:opacity 200ms ease}`,
      `.dsh-review-overlay[data-open="true"]{opacity:1;pointer-events:auto}`,
      `.dsh-review-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;height:52px;padding:0 16px;background:#ece7dd;border-bottom:1px solid #e3ddd1}`,
      `.dsh-review-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;color:#1d1b16}`,
      `.dsh-review-close{width:28px;height:28px;flex:none;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:#1d1b16;cursor:pointer;padding:0;position:relative;z-index:1}`,
      `.dsh-review-close:hover{background:#e3ddd1;color:#1d1b16}`,
      `.dsh-review-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:16px;padding:16px;overflow:auto}`,
      `.dsh-review-label{font-size:11px;line-height:16px;letter-spacing:.04em;text-transform:uppercase;color:#7f7869}`,
      `.dsh-review-diff{margin:0;flex:none;max-height:52vh;overflow:auto;border:1px solid #e3ddd1;border-radius:8px;background:#fff;padding:8px 0}`,
      `.dsh-diff-line{white-space:pre;padding:0 12px;font-size:12px;line-height:20px;color:#1d1b16}`,
      `.dsh-diff-line[data-kind="add"]{background:#00c853;color:#1d1b16}`,
      `.dsh-diff-line[data-kind="del"]{background:#ff5f38;color:#1d1b16}`,
      `.dsh-diff-line[data-kind="meta"]{color:#7f7869}`,
      `.dsh-review-preview{flex:none;display:flex;flex-direction:column;min-height:140px;border:1px solid #b4ab99;border-radius:8px;overflow:hidden;background:#f5f3ee}`,
      `.dsh-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid #e3ddd1;font-size:11px;line-height:16px;color:#7f7869}`,
      `.dsh-preview-refresh{width:22px;height:22px;flex:none;display:grid;place-items:center;border:0;border-radius:5px;background:transparent;color:#7f7869;cursor:pointer;padding:0}`,
      `.dsh-preview-refresh:hover{background:#e3ddd1;color:#1d1b16}`,
      `.dsh-preview-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:16px;font-size:11px;line-height:16px;color:#7f7869}`,
      `.dsh-preview-body strong{font-weight:400;color:#1d1b16}`,
      // ── v1 forced layer (the last word) ───────────────────────────────────
      // Applies the original "warm, elegant" spec globally with !important:
      // serif UI face first, SF Mono for every code/mono surface, surface
      // #f5f3ee, ink #1d1b16, accent #da7756 and the v1 diff semantics.
      `html,body{font-family:${UI_FONT}!important;font-weight:400!important;font-synthesis:none!important}`,
      `body,body *{font-family:${UI_FONT}!important}`,
      `code,code *,pre,pre *,kbd,kbd *,samp,samp *,.shiki,.shiki *,.xterm,.xterm *,.monaco-editor,.monaco-editor *,.duo-tile-value,.duo-tile-value *,.duo-model-tokens,.duo-model-tokens *,.dsh-composer-tray,.dsh-composer-tray *,.dsh-diff-badge,.dsh-diff-badge *,.dsh-review-drawer,.dsh-review-drawer *{font-family:${CODE_FONT}!important}`,
      `${LIGHT}{background-color:#f5f3ee!important;color:#1d1b16!important}`,
      `${DARK}{background-color:#24221f!important;color:#ece7dd!important}`,
      `${LIGHT} [class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]){background:#f5f3ee!important}`,
      `${DARK} [class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]){background:#2b2825!important}`,
      `${LIGHT} .dsh-composer-tray{color:#7f7869!important}`,
      `${DARK} .dsh-composer-tray{color:#9a9285!important}`,
      `${LIGHT} .dsh-hud-num,${LIGHT} .dsh-hud-agent-label,${LIGHT} .dsh-hud-context-label{color:#1d1b16!important}`,
      `${DARK} .dsh-hud-num,${DARK} .dsh-hud-agent-label,${DARK} .dsh-hud-context-label{color:#ece7dd!important}`,
      `${LIGHT} .dsh-hud-ring-track{stroke:#e3ddd1!important}`,
      `${DARK} .dsh-hud-ring-track{stroke:#4a443c!important}`,
      `${LIGHT} .dsh-hud-ring-progress{stroke:#da7756!important}`,
      `${DARK} .dsh-hud-ring-progress{stroke:#e8a184!important}`,
      `.dsh-hud-agent-dot{background:#da7756!important}`,
      `${LIGHT} .dsh-diff-badge{background:#ece7dd!important}`,
      `${DARK} .dsh-diff-badge{background:#3a3732!important}`,
      `.dsh-diff-add{color:#00c853!important}`,
      `.dsh-diff-del{color:#ff5f38!important}`,
      `.dsh-diff-line[data-kind="add"]{background:#00c853!important;color:#1d1b16!important}`,
      `.dsh-diff-line[data-kind="del"]{background:#ff5f38!important;color:#1d1b16!important}`,
      `.dsh-diff-line[data-kind="meta"]{color:#7f7869!important}`,
      `${LIGHT} .dsh-review-drawer,${LIGHT} .dsh-review-body,${LIGHT} .dsh-review-preview{background-color:#f5f3ee!important;color:#1d1b16!important}`,
      `${DARK} .dsh-review-drawer,${DARK} .dsh-review-body,${DARK} .dsh-review-preview{background-color:#24221f!important;color:#ece7dd!important}`,
      `${LIGHT} .dsh-review-head{background:#ece7dd!important}`,
      `${DARK} .dsh-review-head{background:#3a3732!important}`,
      `${LIGHT} .dsh-review-title,${LIGHT} .dsh-review-close{color:#1d1b16!important}`,
      `${DARK} .dsh-review-title,${DARK} .dsh-review-close{color:#ece7dd!important}`,
      `[class*="_sessionRow"][data-dsh-status="waiting"] [class*="_slot"]::before{background:#da7756!important;opacity:1!important}`,
      `[class*="_sessionRow"][data-dsh-status="idle"] [class*="_slot"]::before{background:#7f7869!important;opacity:.5!important}`,
      `${LIGHT} [class*="_composerHero"] [class*="_headline"],${LIGHT} [class*="_composerHero"] [class*="_titleGroup"]>span:not([class]){font-family:${UI_FONT}!important;color:#1d1b16!important}`,
      `body[data-ds-dark-theme] [class*="_composerHero"] [class*="_headline"],body[data-ds-dark-theme] [class*="_composerHero"] [class*="_titleGroup"]>span:not([class]){font-family:${UI_FONT}!important;color:#f0ede4!important}`,
    ].join('\n')

    // ── Real session status layer ───────────────────────────────────────────
    // The sidebar row itself is host-owned, so its status is read from the same
    // stores the host uses (`useSessionStatus` + `useSessions`, relayed through
    // the headless bridge) and written onto the row as `data-dsh-status`:
    //   pending interaction (approval / plan-review / question) → waiting
    //   running session (or running subagents)                  → busy
    //   everything else                                          → idle
    // The dot itself is a CSS pseudo-element on the host's leading slot, so it
    // is not a React child and a sidebar re-render can never delete it. Only the
    // row's `data-dsh-status` attribute is written from the real bridge stores.
    // M0-S4: a 500ms runtime ticker task and a runtime mutation task (both named
    // 'sidebar-status-dots') plus the bridge's change listeners keep it in sync;
    // the shared scheduler owns the single body observer and ticker.
    const SESSION_ROW_SELECTOR = '[role="treeitem"][data-row-key^="session:"]'
    const SESSION_ID_PREFIX = 'session:'

    /** Map the real per-session status snapshot onto rows + real dot spans. */
    function mountSessionStatus() {
      const rows = () => [...document.querySelectorAll(SESSION_ROW_SELECTOR)]
      const readStatus = (row, sessions) => {
        const key = row.getAttribute('data-row-key') ?? ''
        if (key.startsWith(SESSION_ID_PREFIX) === false) return null
        const id = key.slice(SESSION_ID_PREFIX.length)
        const status = sessions.statuses?.get(id) ?? null
        const summary = sessions.byId?.[id] ?? null
        const running = status?.running ?? summary?.running ?? false
        const pending = status?.pendingInteraction?.kind
        const subagents = sessions.subagents?.get(id) ?? 0
        if (pending !== undefined && pending !== null) return 'waiting'
        if (running === true || subagents > 0) return 'busy'
        return 'idle'
      }
      // Last known status per session: even when the bridge is momentarily
      // unavailable (HMR remount, render race) the row keeps its last status and
      // therefore its dot.
      const statusCache = new Map()
      let applying = false
      const apply = () => {
        if (applying === true) return
        applying = true
        try {
          const sessions = bridge.sessions
          for (const row of rows()) {
            const key = row.getAttribute('data-row-key') ?? ''
            if (key.startsWith(SESSION_ID_PREFIX) === false) continue
            const id = key.slice(SESSION_ID_PREFIX.length)
            let status = sessions === null ? undefined : readStatus(row, sessions)
            if (status !== null && status !== undefined) statusCache.set(id, status)
            else status = statusCache.get(id)
            if (status === undefined || status === null) continue
            if (row.dataset.dshStatus !== status) row.dataset.dshStatus = status
          }
        } finally {
          applying = false
        }
      }
      apply()
      // M0-S4: one mutation task + one 500ms ticker task ('sidebar-status-dots')
      // instead of a private observer and interval.
      const offMutation = runtimeOnMutation('sidebar-status-dots', apply)
      const offTicker = runtimeEvery('sidebar-status-dots', apply, 500)
      bridgeListeners.add(apply)
      return () => {
        bridgeListeners.delete(apply)
        offTicker()
        offMutation()
        statusCache.clear()
        for (const row of document.querySelectorAll('[data-dsh-status]')) delete row.dataset.dshStatus
      }
    }

    // ── Hero dashboard card placement ──────────────────────────────────────
    // New-session hero, pinned layout matching the user's sketch:
    //   • usage card   → square at the upper-left of the content area, with a
    //                    soft ink shadow (fixed so it never re-centers);
    //   • menu row     → fixed directly above the composer, left aligned;
    //   • composer     → fixed at the lower block the user drew, same size.
    // Everything is released when the hero unmounts (conversation page).
    function mountHeroDashboardCard() {
      const state = { card: null, row: null, composer: null, natural: null }
      let scheduled = 0

      const unpin = (element) => {
        if (element === null) return
        for (const property of ['position', 'left', 'top', 'width', 'height', 'max-width', 'margin', 'z-index', 'overflow', 'box-shadow', 'transform', 'transform-origin']) {
          element.style.removeProperty(property)
        }
      }

      const reset = () => {
        unpin(state.card)
        unpin(state.row)
        unpin(state.composer)
        if (state.card !== null) delete state.card.dataset.dshHeroCard
        state.card = null
        state.row = null
        state.composer = null
        state.natural = null
      }

      const measure = (element) => {
        const rect = element.getBoundingClientRect()
        return { left: Math.round(rect.left), width: Math.round(rect.width) }
      }

      const apply = () => {
        const hero = document.querySelector('[class*="_composerHero"]')
        document.documentElement.dataset.dshHero = hero === null ? 'false' : 'true'
        const card = document.querySelector('.duo-card')
        const row = document.querySelector('[class*="_heroWorkspaceRow"]')
        const composerCard = document.querySelector(
          '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])',
        )
        const composer = composerCard === null ? null : composerCard.closest('[class*="_root"]')
        if (hero === null || card === null || row === null || composer === null) {
          watchComposerCard(null)
          reset()
          return
        }
        watchComposerCard(composerCard)
        const nodeChanged = card !== state.card || row !== state.row || composer !== state.composer
        if (nodeChanged) {
          reset()
          state.card = card
          state.row = row
          state.composer = composer
        }
        // Stable anchors: the host exposes conversation regions as data
        // attributes, so the column geometry survives every class-hash rebuild.
        const seat = document.querySelector('[data-conversation-region="composer"]')
        const chat = document.querySelector('[data-conversation-region="chat"]')
        const seatRect = seat === null ? null : seat.getBoundingClientRect()
        const chatRect = chat === null ? null : chat.getBoundingClientRect()
        const contentLeft = Math.round(seatRect !== null ? seatRect.left : chatRect !== null ? chatRect.left : 0)
        const contentWidth = Math.max(
          360,
          Math.round(
            seatRect !== null
              ? seatRect.width
              : chatRect !== null
                ? chatRect.width
                : document.documentElement.clientWidth || window.innerWidth,
          ),
        )
        // The composer keeps the host's max width when it has one, otherwise a
        // comfortable reading column inside the chat area.
        const composerWidth = Math.round(Math.min(945, Math.max(480, contentWidth * 0.662)))
        const composerLeft = Math.round(contentLeft + (contentWidth - composerWidth) / 2)
        // The usage card sits top-left, aligned with the composer column and
        // scaled from the design reference width.
        const CARD_BASE_WIDTH = 427
        const REFERENCE_CONTENT_WIDTH = 1427
        const preferredScale = Math.min(1, Math.max(0.85, contentWidth / REFERENCE_CONTENT_WIDTH))
        const fitScale = Math.max(0.3, (contentWidth - 32) / CARD_BASE_WIDTH)
        const cardScale = Math.min(preferredScale, fitScale)
        const cardLeft = composerLeft
        const cardTop = 16
        // Align the menu row's content with the composer card's left/right edges:
        // row padding is 16px, so the row box spans the whole composer root.
        const rowWidth = composerWidth
        const rowLeft = composerLeft
        // Anchor the bottom block by its BOTTOM edge: the reserved HUD strip
        // (28px) stays empty and the composer grows UPWARD when content grows
        // (e.g. an attached image preview) instead of being clipped below.
        const reservedBottom = 28
        const setFixed = (element, values) => {
          element.style.setProperty('position', 'fixed', 'important')
          element.style.setProperty('left', values.left + 'px', 'important')
          element.style.setProperty('width', values.width + 'px', 'important')
          element.style.setProperty('margin', '0', 'important')
          element.style.setProperty('z-index', '5', 'important')
          if (values.top !== undefined) element.style.setProperty('top', values.top + 'px', 'important')
          else element.style.setProperty('top', 'auto', 'important')
          if (values.bottom !== undefined) element.style.setProperty('bottom', values.bottom + 'px', 'important')
          else element.style.removeProperty('bottom')
          if (values.height !== undefined) element.style.setProperty('height', values.height + 'px', 'important')
          if (values.shadow !== undefined) element.style.setProperty('box-shadow', values.shadow, 'important')
          if (values.transform !== undefined) {
            element.style.setProperty('transform', values.transform, 'important')
            element.style.setProperty('transform-origin', '0 0', 'important')
          }
        }
        setFixed(card, {
          left: cardLeft,
          top: cardTop,
          width: CARD_BASE_WIDTH,
          transform: 'scale(' + cardScale + ')',
          shadow: '0 14px 40px rgba(29, 27, 22, 0.12), 0 2px 8px rgba(29, 27, 22, 0.05)',
        })
        card.dataset.dshHeroCard = 'true'
        card.style.setProperty('max-width', 'none', 'important')
        card.style.setProperty('height', 'auto', 'important')
        card.style.setProperty('overflow', 'hidden', 'important')
        row.style.setProperty('box-sizing', 'border-box', 'important')
        composer.style.setProperty('box-sizing', 'border-box', 'important')
        row.style.setProperty('box-sizing', 'border-box', 'important')
        composer.style.setProperty('box-sizing', 'border-box', 'important')
        setFixed(composer, {
          left: composerLeft,
          width: composerWidth,
          bottom: reservedBottom,
        })
        const composerHeight = Math.round(composer.getBoundingClientRect().height)
        setFixed(row, {
          left: rowLeft,
          width: rowWidth,
          bottom: reservedBottom + composerHeight + 10,
        })
        row.style.setProperty('padding', '0 16px', 'important')
      }

      const schedule = () => {
        if (scheduled !== 0) return
        scheduled = window.requestAnimationFrame(() => {
          scheduled = 0
          apply()
        })
      }

      // M0-S4: 'hero-layout' is a mutation task now (no 800ms full re-measure).
      // The composer card can grow without any childList mutation (attachments,
      // multi-line input), so its box is observed to re-run the same apply pass;
      // viewport changes keep using the existing resize listener.
      let composerResizeObserver = null
      let observedComposerCard = null
      const watchComposerCard = (card) => {
        if (card === observedComposerCard) return
        if (composerResizeObserver === null && typeof ResizeObserver === 'function') {
          composerResizeObserver = new ResizeObserver(schedule)
        }
        if (composerResizeObserver !== null) {
          if (observedComposerCard !== null) composerResizeObserver.unobserve(observedComposerCard)
          if (card !== null) composerResizeObserver.observe(card)
        }
        observedComposerCard = card
      }
      schedule()
      const offMutation = runtimeOnMutation('hero-layout', apply)
      window.addEventListener('resize', schedule)
      return () => {
        offMutation()
        window.removeEventListener('resize', schedule)
        if (scheduled !== 0) window.cancelAnimationFrame(scheduled)
        scheduled = 0
        if (composerResizeObserver !== null) composerResizeObserver.disconnect()
        composerResizeObserver = null
        observedComposerCard = null
        reset()
      }
    }

    // ── Hero dropdowns open upward ──────────────────────────────────────────
    // The workspace and mode pickers sit directly above the composer now; their
    // host portals still open downward over the input. Re-anchor any open hero
    // menu above its trigger so the option list extends upward.
    const HERO_MENU_TRIGGER_SELECTOR = '[class*="_workspace"]:not([class*="_workspaceRow"]):not([class*="_workspaceLabel"]), [class*="_seat"]:not([class*="_seatIcon"]):not([class*="_seatLabel"])'
    const HERO_MENU_PANEL_SELECTOR = '[role="menu"][class*="_portal"]'

    function mountHeroMenusUpward() {
      let scheduled = 0
      const reposition = () => {
        const hero = document.querySelector('[class*="_composerHero"]')
        if (hero === null) return
        const triggers = [...hero.querySelectorAll(HERO_MENU_TRIGGER_SELECTOR)]
          .filter((trigger) => trigger.getAttribute('aria-expanded') === 'true')
        if (triggers.length === 0) return
        for (const panel of document.querySelectorAll(HERO_MENU_PANEL_SELECTOR)) {
          const panelRect = panel.getBoundingClientRect()
          const trigger = triggers.find((candidate) => {
            const rect = candidate.getBoundingClientRect()
            // Match by horizontal alignment only: the host clamps a too-tall
            // menu to the viewport, so its initial top may already sit above the
            // trigger. Only one hero menu is open at a time.
            const overlapsHorizontally = panelRect.left < rect.right + 40 && panelRect.right > rect.left - 40
            return overlapsHorizontally
          })
          if (trigger === undefined) continue
          const triggerRect = trigger.getBoundingClientRect()
          const top = Math.round(triggerRect.top - panelRect.height - 4)
          if (Math.abs(panelRect.top - top) > 1) {
            panel.style.setProperty('top', top + 'px', 'important')
            panel.dataset.dshMenuUp = 'true'
          }
        }
      }
      const schedule = () => {
        if (scheduled !== 0) return
        scheduled = window.requestAnimationFrame(() => {
          scheduled = 0
          reposition()
        })
      }
      schedule()
      // M0-S4: 'hero-menu-upward' is a mutation task now (no 200ms interval);
      // the open panel is viewport-fixed, so scroll/resize still re-anchor it.
      const offMutation = runtimeOnMutation('hero-menu-upward', reposition)
      window.addEventListener('scroll', schedule, { capture: true, passive: true })
      window.addEventListener('resize', schedule)
      return () => {
        offMutation()
        window.removeEventListener('scroll', schedule, { capture: true })
        window.removeEventListener('resize', schedule)
        if (scheduled !== 0) window.cancelAnimationFrame(scheduled)
        scheduled = 0
        for (const panel of document.querySelectorAll('[data-dsh-menu-up="true"]')) {
          panel.style.removeProperty('top')
          delete panel.dataset.dshMenuUp
        }
      }
    }

    // ── Usage card: real model display name ─────────────────────────────────
    // The usage Host folds the raw model id (e.g. "deepseek-flash") for the
    // favourite-model tile. Resolve it through the Host model catalog so the
    // tile shows the real, full display name of the model actually used most
    // (e.g. "DeepSeek-V4.1-Flash") instead of the raw text.
    const modelNamesById = new Map()

    function mountUsageModelLabels(ctx) {
      const loadCatalog = ctx.remote?.session?.modelCatalog
      if (typeof loadCatalog !== 'function') return () => {}
      let loaded = false
      const decorate = () => {
        if (modelNamesById.size === 0) return
        for (const valueEl of document.querySelectorAll('.duo-grid>.duo-tile:last-child .duo-tile-value')) {
          const raw = (valueEl.textContent ?? '').trim()
          if (raw === '') continue
          const display = modelNamesById.get(raw) ?? raw
          if (valueEl.textContent !== display) valueEl.textContent = display
          if (valueEl.getAttribute('title') !== display) valueEl.setAttribute('title', display)
        }
        for (const nameEl of document.querySelectorAll('.duo-model-name')) {
          const raw = (nameEl.textContent ?? '').trim()
          const display = modelNamesById.get(raw)
          if (display !== undefined && display !== raw) nameEl.textContent = display
        }
      }
      const load = async () => {
        try {
          const response = await loadCatalog()
          if (response?.ok !== true) return
          const groups = response.value?.groups
          if (!Array.isArray(groups)) return
          for (const group of groups) {
            if (typeof group?.id !== 'string' || !Array.isArray(group.models)) continue
            for (const model of group.models) {
              if (typeof model?.id !== 'string' || typeof model?.name !== 'string') continue
              if (model.id !== '' && model.name !== '') modelNamesById.set(model.id, model.name)
            }
          }
          loaded = true
          decorate()
        } catch {
          // Catalog unavailable: the raw id remains visible.
        }
      }
      void load()
      const poll = () => {
        if (loaded === false && modelNamesById.size === 0) void load()
        decorate()
      }
      // M0-S4: 'usage-model-labels' runs as one mutation task + one 700ms ticker
      // task on the shared scheduler instead of a private observer and interval.
      const offMutation = runtimeOnMutation('usage-model-labels', decorate)
      const offTicker = runtimeEvery('usage-model-labels', poll, 700)
      return () => {
        offMutation()
        offTicker()
      }
    }

    // ── Sidebar footer balance ──────────────────────────────────────────────
    // The account balance is no longer shown under the input; it lives in the
    // sidebar footer row (right of the account name) and stays visible on every
    // page. Value comes from the hidden legacy bar (`余额 …`).
    const SIDEBAR_BALANCE_CLASS = 'dsh-sidebar-footer-balance'

    // M0-S4: locate the sidebar account launcher by host *semantics*, not by a
    // build hash or by an attribute another plugin happens to inject. The
    // settings.launcher slot is the host-declared seat for the sidebar account
    // launcher (HOST-PROBE §2.9); data-signed-out is a live extra, kept as a
    // fallback because static host code does not declare it.
    const ACCOUNT_TRIGGER_SELECTORS = [
      '[data-slot="settings.launcher"] button',
      '[data-slot="settings.launcher"] [role="button"]',
      'button[data-signed-out]',
      'button[aria-haspopup="dialog"][aria-label*="账户"]',
    ]

    function findAccountTrigger() {
      for (const selector of ACCOUNT_TRIGGER_SELECTORS) {
        let candidates = []
        try {
          candidates = [...document.querySelectorAll(selector)]
        } catch (error) {
          continue
        }
        for (const candidate of candidates) {
          if (candidate.querySelector(':scope > span') !== null) return candidate
        }
        if (candidates.length > 0) return candidates[0]
      }
      return null
    }

    function ensureSidebarBalance() {
      const row = findAccountTrigger()
      if (row === null) return null
      let node = row.querySelector(':scope > .' + SIDEBAR_BALANCE_CLASS)
      if (node === null) {
        node = document.createElement('span')
        node.className = SIDEBAR_BALANCE_CLASS
        node.setAttribute('aria-label', '账户余额')
        row.appendChild(node)
      }
      const text = '余额 ' + (lastKnownBalance ?? '—')
      if (node.textContent !== text) node.textContent = text
      return node
    }

    function syncSidebarBalance() {
      ensureSidebarBalance()
    }

    function mountSidebarBalance() {
      ensureSidebarBalance()
      // M0-S4: 'sidebar-balance' runs as one mutation task + one 1000ms ticker
      // task on the shared scheduler instead of a private observer and interval.
      const offMutation = runtimeOnMutation('sidebar-balance', ensureSidebarBalance)
      const offTicker = runtimeEvery('sidebar-balance', ensureSidebarBalance, 1000)
      return () => {
        offMutation()
        offTicker()
        for (const node of document.querySelectorAll('.' + SIDEBAR_BALANCE_CLASS)) node.remove()
      }
    }

    // ── Composer HUD tray ───────────────────────────────────────────────────
    // A quiet 16px line rendered directly below the composer card (8px gap),
    // two ends aligned. Left: context ring + cache countdown. Right: session
    // cost, account balance and agents. The cost/balance values are scraped
    // from the old bottom bar (`[class*="_root"]:has([data-lexical-editor="true"]) [class*="_dock"]`, kept mounted but display:none),
    // so the legacy plugin keeps computing them while the new tray stays on a
    // single line. Injected as a sibling of `[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])`, so the card never
    // grows; the shared runtime mutation task re-creates it when the composer re-renders.
    const TRAY_CLASS = 'dsh-composer-tray'
    const TRAY_RING_RADIUS = 4.6
    const TRAY_RING_LENGTH = 2 * Math.PI * TRAY_RING_RADIUS
    const TRAY_CONTEXT_FALLBACK = 24
    const TRAY_COST_FALLBACK = '—'

    /** Build one tray element: ring + 上下文, 缓存 | 花费, 余额, Agents. */
    function createComposerTray() {
      const tray = document.createElement('div')
      tray.className = TRAY_CLASS
      tray.setAttribute('aria-label', 'Composer status')
      const ring = [
        '<svg class="dsh-hud-ring" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">',
        '<circle class="dsh-hud-ring-track" cx="6" cy="6" r="' + TRAY_RING_RADIUS + '" fill="none" stroke="#e3ddd1" stroke-width="1.7"/>',
        '<circle class="dsh-hud-ring-progress" cx="6" cy="6" r="' + TRAY_RING_RADIUS + '" fill="none" stroke="#da7756" stroke-width="1.7"',
        ' stroke-linecap="round" stroke-dasharray="' + TRAY_RING_LENGTH.toFixed(2) + '"',
        ' stroke-dashoffset="' + (TRAY_RING_LENGTH * (1 - TRAY_CONTEXT_FALLBACK / 100)).toFixed(2) + '"',
        ' transform="rotate(-90 6 6)"/></svg>',
      ].join('')
      tray.innerHTML = [
        '<div class="dsh-tray-group dsh-tray-left">',
        '<span class="dsh-hud-part dsh-hud-context">' + ring + '<span class="dsh-hud-context-label">上下文 <span class="dsh-hud-num dsh-hud-context-value">—</span></span></span>',
        '<span class="dsh-hud-part dsh-hud-cache"><span class="dsh-hud-cache-label">缓存命中</span> <span class="dsh-hud-num dsh-hud-cache-value">—</span></span>',
        '</div>',
        '<div class="dsh-tray-group dsh-tray-right">',
        '<span class="dsh-hud-part dsh-hud-cost"><span class="dsh-hud-cost-label">本次花费</span> <span class="dsh-hud-num dsh-hud-cost-value">' + TRAY_COST_FALLBACK + '</span></span>',
        '<span class="dsh-tray-sep" aria-hidden="true">·</span>',
        '<span class="dsh-hud-part dsh-hud-tps"><span class="dsh-hud-num dsh-hud-tps-value">—</span><span class="dsh-hud-tps-unit">tok/s</span></span>',
        '<span class="dsh-tray-sep dsh-tray-sep-agents" aria-hidden="true">·</span>',
        '<span class="dsh-hud-part dsh-hud-agents" style="display:none"><span class="dsh-hud-agent-dot" aria-hidden="true"></span><span class="dsh-hud-agent-label">0 Agents</span></span>',
        '</div>',
      ].join('')
      return tray
    }

    // Numbers get fixed-width slots so a value change never rewraps the row,
    // and cached node references so a 2 Hz tick costs no querySelector sweep.
    const hudTrayParts = new WeakMap()

    /** Child nodes of one tray, resolved once and cached. */
    function hudPartsOf(tray) {
      let parts = hudTrayParts.get(tray)
      if (parts !== undefined) return parts
      parts = {
        cachePart: tray.querySelector('.dsh-hud-cache'),
        cache: tray.querySelector('.dsh-hud-cache-value'),
        costPart: tray.querySelector('.dsh-hud-cost'),
        cost: tray.querySelector('.dsh-hud-cost-value'),
        tpsPart: tray.querySelector('.dsh-hud-tps'),
        tps: tray.querySelector('.dsh-hud-tps-value'),
        progress: tray.querySelector('.dsh-hud-ring-progress'),
        contextPart: tray.querySelector('.dsh-hud-context'),
        context: tray.querySelector('.dsh-hud-context-value'),
        agentsPart: tray.querySelector('.dsh-hud-agents'),
        agentsSep: tray.querySelector('.dsh-tray-sep-agents'),
        agentsLabel: tray.querySelector('.dsh-hud-agent-label'),
      }
      hudTrayParts.set(tray, parts)
      return parts
    }

    const HUD_REDUCED_MOTION = (() => {
      try {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true
      } catch {
        return false
      }
    })()

    /** Fade/slide one number on change: opacity + transform only, no reflow. */
    function flashHudValue(element) {
      if (HUD_REDUCED_MOTION || element === null || typeof element.animate !== 'function') return
      try {
        element.animate(
          [{ opacity: 0.35, transform: 'translateY(1px)' }, { opacity: 1, transform: 'none' }],
          { duration: 150, easing: 'ease-out' },
        )
      } catch {
        // Animation is cosmetic only.
      }
    }

    /** Write text only when it changed, then flash the number. */
    function setHudText(element, text) {
      if (element === null || element === undefined) return
      if (element.textContent === text) return
      element.textContent = text
      flashHudValue(element)
    }

    /** Write a tooltip only when it changed. */
    function setHudTitle(element, title) {
      if (element === null || element === undefined) return
      const next = typeof title === 'string' ? title : ''
      if (element.getAttribute('title') === next) return
      if (next === '') element.removeAttribute('title')
      else element.setAttribute('title', next)
    }

    const BALANCE_CACHE_KEY = 'dsh-theme-last-balance'
    const COST_CACHE_KEY = 'dsh-theme-last-session-cost'
    const SESSION_COST_ROUTE = '/api/dsh-claude-code-desktop-theme/usage-summary'
    /** Client-side fetch floor; the host route has its own 5 s fold cache. */
    const SESSION_COST_THROTTLE_MS = 2000
    // Display state of the host estimate. `text` always carries its provenance
    // (a leading `~` for estimates); bottom-info-bar's actual charge never
    // enters this object, it is read straight from the hidden dock per tick.
    const sessionCost = { id: null, text: null, title: '', source: null, estimated: false }
    let sessionCostFetchedAt = 0
    let sessionCostPending = false
    let lastKnownBalance = null
    let lastKnownTps = null
    try {
      const cached = window.localStorage.getItem(BALANCE_CACHE_KEY)
      if (typeof cached === 'string' && cached !== '') lastKnownBalance = cached
    } catch {
      // localStorage may be unavailable in restricted profiles.
    }

    /** Read cost / balance / tokens-per-second out of the hidden legacy bar. */
    function readLegacyStats() {
      const dock = document.querySelector('[class*="_root"]:has([data-lexical-editor="true"]) [class*="_dock"]')
      const text = dock === null ? '' : (dock.textContent || '')
      const pick = (pattern) => {
        const match = text.match(pattern)
        return match === null ? undefined : match[1].replace(/\s+/g, '')
      }
      const format = (raw) => {
        const match = /^([¥￥$]?)([\d,]*\.?[\d]+)$/.exec(raw)
        if (match === null) return raw
        const value = Number(match[2].replace(/,/g, ''))
        if (Number.isFinite(value) === false) return raw
        return match[1] + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      }
      const rawBalance = pick(/(?:余额|额度)[^¥￥$0-9]{0,8}([¥￥$]?\s*[\d][\d,.]*)/)
      const balance = rawBalance === undefined ? lastKnownBalance : format(rawBalance)
      const tpsMatch = text.match(/([\d.,]+)\s*tok\/s/)
      const cacheMatch = text.match(/(?:缓存命中|cache hit)\s*([\d.]+%)/)
      const rawCost = pick(/(?:本会话|本次花费|本次)[^¥￥$0-9]{0,8}([¥￥$]?\s*[\d][\d,.]*)/)
      if (balance !== undefined) lastKnownBalance = balance
      if (tpsMatch !== null) lastKnownTps = tpsMatch[1] + ' tok/s'
      return {
        cost: format(rawCost ?? TRAY_COST_FALLBACK),
        costKnown: rawCost !== undefined,
        balance,
        tps: tpsMatch === null ? lastKnownTps : tpsMatch[1] + ' tok/s',
        cacheHit: cacheMatch === null ? null : cacheMatch[1],
      }
    }

    /* ── Plugin-page update check ─────────────────────────────────────────── */

    const UPDATE_STATUS_ROUTE = '/api/dsh-claude-code-desktop-theme/update-status'
    const UPDATE_APPLY_ROUTE = '/api/dsh-claude-code-desktop-theme/update-apply'
    const UPDATE_ROW_ID = 'dsh-theme-update-row'
    const UPDATE_PACKAGE_NAME = 'dsh-claude-code-desktop-theme'

    /**
     * DSH offers an update action only for its own optional bundles; a third
     * party profile plugin has to be uninstalled and reinstalled by hand. This
     * adds a small status row to our own card on the plugin page: it asks the
     * host for the installed and published versions, then runs the same
     * `pnpm add` the plugin manager would run.
     *
     * The row anchors on the "当前版本 / Current version" line, the one label
     * this page renders for every profile plugin. React may re-render the card
     * at any time, so a mutation observer puts the row back.
     */
    function mountUpdatePanel() {
      const ROUTES = { status: UPDATE_STATUS_ROUTE, apply: UPDATE_APPLY_ROUTE }
      const state = { phase: 'idle', info: null, message: '', failedCommand: '' }
      let disposed = false
      let debounce = null

      const post = async (route) => {
        const response = await fetch(route, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        })
        let payload = null
        try {
          payload = await response.json()
        } catch {
          throw new Error(`HTTP ${response.status}`)
        }
        if (payload?.ok !== true) throw new Error(payload?.error?.message ?? `HTTP ${response.status}`)
        return payload.value
      }

      /** 复制一条命令；剪贴板不可用时退回选中式 texarea。 */
      const copyText = async (text) => {
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(text)
            return
          }
        } catch {
          // fall through to the legacy path
        }
        try {
          const area = document.createElement('textarea')
          area.value = text
          area.style.cssText = 'position:fixed;left:-9999px;top:0'
          document.body.append(area)
          area.select()
          document.execCommand('copy')
          area.remove()
        } catch {
          // nothing else to try
        }
      }

      const makeButton = (label, onClick, disabled) => {
        const node = document.createElement('button')
        node.type = 'button'
        node.textContent = label
        node.disabled = disabled === true
        node.style.cssText = [
          'padding:3px 12px',
          'border-radius:6px',
          'border:1px solid #d97757',
          'background:#d97757',
          'color:#fff',
          'font:inherit',
          'font-size:12px',
          'line-height:20px',
          'cursor:pointer',
          node.disabled ? 'opacity:.55;cursor:default' : '',
        ]
          .filter((rule) => rule !== '')
          .join(';')
        if (!node.disabled) node.addEventListener('click', onClick)
        return node
      }

      const describe = () => {
        const info = state.info
        if (state.phase === 'loading') return '正在查询 npm registry…'
        if (state.phase === 'applying') return '正在下载并安装…'
        if (state.message !== '') return state.message
        if (info === null) return '正在读取版本…'
        const failed = info.latest === null
          ? ` · 查询 npm 失败${info.error ? `：${String(info.error).slice(0, 80)}` : ''}`
          : ''
        // link 模式不能走 npm 安装，但仍然要告诉作者「本地和已发布谁更新」。
        if (info.source === 'link') {
          if (info.latest === null) return `本地开发 ${info.current}（link）${failed}`
          return info.hasUpdate === true
            ? `本地开发 ${info.current}（link）· npm 已发布 ${info.latest}（本地落后，需在该目录 git pull）`
            : `本地开发 ${info.current}（link）· npm 最新 ${info.latest}（已同步或本地更新）`
        }
        if (info.source === 'unknown') return `当前 ${info.current} · 无法确定安装来源${failed}`
        if (info.latest === null) return `当前 ${info.current}${failed}`
        const pending = typeof info.installed === 'string' && info.installed !== info.current
          ? `（已安装 ${info.installed}，重启后生效）`
          : ''
        if (info.hasUpdate === true) return `当前 ${info.current}${pending} · 最新 ${info.latest}`
        return `当前 ${info.current}${pending} · 已是最新 ${info.latest}`
      }

      /**
       * 观察期说明：pnpm 11 默认不解析发布未满 24 小时的版本，普通安装会
       * 静默落到旧版。面板必须把这件事讲出来，否则「更新了却没变化」会被
       * 当成插件坏了。
       */
      const describeNote = () => {
        const info = state.info
        if (info === null || info.cooldownActive !== true || info.canApply !== true) return ''
        const until = typeof info.cooldownUntil === 'string' ? new Date(info.cooldownUntil) : null
        const when = until === null || Number.isNaN(until.getTime()) ? '' : until.toLocaleString()
        return (
          `${info.latest} 发布未满 24 小时：直接安装 latest 会解析到旧版。` +
          `下方按钮按精确版本 ${info.latest} 安装，可跳过等待` +
          (when === '' ? '。' : `；普通安装需等到 ${when}。`)
        )
      }

      const render = (panel) => {
        panel.textContent = ''
        const dark = document.body.hasAttribute('data-ds-dark-theme')
        panel.style.cssText = [
          'display:flex',
          'flex-direction:column',
          'align-items:stretch',
          'justify-content:flex-start',
          'gap:6px',
          'width:100%',
          'box-sizing:border-box',
          'margin:10px 0 0',
          'padding:8px 12px',
          'border:1px solid transparent',
          'border-radius:8px',
          `background:${dark ? '#2a2723' : '#faf8f2'}`,
          `border-color:${dark ? '#3a352e' : '#ece5d8'}`,
          `color:${dark ? '#c9c2b4' : '#6b6459'}`,
          'font-size:12px',
          'line-height:1.5',
          'text-align:left',
          'min-height:0',
        ].join(';')

        // 宿主 `.facts div` 会给区域内每个 div 加 display:flex / space-between /
        // align-items:center，必须逐项覆盖，否则文字被居中、按钮被顶到最右。
        const row = document.createElement('div')
        row.style.cssText =
          'display:flex;align-items:center;justify-content:flex-start;gap:10px;flex-wrap:wrap;' +
          'width:100%;padding:0;border-bottom:none;min-height:0;text-align:left'
        const label = document.createElement('span')
        label.style.cssText = 'flex:1 1 auto;min-width:200px;text-align:left'
        label.textContent = describe()
        row.append(label)
        panel.append(row)

        const info = state.info
        if (state.phase === 'loading' || state.phase === 'applying') {
          row.append(makeButton(state.phase === 'loading' ? '检查中' : '更新中', () => {}, true))
          return
        }
        if (info !== null && info.source === 'registry' && info.hasUpdate === true) {
          row.append(makeButton(`更新到 ${info.latest}`, () => void apply(info), false))
          row.append(makeButton('忽略', () => {
            state.phase = 'idle'
            state.message = '已忽略本次更新'
            const current = document.getElementById(UPDATE_ROW_ID)
            if (current !== null) render(current)
          }, false))
        } else if (info !== null && info.source === 'registry') {
          row.append(makeButton('重新检查', () => void check(), false))
        } else if (info !== null && info.source === 'link') {
          // 工作副本的「更新」是拉代码；把命令复制好，省得用户自己拼路径。
          const workCopy =
            typeof info.spec === 'string' && info.spec.startsWith('link:')
              ? info.spec.slice('link:'.length)
              : null
          row.append(makeButton('复制 git pull', () => {
            const command = workCopy === null ? 'git pull' : `git -C "${workCopy}" pull`
            void copyText(command)
            state.message = `已复制：${command}`
            const current = document.getElementById(UPDATE_ROW_ID)
            if (current !== null) render(current)
          }, false))
          row.append(makeButton('重新检查', () => void check(), false))
        } else if (info !== null) {
          row.append(makeButton('重新检查', () => void check(), false))
        }

        // 失败时给一条能直接粘贴的命令，不让用户卡在「更新失败」四个字上。
        if (state.failedCommand !== '') {
          row.append(makeButton('复制安装命令', () => {
            void copyText(state.failedCommand)
            state.message = '安装命令已复制，可在 profile 目录执行'
            const current = document.getElementById(UPDATE_ROW_ID)
            if (current !== null) render(current)
          }, false))
        }

        const note = describeNote()
        if (note !== '') {
          const hint = document.createElement('div')
          hint.style.cssText =
            'display:block;width:100%;padding:0;border-bottom:none;min-height:0;text-align:left;' +
            `opacity:.85;font-size:12px;${dark ? 'color:#b8b0a2' : 'color:#7a7266'}`
          hint.textContent = note
          panel.append(hint)
        }
      }

      const paint = () => {
        const panel = document.getElementById(UPDATE_ROW_ID)
        if (panel !== null) render(panel)
      }

      const check = async () => {
        if (disposed || state.phase === 'loading' || state.phase === 'applying') return
        state.phase = 'loading'
        state.message = ''
        state.failedCommand = ''
        paint()
        try {
          state.info = await post(ROUTES.status)
          state.phase = 'idle'
        } catch (error) {
          state.phase = 'idle'
          state.message = `检查失败：${String(error?.message ?? error)}`
        }
        paint()
      }

      const apply = async (info) => {
        if (disposed || state.phase === 'applying') return
        const cooldown = info.cooldownActive === true
          ? '\n\n该版本发布未满 24 小时，直接用 pnpm 装 latest 会解析到旧版；本次按精确版本安装，可跳过观察期。'
          : ''
        const ok = window.confirm(
          `更新到 ${info.latest}？\n\n当前 ${info.current}，将以精确版本 ${info.latest} 安装。` +
            `${cooldown}\n\n安装完成后需要重启 DeepSeek Harness 才会生效。`,
        )
        if (ok !== true) return
        state.phase = 'applying'
        state.message = ''
        state.failedCommand = ''
        paint()
        try {
          const result = await post(ROUTES.apply)
          state.phase = 'idle'
          if (result?.ok === true) {
            const to = typeof result.to === 'string' ? result.to : info.latest
            if (result.alreadyInstalled === true) {
              state.message = `已是最新 ${to}${result.restartRequired === true ? '，重启后生效' : ''}`
            } else {
              state.message = `已安装 ${to}（校验通过）${result.restartRequired === true ? '，重启 DeepSeek Harness 后生效' : ''}`
            }
            state.info = {
              ...info,
              current: to,
              installed: to,
              hasUpdate: false,
              cooldownActive: false,
              cooldownUntil: null,
            }
          } else {
            const reason = result?.reason
            const hint =
              reason === 'link'
                ? '本地 link 模式：请到该目录执行 git pull'
                : reason === 'verify'
                  ? '安装后校验失败：磁盘上的版本没有变化'
                  : reason === 'registry'
                    ? '无法读取 npm 上的最新版本'
                    : reason === 'pnpm'
                      ? 'pnpm 安装失败'
                      : '未知原因'
            const detail = result?.message ? `（${String(result.message).slice(0, 160)}）` : ''
            state.message = `更新失败：${hint}${detail}`
            if (reason !== 'link') {
              const profile = typeof info.profile === 'string' && info.profile !== '' ? info.profile : '<profile>'
              state.failedCommand = `pnpm add ${UPDATE_PACKAGE_NAME}@${info.latest} --dir ${profile}`
            }
          }
        } catch (error) {
          state.phase = 'idle'
          state.message = `更新失败：${String(error?.message ?? error)}`
          const profile = typeof info.profile === 'string' && info.profile !== '' ? info.profile : '<profile>'
          state.failedCommand = `pnpm add ${UPDATE_PACKAGE_NAME}@${info.latest} --dir ${profile}`
        }
        paint()
      }

      // O(n) scan #1 (M0-S4): this used to read the whole body's text on every
      // probe — an entire chat transcript on the wrong page. The version line is
      // a definition-list row, so only label-size nodes are read (64 chars
      // each); the div-rendered fallback probes bounded plugin-page hosts only
      // and caps its text read at 200k. No page-wide text read remains.
      const UPDATE_PROBE_SELECTORS = ['.facts', '[data-slot="settings.plugins"]', '[role="dialog"]']
      const UPDATE_PROBE_TEXT_LIMIT = 200000
      const UPDATE_PROBE_NODE_LIMIT = 2000

      const isVersionLabel = (text) =>
        text.startsWith('当前版本') || /^Current version/i.test(text)

      /** First candidate whose own text starts with the version label. */
      const anchorFor = (scope) => {
        const nodes = scope.querySelectorAll('div,dl,li')
        const limit = Math.min(nodes.length, UPDATE_PROBE_NODE_LIMIT)
        for (let index = 0; index < limit; index += 1) {
          const node = nodes[index]
          if (node.childElementCount > 2) continue
          const text = (node.textContent ?? '').slice(0, 32).trim()
          if (text.length > 24) continue
          if (isVersionLabel(text)) return node
        }
        return null
      }

      /** Anchor of the "当前版本 / Current version" row, from a bounded set. */
      const findVersionAnchor = () => {
        // Fast path: the host renders the line as <dt>当前版本</dt>. Only those
        // label-size nodes are read, so a chat transcript is never touched.
        let labels = []
        try {
          labels = document.querySelectorAll('dt')
        } catch {
          labels = []
        }
        const labelLimit = Math.min(labels.length, UPDATE_PROBE_NODE_LIMIT)
        for (let index = 0; index < labelLimit; index += 1) {
          if (isVersionLabel((labels[index].textContent ?? '').slice(0, 64).trim())) return labels[index]
        }
        // Div-rendered variant: bounded plugin-page hosts, then a scoped scan.
        for (const selector of UPDATE_PROBE_SELECTORS) {
          let scopes = []
          try {
            scopes = document.querySelectorAll(selector)
          } catch {
            continue
          }
          for (const scope of scopes) {
            const text = (scope.textContent ?? '').slice(0, UPDATE_PROBE_TEXT_LIMIT)
            if (!text.includes('当前版本') && !text.includes('Current version')) continue
            const anchor = anchorFor(scope)
            if (anchor !== null) return anchor
          }
        }
        return null
      }

      const ensure = () => {
        if (disposed) return
        const existing = document.getElementById(UPDATE_ROW_ID)
        if (existing !== null) {
          render(existing)
          return
        }
        // Cheap gate: only the plugin page renders this label; a chat session
        // has no candidate, so neither the label read nor the scan runs there.
        const anchor = findVersionAnchor()
        if (anchor === null) return
        // 目标是「当前版本」那一整行（dt + dd 的容器），这样面板作为 .facts
        // 的直接子项独占一行；若只匹配到 dt，就上提到它的行容器。
        const row =
          anchor.tagName === 'DT' || anchor.tagName === 'DD'
            ? (anchor.parentElement ?? anchor)
            : anchor
        const panel = document.createElement('div')
        panel.id = UPDATE_ROW_ID
        row.insertAdjacentElement('afterend', panel)
        render(panel)
      }

      const schedule = () => {
        if (disposed || debounce !== null) return
        debounce = window.setTimeout(() => {
          debounce = null
          ensure()
        }, 400)
      }

      // M0-S4: the shared runtime owns the single body observer. The task keeps
      // this panel's own 400ms debounce, so a React burst still folds into one
      // scan; disposal just unregisters the task.
      const disposeTask = runtimeOnMutation('hud-update-rows', schedule)

      ensure()
      void check()

      return () => {
        disposed = true
        disposeTask()
        if (debounce !== null) window.clearTimeout(debounce)
        const panel = document.getElementById(UPDATE_ROW_ID)
        if (panel !== null) panel.remove()
      }
    }

    /**
     * Mount the HUD tray below every composer card and tick the cache
     * countdown. The tray is a sibling of the card, so it never changes the
     * card's height; the shared runtime mutation task re-creates it after React
     * re-renders.
     * @returns a dispose callback that removes the trays and unregisters the tasks.
     */
    function mountComposerTray() {
      try {
        const cached = JSON.parse(window.localStorage.getItem(COST_CACHE_KEY) ?? 'null')
        if (cached !== null && typeof cached === 'object' && typeof cached.text === 'string') {
          // Everything restored from this key came from the estimate route, so
          // it must never resurface as an actual charge: an older cache row
          // without the `~` marker is upgraded here.
          const cachedText = cached.text
          sessionCost.id = typeof cached.sessionId === 'string' ? cached.sessionId : null
          sessionCost.text = cachedText.startsWith('~') ? cachedText : '~' + cachedText
          sessionCost.estimated = true
          sessionCost.source = typeof cached.source === 'string' ? cached.source : null
          sessionCost.title = '上次刷新得到的估算金额，正在重新核对'
        }
      } catch {
        // The cost cache is best effort.
      }

      const refreshSessionCost = () => {
        if (readLegacyStats().costKnown) return
        const sessionId = bridge.currentSessionId
        if (typeof sessionId !== 'string' || sessionId === '') return
        if (sessionCostPending) return
        if (sessionCost.id === sessionId && Date.now() - sessionCostFetchedAt < SESSION_COST_THROTTLE_MS) return
        sessionCostPending = true
        fetch(SESSION_COST_ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
          .then((response) => response.json())
          .then((payload) => {
            const cost = payload?.value?.sessionCost
            if (cost === null || typeof cost !== 'object') return
            if (cost.sessionId !== sessionId) return
            sessionCostFetchedAt = Date.now()
            sessionCost.id = sessionId
            const display = hudCostDisplay(cost)
            if (display === null) {
              // `priced: false` means the log carries no model information at
              // all: an honest "—" beats a made-up number.
              sessionCost.text = null
              sessionCost.title = '无法定价：会话里没有可定价的模型信息'
              sessionCost.source = null
              sessionCost.estimated = false
              return
            }
            sessionCost.text = display.text
            sessionCost.title = display.title
            sessionCost.source = display.source
            sessionCost.estimated = display.text.startsWith('~')
            try {
              window.localStorage.setItem(COST_CACHE_KEY, JSON.stringify({
                sessionId,
                text: display.text,
                estimated: sessionCost.estimated,
                source: display.source,
              }))
            } catch {
              // Best effort only.
            }
          })
          .catch(() => {
            // Keep the cached or legacy value; retry on the next tick.
          })
          .finally(() => {
            sessionCostPending = false
          })
      }

      /** Fold every HUD reading into one display model (no DOM writes). */
      const readModel = () => {
        const money = readLegacyStats()
        const sessionId = bridge.currentSessionId
        const sessionStatus = bridge.sessions?.statuses?.get(sessionId) ?? null
        const sessionSummary = bridge.sessions?.byId?.[sessionId] ?? null
        const running = sessionStatus?.running ?? sessionSummary?.running ?? false
        const now = hudNow()
        const lastStep = bridge.lastStep
        // Calibrate lazily: the probe and the data bridge are separate React
        // occupants, so the step sample can become ready after the projection
        // frame that carried the provider truth.
        if (lastStep !== null && lastStep.calibrated !== true) {
          // Mark the sample as consumed only when it actually landed; the probe
          // may still be one commit behind the projection frame.
          if (liveCalibrate(lastStep.tokens) === true) lastStep.calibrated = true
        }
        const liveSpeed = liveTps(now)
        let tps = 0
        let tpsSource = 'idle'
        if (running === true) {
          if (liveSpeed > 0) {
            // Character-priced stream speed: the only reading that moves mid-step.
            tps = liveSpeed
            tpsSource = 'live'
          } else if (lastStep !== null && now - lastStep.at < 15000) {
            // Between steps the last provider-truth sample is the honest number.
            tps = lastStep.tps
            if (tps > 0) tpsSource = 'last'
          } else if (typeof bridge.tokensPerSecond === 'number' && bridge.tokensPerSecond > 0) {
            // Whole-session fallback for a Session opened before any step settled.
            tps = bridge.tokensPerSecond
            tpsSource = 'lifetime'
          } else if (money.tps !== null) {
            // Last resort: the host pill itself (same whole-session semantics).
            const parsed = Number.parseInt(money.tps, 10)
            if (Number.isFinite(parsed) && parsed > 0) {
              tps = parsed
              tpsSource = 'lifetime'
            }
          }
        }
        const tpsTitle = tpsSource === 'live'
          ? '当前流式解码速度（按流式文本估算，步末校准）'
          : tpsSource === 'last'
            ? '最近一步的真实解码速度（provider 上报）'
            : tpsSource === 'lifetime'
              ? '整段会话平均解码速度（宿主 sessionStats）'
              : (running === true ? '会话运行中，暂无可用的解码速度' : '会话空闲')
        const lifetimeHit = typeof bridge.cacheHitPercent === 'number' ? bridge.cacheHitPercent : null
        const cacheText = lifetimeHit === null
          ? (money.cacheHit === null ? '—' : money.cacheHit)
          : lifetimeHit.toFixed(1) + '%'
        const cacheTitle = []
        if (lifetimeHit !== null) cacheTitle.push('整段会话 ' + lifetimeHit.toFixed(1) + '%')
        if (typeof bridge.lastStepHit === 'number') cacheTitle.push('最近一步 ' + bridge.lastStepHit.toFixed(1) + '%')
        if (bridge.tokenUsage !== null && typeof bridge.tokenUsage === 'object'
          && typeof bridge.tokenUsage.cacheReadTokens === 'number') {
          cacheTitle.push('缓存读 ' + formatTokens(bridge.tokenUsage.cacheReadTokens) + ' tokens')
        }
        const context = bridge.context
        const liveTokens = running === true ? liveStepTokens() : 0
        let contextPercent = null
        let contextText = '—'
        let contextTitle = ''
        if (context !== null) {
          const used = context.usedTokens + liveTokens
          contextPercent = context.contextWindow > 0 ? Math.min(100, used / context.contextWindow * 100) : 0
          contextText = hudPercentText(contextPercent)
          contextTitle = (liveTokens > 0 ? '~' : '') + formatTokens(used) + ' / ' + formatTokens(context.contextWindow) + ' tokens'
          if (liveTokens > 0) contextTitle += '（含流式估算 ' + formatTokens(liveTokens) + '）'
        }
        const costKnownHere = money.costKnown === true
        const costFromSession = sessionCost.id === sessionId && sessionCost.text !== null
        const costText = costKnownHere ? money.cost : (costFromSession ? sessionCost.text : '—')
        let costTitle = '本会话实扣金额（bottom-info-bar）'
        let costSource = 'actual'
        if (costKnownHere === false) {
          if (costFromSession) {
            costTitle = sessionCost.title
            costSource = sessionCost.source ?? 'none'
          } else {
            costTitle = sessionCost.id === sessionId
              ? (sessionCost.title !== '' ? sessionCost.title : '本次会话花费暂不可用')
              : '正在读取本次会话的估算花费…'
            costSource = null
          }
        }
        const agents = bridge.agentsKnown ? bridge.agents : 0
        // A brand-new (blank) Session has no conversation yet: hide the whole
        // tray so the home page never shows a fake 上下文/花费 readout.
        // The hero headline is the reliable "not started yet" UI signal; the
        // bridge flag covers blank sessions that render without the hero.
        const blank = bridge.blank === true || document.querySelector('[class*="_composerHero"] [class*="_headline"]') !== null
        return {
          blank,
          tpsText: tps > 0 ? String(tps) : '0',
          cacheText,
          cacheTitle: cacheTitle.join('；'),
          contextPercent,
          contextText,
          contextTitle,
          costText,
          costTitle,
          priceSource: costSource,
          tpsTitle,
          agents,
        }
      }

      /** Paint one model into every mounted tray: text + attributes only. */
      const paint = (model) => {
        for (const tray of document.querySelectorAll('.' + TRAY_CLASS)) {
          const display = model.blank ? 'none' : ''
          if (tray.style.display !== display) tray.style.display = display
          if (model.blank) continue
          const parts = hudPartsOf(tray)
          setHudText(parts.cache, model.cacheText)
          setHudTitle(parts.cachePart, model.cacheTitle)
          setHudText(parts.cost, model.costText)
          if (parts.costPart !== null) {
            const source = model.priceSource === null ? 'pending' : model.priceSource
            if (parts.costPart.getAttribute('data-price-source') !== source) parts.costPart.setAttribute('data-price-source', source)
          }
          setHudTitle(parts.costPart, model.costTitle)
          setHudText(parts.tps, model.tpsText)
          setHudTitle(parts.tpsPart, model.tpsTitle)
          if (parts.progress !== null) {
            const percent = model.contextPercent === null ? TRAY_CONTEXT_FALLBACK : model.contextPercent
            const offset = (TRAY_RING_LENGTH * (1 - percent / 100)).toFixed(2)
            if (parts.progress.getAttribute('stroke-dashoffset') !== offset) parts.progress.setAttribute('stroke-dashoffset', offset)
          }
          setHudText(parts.context, model.contextText)
          setHudTitle(parts.contextPart, model.contextTitle)
          const agentsDisplay = model.agents > 0 ? '' : 'none'
          if (parts.agentsPart !== null && parts.agentsPart.style.display !== agentsDisplay) parts.agentsPart.style.display = agentsDisplay
          if (parts.agentsSep !== null && parts.agentsSep.style.display !== agentsDisplay) parts.agentsSep.style.display = agentsDisplay
          if (parts.agentsLabel !== null) setHudText(parts.agentsLabel, model.agents + ' Agents')
        }
      }
      const render = () => {
        refreshSessionCost()
        paint(readModel())
      }
      const ensure = () => {
        for (const root of document.querySelectorAll('[class*="_root"]:has([data-lexical-editor="true"])')) {
          const card = root.querySelector(':scope > [class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])')
          if (card === null) continue
          if (root.querySelector(':scope > .' + TRAY_CLASS) === null) card.after(createComposerTray())
        }
        for (const tray of document.querySelectorAll('.' + TRAY_CLASS)) {
          const card = tray.previousElementSibling
          if (card === null || card.matches('[class*="_card"]') === false) tray.remove()
        }
      }
      // Two cadences: a streaming Session needs a 2 Hz sample, an idle one only
      // has to keep cost/balance honest. M0-S4: the shared ticker is the only
      // interval — this task runs at its base rate and decides for itself
      // whether the frame is due (no recursive timeout, no cadence teardown).
      const HUD_ACTIVE_TICK_MS = 500
      const HUD_IDLE_TICK_MS = 2000
      let disposed = false
      let lastPaintAt = 0

      const pageHidden = () => {
        try {
          return document.visibilityState === 'hidden'
        } catch {
          return false
        }
      }
      const sessionRunning = () => {
        const sessionId = bridge.currentSessionId
        const status = bridge.sessions?.statuses?.get(sessionId) ?? null
        const summary = bridge.sessions?.byId?.[sessionId] ?? null
        return (status?.running ?? summary?.running ?? false) === true
      }
      const renderNow = () => {
        if (disposed || pageHidden()) return
        try {
          render()
        } catch (error) {
          // A HUD failure must never break the composer; log it once.
          if (bridge.hudPaintError !== true) {
            bridge.hudPaintError = true
            console.error('[dsh-claude-code-desktop-theme] HUD paint failed', error)
          }
        }
      }
      const tick = () => {
        if (disposed) return
        const now = performance.now()
        const cadence = sessionRunning() ? HUD_ACTIVE_TICK_MS : HUD_IDLE_TICK_MS
        if (now - lastPaintAt < cadence) return
        lastPaintAt = now
        renderNow()
      }
      // Projection frames still paint immediately: provider truth must land at
      // once. The ticker only covers values that move between frames (live
      // tok/s decay, cost refresh, the context ring while streaming).
      const onBridgeChange = () => renderNow()
      const onVisibility = () => {
        if (pageHidden()) return
        renderNow()
        lastPaintAt = performance.now()
      }
      ensure()
      renderNow()
      bridgeListeners.add(onBridgeChange)
      document.addEventListener('visibilitychange', onVisibility)
      // The shared runtime pauses the ticker while the page is hidden and
      // restarts it on return; the first tick then paints because `lastPaintAt`
      // is stale.
      const disposeTicker = runtimeEvery('hud-ticker', tick, HUD_ACTIVE_TICK_MS)
      // The body observer is mount maintenance only: React re-renders the
      // composer freely while streaming, and repainting the whole tray on every
      // one of those mutations was the old observer's biggest cost. The runtime
      // already folds a mutation burst into one rAF, so `ensure` is the task.
      const disposeMountTask = runtimeOnMutation('hud-tray', ensure)
      return () => {
        disposed = true
        bridgeListeners.delete(onBridgeChange)
        document.removeEventListener('visibilitychange', onVisibility)
        disposeTicker()
        disposeMountTask()
        liveReset()
        for (const tray of document.querySelectorAll('.' + TRAY_CLASS)) tray.remove()
      }
    }

    // ── Diff micro-badge + review drawer ───────────────────────────────────
    // A tiny `+N -M` badge sits on the header of every edit/write card whose
    // real tool result the bridge has indexed. The numbers are the real line
    // diff of `meta.diffs` (or the edit/write arguments); cards without data
    // simply carry no badge. Clicking opens the fixed review drawer with the
    // same real hunk lines. The drawer lives at the end of <body>, so the chat
    // scroll container can never clip it.
    const DIFF_TOOLS = new Set(['edit', 'write'])
    const DIFF_BADGE_CLASS = 'dsh-diff-badge'
    const DRAWER_CLASS = 'dsh-review-drawer'
    const MOCK_FILENAME = 'src/composer/ComposerHud.tsx'
    const MOCK_BROWSER = 'localhost:3000'
    const ICON_CLOSE = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
    const ICON_REFRESH = '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.2 8a5.2 5.2 0 1 1-1.6-3.7M13.2 2.8v3.4H9.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    const FILE_PATTERN = /[\w.-]+(?:[\\/][\w.-]+)+\.(?:tsx?|jsx?|mjs|cjs|css|scss|json|md|py|rs|go|java|kt|html|vue|svelte|yml|yaml|toml)/

    /** Rows may be `[kind, text]` tuples or `{kind, text}` objects. */
    function renderDiffLines(container, rows) {
      container.replaceChildren()
      for (const row of rows) {
        const kind = Array.isArray(row) ? row[0] : row.kind
        const text = Array.isArray(row) ? row[1] : row.text
        const line = document.createElement('div')
        line.className = 'dsh-diff-line'
        line.dataset.kind = kind
        line.textContent = text
        container.appendChild(line)
      }
    }

    /** Best-effort filename shown by the drawer (falls back to the mock). */
    function filenameFor(card) {
      const match = (card.textContent || '').match(FILE_PATTERN)
      return match === null ? MOCK_FILENAME : match[0]
    }

    /** Build the `+N -M` micro badge for one file tool card (hidden until data). */
    function createDiffBadge(card) {
      const badge = document.createElement('span')
      badge.className = DIFF_BADGE_CLASS
      badge.setAttribute('role', 'button')
      badge.setAttribute('tabindex', '0')
      badge.setAttribute('aria-label', '打开 Diff 审查抽屉')
      badge.dataset.filename = filenameFor(card)
      badge.innerHTML = '<span class="dsh-diff-add">+0</span><span class="dsh-diff-del">-0</span>'
      badge.style.display = 'none'
      return badge
    }

    /** Build the fixed review drawer with the mocked diff and preview pane. */
    function createReviewDrawer() {
      const drawer = document.createElement('aside')
      drawer.className = DRAWER_CLASS
      drawer.dataset.open = 'false'
      drawer.setAttribute('aria-hidden', 'true')
      const head = document.createElement('div')
      head.className = 'dsh-review-head'
      const title = document.createElement('span')
      title.className = 'dsh-review-title'
      title.textContent = MOCK_FILENAME
      const close = document.createElement('button')
      close.type = 'button'
      close.className = 'dsh-review-close'
      close.setAttribute('aria-label', '关闭 Diff 审查')
      close.innerHTML = ICON_CLOSE
      head.append(title, close)
      const body = document.createElement('div')
      body.className = 'dsh-review-body'
      const label = document.createElement('div')
      label.className = 'dsh-review-label'
      label.textContent = 'Diff · mock'
      const diff = document.createElement('pre')
      diff.className = 'dsh-review-diff'
      renderDiffLines(diff, [['meta', '没有可用的 diff 数据']])
      const preview = document.createElement('div')
      preview.className = 'dsh-review-preview'
      const previewHead = document.createElement('div')
      previewHead.className = 'dsh-preview-head'
      const previewLabel = document.createElement('span')
      previewLabel.textContent = '浏览器预览'
      const refresh = document.createElement('button')
      refresh.type = 'button'
      refresh.className = 'dsh-preview-refresh'
      refresh.setAttribute('aria-label', '刷新预览')
      refresh.innerHTML = ICON_REFRESH
      previewHead.append(previewLabel, refresh)
      const previewBody = document.createElement('div')
      previewBody.className = 'dsh-preview-body'
      const previewUrl = document.createElement('strong')
      previewUrl.textContent = MOCK_BROWSER
      const previewHint = document.createElement('span')
      previewHint.textContent = '开发环境预览占位'
      previewBody.append(previewUrl, previewHint)
      preview.append(previewHead, previewBody)
      body.append(label, diff, preview)
      drawer.append(head, body)
      return drawer
    }

    /**
     * Decorate edit/write/bash tool cards with the diff badge and mount the
     * review drawer. Returns a dispose callback that removes both.
     */
    function mountDiffReview() {
      // Adopt-and-replace: a disposed plugin instance or a failed HMR reload can
      // leave a stale drawer/overlay behind with no listeners attached. Remove
      // any before mounting so exactly one interactive drawer is ever alive.
      for (const stale of document.querySelectorAll('.' + DRAWER_CLASS + ', .dsh-review-overlay')) stale.remove()
      const drawer = createReviewDrawer()
      const overlay = document.createElement('div')
      overlay.className = 'dsh-review-overlay'
      overlay.dataset.open = 'false'
      overlay.setAttribute('aria-hidden', 'true')
      const titleEl = drawer.querySelector('.dsh-review-title')
      const labelEl = drawer.querySelector('.dsh-review-label')
      const diffEl = drawer.querySelector('.dsh-review-diff')
      const closeButton = drawer.querySelector('.dsh-review-close')
      const refreshButton = drawer.querySelector('.dsh-preview-refresh')
      document.body.append(overlay, drawer)
      const open = (filename, callId) => {
        const tool = typeof callId === 'string' ? bridge.tools.get(callId) : undefined
        const live = tool !== undefined && tool.lines.length > 0
        titleEl.textContent = live ? displayPath(tool.path) : filename
        titleEl.title = live && typeof tool.path === 'string' ? tool.path : ''
        labelEl.textContent = live ? 'Diff · live' : 'Diff'
        if (live) {
          renderDiffLines(diffEl, tool.lines)
        } else {
          renderDiffLines(diffEl, [['meta', '没有可用的 diff 数据']])
        }
        drawer.dataset.open = 'true'
        drawer.setAttribute('aria-hidden', 'false')
        overlay.dataset.open = 'true'
        overlay.setAttribute('aria-hidden', 'false')
      }
      const close = () => {
        drawer.dataset.open = 'false'
        drawer.setAttribute('aria-hidden', 'true')
        overlay.dataset.open = 'false'
        overlay.setAttribute('aria-hidden', 'true')
      }
      const onClose = () => close()
      closeButton.addEventListener('click', onClose)
      const onOverlay = () => close()
      overlay.addEventListener('click', onOverlay)
      const onKey = (event) => {
        if (event.key === 'Escape' && drawer.dataset.open === 'true') close()
      }
      document.addEventListener('keydown', onKey)
      const onRefresh = () => {
        refreshButton.animate?.(
          [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }],
          { duration: 320, easing: 'ease' },
        )
      }
      refreshButton.addEventListener('click', onRefresh)
      const onClick = (event) => {
        const target = event.target instanceof Element ? event.target : null
        const badge = target === null ? null : target.closest('.' + DIFF_BADGE_CLASS)
        if (badge === null || badge.style.display === 'none') return
        event.preventDefault()
        event.stopPropagation()
        open(badge.dataset.filename || MOCK_FILENAME, badge.dataset.callId)
      }
      document.addEventListener('click', onClick, true)
      /** Rewrite one badge from the bridge's real tool diff map (idempotent). */
      const syncBadge = (badge, card) => {
        const callId = card.closest('[data-chat-call-id]')?.getAttribute('data-chat-call-id') ?? null
        const tool = callId === null ? undefined : bridge.tools.get(callId)
        if (tool === undefined || tool.lines.length === 0) {
          if (badge.style.display !== 'none') badge.style.display = 'none'
          return
        }
        badge.style.display = ''
        badge.dataset.callId = callId
        badge.dataset.filename = tool.path === null ? filenameFor(card) : displayPath(tool.path)
        badge.setAttribute('title', displayPath(tool.path) + ' · +' + tool.added + ' -' + tool.removed)
        const add = badge.querySelector('.dsh-diff-add')
        const del = badge.querySelector('.dsh-diff-del')
        const addText = '+' + tool.added
        const delText = '-' + tool.removed
        if (add !== null && add.textContent !== addText) add.textContent = addText
        if (del !== null && del.textContent !== delText) del.textContent = delText
      }
      /**
       * O(n) scan #3 (M0-S4): this used to sweep every badge in the document on
       * a 700ms `setInterval` and run `closest('[data-tool]')` per badge. It now
       * scans the disclosure rows only — the badge is their direct child — and
       * is driven by the shared mutation task instead of a timer.
       */
      const syncBadges = () => {
        for (const row of document.querySelectorAll('[data-disclosure-row]')) {
          const badge = row.querySelector(':scope > .' + DIFF_BADGE_CLASS)
          if (badge === null) continue
          const card = row.closest('[data-tool]')
          if (card === null) {
            if (badge.style.display !== 'none') badge.style.display = 'none'
            continue
          }
          syncBadge(badge, card)
        }
      }
      const decorate = () => {
        for (const card of document.querySelectorAll('[data-tool]')) {
          const tool = card.getAttribute('data-tool')
          if (tool === null || DIFF_TOOLS.has(tool) === false) continue
          const row = card.querySelector('[data-disclosure-row="true"]')
          if (row === null) continue
          if (row.querySelector(':scope > .' + DIFF_BADGE_CLASS) !== null) continue
          row.appendChild(createDiffBadge(card))
        }
        syncBadges()
      }
      decorate()
      // M0-S4: the 700ms interval and the private body observer are gone. The
      // mutation task re-inserts missing badges (idempotent) and syncs them in
      // one pass; the drawer's click/keydown listeners stay.
      const disposeTask = runtimeOnMutation('diff-badges', decorate)
      return () => {
        disposeTask()
        document.removeEventListener('click', onClick, true)
        document.removeEventListener('keydown', onKey)
        closeButton.removeEventListener('click', onClose)
        overlay.removeEventListener('click', onOverlay)
        refreshButton.removeEventListener('click', onRefresh)
        for (const badge of document.querySelectorAll('.' + DIFF_BADGE_CLASS)) badge.remove()
        for (const node of document.querySelectorAll('.' + DRAWER_CLASS + ', .dsh-review-overlay')) node.remove()
      }
    }

    // ── Live session data bridge ────────────────────────────────────────────
    // A headless React occupant under the composer subscribes to the host
    // session stores and folds them into `bridge`, which the DOM runtimes
    // below read every tick:
    //   context  ← useProjection('contextPressure')  (used / window tokens)
    //   agents   ← subagentCatalog + statuses        (running subagents)
    //   tools    ← useChat().legacy.nodes tool-result nodes with real
    //              argsRaw / meta.diffs, diffed line-by-line for badges and
    //              the review drawer.
    // Every read is defensive: a missing or reshaped projection leaves the last
    // snapshot in place and the UI keeps its fallback values.
    const bridge = {
      context: null,
      agents: 0,
      agentsKnown: false,
      tools: new Map(),
      cwd: null,
      sessions: null,
      updates: 0,
      blank: null,
      // Step-to-step provider truth, derived from adjacent projection frames:
      // the only real decode speed / cache-hit sample that exists between ticks.
      lastStep: null,
      lastStepHit: null,
    }
    /** DOM runtimes that want an immediate refresh when the bridge changes. */
    const bridgeListeners = new Set()
    const FILE_TOOL_NAMES = new Set(['edit', 'write'])
    const DIFF_LINE_LIMIT = 800

    /** Compact token count for tooltips (`229.5K`, `1M`). */
    function formatTokens(value) {
      if (typeof value !== 'number' || Number.isFinite(value) === false) return '—'
      if (value < 1000) return String(Math.round(value))
      if (value < 1e6) return (value / 1e3).toFixed(value < 1e4 ? 1 : 0) + 'K'
      return (value / 1e6).toFixed(1) + 'M'
    }

    // ── HUD live stream sampler (data layer) ────────────────────────────────
    // The host settles usage once per model step, so projections alone cannot
    // move during a decode. The chat snapshot, however, publishes the running
    // Assistant step's content blocks every animation frame (`legacy.partial`),
    // so ThemeLiveProbe can price those character deltas here. Everything in
    // this section is read-only state the HUD ticker reads; it never renders.
    const HUD_TPS_WINDOW_MS = 2000
    const HUD_TPS_STALE_MS = 1200
    const HUD_SAMPLE_KEEP_MS = 3000
    const HUD_SAMPLE_INTERVAL_MS = 80
    const HUD_BLOCK_OVERHEAD = 4
    const HUD_CJK_CHAR_PATTERN = /[\u2e80-\u2eff\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/g
    const HUD_CURRENCY_SYMBOLS = { CNY: '¥', USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

    /** Monotonic clock shared by every live/deadline comparison. */
    function hudNow() {
      try {
        if (typeof performance !== 'undefined' && typeof performance.now === 'function') return performance.now()
      } catch {
        // Fall through to wall time.
      }
      return Date.now()
    }

    /**
     * Price one streaming content-block list the way the host's heuristic does
     * (CHARS_PER_TOKEN = 4) but count CJK characters one token each, otherwise a
     * Chinese reply reads 3-4x slower than the provider's own tok/s.
     * Pure: offline-testable, no DOM, no clock.
     * @param {Array<object>} blocks - assistant content blocks (text/reasoning/tool-call).
     * @returns {number} estimated tokens.
     */
    function estimateStreamTokens(blocks) {
      if (Array.isArray(blocks) === false) return 0
      let tokens = 0
      for (const block of blocks) {
        if (block === null || typeof block !== 'object') continue
        if (block.type === 'text' || block.type === 'reasoning') {
          const text = typeof block.text === 'string' ? block.text : ''
          const cjk = text.match(HUD_CJK_CHAR_PATTERN)
          const cjkCount = cjk === null ? 0 : cjk.length
          tokens += cjkCount + Math.ceil((text.length - cjkCount) / 4) + HUD_BLOCK_OVERHEAD
        } else if (block.type === 'tool-call') {
          const name = typeof block.name === 'string' ? block.name : ''
          const args = typeof block.arguments === 'string' ? block.arguments : ''
          tokens += Math.ceil(name.length / 4) + Math.ceil(args.length / 4) + HUD_BLOCK_OVERHEAD
        }
      }
      return tokens
    }

    /** One decimal for occupancy; 100% only when genuinely full. Pure. */
    function hudPercentText(percent) {
      if (typeof percent !== 'number' || Number.isFinite(percent) === false) return '—'
      const clamped = Math.min(100, Math.max(0, percent))
      if (clamped >= 99.95) return '100%'
      return clamped.toFixed(1) + '%'
    }

    /**
     * Turn the host's `sessionCost` payload into display text plus a tooltip.
     * Never derives an "actual charge": an estimate keeps its `~` marker.
     * Pure: offline-testable.
     * @param {object} cost - `value.sessionCost` from the usage-summary route.
     * @returns {{text: string, title: string, currency: string, source: string} | null}
     */
    function hudCostDisplay(cost) {
      if (cost === null || typeof cost !== 'object') return null
      if (cost.priced !== true || typeof cost.cost !== 'number' || Number.isFinite(cost.cost) === false) return null
      const currency = typeof cost.currency === 'string' && cost.currency !== '' ? cost.currency.toUpperCase() : 'CNY'
      const symbol = Object.hasOwn(HUD_CURRENCY_SYMBOLS, currency) ? HUD_CURRENCY_SYMBOLS[currency] : '¥'
      const digits = cost.cost > 0 && cost.cost < 0.01 ? 4 : 2
      const amount = symbol + cost.cost.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
      const estimated = cost.estimated === true
      const source = typeof cost.priceSource === 'string' ? cost.priceSource : 'none'
      const matched = typeof cost.matchedKey === 'string' && cost.matchedKey !== '' ? '（' + cost.matchedKey + '）' : ''
      const lines = []
      if (source === 'none') lines.push('未知模型，按中档价估算')
      else if (source === 'family') lines.push('同族默认价估算' + matched)
      else if (source === 'override') lines.push('自定义价目估算' + matched)
      else lines.push('官方价目估算' + matched)
      if (estimated === true) lines.push('按真实 token 用量估算，不是账单实扣')
      const byCurrency = cost.costByCurrency
      if (cost.mixedCurrencies === true && byCurrency !== null && typeof byCurrency === 'object') {
        const others = Object.entries(byCurrency)
          .filter(([code, value]) => code !== currency && typeof value === 'number' && Number.isFinite(value))
          .map(([code, value]) => code + ' ' + value.toFixed(2))
        if (others.length > 0) lines.push('另含 ' + others.join(' / ') + '，未换算')
      }
      return { text: (estimated ? '~' : '') + amount, title: lines.join('；'), currency, source }
    }

    const live = {
      sessionId: null,
      turn: null,
      step: null,
      tokens: 0,
      cum: 0,
      samples: [],
      streaming: false,
      lastGrowthAt: 0,
      lastSampleAt: 0,
      finished: null,
      calib: 1,
    }

    /** Forget every live reading (session switch, unmount, tab resume). */
    function liveReset() {
      live.turn = null
      live.step = null
      live.tokens = 0
      live.cum = 0
      live.samples.length = 0
      live.streaming = false
      live.lastGrowthAt = 0
      live.lastSampleAt = 0
      live.finished = null
      live.calib = 1
    }

    /**
     * Fold one chat snapshot's running Assistant step into the sampler.
     * Runs on every probe render; the 80ms gate keeps a long reasoning block
     * from being re-priced on all 60 frames of a second.
     * @param {object|null} partial - `useChat().legacy.partial`.
     * @param {string|null} sessionId - owner Session.
     */
    function liveSample(partial, sessionId) {
      const now = hudNow()
      const owner = typeof sessionId === 'string' ? sessionId : null
      if (live.sessionId !== owner) {
        live.sessionId = owner
        liveReset()
      }
      if (partial === null || typeof partial !== 'object') {
        if (live.streaming === true && live.tokens > 0) live.finished = { tokens: live.tokens, at: now }
        live.streaming = false
        live.tokens = 0
        live.turn = null
        live.step = null
        return
      }
      if (live.lastSampleAt !== 0 && now - live.lastSampleAt < HUD_SAMPLE_INTERVAL_MS) return
      live.lastSampleAt = now
      const turn = typeof partial.turn === 'number' ? partial.turn : null
      const step = typeof partial.step === 'number' ? partial.step : null
      const tokens = estimateStreamTokens(partial.blocks)
      if (live.turn !== turn || live.step !== step) {
        // New step: `cum` stays monotonic so the window can span the boundary.
        live.turn = turn
        live.step = step
        live.tokens = 0
      }
      const delta = tokens - live.tokens
      live.tokens = tokens
      if (delta <= 0) return
      live.cum += delta
      live.streaming = true
      live.lastGrowthAt = now
      live.samples.push({ t: now, cum: live.cum })
      const cutoff = now - HUD_SAMPLE_KEEP_MS
      while (live.samples.length > 1 && live.samples[0].t < cutoff) live.samples.shift()
    }

    /**
     * Decode speed over the last HUD window, calibrated to provider truth.
     * Zero once the stream has been quiet for HUD_TPS_STALE_MS.
     * @param {number} now - hudNow() reading of the caller.
     * @returns {number} rounded tok/s, or 0.
     */
    function liveTps(now) {
      if (live.streaming !== true || live.calib <= 0) return 0
      if (now - live.lastGrowthAt > HUD_TPS_STALE_MS) return 0
      const samples = live.samples
      if (samples.length < 2) return 0
      const newest = samples[samples.length - 1]
      const cutoff = newest.t - HUD_TPS_WINDOW_MS
      let base = samples[0]
      for (let index = samples.length - 2; index >= 0; index -= 1) {
        base = samples[index]
        if (base.t <= cutoff) break
      }
      const seconds = (newest.t - base.t) / 1000
      const tokens = (newest.cum - base.cum) * live.calib
      if (seconds < 0.5 || tokens <= 0) return 0
      return Math.round(tokens / seconds)
    }

    /** Estimated tokens already streamed for the current step. */
    function liveStepTokens() {
      return live.streaming === true && live.tokens > 0 ? live.tokens : 0
    }

    /**
     * Calibrate the character heuristic against provider-reported decode
     * tokens of the step that just settled (one sample per step).
     * @param {number} realTokens - ΔdecodeTokens from the sessionStats fold.
     * @returns {boolean} true when the sample was applied.
     */
    function liveCalibrate(realTokens) {
      const finished = live.finished
      if (finished === null || typeof finished !== 'object') return false
      if (typeof realTokens !== 'number' || Number.isFinite(realTokens) === false) return false
      const age = hudNow() - finished.at
      if (age > 5000 || finished.tokens < 20) return false
      const ratio = realTokens / finished.tokens
      if (Number.isFinite(ratio) === false || ratio <= 0) return false
      live.calib = Math.min(2.5, Math.max(0.5, ratio))
      return true
    }

    /** Split text into diffable lines; tolerates CRLF and absent text. */
    function diffLinesOf(text) {
      return typeof text === 'string' && text !== '' ? text.replace(/\r\n/g, '\n').split('\n') : []
    }

    /**
     * Line diff between one hunk's old and new text, bounded so pathological
     * inputs fall back to a whole-block replace instead of freezing the tab.
     * @returns display lines plus the real added/removed totals.
     */
    function diffHunk(oldText, newText) {
      const before = diffLinesOf(oldText)
      const after = diffLinesOf(newText)
      if (before.length > DIFF_LINE_LIMIT || after.length > DIFF_LINE_LIMIT) {
        return {
          added: after.length,
          removed: before.length,
          lines: [
            ...before.map((text) => ({ kind: 'del', text: '-' + text })),
            ...after.map((text) => ({ kind: 'add', text: '+' + text })),
          ],
        }
      }
      const rows = before.length
      const cols = after.length
      const table = Array.from({ length: rows + 1 }, () => new Uint16Array(cols + 1))
      for (let i = rows - 1; i >= 0; i -= 1) {
        for (let j = cols - 1; j >= 0; j -= 1) {
          table[i][j] = before[i] === after[j]
            ? table[i + 1][j + 1] + 1
            : Math.max(table[i + 1][j], table[i][j + 1])
        }
      }
      const lines = []
      let i = 0
      let j = 0
      while (i < rows || j < cols) {
        if (i < rows && j < cols && before[i] === after[j]) {
          lines.push({ kind: 'context', text: ' ' + before[i] })
          i += 1
          j += 1
        } else if (j < cols && (i === rows || table[i][j + 1] >= table[i + 1][j])) {
          lines.push({ kind: 'add', text: '+' + after[j] })
          j += 1
        } else {
          lines.push({ kind: 'del', text: '-' + before[i] })
          i += 1
        }
      }
      return {
        added: lines.filter((line) => line.kind === 'add').length,
        removed: lines.filter((line) => line.kind === 'del').length,
        lines,
      }
    }

    /** Trim a tool path to something readable inside the 400px drawer. */
    function displayPath(path) {
      if (typeof path !== 'string' || path === '') return 'file'
      const cwd = bridge.cwd
      if (typeof cwd === 'string' && cwd !== '') {
        const normalizedCwd = cwd.replace(/[\\/]+$/, '')
        if (path === normalizedCwd) return path.split(/[\\/]/).at(-1) ?? path
        if (path.startsWith(normalizedCwd + '\\') || path.startsWith(normalizedCwd + '/')) {
          return path.slice(normalizedCwd.length + 1)
        }
      }
      const parts = path.split(/[\\/]/).filter(Boolean)
      return parts.length > 3 ? parts.slice(-2).join('/') : path
    }

    /**
     * Build the real review payload for one edit/write tool result: applied
     * `meta.diffs` when present, otherwise the call arguments (write content,
     * edit old_string/new_string).
     */
    function buildToolDiff(node) {
      let args = null
      try {
        args = JSON.parse(node.call?.argsRaw ?? '')
      } catch {
        args = null
      }
      let path = node.meta?.path ?? args?.file_path ?? args?.path ?? null
      const hunks = []
      for (const hunk of Array.isArray(node.meta?.diffs) ? node.meta.diffs : []) {
        if (hunk !== null && typeof hunk === 'object' && typeof hunk.newText === 'string') {
          hunks.push({
            path: typeof hunk.path === 'string' ? hunk.path : path,
            oldText: typeof hunk.oldText === 'string' ? hunk.oldText : null,
            newText: hunk.newText,
          })
        }
      }
      if (hunks.length === 0 && args !== null && typeof args === 'object') {
        if (node.name === 'write' && typeof args.content === 'string') {
          hunks.push({ path, oldText: null, newText: args.content })
        }
        if (node.name === 'edit' && typeof args.new_string === 'string') {
          hunks.push({
            path,
            oldText: typeof args.old_string === 'string' && args.old_string !== '' ? args.old_string : null,
            newText: args.new_string,
          })
        }
      }
      const lines = []
      let added = 0
      let removed = 0
      for (const hunk of hunks) {
        if (path === null && typeof hunk.path === 'string') path = hunk.path
        const result = diffHunk(hunk.oldText, hunk.newText)
        added += result.added
        removed += result.removed
        lines.push({ kind: 'meta', text: '@@ ' + displayPath(hunk.path ?? path) + ' @@' })
        lines.push(...result.lines)
      }
      return { name: node.name, path: typeof path === 'string' ? path : null, added, removed, lines }
    }

    /** Fold the headless component's host stores into `bridge` (defensive). */
    function updateBridge(input) {
      bridge.updates += 1
      try {
        const pressure = input.pressure
        if (pressure !== null && typeof pressure === 'object') {
          const used = pressure.projectedTokens ?? pressure.pressureTokens
          if (typeof used === 'number' && typeof pressure.contextWindow === 'number' && pressure.contextWindow > 0) {
            bridge.context = {
              percent: Math.min(100, Math.round(used / pressure.contextWindow * 100)),
              usedTokens: used,
              contextWindow: pressure.contextWindow,
            }
          }
        }
      } catch (error) {
        // Keep the last known context reading.
      }
      try {
        const stats = input.stats
        if (stats !== null && typeof stats === 'object') {
          const previous = bridge.stats
          bridge.stats = stats
          const decodeMs = typeof stats.decodeMs === 'number' ? stats.decodeMs : 0
          const decodeTokens = typeof stats.decodeTokens === 'number' ? stats.decodeTokens : 0
          bridge.tokensPerSecond = decodeMs > 0 ? Math.max(0, Math.round(decodeTokens / (decodeMs / 1000))) : 0
          if (previous !== null && typeof previous === 'object') {
            const previousTokens = typeof previous.decodeTokens === 'number' ? previous.decodeTokens : 0
            const previousMs = typeof previous.decodeMs === 'number' ? previous.decodeMs : 0
            const deltaTokens = decodeTokens - previousTokens
            const deltaMs = decodeMs - previousMs
            // One assistant/message settlement == one real decode sample.
            if (deltaTokens > 0 && deltaMs > 0) {
              bridge.lastStep = {
                tps: Math.round(deltaTokens / (deltaMs / 1000)),
                tokens: deltaTokens,
                at: hudNow(),
                calibrated: false,
              }
              if (liveCalibrate(deltaTokens) === true) bridge.lastStep.calibrated = true
            }
          }
        }
      } catch (error) {
        // Keep the last known session statistics.
      }
      try {
        const usage = input.usage
        const totals = usage && typeof usage === 'object' ? usage.totals : null
        if (totals !== null && typeof totals === 'object') {
          const previous = bridge.tokenUsage
          bridge.tokenUsage = totals
          const read = typeof totals.cacheReadTokens === 'number' ? totals.cacheReadTokens : 0
          const uncached = typeof totals.uncachedInputTokens === 'number' ? totals.uncachedInputTokens : 0
          const write = typeof totals.cacheWriteTokens === 'number' ? totals.cacheWriteTokens : 0
          const prompt = read + uncached + write
          bridge.cacheHitPercent = prompt > 0 ? Math.round((read / prompt) * 1000) / 10 : null
          if (previous !== null && typeof previous === 'object') {
            const previousRead = typeof previous.cacheReadTokens === 'number' ? previous.cacheReadTokens : 0
            const previousUncached = typeof previous.uncachedInputTokens === 'number' ? previous.uncachedInputTokens : 0
            const previousWrite = typeof previous.cacheWriteTokens === 'number' ? previous.cacheWriteTokens : 0
            const deltaRead = read - previousRead
            const deltaPrompt = deltaRead + (uncached - previousUncached) + (write - previousWrite)
            if (deltaPrompt > 0) bridge.lastStepHit = Math.round((deltaRead / deltaPrompt) * 1000) / 10
          }
        }
      } catch (error) {
        // Keep the last known token usage.
      }
      try {
        const entries = input.projections?.[input.sessionId]?.values?.subagentCatalog
        if (Array.isArray(entries)) {
          bridge.agentsKnown = true
          bridge.agents = entries.filter((entry) => (
            input.statuses?.get(entry.id)?.running ?? input.summaries?.[entry.id]?.running
          ) === true).length
        }
      } catch (error) {
        // Keep the last known agent count.
      }
      try {
        const sessions = {
          statuses: input.statuses ?? null,
          byId: input.summaries ?? null,
          subagents: new Map(),
        }
        for (const [parentId, snapshot] of Object.entries(input.projections ?? {})) {
          const entries = snapshot?.values?.subagentCatalog
          if (!Array.isArray(entries)) continue
          let running = 0
          for (const entry of entries) {
            if ((input.statuses?.get(entry.id)?.running ?? input.summaries?.[entry.id]?.running) === true) running += 1
          }
          sessions.subagents.set(parentId, running)
        }
        bridge.sessions = sessions
      } catch (error) {
        // Keep the last known session status snapshot.
      }
      try {
        const nextSessionId = input.sessionId ?? null
        if (bridge.currentSessionId !== nextSessionId) {
          // A different Session must never inherit the previous live window or
          // the previous estimate (the cached text belongs to the old session).
          bridge.lastStep = null
          bridge.lastStepHit = null
          live.sessionId = nextSessionId
          liveReset()
          // Keep a cache entry that already belongs to the incoming Session.
          if (sessionCost.id !== null && sessionCost.id !== nextSessionId) {
            sessionCost.id = null
            sessionCost.text = null
            sessionCost.title = ''
            sessionCost.source = null
            sessionCost.estimated = false
          }
        }
        bridge.blank = input.blank === true
        bridge.nodeCount = (input.nodes || []).length
        bridge.currentSessionId = nextSessionId
        bridge.sessionSummaryBlank = input.summaries?.[input.sessionId]?.blank ?? null
      } catch (error) {
        // Keep the last known blank-session flag.
      }
      try {
        if (typeof input.cwd === 'string' && input.cwd !== '') bridge.cwd = input.cwd
      } catch (error) {
        // Keep the last known workspace root.
      }
      try {
        const tools = new Map()
        for (const node of input.nodes || []) {
          if (node === null || node.kind !== 'tool-result' || typeof node.callId !== 'string') continue
          if (FILE_TOOL_NAMES.has(node.name) === false) continue
          tools.set(node.callId, buildToolDiff(node))
        }
        bridge.tools = tools
      } catch (error) {
        // Keep the last known tool diff map.
      }
      // React just pushed a new snapshot: let DOM runtimes redraw immediately
      // instead of waiting for their polling tick.
      for (const listener of bridgeListeners) {
        try {
          listener()
        } catch (error) {
          // A single runtime failure must not block the others.
        }
      }
    }

    /** Headless occupant under the composer: publishes real session data. */
    function ThemeDataBridge({ useChat, useProjection, useSessions, useSessionStatus, sessionId }) {
      bridge.renders = (bridge.renders ?? 0) + 1
      const nodes = useChat((state) => state.legacy.nodes)
      const pressure = useProjection('contextPressure')
      const stats = useProjection('sessionStats')
      const usage = useProjection('tokenUsage')
      const projections = useSessions((state) => state.projectionsBySession)
      const summaries = useSessions((state) => state.byId)
      const cwd = useSessions((state) => state.byId[sessionId]?.cwd)
      const statuses = useSessionStatus((value) => value)
      React.useEffect(() => {
        try {
          const summary = summaries?.[sessionId]
          const blank = summary?.blank === true || (nodes?.length ?? 0) === 0
          updateBridge({ nodes, pressure, stats, usage, projections, summaries, statuses, sessionId, cwd, blank })
        } catch (error) {
          bridge.lastError = String(error && error.message ? error.message : error)
        }
      })
      // The probe is a child, not a second slot occupant: it re-renders on its
      // own streamed frames while this bridge keeps its per-node-change cadence.
      return React.createElement(ThemeLiveProbe, { useChat, sessionId })
    }

    /**
     * Headless stream probe: samples the running Assistant step's partial
     * blocks for the live tok/s window, and renders nothing.
     *
     * It is a separate occupant from ThemeDataBridge on purpose: that bridge
     * rebuilds the whole tool-diff map on every render, while this one has to
     * run on each streamed animation frame. All it does is price characters
     * into module state (no setState, no DOM, no bridge write).
     */
    function ThemeLiveProbe({ useChat, sessionId }) {
      // Defensive selector: an older host without the `legacy` compatibility
      // slice must degrade to "no live estimate", never crash the composer.
      const partial = useChat((state) => (state && state.legacy ? state.legacy.partial ?? null : null))
      React.useEffect(() => {
        try {
          const owner = typeof sessionId === 'string' ? sessionId : bridge.currentSessionId
          liveSample(partial ?? null, typeof owner === 'string' ? owner : null)
        } catch (error) {
          // A reshaped chat snapshot must only cost the live estimate.
          bridge.lastLiveError = String(error && error.message ? error.message : error)
        }
      })
      return null
    }

    /** One value for both color schemes. */
    function both(value) {
      return { light: value, dark: value }
    }

    /** Explicit light/dark pair. */
    function pair(light, dark) {
      return { light, dark }
    }

    // ── Static palette scales ────────────────────────────────────────────────
    // The host sheets declare the --dsw-static-* scales once on body and let
    // both palettes reference them. Warming the neutral, brand and state scales
    // recolors every derived alias we do not override explicitly (hover fills,
    // skeletons, menus, plugin surfaces).
    const STATIC_SCALES = {
      'neutral-00': '#fffdf9',
      'neutral-50': '#faf7f2',
      'neutral-100': '#f3efe8',
      'neutral-150': '#ece7dd',
      'neutral-200': '#e3ddd1',
      'neutral-250': '#dad3c5',
      'neutral-300': '#d0c8b8',
      'neutral-400': '#b4ab99',
      'neutral-500': '#9a9080',
      'neutral-550': '#857b6b',
      'neutral-600': '#70665a',
      'neutral-700': '#5b5248',
      'neutral-800': '#3f3932',
      'neutral-850': '#332f2a',
      'neutral-900': '#26231f',
      'neutral-1000': '#131110',

      'neutral-bluish-00': '#fffdf8',
      'neutral-bluish-50': '#faf7f0',
      'neutral-bluish-60': '#f6f2e9',
      'neutral-bluish-75': '#f2eee4',
      'neutral-bluish-100': '#ede8dd',
      'neutral-bluish-150': '#e8e2d5',
      'neutral-bluish-200': '#e1dbcd',
      'neutral-bluish-300': '#d2cab9',
      'neutral-bluish-400': '#b6ad9b',
      'neutral-bluish-500': '#9c9382',
      'neutral-bluish-600': '#7f7666',
      'neutral-bluish-700': '#625a4c',
      'neutral-bluish-750': '#4d4640',
      'neutral-bluish-800': '#3c3832',
      'neutral-bluish-850': '#312e29',
      'neutral-bluish-875': '#2a2723',
      'neutral-bluish-900': '#252320',
      'neutral-bluish-950': '#1f1d1a',
      'neutral-bluish-1000': '#12100e',

      'deepseek-50': '#fdf4ef',
      'deepseek-100': '#f9e6dc',
      'deepseek-200': '#f1d0be',
      'deepseek-300': '#e8b598',
      'deepseek-400': '#df9671',
      'deepseek-450': ACCENT,
      'deepseek-500': '#cb6845',
      'deepseek-600': '#b05537',
      'deepseek-700-delete': '#8f452c',
      'deepseek-800': '#6f3622',
      'deepseek-900': '#552a1b',

      'green-50': '#eefaf2',
      'green-100': '#dcf7e6',
      'green-400': '#37d06c',
      'green-500': '#00c853',
      'green-500-a08': '#00c85314',
      'green-500-a12': '#00c8531f',
      'green-900': '#173a24',

      'red-50': '#fff1ec',
      'red-100': '#ffddd3',
      'red-400': '#ff7a58',
      'red-500': '#fa5b34',
      'red-600': '#e14a24',
      'red-600-a08': '#e14a2414',
      'red-400-a12': '#ff7a581f',
      'red-900': '#4a1a0e',

      'amber-100': '#fbf2de',
      'amber-400': '#f2c15c',
      'amber-500': '#e0a43a',
      'amber-600': '#b9832a',
      'amber-900': '#3a2d16',
    }

    const tokens = {}
    for (const [name, value] of Object.entries(STATIC_SCALES)) {
      tokens['--dsw-static-' + name] = both(value)
    }

    Object.assign(tokens, {
      '--dsh-font-family-text': both(UI_FONT),
      '--dsh-font-family-code': both(CODE_FONT),
      '--dsh-font-family-terminal': both(CODE_FONT),
    })

    // ── Alias tokens ────────────────────────────────────────────────────────
    Object.assign(tokens, {
      // Surfaces
      '--dsw-alias-bg-base': pair(SURFACE, '#24221f'),
      '--dsw-alias-bg-layer-1': pair('#fbf9f4', '#2b2825'),
      '--dsw-alias-bg-layer-2': pair('#efebe2', '#322f2b'),
      '--dsw-alias-bg-layer-3': pair('#e7e2d7', '#393530'),
      '--dsw-alias-bg-overlay': pair('#fbf9f4', '#302d29'),
      '--dsw-alias-bg-document-preview': pair('#f0ece3', '#2b2825'),
      '--dsw-alias-bg-document-selection': pair('color-mix(in srgb, ' + ACCENT + ' 32%, transparent)', 'color-mix(in srgb, ' + ACCENT + ' 40%, transparent)'),
      '--dsw-alias-bg-module-platform': pair('#f0ece3', '#322f2b'),
      '--dsw-alias-bg-multi-select': pair('#f0ece3', '#322f2b'),
      '--dsw-alias-bg-skeleton': pair('#1d1b160a', '#f5f3ee14'),
      '--dsw-alias-bg-mask-drop': pair('#f5f3eeb3', '#272730b3'),

      // Borders (warm ink hairlines instead of blue-black)
      '--dsw-alias-border-l1': pair('#1d1b160d', '#f5f3ee0f'),
      '--dsw-alias-border-l2': pair('#1d1b161a', '#f5f3ee1f'),
      '--dsw-alias-border-l2-darkmode-thin': pair('#1d1b161a', '#f5f3ee0f'),
      '--dsw-alias-border-l3': pair('#1d1b1621', '#f5f3ee29'),
      '--dsw-alias-border-l4': pair('#1d1b1629', '#f5f3ee33'),

      // Brand / actions
      '--dsw-alias-brand-primary': both(ACCENT),
      '--dsw-alias-brand-primary-invert': pair('#fbf9f4', '#1d1b16'),
      '--dsw-alias-brand-primary-new-colorprimary-new-color': both(ACCENT),
      '--dsw-alias-brand-text': pair(INK, '#f0ede4'),
      '--dsw-alias-button-contrast-fill': pair('#4a463f', '#f0ede4'),
      '--dsw-alias-button-elevated-fill': pair('#fbf9f4', '#322f2b'),
      '--dsw-alias-button-floating-fill': pair('#fbf9f4', '#2b2825'),
      '--dsw-alias-button-floating-hover': pair('#efebe2', '#393530'),
      '--dsw-alias-button-ghost-active-border': pair('#a89f90', '#5b5248'),
      '--dsw-alias-button-ghost-active-fill': pair('#efebe2', '#322f2b'),
      '--dsw-alias-button-ghost-active-hover': pair('#e7e2d7', '#393530'),
      '--dsw-alias-button-info-fill': both(ACCENT),
      '--dsw-alias-button-info-hover': both(ACCENT_HOVER),
      '--dsw-alias-button-primary-dimmed': pair('#f3ddd1', '#4a352b'),
      '--dsw-alias-button-primary-hover': both(ACCENT_HOVER),
      '--dsw-alias-button-tool-bar-fill': pair('#6f665680', '#54555780'),
      '--dsw-alias-button-tool-bar-fill-invisible': pair('#2a28245c', '#1f1f1f5c'),
      '--dsw-alias-button-tool-bar-hover': pair('#6f665699', '#54555799'),

      // Interaction fills
      '--dsw-alias-interactive-bg-active': pair('#1d1b1617', '#f5f3ee24'),
      '--dsw-alias-interactive-bg-hover': pair('#1d1b160d', '#f5f3ee14'),
      '--dsw-alias-interactive-bg-hover-accent': pair('#da775624', '#da77563d'),
      '--dsw-alias-interactive-bg-hover-danger': pair('#e14a2414', '#ff5f3826'),
      '--dsw-alias-interactive-bg-hover-solid': pair('#ece7dd', '#393530'),

      // Text
      '--dsw-alias-label-primary': pair(INK, '#f0ede4'),
      '--dsw-alias-label-secondary': pair('#635f56', '#bdb6a9'),
      '--dsw-alias-label-tertiary': pair('#7f7869', '#9a9285'),
      '--dsw-alias-label-caption': pair('#948d7e', '#857e71'),
      '--dsw-alias-label-dimmed': pair('#ddd7ca', '#3d3934'),
      '--dsw-alias-label-primary-dimmed': pair('#3a362f', '#d6d0c4'),
      '--dsw-alias-label-primary-foreground': both('#fffdf8'),
      '--dsw-alias-label-primary-inverted': pair('#fbf9f4', '#1d1b16'),
      '--dsw-alias-label-primary-bluish': pair('#6b4a38', '#e0b6a1'),
      '--dsw-alias-label-document-preview': pair('#4a463f', '#bdb6a9'),
      '--dsw-alias-label-deep-diving': pair('color-mix(in srgb, ' + ACCENT + ' 70%, #3a2a20)', 'color-mix(in srgb, #e0957a 55%, #b3aa98)'),
      '--dsw-alias-label-deep-diving-shimmer': pair('color-mix(in srgb, ' + ACCENT + ' 30%, #3a2a20)', 'color-mix(in srgb, #e0957a 35%, #f0ede4)'),
      '--dsw-alias-label-shimmer': pair('color-mix(in srgb, #1d1b16 30%, transparent)', 'color-mix(in srgb, #f5f3ee 45%, transparent)'),
      '--dsw-alias-menu-icon': pair('#4a463f', '#d6d0c4'),
      '--dsw-alias-link': pair('#ad5738', '#e39170'),

      // Menus, tooltips, toasts — opaque windows
      '--dsw-menu-surface-fill': pair('#fbf9f4', '#302d29'),
      '--dsw-alias-menu-group-header-fill': pair('#f7f4ed', '#35322f'),
      '--dsw-specific-menu': pair('#fbf9f4', '#302d29'),
      '--dsw-mask-blur': both('none'),
      '--dsw-menu-backdrop-filter': both('none'),
      '--dsw-alias-toast-bg': pair('#2a2824', '#3d3933'),
      '--dsw-alias-toast-label': pair('#fbf9f4', '#f0ede4'),
      '--dsw-alias-tooltip-bg': pair('#2a2824', '#3d3933'),
      '--dsw-alias-tooltip-key-bg': pair('color-mix(in srgb, #2a2824, white 18%)', 'color-mix(in srgb, #3d3933, white 18%)'),

      // Markdown and code
      '--dsw-alias-markdown-code-block': pair('#f7f5f0', CODE_BG),
      '--dsw-alias-markdown-code-block-banner': pair('#efebe2', '#34322f'),
      '--dsw-alias-markdown-code-segment-selected': pair('#fbf9f4', '#3a3732'),
      '--dsw-alias-markdown-code-segment-unselected': pair('#efebe2', '#262421'),
      '--dsw-alias-markdown-inline-code': pair('#ede8dd', '#3a3732'),
      '--dsw-alias-markdown-placeholder': pair('#e9e4d9', '#34322f'),
      '--dsw-alias-markdown-tag': pair('#efebe2', '#34322f'),
      '--dsw-alias-markdown-citation': pair('#f0ece3', '#34322f'),
      '--dsw-alias-turn-trigger-bg': pair('#f7f5f0', '#2f2c28'),
      '--dsw-alias-turn-trigger-bg-hover': pair('#efece4', '#393530'),

      // Sidebar and composer
      '--dsw-specific-sidebar-fill': pair(SHELL.sidebarFill, '#1e1d1a'),
      '--dsw-specific-sidebar-nav-item-active': pair(SHELL.navActiveFill, '#2f2c28'),
      '--dsw-specific-sidebar-nav-item-active-accent': pair('#f4e0d5', '#4a3a30'),
      '--dsw-specific-sidebar-nav-item-hover': pair('#eae5db', '#292723'),
      '--dsw-specific-input-major': pair('#fffdf8', '#2b2825'),
      '--dsw-specific-login-input': pair('#f0ece3', '#262421'),
      '--dsw-specific-selector': pair('#f0ece3', '#2c2a26'),
      '--dsw-specific-tip': pair('#f0ece3', '#2c2a26'),
      '--dsw-specific-bubble': pair('#f0ebe1', '#35322d'),
      '--dsw-specific-bubble-highlight': pair('#e6dfd2', '#403c35'),

      // Scrollbars
      '--dsw-alias-scrollbar-bg-l1': pair('#d9d2c3', '#46423b'),
      '--dsw-alias-scrollbar-bg-l2': pair('#d9d2c3', '#46423b'),
      '--dsw-alias-scrollbar-hover-l1': pair('#c7bfad', '#55504a'),
      '--dsw-alias-scrollbar-hover-l2': pair('#c7bfad', '#55504a'),

      // State colors (semanticColors from the spec)
      '--dsw-alias-state-business-primary': both(ACCENT),
      // The official menu row paints a focus ring when the merged effort
      // slider is interacted with; keep it on the theme accent (host default
      // is violet).
      '--dsw-focus-ring-color': pair(ACCENT, '#e8a184'),
      '--dsw-focus-ring-width': both('2px'),
      '--dsw-alias-state-business-tertiary': pair('#f4e0d5', '#4a352b'),
      '--dsw-alias-state-success-primary': pair('#009c3f', '#37d06c'),
      '--dsw-alias-state-success-secondary': both('#00c853'),
      '--dsw-alias-state-success-tertiary': pair('#dcf7e6', '#1f3a28'),
      '--dsw-alias-state-error-primary': pair('#e14a24', '#ff7a58'),
      '--dsw-alias-state-error-secondary': pair('#ff5f38', '#ff8a6c'),
      '--dsw-alias-state-warn-label': pair('#b07a22', '#f2c15c'),
      '--dsw-alias-state-warn-primary': pair('#d99a2b', '#e0a43a'),
      '--dsw-alias-state-warn-secondary': pair('#f0b64a', '#f2c15c'),
      '--dsw-alias-state-warn-tertiary': pair('#fbf2de', '#3a2d16'),
      '--dsw-alias-state-idle-primary': pair('#cfc7b6', '#4d4640'),
      '--dsw-alias-switch-thumb': pair('#fffdf8', '#f0ede4'),

      // Diffs
      '--dsw-alias-code-diff-added': pair('#00c8531f', '#00c85326'),
      '--dsw-alias-code-diff-deleted': pair('#e14a2414', '#ff5f3826'),
      '--dsw-alias-file-diff-added-bg': pair('#e9f8ee', '#1f3427'),
      '--dsw-alias-file-diff-added-gutter': pair('#eefaf2', '#233b2c'),
      '--dsw-alias-file-diff-added-marker': pair('#00a344', '#37d06c'),
      '--dsw-alias-file-diff-deleted-bg': pair('#fdeae4', '#3c221a'),
      '--dsw-alias-file-diff-deleted-gutter': pair('#fdf0ec', '#43271e'),
      '--dsw-alias-file-diff-deleted-marker': pair('#d94a26', '#ff7a58'),

      // Onboarding accents (used by the welcome/onboarding surfaces)
      '--dsw-alias-onboarding-accent': both(ACCENT),

      // Think fade gradients must match the surface they fade into
      '--dsw-linear-gradient-think': pair(
        'linear-gradient(180deg, ' + SURFACE + ' 20.19%, ' + SURFACE + '00 100%)',
        'linear-gradient(180deg, #24221f 20.19%, #24221f00 100%)'
      ),
      '--dsw-linear-think-select': pair(
        'linear-gradient(180deg, #efebe2 20.19%, #efebe200 100%)',
        'linear-gradient(180deg, #322f2b 20.19%, #322f2b00 100%)'
      ),

      // Syntax colors — the "Absolutely" code theme (light + dark variants)
      '--shiki-foreground': pair(CODE_FG_LIGHT, CODE_FG_DARK),
      '--shiki-background': pair('#f9f9f7', CODE_BG),
      '--shiki-token-constant': pair('#ff5f38', '#ff5f38'),
      '--shiki-token-string': pair('#00c853', '#00c853'),
      '--shiki-token-comment': pair('#939391', '#b2b2b0'),
      '--shiki-token-keyword': pair('#ff5f38', '#ff5f38'),
      '--shiki-token-parameter': pair('#bc7559', '#d28e73'),
      '--shiki-token-function': pair(CODE_FG_LIGHT, CODE_FG_DARK),
      '--shiki-token-string-expression': pair('#00c853', '#00c853'),
      '--shiki-token-punctuation': pair('#6f6d68', '#a8a6a2'),
      '--shiki-token-link': pair('#cc7d5e', '#cc7d5e'),
    })

    // ── Merged reasoning-effort slider ──────────────────────────────────────
    // Adapted from dsh-codex-effort-slider v1.1.1 (MIT, © 2026
    // dsh-codex-effort-slider contributors). The algorithm is kept as-is; the
    // palette is remapped to the theme's cream / terracotta scale and the module
    // is mounted lazily only when the standalone plugin is not installed.
    const codexEffortSliderPlugin = (() => {

    var module = { exports: {} };
    var exports = module.exports;

    var React = require("react");
    var ReactDOM = require("react-dom");

    var PACKAGE_ID = "dsh-claude-code-desktop-theme/effort-slider";
    /** 仍然注册一个（不可见的）插槽条目：它是**每会话**拿到 sessionId 与 ctx 的立足点。 */
    var SLOT_NAME = "conversation.input.right";
    var ENTRY_ID = "claude-theme-effort-slider";
    var ENTRY_ORDER = 40;
    /** 「加高那一栏的上下距离」。 */
    var ROW_PADDING_BLOCK = "10px";
    /** 官方那一行的中文/英文文案（形状锚点之一；认不出就按官方固定顺序取第 2 个 menuitem）。 */
    var EFFORT_ROW_LABELS = ["推理等级", "Effort"];
    /** 拖动期间的写回降频窗口（毫秒）。松手一律立即落地。 */
    var COMMIT_THROTTLE_MS = 120;
    /** 提交后等宿主真实回报的上限；超时回滚并提示，不继续假装已生效。 */
    var COMMIT_DEADLINE_MS = 10000;
    /** 目录解析失败时的退避重试序列（毫秒，累计约 9 秒）。 */
    var RETRY_DELAYS = [60, 240, 540, 960, 1500, 3000, 3000];
    var STYLE_MARKER = PACKAGE_ID;

    /* ── 尺寸与速率常量：**必须声明在 CSS 数组之前**，因为样式表要插值它们 ──
       （踩过一次：CSS 数组先于常量求值，样式里写进去的是 `height:undefinedpx`，
       真机上轨道会塌成 0 高。测试里对轨道高/旋钮直径的断言就是为这个加的。） */
    /** 轨道高度（px）。旋钮直径与它相同 —— 一个"管子里的球"，圆永远是完整的圆。 */
    var TRACK_HEIGHT = 28;
    var KNOB_SIZE = TRACK_HEIGHT;
    /** 旋钮半径。圆心在两端各留出这个半径，圆圈才不会顶出轨道被菜单裁掉。 */
    var KNOB_RADIUS = KNOB_SIZE / 2;
    /** 全局速率倍数（用户要求：所有速度 ×4）。粒子时长 = 基准时长 ÷ (本值 × speedFor)。 */
    var BASE_SPEEDUP = 4;
    /**
     * 星空的**基准横穿时长**（秒，越大越慢）与各星时长浮动（± 这个比例）。
     * 基准对应"位置速率最快的那一档"（speedFor 的上限 `MAX_SPEED_FACTOR = 2`）：MAX 档 1.5s，
     * high 档（1×）3s，左端（0.35×）约 8.6s —— 速度随位置变化这条一直保留。
     * 浮动压到 ±8%（速度差 1.16×）：原来用 0.95~2.05s（速度差 2.16×）时快星会追上慢星成团。
     */
    var STARFIELD_DURATION_MEAN = 1.5;
    var STARFIELD_DURATION_SPREAD = 0.08;
    /** MAX 档星空的亮度/大小下限（1 = 现在的大小与亮度，即上限）。 */
    var STARFIELD_MIN = 0.5;
    /** 黄金比：把 22 颗星的高度与相位按低差异序列铺开（见 buildParticles / starDelayFor）。 */
    var GOLDEN_RATIO = 0.6180339887498949;
    /** 位置速率的上限（= speedFor 的封顶值），用来把"最快那一档"和基准时长对齐。 */
    var MAX_SPEED_FACTOR = 2;
    /** 系统开启「减少动态效果」时，星星时长乘这个倍数（放缓而不是冻住）。 */
    var REDUCED_MOTION_SLOWDOWN = 2.6;
    /** 相位相邻的两颗星，高度至少差这么多"槽"（1 槽 = 4% 轨道高）——防止并成一坨。 */
    var MIN_HEIGHT_SLOTS = 3;
    /** 能量段起点：第二档的刻度位置（4 档模型 → 1/3）。这一段以前是纯蓝，之后才渐入紫色。 */
    var ENERGY_START = 1 / 3;
    /** 颜色锚点：紫出现在这里（4 档模型 → high 档）。 */
    var ENERGY_END = 2 / 3;

    /** 蓝 → 紫 → 深紫（"第一档到第二档为蓝色，再往右逐渐变紫变深"）。 */
    var COLOR_BLUE = [168, 132, 104];
    var COLOR_VIOLET = [218, 119, 86];
    var COLOR_DEEP = [176, 85, 55];
    /**
     * 数值文字（"Max"）用的亮紫终点。
     * 文字不能像填充那样收到深紫（`COLOR_DEEP` 在深色底上几乎看不见），所以另给一个亮端；
     * 但也不能太亮 —— 实测 `#e8b598` 在**浅色主题**下对比度只有 2.6:1（发虚），
     * 所以取中档紫罗兰 `#b8583a`：对白底 ≈4.2:1、对深色底（#1d1b16）≈4.0:1，两种主题都读得清。
     */
    var COLOR_TEXT_VIOLET = [176, 85, 55];

    /* ════════════════════════════ 样式 ════════════════════════════ */

    /*
     * 颜色一律走 DSH 自己的设计令牌（`--dsw-*`），浅色/深色自动跟随。
     * 蓝色强调色用 `--dsw-alias-state-business-primary`（深色下 = deepseek-400 #da7756），
     * 回退到 blue-450 #da7756 —— 也就是参考图里那条轨道的蓝。
     */
    var FILL_RADIUS = "border-radius:" + KNOB_RADIUS + "px 0 0 " + KNOB_RADIUS + "px";
    var CSS = [
      /* 注入进官方那一行的容器：折行到第二行并铺满整行 */
      ".ces-inline{--ces-accent:var(--dsw-alias-state-business-primary,var(--dsw-static-deepseek-450,#da7756));box-sizing:border-box;flex-basis:100%;width:100%;min-width:0}",
      ".ces-track{position:relative;box-sizing:border-box;height:" + TRACK_HEIGHT + "px;margin-top:2px;border-radius:999px;background:var(--dsw-alias-border-l1,rgba(15,17,21,.08));cursor:pointer;touch-action:none;user-select:none;-webkit-user-select:none}",
      ".ces-track:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--ces-accent));outline-offset:2px}",
      ".ces-fill{position:absolute;top:0;bottom:0;left:0;" + FILL_RADIUS + ";pointer-events:none}",
      ".ces-tick{position:absolute;top:50%;width:3px;height:3px;margin:-1.5px 0 0 -1.5px;border-radius:50%;background:color-mix(in srgb,var(--dsw-alias-label-primary,#1d1b16) 26%,transparent);pointer-events:none}",
      ".ces-tick[data-on='1']{background:rgba(255,255,255,.5)}",
      /* 旋钮直径 = 轨道高度（"与滑条同宽"）：圆完整地填满管口，不会出现被裁出的平边。 */
      ".ces-knob{position:absolute;top:50%;width:" + KNOB_SIZE + "px;height:" + KNOB_SIZE + "px;margin:" + (-KNOB_RADIUS) + "px 0 0 " + (-KNOB_RADIUS) + "px;border-radius:50%;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.34),0 0 0 .5px rgba(0,0,0,.06);pointer-events:none}",
      ".ces-error{margin-top:6px;font-size:11px;line-height:16px;color:var(--dsw-alias-state-error-primary,#e5484d)}",
      /* ── 最高档能量层（纯视觉：紫色星云 + 星尘粒子 + 扫光）─────────────────
         强度由 `--ces-energy`(0..1) 一个变量驱动：外层只做 opacity/box-shadow，
         所以"渐入"是浏览器合成的颜色插值，不需要 JS 逐帧改样式。
         关掉时把粒子动画 `animation-play-state: paused`，不让 22 个隐形元素白烧 GPU。 */
      ".ces-inline[data-energy='1'] .ces-track{box-shadow:0 0 calc(var(--ces-energy,0) * 16px) rgba(218,119,86,.45)}",
      ".ces-inline[data-energy='0'] .ces-star,.ces-inline[data-energy='0'] .ces-energy__sweep{animation-play-state:paused}",
      /* 能量层只覆盖**已填充那一段**（宽度与填充相同）：档位右边没到的部分不显示能量条。
         左端从 0 起、宽度由内联样式给（= 到旋钮圆心），所以它跟着旋钮一起长。 */
      ".ces-energy{position:absolute;top:0;bottom:0;left:0;" + FILL_RADIUS + ";overflow:hidden;pointer-events:none;opacity:var(--ces-energy,0);transition:opacity .2s ease;background:linear-gradient(90deg,#8f5a44 0%,#b05537 30%,#da7756 62%,#e8b598 100%)}",
      /* 星星单独一层：**不跟着星云淡入**（否则 high 档会被星云的 0.5 透明度压得看不见）。
         几何与星云层相同（贴着已填充段、圆角裁切），透明度由内联样式给。 */
      ".ces-stars{position:absolute;top:0;bottom:0;left:0;" + FILL_RADIUS + ";overflow:hidden;pointer-events:none;transition:opacity .2s ease}",
      /* 星空（**所有出现粒子的档位都用这一套**）：外层是**整轨宽度**的轨道
         （它自己在做 -100% 的连续横穿），内层圆点的亮度/大小由 --ces-b 决定（越亮越大）。
         残影只在两端淡出，而那两端在可视区外，所以看起来粒子"从不消失"。

         ⚠️ 时长与相位**直接内联**写在元素上（见组件的 animationDuration / animationDelay），
         不走 CSS 变量：实测把 `animation-delay:var(--ces-delay)` 写在样式表里时，
         真宿主里负相位不生效 —— 结果是"一打开所有星星挤在起点，十几秒后才靠速度差散开"。
         `--ces-b`（亮度/大小）只是不参与动画计时的普通变量，留着没问题。 */
      ".ces-star{position:absolute;left:0;right:0;height:3px;margin-top:-1.5px;pointer-events:none;animation-name:ces-star-sweep;animation-timing-function:linear;animation-iteration-count:infinite}",
      ".ces-star__dot{position:absolute;left:100%;top:0;width:3px;height:3px;margin-left:-1.5px;border-radius:50%;background:#fff;box-shadow:0 0 4px rgba(255,255,255,.85);opacity:var(--ces-b,1);transform:scale(var(--ces-b,1))}",
      "@keyframes ces-star-sweep{0%{transform:translate3d(0,0,0);opacity:0}6%{opacity:1}94%{opacity:1}100%{transform:translate3d(-100%,0,0);opacity:0}}",
      ".ces-energy__sweep{position:absolute;inset:0;background:linear-gradient(100deg,transparent 18%,rgba(255,255,255,.30) 50%,transparent 82%);transform:translateX(100%);animation:ces-sweep 2.4s linear infinite}",
      "@keyframes ces-sweep{0%{transform:translateX(100%)}100%{transform:translateX(-100%)}}",
      "body[data-ds-dark-theme] .ces-star__dot{background:#fdf4ef;box-shadow:0 0 5px rgba(232,181,152,.85)}",
      /* 系统要求「减少动态效果」时**放缓**而不是冻住：收起扫光。
         星星的放缓在 JS 里算（时长 × REDUCED_MOTION_SLOWDOWN）—— 不走 CSS 媒体查询，
         因为时长现在是内联的，也免得再引入"变量参与动画计时"这类坑。 */
      "@media (prefers-reduced-motion: reduce){.ces-energy{transition:none}.ces-energy__sweep{display:none}}",
      /* 设置面板（挂在 body 上，样式必须是全局的） */
      ".ces-set{position:fixed;z-index:2147483000;min-width:252px;max-width:340px;padding:10px 12px;border-radius:10px;box-sizing:border-box;background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-label-pri,#1d1b16);border:1px solid rgba(127,127,127,.28);box-shadow:0 12px 32px rgba(0,0,0,.24);font:13px/1.5 'DSH Serif UI','Microsoft YaHei',sans-serif}",
      ".ces-set__title{font-weight:600;margin:0 0 6px 0}",
      ".ces-set__row{font-size:12px;opacity:.72;margin-bottom:8px}",
      ".ces-set__group{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}",
      ".ces-set__group label{display:flex;gap:6px;align-items:center;cursor:pointer}",
      ".ces-set__actions{display:flex;justify-content:space-between;gap:8px}",
      ".ces-set button{cursor:pointer;font:inherit;color:inherit;padding:4px 10px;border-radius:6px;border:1px solid rgba(127,127,127,.35);background:transparent}",
      ".ces-set button:hover{background:rgba(127,127,127,.14)}",
      "body[data-ds-dark-theme] .ces-set{background:var(--dsw-alias-bg-base,#24221f);color:var(--dsw-alias-label-pri,#ece7dd)}",
      /* 「已到达档位的刻度点」：dim = 与未到达同色；hidden = 隐藏 */
      ".ces-inline[data-reached-ticks='dim'] .ces-tick[data-on='1']{background:color-mix(in srgb,var(--dsw-alias-label-primary,#1d1b16) 26%,transparent)}",
      ".ces-inline[data-reached-ticks='hidden'] .ces-tick[data-on='1']{display:none}",
    ].join("\n");

    /** 把样式挂进文档。加载器会把它认领为「本插件产出的 style」（HMR 卸载时一并清理）。 */
    function installStyles() {
      try {
        installSettingsUi();
        if (typeof document === "undefined" || !document.head) return null;
        var existing = document.querySelector('style[data-plugin-css="' + STYLE_MARKER + '"]');
        if (existing) return existing;
        var style = document.createElement("style");
        style.setAttribute("data-plugin-css", STYLE_MARKER);
        style.textContent = CSS;
        document.head.appendChild(style);
        return style;
      } catch (error) {
        /* 样式失败只影响观感，绝不影响功能 */
        return null;
      }
    }

    /* ════════════════ 设置（schema 驱动，加新设置只需加一行）════════════════ *
     *
     * 目标（用户明确要求）：
     *   1. 只保留两种动画：「简洁动画」(quick) 与「完整动画」(full)
     *   2. **完全不受系统「减少动态效果」影响** —— 两种模式都由插件自己决定
     *   3. 简洁动画 = 我们之前的方案（MOTION_REDUCED 紧参数）
     *   4. 完整动画 = 作者原本的方案（MOTION 松参数）
     *
     * 设计要点：
     *   · 所有设置都在 SETTINGS_SCHEMA 里声明；面板按 schema 自动渲染/回填/校验
     *   · 加设置 = 加一行表项（若是新控件类型，再加一个 renderKind 分支）
     *
     * ⚠️ 这些函数会被预览生成器**原样抽取**到另一个作用域，所以模块级变量一律
     *    用 `typeof x === "undefined"` 兜底，绝不裸引用。
     */
    /** 诊断用：本模块被加载了几次、每个组件实例的编号（排查"两个实例互相搅乱拖动状态"）。 */
    var __cesInstanceSeq = 0;
    /** 本份模块加载的身份令牌（每次 load 一份新的）。 */
    var __cesOwnerToken = {};
    /** 本份加载是否"已判定过""是否是 owner"——只判定一次，保证实例的 Hook 数量恒定。 */
    var __cesDecided = false;
    var __cesIsOwner = false;
    var SETTINGS_KEY = "dsh-codex-effort-slider.settings";
    var SETTINGS_EVENT = "dsh-codex-effort-slider:settings";
    var SETTINGS_VERSION = 3;

    var SETTINGS_SCHEMA = [
      {
        key: "motion",
        kind: "radio",
        group: "动画",
        label: "动画",
        default: "full",
        options: [
          { value: "quick", label: "简洁动画" },
          { value: "full", label: "完整动画" },
        ],
      },
      {
        key: "reachedTicks",
        kind: "radio",
        group: "已到达档位的刻度点",
        label: "刻度点",
        default: "hidden",
        options: [
          { value: "highlight", label: "亮白显示" },
          { value: "dim", label: "与未到达同色" },
          { value: "hidden", label: "隐藏" },
        ],
      },
    ];

    function schemaDefaults() {
      var schema = (typeof SETTINGS_SCHEMA === "undefined") ? [] : SETTINGS_SCHEMA;
      var out = {};
      for (var i = 0; i < schema.length; i += 1) {
        var item = schema[i];
        if (item.default !== undefined) { out[item.key] = item.default; continue; }
        if (item.kind === "radio") out[item.key] = item.options[0].value;
        else if (item.kind === "switch") out[item.key] = true;
        else if (item.kind === "range") out[item.key] = (item.scale || 1);
        else out[item.key] = null;
      }
      return out;
    }

    /** schema 驱动的校验：非法/缺失值回退默认，永远返回完整设置。 */
    function normalizeSettings(raw) {
      var schema = (typeof SETTINGS_SCHEMA === "undefined") ? [] : SETTINGS_SCHEMA;
      var out = schemaDefaults();
      var source = (raw && typeof raw === "object") ? raw : {};
      for (var i = 0; i < schema.length; i += 1) {
        var item = schema[i];
        var value = source[item.key];
        if (value === undefined) continue;
        if (item.kind === "radio") {
          for (var j = 0; j < item.options.length; j += 1) {
            if (item.options[j].value === value) { out[item.key] = value; break; }
          }
        } else if (item.kind === "switch") {
          if (typeof value === "boolean") out[item.key] = value;
        } else if (item.kind === "range") {
          var n = typeof value === "number" ? value : parseFloat(value);
          var scale = item.scale || 1;
          if (isFinite(n)) {
            var lo = item.min / scale, hi = item.max / scale;
            out[item.key] = n < lo ? lo : (n > hi ? hi : n);
          }
        }
      }
      return out;
    }

    var settingsCache = null;
    var settingsUiState = {
      installed: false, panel: null, longPressTimer: null, longPressOrigin: null,
      anchorEl: null, cacheListenerInstalled: false,
    };

    function settingsKey() { return (typeof SETTINGS_KEY === "undefined") ? "dsh-codex-effort-slider.settings" : SETTINGS_KEY; }
    function settingsEventName() { return (typeof SETTINGS_EVENT === "undefined") ? "dsh-codex-effort-slider:settings" : SETTINGS_EVENT; }
    function cacheGet() { return (typeof settingsCache === "undefined") ? null : settingsCache; }
    function cacheSet(value) { if (typeof settingsCache !== "undefined") settingsCache = value; }

    function readSettings() {
      var cached = cacheGet();
      if (cached !== null) return cached;
      var raw = null;
      try {
        if (typeof localStorage !== "undefined" && localStorage) raw = localStorage.getItem(settingsKey());
      } catch (error) { /* 读不到用默认 */ }
      var parsed = null;
      try { parsed = raw ? JSON.parse(raw) : null; } catch (error) { parsed = null; }
      var expected = (typeof SETTINGS_VERSION === "undefined") ? 3 : SETTINGS_VERSION;
      // 版本不符 → **不丢弃值**，只按当前 schema 规范化（保留仍合法的项）并盖上版本号。
      var out = normalizeSettings(parsed);
      out.v = expected;
      if (parsed && typeof parsed === "object" && parsed.v !== expected) {
        try {
          if (typeof localStorage !== "undefined" && localStorage) localStorage.setItem(settingsKey(), JSON.stringify(out));
        } catch (error) { /* 写盘失败也无妨：值已保住 */ }
      }
      cacheSet(out);
      return out;
    }

    function writeSettings(patch) {
      var cur = readSettings();
      var merged = {};
      for (var k in cur) if (Object.prototype.hasOwnProperty.call(cur, k)) merged[k] = cur[k];
      if (patch && typeof patch === "object") {
        for (var k2 in patch) if (Object.prototype.hasOwnProperty.call(patch, k2)) merged[k2] = patch[k2];
      }
      var next = normalizeSettings(merged);
      next.v = (typeof SETTINGS_VERSION === "undefined") ? 3 : SETTINGS_VERSION;
      cacheSet(next);
      try {
        if (typeof localStorage !== "undefined" && localStorage) localStorage.setItem(settingsKey(), JSON.stringify(next));
      } catch (error) { /* 存不下只影响"下次还记不记得" */ }
      try {
        if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent === "function") {
          window.dispatchEvent(new CustomEvent(settingsEventName()));
        }
      } catch (error) { /* 广播失败无妨 */ }
      return next;
    }

    /** 当前动画模式：'quick' = 简洁动画，'full' = 完整动画。**与系统设置无关**。 */
    function motionMode() {
      return readSettings().motion === "quick" ? "quick" : "full";
    }

    /** 当前模式对应的运动参数组（不读取任何系统偏好）。 */
    function motionParamsForMode() {
      return motionMode() === "quick" ? MOTION_REDUCED : MOTION;
    }

    /** 系统是否要求「减少动态效果」——**仅用于面板提示**，不影响任何行为。 */
    function systemReducedMotion() {
      try {
        return typeof window !== "undefined" && typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches === true;
      } catch (error) { return false; }
    }

    /* ───────────── 诊断记录（排查"松手抽搐"这类真机时序问题）───────────── *
     * 推理到极限时的办法：把每一帧的"显示值 / 已生效档位 / 草稿"记下来，
     * 复现后一键复制，就能直接看到**到底是哪一帧、哪个值跳了**。
     */
    var traceBuf = [];
    function tracePush(entry) {
      try {
        traceBuf.push(entry);
        if (traceBuf.length > 400) traceBuf.splice(0, traceBuf.length - 400);
      } catch (error) { /* 诊断失败绝不影响功能 */ }
    }
    function traceClear() {
      try { traceBuf.length = 0; } catch (error) { /* 忽略 */ }
    }
    /** 生成可直接粘贴的诊断文本：突出"单帧跳变"与"松手事件"。 */
    function dumpTrace() {
      try {
        var buf = traceBuf.slice();
        if (buf.length === 0) return "（还没有记录：请先在滑条上拖动/松手几次，再点这里）";
        var samples = buf.filter(function (e) { return e && e.k === "s"; });
        var jumps = [];
        for (var i = 1; i < samples.length; i += 1) {
          var d = Math.abs((samples[i].shown || 0) - (samples[i - 1].shown || 0));
          if (d > 0.02) jumps.push({ at: i, d: Math.round(d * 1000) / 10, from: samples[i - 1], to: samples[i] });
        }
        jumps.sort(function (a, b) { return b.d - a.d; });
        var lines = [];
        lines.push("=== 滑条诊断 " + new Date().toISOString() + " ===");
        lines.push("记录 " + buf.length + " 条（采样 " + samples.length + "）");
        lines.push("动画模式 = " + readSettings().motion + " ; 系统减少动态 = " + systemReducedMotion());
        lines.push("单帧跳变(>2%) 次数: " + jumps.length);
        for (var j = 0; j < Math.min(8, jumps.length); j += 1) {
          var x = jumps[j];
          lines.push("  跳 " + x.d + "%  " + JSON.stringify({ from: x.from, to: x.to }));
        }
        var rel = buf.filter(function (e) { return e && e.k === "release"; });
        lines.push("松手事件 " + rel.length + " 次，最后 3 次:");
        for (var r = Math.max(0, rel.length - 3); r < rel.length; r += 1) lines.push("  " + JSON.stringify(rel[r]));
        // 事件计数：一眼看出 endDrag / settle-clear / release 各发生了几次
        var evCounts = {};
        for (var ci = 0; ci < buf.length; ci += 1) { var kk = buf[ci] && buf[ci].k; if (kk) evCounts[kk] = (evCounts[kk] || 0) + 1; }
        lines.push("事件计数: " + JSON.stringify(evCounts));
        // 每个非采样事件的上下文（前 2 条 + 后 6 条）
        var marks = [];
        for (var mi = 0; mi < buf.length; mi += 1) { if (buf[mi] && buf[mi].k && buf[mi].k !== "s") marks.push(mi); }
        for (var mj = Math.max(0, marks.length - 5); mj < marks.length; mj += 1) {
          var mIdx = marks[mj];
          lines.push("=== 事件 " + JSON.stringify(buf[mIdx]));
          for (var mb = Math.max(0, mIdx - 2); mb < mIdx; mb += 1) lines.push("  前 " + JSON.stringify(buf[mb]));
          for (var ma = mIdx + 1; ma < Math.min(buf.length, mIdx + 7); ma += 1) lines.push("  后 " + JSON.stringify(buf[ma]));
        }
        lines.push("--- 最后 120 条原始记录 ---");
        var tail = buf.slice(-120);
        for (var k = 0; k < tail.length; k += 1) lines.push(JSON.stringify(tail[k]));
        return lines.join("\n");
      } catch (error) {
        return "诊断生成失败: " + String(error && error.message ? error.message : error);
      }
    }

    /* ───────────── 面板：全部由 SETTINGS_SCHEMA 生成 ───────────── */

    function renderKind(item, value, esc) {
      var key = item.key;
      if (item.kind === "radio") {
        var opts = "";
        for (var i = 0; i < item.options.length; i += 1) {
          var o = item.options[i];
          opts += '<label><input type="radio" name="ces-' + esc(key) + '" data-ces-key="' + esc(key) + '" value="' + esc(o.value) + '"' +
            (value === o.value ? " checked" : "") + '> ' + esc(o.label) + '</label>';
        }
        return '<div class="ces-set__group" role="radiogroup" aria-label="' + esc(item.group || item.label) + '">' +
          (item.group ? '<div class="ces-set__row">' + esc(item.group) + '</div>' : "") + opts + '</div>';
      }
      if (item.kind === "switch") {
        return '<div class="ces-set__group"><label><input type="checkbox" data-ces-key="' + esc(key) + '"' +
          (value === true ? " checked" : "") + '> ' + esc(item.label) + '</label></div>';
      }
      if (item.kind === "range") {
        var shown = Math.round((value || 0) * (item.scale || 1));
        return '<div class="ces-set__group"><label class="ces-set__range">' + esc(item.label) +
          ' <input type="range" data-ces-key="' + esc(key) + '" data-ces-scale="' + esc(item.scale || 1) + '"' +
          ' min="' + esc(item.min) + '" max="' + esc(item.max) + '" step="' + esc(item.step || 1) + '" value="' + esc(shown) + '">' +
          ' <span data-ces-val="' + esc(key) + '"></span></label></div>';
      }
      return "";   // 未知 kind：安静跳过（旧版本遇到新控件不崩）
    }

    function disposeSettingsPanel() {
      try {
        if (typeof document === "undefined") return;
        var stale = document.querySelectorAll(".ces-set");
        for (var i = 0; i < stale.length; i += 1) {
          if (stale[i].parentNode) stale[i].parentNode.removeChild(stale[i]);
        }
      } catch (error) { /* 清理失败不致命 */ }
      settingsUiState.panel = null;
    }

    function buildSettingsPanel() {
      disposeSettingsPanel();   // 插件可能被加载多次：每次清掉旧面板再建，保证唯一且最新
      var esc = function (v) {
        return String(v === undefined || v === null ? "" : v)
          .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      };
      var s = readSettings();
      var schema = (typeof SETTINGS_SCHEMA === "undefined") ? [] : SETTINGS_SCHEMA;
      var body = "";
      for (var i = 0; i < schema.length; i += 1) body += renderKind(schema[i], s[schema[i].key], esc);

      var panel = document.createElement("div");
      panel.className = "ces-set";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "推理等级滑条 · 设置");
      panel.setAttribute("tabindex", "-1");
      panel.style.display = "none";
      panel.innerHTML =
        '<div class="ces-set__title">滑条设置</div>' +
        '<div class="ces-set__row" data-ces-system></div>' +
        body +
        '<div class="ces-set__actions">' +
        '<button type="button" data-ces-trace>复制诊断</button>' +
        '<button type="button" data-ces-reset>恢复默认</button>' +
        '<button type="button" data-ces-close>关闭</button>' +
        '</div>';

      // 事件完全由 data-ces-key 驱动：加新设置不用改这里；只监听 input（挂 change 会写两次）
      var applyFromInput = function (input) {
        var key = input.getAttribute("data-ces-key");
        if (!key) return;
        var schema = (typeof SETTINGS_SCHEMA === "undefined") ? [] : SETTINGS_SCHEMA;
        var item = null;
        for (var i = 0; i < schema.length; i += 1) if (schema[i].key === key) { item = schema[i]; break; }
        if (item === null) return;
        var patch = {};
        if (item.kind === "switch") patch[key] = input.checked === true;
        else if (item.kind === "range") patch[key] = parseFloat(input.value) / (item.scale || 1);
        else patch[key] = input.value;
        writeSettings(patch);
        syncSettingsPanel();   // 任何改动都刷新：让依赖联动立刻生效
      };
      panel.addEventListener("input", function (event) { applyFromInput(event.target); });
      panel.addEventListener("click", function (event) {
        var el = event.target;
        if (!el || typeof el.hasAttribute !== "function") return;
        if (el.hasAttribute("data-ces-trace")) {
          var txt = dumpTrace();
          var btn = el;
          try {
            if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(txt);
              btn.textContent = "已复制 ✓";
            } else {
              btn.textContent = "无法复制";
            }
          } catch (error) { btn.textContent = "无法复制"; }
          setTimeout(function () { btn.textContent = "复制诊断"; }, 1500);
        }
        if (el.hasAttribute("data-ces-reset")) { writeSettings(schemaDefaults()); syncSettingsPanel(); }
        if (el.hasAttribute("data-ces-close")) closeSettingsPanel();
      });
      panel.addEventListener("mousedown", function (event) { event.stopPropagation(); });

      document.body.appendChild(panel);
      settingsUiState.panel = panel;
      return panel;
    }

    function syncSettingsPanel() {
      var panel = settingsUiState.panel;
      if (!panel) return;
      var s = readSettings();
      var schema = (typeof SETTINGS_SCHEMA === "undefined") ? [] : SETTINGS_SCHEMA;
      for (var i = 0; i < schema.length; i += 1) {
        var item = schema[i];
        var input = panel.querySelector('[data-ces-key="' + item.key + '"]');
        if (item.kind === "radio") {
          var radios = panel.querySelectorAll('[data-ces-key="' + item.key + '"]');
          for (var r = 0; r < radios.length; r += 1) radios[r].checked = (radios[r].value === s[item.key]);
        } else if (item.kind === "switch" && input) {
          input.checked = s[item.key] === true;
        } else if (item.kind === "range" && input) {
          var shown = String(Math.round((s[item.key] || 0) * (item.scale || 1)));
          if (input.value !== shown) input.value = shown;
          input.disabled = item.dependsOn ? (s[item.dependsOn] !== true) : false;
          var label = panel.querySelector('[data-ces-val="' + item.key + '"]');
          if (label) label.textContent = input.disabled ? "已关闭" : (shown + (item.unit || ""));
        }
      }
      var sys = panel.querySelector("[data-ces-system]");
      if (sys) sys.textContent = "两种动画都不受系统「减少动态效果」影响";
    }

    function closeSettingsPanel() {
      var panel = settingsUiState.panel;
      if (!panel || panel.style.display === "none") return;
      panel.style.display = "none";
      try {
        if (settingsUiState.anchorEl && typeof settingsUiState.anchorEl.focus === "function") settingsUiState.anchorEl.focus();
      } catch (error) { /* 忽略 */ }
    }

    function openSettingsPanel(rect, anchorEl) {
      try {
        if (typeof document === "undefined" || !document.body) return;
        var panel = buildSettingsPanel();
        syncSettingsPanel();
        panel.style.display = "block";
        settingsUiState.anchorEl = anchorEl || null;
        var width = panel.offsetWidth || 280;
        var height = panel.offsetHeight || 200;
        var x = rect ? rect.left : 40;
        var y = rect ? rect.bottom + 6 : 80;
        var maxX = (window.innerWidth || 1024) - width - 8;
        var maxY = (window.innerHeight || 768) - height - 8;
        panel.style.left = Math.max(8, Math.min(x, maxX)) + "px";
        panel.style.top = Math.max(8, Math.min(y, maxY)) + "px";
        try { panel.focus(); } catch (error) { /* 无所谓 */ }
      } catch (error) { /* 面板失败不影响滑条 */ }
    }

    function isOurSlider(node) {
      return !!(node && typeof node.closest === "function" && node.closest(".ces-inline"));
    }

    /** 安装全局交互。分两段：① 每个模块实例都要挂"清缓存"；② 全局交互只装一套。 */
    function installSettingsUi() {
      if (typeof document === "undefined" || !document.addEventListener) return;
      settingsUiState.installed = true;

      if (settingsUiState.cacheListenerInstalled !== true) {
        settingsUiState.cacheListenerInstalled = true;
        try {
          if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener(settingsEventName(), function () { cacheSet(null); });
          }
        } catch (error) { /* 忽略 */ }
      }
      if (document.__cesSettingsUiInstalled === true) return;
      document.__cesSettingsUiInstalled = true;

      // 1) 右键
      document.addEventListener("contextmenu", function (event) {
        if (!isOurSlider(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        var host = event.target.closest(".ces-inline");
        openSettingsPanel(host.getBoundingClientRect(), host);
      }, true);

      // 2) 长按 600ms（必须"按住不动"：拖动时指针一直在动，绝不能弹面板）
      document.addEventListener("pointerdown", function (event) {
        if (!isOurSlider(event.target)) return;
        var host = event.target.closest(".ces-inline");
        clearTimeout(settingsUiState.longPressTimer);
        settingsUiState.longPressOrigin = { x: event.clientX, y: event.clientY };
        settingsUiState.longPressTimer = setTimeout(function () {
          settingsUiState.longPressTimer = null;
          openSettingsPanel(host.getBoundingClientRect(), host);
        }, 600);
      }, true);
      var cancelLongPress = function () {
        if (!settingsUiState.longPressTimer) return;
        clearTimeout(settingsUiState.longPressTimer);
        settingsUiState.longPressTimer = null;
      };
      document.addEventListener("pointermove", function (event) {
        var origin = settingsUiState.longPressOrigin;
        if (!origin) return;
        if (Math.abs((event.clientX || 0) - origin.x) > 6 || Math.abs((event.clientY || 0) - origin.y) > 6) cancelLongPress();
      }, true);
      document.addEventListener("pointerup", cancelLongPress, true);
      document.addEventListener("pointercancel", cancelLongPress, true);

      // 3) 键盘等效键（右键是键盘用户够不到的）
      document.addEventListener("keydown", function (event) {
        var isMenuKey = (event.shiftKey && event.key === "F10") || event.key === "ContextMenu";
        if (!isMenuKey) return;
        var active = document.activeElement;
        if (!isOurSlider(active)) return;
        event.preventDefault();
        openSettingsPanel(active.getBoundingClientRect(), active);
      }, true);

      // 4) Esc / 点外部关闭
      document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") closeSettingsPanel();
      }, true);
      document.addEventListener("mousedown", function (event) {
        var panel = settingsUiState.panel;
        if (!panel || panel.style.display === "none") return;
        if (panel.contains(event.target)) return;
        if (isOurSlider(event.target)) return;   // 右键/长按紧接着会重新打开
        closeSettingsPanel();
      }, true);
    }

    /* ════════════════════════ 纯函数（可离线单测）════════════════════════ */

    var EMPTY_SNAPSHOT = Object.freeze({
      current: null,
      groups: [],
      failures: [],
      status: "idle",
      pending: null,
      error: null,
      retainedEffort: undefined,
    });

    /** 在目录快照里找到当前模型条目（groups[].models[]）。 */
    function modelOf(state) {
      var current = state && state.current;
      if (!current || typeof current.provider !== "string" || typeof current.model !== "string") return null;
      var groups = state && Array.isArray(state.groups) ? state.groups : [];
      for (var i = 0; i < groups.length; i += 1) {
        var group = groups[i];
        if (!group || group.id !== current.provider) continue;
        var models = Array.isArray(group.models) ? group.models : [];
        for (var j = 0; j < models.length; j += 1) {
          if (models[j] && models[j].id === current.model) return models[j];
        }
      }
      return null;
    }

    /**
     * 「不指定档位」的哨兵 id。
     *
     * 官方模型菜单在模型没有 defaultEffort 时会多出一个 Default 选项：选中它等于
     * 请求里不带 reasoningEffort，交给 provider 决定（对 thinkingFormat=qwen 的网关
     * 就是 enable_thinking=false，即关思考）。它和显式档位一样是可选状态，所以滑条
     * 必须画成一个位置，否则会出现「菜单 4 项、滑条只有 3 点」。
     */
    var PROVIDER_DEFAULT_LEVEL_ID = "__provider_default__";

    /** 当前模型真实可用的档位列表（官方 id + 官方显示名，按目录顺序）。 */
    function levelsOf(state) {
      var model = modelOf(state);
      var reasoning = model && model.reasoning ? model.reasoning : null;
      var efforts = reasoning && Array.isArray(reasoning.efforts) ? reasoning.efforts : [];
      var out = [];
      // 与官方菜单一致：没有 defaultEffort 时，Default 排在第一项。
      var hasDefault = reasoning && typeof reasoning.defaultEffort === "string" && reasoning.defaultEffort.length > 0;
      if (reasoning && efforts.length > 0 && !hasDefault) {
        out.push({ id: PROVIDER_DEFAULT_LEVEL_ID, name: "Default", providerDefault: true });
      }
      for (var i = 0; i < efforts.length; i += 1) {
        var effort = efforts[i];
        if (!effort || typeof effort.id !== "string" || effort.id.length === 0) continue;
        out.push({
          id: effort.id,
          name: typeof effort.name === "string" && effort.name.length > 0 ? effort.name : effort.id,
        });
      }
      return out;
    }

    /**
     * 当前**生效**的档位 id：显式设置优先；没设置过就是模型的默认档
     * （与官方 `syncInputs()` 的 `effort = intended.reasoningEffort ?? reasoning.defaultEffort` 同款）；
     * 两者都没有但有可选档位时，就是官方的 Default 状态。
     */
    function effectiveEffortId(state) {
      var current = state && state.current;
      if (current && typeof current.reasoningEffort === "string" && current.reasoningEffort.length > 0) {
        return current.reasoningEffort;
      }
      var model = modelOf(state);
      var reasoning = model && model.reasoning ? model.reasoning : null;
      var fallback = reasoning && reasoning.defaultEffort;
      if (typeof fallback === "string" && fallback.length > 0) return fallback;
      var efforts = reasoning && Array.isArray(reasoning.efforts) ? reasoning.efforts : [];
      if (efforts.length > 0) return PROVIDER_DEFAULT_LEVEL_ID;
      return null;
    }

    function indexOfLevel(levels, id) {
      if (typeof id !== "string") return -1;
      for (var i = 0; i < levels.length; i += 1) if (levels[i].id === id) return i;
      return -1;
    }

    function clamp01(value) {
      if (!(value > 0)) return 0; // 同时挡住 NaN
      return value > 1 ? 1 : value;
    }

    /** 百分比 → 最近档位下标（滑条连续，档位离散，所以必须吸附）。 */
    function indexFromPct(pct, count) {
      if (count <= 1) return 0;
      return Math.max(0, Math.min(count - 1, Math.round(clamp01(pct) * (count - 1))));
    }

    /** 档位下标 → 该档位在轨道上的百分比（刻度点与旋钮永远对齐）。 */
    function pctFromIndex(index, count) {
      if (count <= 1) return 0;
      var safe = Math.max(0, Math.min(count - 1, index));
      return safe / (count - 1);
    }

    /* ══════════════ 连续运动引擎（刹车预测 + 速度跟踪）══════════════
     *
     * 核心不变量：**目标可以突变，运动状态（位置 x / 速度 v / 加速度 a）不可以。**
     * 用户操作（按下 / 拖动 / 松手 / 键盘）只改 `m.target`，**绝不碰 x / v / a**。
     *
     * 早先几版都在"时长 + 缓动曲线"里打转（200ms ease-in-out → 80ms ease-out →
     * 追赶窗口），怎么调都不对。根因是：CSS transition 在目标变化时**必然重播
     * 一条固定曲线**，做不到"只换目标、不换运动状态"，于是永远在"取消旧动画 →
     * 播新动画"之间切换，视觉上就是"本来在减速突然又开始加速"的割裂感。
     *
     * ── 运动律：两步 ──
     *
     *   第 1 步：**由位置误差算出"期望速度"**（两个映射取小）
     *       v期望 = sign(e) · min( K·|e| , √(2·A·|e|) , vmax )
     *
     *   第 2 步：**由速度差算出加速度**（连续跟踪，不是 bang-bang）
     *       a = clamp(k · (v期望 − v), ±amax)
     *       v = clamp(v + a·dt, ±vmax);   x = x + v·dt
     *
     * ⚠️ **必须同时有那两项，只留刹车曲线会抖振**（实测定论，别重犯）：
     *   `√(2A|e|)` 是 **bang-bang 的切换曲线**，含义是"在**恒力 A 减速**下还能
     *   刹停的速度上限"，它和 `a = ±A` 是**一对**。一旦力律换成连续的
     *   `a = k(v期望 − v)`，就丢掉了"力恒定为 A"这个前提：
     *     · v期望 自身随 e→0 而下降，v 永远追不上一条持续下降的曲线
     *     · 到目标时仍有残速 → 冲过去 → e 变号 → v期望 反向 → 又冲回来
     *   实测只留 `√(2Ae)` 当速度目标：目标 0.5 时 **v 符号翻转 973 次、永不收敛**。
     *
     *   所以 `K·|e|` 才是**为连续力律设计的**位置→速度映射；`√(2A|e|)` 降级为
     *   **上限**（"别快过刹得住的速度"）。两者取小后实测零抖振、全部精确落点。
     *
     * ── 参数（四个旋钮）──
     *   K    = 位置→速度映射增益（1/s）。决定"离目标多远时想跑多快"。
     *   A    = 刹车斜率，只作速度上限。同时决定反向滑行距离 ≈ v²/(2A)。
     *   k    = 速度跟踪增益（1/s）。越大越接近 bang-bang（力陡），越小越柔和。
     *   vmax = 速度上限。
     *
     * 实测标定（真实事件率 125Hz + 帧 60Hz，行程 = 1.0）—— K=20 A=120 k=40 vmax=6：
     *
     *     指标                        本版      弹簧阻尼版   纯 bang-bang
     *     小幅动 10px 后的"弹"        0.28px    7.11px      0.00px
     *     召唤到 1%                   ~200ms    333ms       217ms
     *     过冲（各距离）              ≤0.2px    0.00px      0.00px
     *     各距离精确落点              全部 ✓    全部 ✓      全部 ✓
     *     抖振（v 符号翻转）          0         0           需要 16 子步抑制
     *
     * ⚠️ 两个实测确认"别加"的东西：
     *   1) **不要加加加速度(jmax)限幅**：会拖慢力对"预测切换时机"的响应，
     *      反而把弹从小到大（在 bang-bang 版上实测 0.32 → 1.40px）。
     *   2) **不要加指针速度前馈**：本律只看 x 与 v；叠前馈会把拖动领先放大
     *      （在 bang-bang 版上实测 1.0 → 4.6px）。
     *
     * ⚠️ 边界处理：位置夹住时必须同时把朝外的速度停住，否则会在端点"顶住"抖动。
     */
    var MOTION = {
      K: 20,       // 位置→速度映射增益（1/s）
      A: 120,      // 刹车斜率（pct/s²）：只作速度上限；反向滑行 ≈ v²/(2A)
      k: 40,       // 速度跟踪增益（1/s）
      amax: 240,   // 加速度上限（pct/s²，安全阀）
      vmax: 6,     // 速度上限（pct/s）
      epsX: 0.0015, // 到位判定：位置误差阈值
      epsV: 0.02,   // 到位判定：速度阈值
    };
    /** 「减少动态效果」下拖动仍走引擎（位置永远连续、绝不跳变），但跟得更紧。 */
    var MOTION_REDUCED = {
      K: 120, A: 600, k: 200, amax: 1200, vmax: 20,
      epsX: 0.0015, epsV: 0.02,
    };
    /** 松手落点外推时长（秒）：带着动量滑向它正要去的档位（"快滑跳过中间点"）。
     *  实测：这是指针速度的**连续函数**（v→0 时外推量→0），所以**不需要任何门槛**；
     *  1489 组样本中外推改变落点时 100% 顺着运动方向。速度抖动用 EMA 平滑即可。 */
    /** 松手外推时长（秒）。
     *  ⚠️ 实测诊断结论（两份 trace）：**任何非零外推都可能把落点推到另一档** ——
     *    指针可以停在档位区间内的任何位置（例如 31.3% 属于档位 1），
     *    而 0.04s × 最大指针速度(6/s) = 0.24，远大于"到区间边界的距离"，
     *    于是 releaseIndexFor 落到**档位 0**：滑条滑到 0% 后再跳回本体的 33.3% = 抽搐。
     *    预览页手感好，正是因为它的 vPtr 基本为 0（= 不外推）。
     *    故置 0（灵敏度关闭）；要重新启用惯性，必须先解决"外推不得跨档"。 */
    var RELEASE_PROJECT_S = 0;
    /** 指针速度 EMA 系数：防抖（松手瞬间鼠标微抖会让 vPtr 跳变）。非门槛。 */
    var POINTER_SPEED_EMA = 0.4;
    /**
     * 指针速度的"保鲜期"（秒）：超过这段时间没有新的 pointermove，就认为指针已停。
     * 2 帧 ≈ 33ms —— 足够容忍 60Hz 的 pointermove 间隔，又能及时判定"停住"。
     */
    var POINTER_STALE_S = 2 / 60;
    /** 指针速度陈旧后的衰减时间常数（秒）。30ms 实测：停住后偏移从 13.33% 降到 0.08%。 */
    var POINTER_SPEED_TAU = 0.03;
    /** 单帧 dt 上限（秒）：切标签/卡顿后回来时不要一帧跳一大段。 */
    var MAX_FRAME_DT = 0.05;

    function clampAbs(value, limit) {
      if (value > limit) return limit;
      return value < -limit ? -limit : value;
    }

    /**
     * 运动引擎单步演化（纯函数，原地修改 m，返回 m）。
     * 抽成纯函数是为了让测试能**注入固定 dt 精确断言**（零过冲/精确落点/收敛），
     * 不依赖真实时钟。
     *
     * @param m  { x, v, a, target } —— a 只是"本帧算出的加速度"，便于断言与调试
     * @param dt 秒
     * @param p  参数组（MOTION / MOTION_REDUCED）
     */
    function motionStep(m, dt, p) {
      // 1) 由**位置误差**算出「期望速度」——两个映射取小：
      //    · K·|e|        ：线性"位置→速度"映射，**这是为连续力律设计的**
      //    · √(2·A·|e|)   ：刹车预测上限（"以当前距离最多还能多快"）
      //    · vmax         ：硬上限
      var e = m.target - m.x;
      var vAbs = p.K * Math.abs(e);
      var brake = Math.sqrt(2 * p.A * Math.abs(e));
      if (brake < vAbs) vAbs = brake;
      if (vAbs > p.vmax) vAbs = p.vmax;
      var vDesired = e > 0 ? vAbs : (e < 0 ? -vAbs : 0);
      // 2) 由**速度差**算出加速度（连续跟踪）
      m.a = clampAbs(p.k * (vDesired - m.v), p.amax);
      // 3) 积分
      m.v = clampAbs(m.v + m.a * dt, p.vmax);
      var xRaw = m.x + m.v * dt;
      var xClamped = xRaw < 0 ? 0 : (xRaw > 1 ? 1 : xRaw);
      // 4) 边界：位置夹住时**必须同时停住朝外的速度**，否则会在端点顶住抖动
      if (xClamped !== xRaw && ((xClamped === 0 && m.v < 0) || (xClamped === 1 && m.v > 0))) {
        m.v = 0;
        m.a = 0;
      }
      m.x = xClamped;
      // 5) 收口：到位时对齐目标（消除浮点残差，否则帧循环会为 1e-6 一直转）
      if (motionSettled(m, p)) { m.x = m.target; m.v = 0; m.a = 0; }
      return m;
    }

    /** 是否已到位（位置与速度都足够小）→ 可以停掉帧循环，不空转。 */
    function motionSettled(m, p) {
      return Math.abs(m.target - m.x) < p.epsX && Math.abs(m.v) < p.epsV;
    }

    /**
     * 指针速度的**陈旧衰减**（纯函数）。
     *
     * 为什么还需要它：`vPtr` 只在 `pointermove` 里更新，而**指针停下后不再有事件** ——
     * 它会永久冻结在最后一个速度值上。`vPtr` 现在**不参与运动演化**
     * （本版运动律只看 x 与 v，没有前馈项），但**松手落点外推**仍在用它：
     *
     *     落点 = 松手位置 + vPtr × 0.08s
     *
     * 若 vPtr 陈旧，指针明明已经停住，松手却会按旧速度多推一段（实测残留 vPtr=2
     * 会多推 16% 行程、vPtr=3 多推 24%）—— 4 档模型间距 33%，足以**落错档**。
     *
     * 修法：距上次 pointermove 超过 `staleS` 后按 `tau` 指数衰减到 0。
     *
     * ⚠️ 历史：在更早的"弹簧阻尼 + 前馈"版里，陈旧的 vPtr 危害**大得多** ——
     * 前馈项 `2ζω(vPtr − v)` 会变成一个**恒定的力**，把滑块永久推到鼠标一侧
     * （实测停在右侧 13.33%），而且让到位判定永不成立、帧循环空转烧 CPU
     * （实测 2 万帧仍未收敛）。本版运动律不含前馈项，那一整类问题从机理上消失。
     *
     * @param vPtr    上次算出的指针速度
     * @param sinceS  距上次 pointermove 的秒数
     */
    function decayPointerSpeed(vPtr, sinceS, staleS, tau) {
      if (!(sinceS > staleS)) return vPtr;
      return vPtr * Math.exp(-(sinceS - staleS) / tau);
    }

    /**
     * 松手落点：目标位置 + 指针速度 × 外推时长 → 最近档位。
     * 无门槛 —— 外推量随速度连续趋于 0，慢拖天然不受影响。
     */
    function releaseIndexFor(targetPct, vPtr, count) {
      return indexFromPct(clamp01(targetPct + vPtr * RELEASE_PROJECT_S), count);
    }

    /** rAF 适配：真机走 requestAnimationFrame；测试台/无 rAF 环境降级到 setTimeout。
     *  ⚠️ 降级**必须用裸 setTimeout**：实测测试台的 window 桩里没有 setTimeout
     *  （写 window.setTimeout 会 TypeError）；也不能写裸 requestAnimationFrame
     *  （Node 没有这个全局，直接 ReferenceError 让整包挂掉）。 */
    function scheduleFrame(cb) {
      if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
        return { raf: true, id: window.requestAnimationFrame(cb) };
      }
      return { raf: false, id: setTimeout(function () { cb(nowMs()); }, 16) };
    }
    function cancelFrame(handle) {
      if (!handle) return;
      if (handle.raf) {
        if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
          window.cancelAnimationFrame(handle.id);
        }
      } else {
        clearTimeout(handle.id);
      }
    }
    /** 单调时钟（performance.now 在真机与测试台都可用；退回 Date.now）。 */
    function nowMs() {
      return (typeof performance !== "undefined" && typeof performance.now === "function")
        ? performance.now() : Date.now();
    }

    function errorText(error) {
      if (error === null || error === undefined) return "档位切换失败";
      if (typeof error === "string") return error;
      if (typeof error.message === "string" && error.message.length > 0) return error.message;
      if (typeof error.code === "string" && error.code.length > 0) return error.code;
      return String(error);
    }

    /* ─────────────────── 最高档能量层：参数与强度曲线 ─────────────────── */

    /**
     * 星尘粒子（星星）：**全部由下标算出，不用随机数** —— 每次渲染完全一致、可离线断言。
     *
     * 形态 = 3px 圆点；运动 = 横穿整条轨道（右 → 左），**不消失**、没有上下飘动。
     *
     * 高度与相位**必须用两条互不相关的分配**：
     *   · 相位 = 黄金比低差异序列（任意前缀都铺得开，拖动时逐渐加星也不会挤）；
     *   · 高度 = **随机排列**的等距槽位（哈希排序，确定性），并与相位排名解耦。
     * 早期版本这两者取自同一个数 `frac((i+1)×φ)`，结果"越靠右的星越高"，22 颗排成
     * 一条斜线（用户实测反馈"太规整，再随机一点"；相关系数实测 0.999）。
     * 再挑一个满足最小间隔的盐值：**相位相邻**（会在轨道上一直并排走）的两颗
     * 高度至少差 `MIN_HEIGHT_SLOTS` 槽，避免并成一坨。
     */
    var PARTICLES = (function buildParticles() {
      var count = 22;
      var out = [];
      var i;
      for (i = 0; i < count; i += 1) {
        out.push({ y: 0, phase: (i + 1) * GOLDEN_RATIO % 1 });
      }
      // 相位排名：黄金比序列里排名相邻 = 在轨道上位置相邻
      var byPhase = [];
      for (i = 0; i < count; i += 1) byPhase.push(i);
      byPhase.sort(function (a, b) {
        return out[a].phase - out[b].phase;
      });
      // 高度槽：找一个满足"相位相邻至少差 MIN_HEIGHT_SLOTS 槽"的确定性随机排列
      var slots = null;
      for (var salt = 71; salt < 4000 && slots === null; salt += 1) {
        var candidate = [];
        for (i = 0; i < count; i += 1) candidate.push(i);
        candidate.sort(function (a, b) {
          var ha = starHash01(a, salt);
          var hb = starHash01(b, salt);
          return ha === hb ? a - b : ha - hb;
        });
        var ok = true;
        for (var k = 1; k < count && ok; k += 1) {
          if (Math.abs(candidate[k] - candidate[k - 1]) < MIN_HEIGHT_SLOTS) ok = false;
        }
        if (ok) slots = candidate;
      }
      if (slots === null) {
        // 兜底：步长 5 与 22 互质 → 一定是排列，且相邻槽恒差 5（≥ MIN_HEIGHT_SLOTS）
        slots = [];
        for (i = 0; i < count; i += 1) slots.push(i * 5 % count);
      }
      for (var rank = 0; rank < count; rank += 1) {
        out[byPhase[rank]].y = 8 + (slots[rank] / (count - 1)) * 84;
      }
      return out;
    })();

    /* 颜色常量与 ENERGY_* 都声明在文件上部的「尺寸与速率常量」块里（供 CSS 插值用），
       这里只放纯函数 —— 不要再重复声明，否则会出现"改一处漏一处"的双份真相。 */

    function mixColor(from, to, t) {
      var k = clamp01(t);
      return [
        Math.round(from[0] + (to[0] - from[0]) * k),
        Math.round(from[1] + (to[1] - from[1]) * k),
        Math.round(from[2] + (to[2] - from[2]) * k),
      ];
    }

    function rgbOf(color) {
      return "rgb(" + color[0] + "," + color[1] + "," + color[2] + ")";
    }

    /** 位置 → 填充色（当前点的颜色，也就是渐变右端的颜色）。 */
    function fillColorFor(pct) {
      var t = clamp01(pct);
      if (t <= ENERGY_START) return rgbOf(COLOR_BLUE);
      if (t <= ENERGY_END) return rgbOf(mixColor(COLOR_BLUE, COLOR_VIOLET, (t - ENERGY_START) / (ENERGY_END - ENERGY_START)));
      return rgbOf(mixColor(COLOR_VIOLET, COLOR_DEEP, (t - ENERGY_END) / (1 - ENERGY_END)));
    }

    /**
     * 位置 → 填充层的背景：**左端恒为蓝，右端（旋钮处）是当前位置的颜色**。
     * 于是 high 档自然呈现"左蓝右紫"的渐变，越往右右端越深。
     */
    function fillBackgroundFor(pct) {
      return "linear-gradient(90deg, " + rgbOf(COLOR_BLUE) + ", " + fillColorFor(pct) + ")";
    }

    /**
     * 位置 → **官方那一行数值文字**（"Max"）的颜色。
     *
     * 与能量同源：蓝 → 紫罗兰，越往右越紫（用户要求"Max 的字体颜色能不能改变"）。
     * 刻意**不跟填充末尾的深紫走** —— `COLOR_DEEP` 当文字在深色底上几乎看不见；
     * 文字需要一个亮端，所以终点用 `COLOR_TEXT_VIOLET`。
     *
     * **Off 档返回空串**：不写内联色 = 官方原本的灰（用户要求"off 档两个界面都是灰的"）。
     * 调用方直接 `style.color = valueColorFor(...)`，空串在浏览器里就是"清掉内联色"。
     */
    function valueColorFor(pct, level) {
      if (isOffLevel(level)) return "";
      return rgbOf(mixColor(COLOR_BLUE, COLOR_TEXT_VIOLET, energyFor(pct)));
    }

    /**
     * 是不是"关闭推理"那一档。
     *
     * DeepSeek 的档位表是 id `off` / name `Off`（见 `dsh-llm-deepseek/lib/index.js` 的
     * `REASONING_EFFORTS`），但 id 是 provider 自己的字符串，所以 id 和 name 都认一遍，
     * 并额外接受几个同义写法。认不出就是普通档位（照常着色）。
     */
    function isOffLevel(level) {
      if (!level) return false;
      var candidates = [level.id, level.name];
      for (var i = 0; i < candidates.length; i += 1) {
        if (typeof candidates[i] !== "string") continue;
        var flat = candidates[i].replace(/\s+/g, "").toLowerCase();
        if (flat === "off" || flat === "none" || flat === "关闭" || flat === "无") return true;
      }
      return false;
    }

    /**
     * 位置 → 能量强度 0..1（紫色星云 + 粒子的总强度）。
     * **纯位置驱动，与档位数无关**：第二档以前为 0（保持干净的蓝），之后线性渐入到最高档的 1。
     * 锚点：pct=1/3 → 0；pct=2/3（4 档模型的 high）→ 0.5；pct=1（max）→ 1。
     */
    function energyFor(pct) {
      return clamp01((clamp01(pct) - ENERGY_START) / (1 - ENERGY_START));
    }

    /**
     * 位置 → 粒子速率倍数。
     * 锚点来自实测反馈：**high 档（4 档模型的 2/3 处）= 1×（也就是现在这个速度刚刚好）**，
     * 最高档 = 2×。再往左按同一斜率降速，但设 0.35× 下限，免得左端变成静止。
     */
    function speedFor(pct) {
      return Math.min(2, Math.max(0.35, 3 * clamp01(pct) - 1));
    }

    /** 位置 → 可见粒子数（"粒子效果逐渐出现、变密集"）。 */
    function particleCountFor(pct) {
      return Math.round(energyFor(pct) * PARTICLES.length);
    }

    /* ── 星空：所有出现粒子的档位都用这一套（统一的动画）────────────────────

       运动模型：外层是一条**整轨宽度**的轨道，自己在做 `translate3d(-100%)` 的连续横穿；
       圆点在最右端出生、向左穿出，残影只在两端淡出（而那两端在可视区外）→ **从不消失**。
       每颗的亮度/大小由确定性伪随机给出（越亮越大，0.5~1），速率随**位置**变化（速度变化保留）。 */

    /** 确定性伪随机 [0,1)：不用 Math.random（可离线断言、重渲染不跳变），但看起来是随机的。 */
    function starHash01(index, salt) {
      var value = (index + 1) * salt * 2654435761 % 4294967296;
      return ((value >>> 8) % 1000) / 1000;
    }

    /** 第 index 颗粒子的亮度/大小系数，落在 [STARFIELD_MIN, 1]（越亮越大）。 */
    function starBrightnessFor(index) {
      return STARFIELD_MIN + (1 - STARFIELD_MIN) * starHash01(index, 61);
    }

    /**
     * 第 index 颗粒子横穿整条轨道的时长（s）。
     * **保留速度随位置变化**：以 speedFor 上限（MAX 档）对齐基准时长 ——
     * MAX 档 1.5s、high 档（1×）3s、左端（0.35×）约 8.6s；各星之间只差 ±8%（防追尾成团）。
     */
    function starDurationFor(index, speedFactor) {
      var speed = Math.min(MAX_SPEED_FACTOR, Math.max(0.35, typeof speedFactor === "number" ? speedFactor : MAX_SPEED_FACTOR));
      var spread = 1 - STARFIELD_DURATION_SPREAD + 2 * STARFIELD_DURATION_SPREAD * starHash01(index, 29);
      return STARFIELD_DURATION_MEAN * MAX_SPEED_FACTOR / speed * spread;
    }

    /**
     * 第 index 颗粒子的相位（负延迟，单位 s）。
     *
     * 相位用**黄金比低差异序列**铺开，而且**只跟 index 有关、跟当前显示几颗无关** ——
     * 这一点很关键：如果按 `i / 当前数量` 算，拖动过程中粒子数变化会让每颗已挂载动画的
     * `animation-delay` 被改写，按规范当前进度会按新起始时间重算，整片星空就会抖一下/重排一次。
     * 低差异序列还有个好处：**任意前缀**（前 N 颗）本身就是均匀铺开的。
     */
    function starDelayFor(index, duration) {
      var particle = PARTICLES[index];
      var phase = particle && typeof particle.phase === "number" ? particle.phase : 0;
      var jitter = starHash01(index, 53) * 0.03; // 一点点抖动，避免看起来像整齐的队列
      return -((phase + jitter) % 1) * duration;
    }

    /** 位置 → 可见星星数（"逐渐出现、变密集"）。 */
    function starCountFor(pct) {
      return particleCountFor(pct);
    }

    /**
     * 位置 → **星星层**的不透明度。
     *
     * 星星不能跟着星云一起淡入：星云层的透明度 = 能量强度，high 档只有 0.5，
     * 那么每颗星的实际不透明度会被压到 0.25~0.5，在紫色底上几乎看不见
     * （用户实测反馈："high 档一打开几乎没粒子"）。所以星星层单独给一个下限，
     * 只随能量轻微变化：high 档 0.8、MAX 档 1.0 —— "逐渐出现"交给**粒子数**去表达。
     */
    function starLayerOpacityFor(pct) {
      return 0.6 + 0.4 * energyFor(pct);
    }

    /**
     * 旋钮中心 / 填充终点 / 刻度的水平位置：`半径 + pct × (100% − 直径)`。
     * 这样 pct=0 时圆心正好落在左端圆角内、pct=1 时落在右端圆角内 —— 圆圈永远是完整的圆。
     */
    function knobOffsetOf(pct) {
      var t = Math.round(clamp01(pct) * 10000) / 10000;
      return "calc(" + KNOB_RADIUS + "px + " + t + " * (100% - " + KNOB_RADIUS * 2 + "px))";
    }

    /* ═════════════════ 官方目录访问（每会话一个，永不抛错）═════════════════ */

    /**
     * 每个会话一个访问器。它解决两件真实存在的事：
     *  1. `directoryFor(sessionId)` 在会话作用域/绑定尚未就绪时**按设计抛错**；
     *  2. 目录实例可能被重建（换模型代、连接重置），"抓一次揣着用"会变成永久坏的控件。
     * 所以每次读写都重新解析，解析失败就退避重试；订阅在一次成功解析后建立。
     */
    function createDirectoryAccess(ctx, sessionId, timers) {
      var listeners = new Set();
      var directory = null;
      var unsubscribe = null;
      var last = EMPTY_SNAPSHOT;
      var retryIndex = 0;
      var retryTimer = null;
      var closed = false;
      var lastLoadAt = 0;

      function notify() {
        var current = [];
        listeners.forEach(function (listener) { current.push(listener); });
        for (var i = 0; i < current.length; i += 1) {
          try { current[i](); } catch (error) { /* 单个订阅者抛错不影响其它订阅者 */ }
        }
      }

      function scheduleRetry() {
        if (closed || retryTimer !== null || retryIndex >= RETRY_DELAYS.length) return;
        var delay = RETRY_DELAYS[retryIndex];
        retryIndex += 1;
        retryTimer = timers.set(function () {
          retryTimer = null;
          // 解析成功后要主动通知一次：调用方（uSES）正等着 store 出现。
          if (resolve() !== null) {
            notify();
            return;
          }
          // 还没就绪就继续退避 —— 少了这一句，第一次重试失败后自愈链就永久断掉，
          // 控件会静默失效（这正是要防的那种"一次启动期抖动变成永久坏控件"）。
          scheduleRetry();
        }, delay);
      }

      /** 重新解析一次目录；实例变化时重挂订阅。返回当前目录（可能为 null）。 */
      function resolve() {
        if (closed) return null;
        var fresh = null;
        try {
          fresh = ctx.modelDirectories.directoryFor(sessionId);
        } catch (error) {
          fresh = null;
        }
        if (!fresh || !fresh.store || typeof fresh.store.getSnapshot !== "function") fresh = null;
        if (fresh === directory) return directory;
        if (unsubscribe !== null) {
          try { unsubscribe(); } catch (error) { /* 退订失败不影响新订阅 */ }
          unsubscribe = null;
        }
        directory = fresh;
        if (directory !== null) {
          retryIndex = 0;
          try {
            unsubscribe = typeof directory.store.subscribe === "function" ? directory.store.subscribe(notify) : null;
          } catch (error) {
            unsubscribe = null;
          }
          kickLoad();
        }
        return directory;
      }

      /** 主动拉一次目录（不 load 的话 store 停在 idle，档位列表是空的）。 */
      function kickLoad() {
        if (closed || directory === null || typeof directory.load !== "function") return;
        var now = Date.now();
        if (now - lastLoadAt < 400) return;
        lastLoadAt = now;
        var target = directory;
        try {
          Promise.resolve(target.load()).catch(function () { /* 失败原因由 store 的 error 字段呈现 */ });
        } catch (error) {
          /* load 同步抛：同样交给 store 状态 */
        }
      }

      return {
        getSnapshot: function () {
          if (closed) return EMPTY_SNAPSHOT;
          if (directory === null) {
            resolve();
            if (directory === null) scheduleRetry();
          }
          if (directory !== null) {
            try {
              var value = directory.store.getSnapshot();
              if (value && typeof value === "object") last = value;
            } catch (error) {
              /* 保留上一次快照，绝不把渲染打崩 */
            }
          }
          return last;
        },
        subscribe: function (listener) {
          if (closed) return function () {};
          listeners.add(listener);
          if (directory === null) {
            resolve();
            if (directory === null) scheduleRetry();
          }
          // StrictMode 会订阅/退订各跑一次；退订只清订阅，不永久关闭访问器。
          return function () {
            listeners.delete(listener);
          };
        },
        /** 取当前真正可写的目录（load/select 在调用时重新解析，避免用失效实例）。 */
        directory: function () {
          var fresh = resolve();
          return fresh !== null ? fresh : directory;
        },
        load: kickLoad,
        dispose: function () {
          closed = true;
          listeners.clear();
          if (retryTimer !== null) {
            try { timers.clear(retryTimer); } catch (error) { /* 忽略 */ }
            retryTimer = null;
          }
          if (unsubscribe !== null) {
            try { unsubscribe(); } catch (error) { /* 忽略 */ }
            unsubscribe = null;
          }
          directory = null;
        },
      };
    }

    /* ══════════ 官方菜单那一行的 DOM 桥（只动那一行，fail-open）══════════ */

    function firstSpanText(row) {
      try {
        var spans = row.querySelectorAll("span");
        for (var i = 0; i < spans.length; i += 1) {
          var text = spans[i].textContent;
          if (typeof text === "string" && text.length > 0) return text;
        }
      } catch (error) {
        /* 认不出就算了，调用方会退到结构判定 */
      }
      return "";
    }

    /**
     * 官方那一行右侧的**数值文字**（"Max" / "High"）—— 就是 `.cellValue` 那个 span。
     * 找不到 class 时退到结构：行内最后一个非空文字的 span（数值在标签之后、箭头之前）。
     * 只改它的颜色，文字内容一律不碰。
     */
    function findValueElement(row) {
      if (!row || typeof row.querySelectorAll !== "function") return null;
      try {
        var byClass = row.querySelectorAll("span[class*='cellValue']");
        if (byClass.length > 0) return byClass[byClass.length - 1];
        var spans = row.querySelectorAll("span");
        var found = null;
        for (var i = 0; i < spans.length; i += 1) {
          var text = spans[i].textContent;
          if (typeof text === "string" && text.replace(/\s+/g, "").length > 0) found = spans[i];
        }
        return found;
      } catch (error) {
        return null;
      }
    }

    /**
     * **收起的模型席按钮**（"DeepSeek-V41-Flash  High  ⌄"）里只显示档位名的那一小段文字。
     *
     * 官方渲染它用的是哈希 class（`wq12jW_triggerEffort`，前缀随构建变），靠 class 认迟早会失效，
     * 所以按**文字**认：官方 trigger 里的档位文字就是档位的 `name`，和我们从目录读到的是同一份数据。
     *
     * 传**全部档位名**（而不是只要当前那个）：档位刚切换、官方还没重渲染席按钮时，
     * 文字还是旧档位名 —— 只认当前名字会在那一瞬间"放手"，颜色闪一下。
     * 认不出任何已知档位名就返回 null（fail-open，绝不动别的文字）。
     */
    function findSeatEffort(doc, composer, expectedLabels) {
      if (!doc || !composer || typeof doc.querySelectorAll !== "function") return null;
      var list = typeof expectedLabels === "string" ? [expectedLabels] : expectedLabels;
      if (Object.prototype.toString.call(list) !== "[object Array]") return null;
      var wanted = [];
      for (var n = 0; n < list.length; n += 1) {
        var name = typeof list[n] === "string" ? list[n].replace(/\s+/g, "") : "";
        if (name.length > 0 && wanted.indexOf(name) < 0) wanted.push(name);
      }
      if (wanted.length === 0) return null;
      try {
        var seats = doc.querySelectorAll('button[aria-haspopup="menu"]');
        for (var i = 0; i < seats.length; i += 1) {
          if (!composer.contains(seats[i])) continue;
          var spans = seats[i].querySelectorAll("span");
          for (var j = 0; j < spans.length; j += 1) {
            var text = spans[j].textContent;
            if (typeof text === "string" && wanted.indexOf(text.replace(/\s+/g, "")) >= 0) return spans[j];
          }
        }
      } catch (error) {
        return null;
      }
      return null;
    }

    /**
     * 在自己所属的 composer 里，找到"打开的那颗官方模型席"对应的菜单，再找到推理等级那一行。
     * 全部用官方**语义属性**（aria-haspopup / aria-expanded / aria-controls / role）定位，
     * 不依赖哈希 class —— 官方改样式不会影响这里，改语义才会（那种改动会先在我的测试里炸掉）。
     */
    function findEffortRow(doc, composer) {
      if (!doc || !composer || typeof doc.querySelectorAll !== "function") return null;
      var seats = doc.querySelectorAll('button[aria-haspopup="menu"][aria-expanded="true"]');
      var seat = null;
      for (var i = 0; i < seats.length; i += 1) {
        if (composer.contains(seats[i])) { seat = seats[i]; break; }
      }
      if (seat === null) return null;

      var menuId = typeof seat.getAttribute === "function" ? seat.getAttribute("aria-controls") : null;
      var menu = menuId && typeof doc.getElementById === "function" ? doc.getElementById(menuId) : null;
      if (!menu) return null;

      var items = menu.querySelectorAll('button[role="menuitem"]');
      if (items.length !== 2) return null; // 根面板恰好两行；子面板用的是 menuitemradio
      for (var j = 0; j < items.length; j += 1) {
        var label = firstSpanText(items[j]);
        for (var k = 0; k < EFFORT_ROW_LABELS.length; k += 1) {
          if (label === EFFORT_ROW_LABELS[k]) return items[j];
        }
      }
      // 文案认不出（官方改了措辞/别的语言）就按官方固定顺序：第 2 个 menuitem 是推理等级。
      return items[1];
    }

    /**
     * 监听文档，把滑条容器挂进官方那一行。
     *
     * @param options.doc      宿主 document
     * @param options.win       宿主 window（派发 resize 让官方重测菜单位置）
     * @param options.anchor    () => 本会话在 composer 里的锚点元素（用来判定"哪颗席是我的"）
     * @param options.active    () => boolean，当前是否值得注入（没有档位就不注入，免得白加高）
     * @param options.onChange  (host | null) => void
     */
    function createMenuBridge(options) {
      var doc = options.doc;
      var win = options.win;
      var anchor = options.anchor;
      var active = options.active;
      var onChange = options.onChange;
      if (!doc || typeof doc.createElement !== "function") return null;

      var current = null;
      var seat = null; // 收起态那一行里的档位文字（菜单没打开时也要着色）
      var seatColor = ""; // 组件给的当前颜色：重新抓到元素时立刻补上，不必等下一次渲染
      var disposeMutation = null;
      var disposeTicker = null;
      var disposed = false;
      var seatLabels = options.seatLabels; // () => string[]，全部已知档位名

      /** 本会话的 composer 容器：从锚点往上找官方给 composer 卡片打的标记。 */
      function composerOf() {
        var node = anchor();
        if (!node) return null;
        var el = node;
        while (el && el.nodeType === 1) {
          if (typeof el.getAttribute === "function" && el.getAttribute("data-composer-card") !== null) return el;
          el = el.parentNode;
        }
        return null;
      }

      function detach() {
        if (current === null) return;
        var row = current.row;
        var container = current.container;
        try {
          if (container && container.parentNode) container.parentNode.removeChild(container);
        } catch (error) { /* 行可能已经被官方卸载 */ }
        try {
          var previous = current.previous;
          if (row && row.style) {
            row.style.height = previous.height;
            row.style.flexWrap = previous.flexWrap;
            row.style.paddingTop = previous.paddingTop;
            row.style.paddingBottom = previous.paddingBottom;
            row.style.boxShadow = previous.boxShadow;
          }
          // 数值文字（"Max"）的颜色也是我们改的，退出时一并还原
          if (current.value && current.value.style) current.value.style.color = previous.valueColor;
        } catch (error) { /* 还原失败不影响官方菜单自身 */ }
        current = null;
        onChange(null);
      }

      /** 收起的档位文字：还原本来的颜色并忘掉它。 */
      function releaseSeat() {
        if (seat === null) return;
        try {
          if (seat.el && seat.el.style) seat.el.style.color = seat.previousColor;
        } catch (error) { /* 元素可能已被官方卸载 */ }
        seat = null;
      }

      /**
       * 同步收起态的档位文字。
       * 只在**元素换了**（官方重渲染换了节点）或还没抓到时重新抓 —— 文字变了不换元素，
       * 所以档位切换不会造成"还原→再上色"的闪动。
       */
      function syncSeat() {
        var composer = composerOf();
        if (composer === null || active() !== true) { releaseSeat(); return; }
        if (seat !== null && seat.el && doc.documentElement && doc.documentElement.contains(seat.el)) {
          if (seatColor && seat.el.style) seat.el.style.color = seatColor; // 官方清过内联样式就补回来
          return;
        }
        releaseSeat();
        var wanted = typeof seatLabels === "function" ? seatLabels() : null;
        var el = findSeatEffort(doc, composer, wanted);
        if (el === null || !el.style) return;
        seat = { el: el, previousColor: el.style.color || "" };
        if (seatColor) el.style.color = seatColor;
      }

      function scan() {
        if (disposed) return;
        // 收起态的档位文字：跟菜单那一行互相独立，任一处失败都不该拖垮另一处
        try { syncSeat(); } catch (error) { /* 忽略 */ }
        try {
          var composer = composerOf();
          if (composer === null || active() !== true) { detach(); return; }
          // 已经挂好且那一行还在 → 什么都不做
          if (current !== null && current.row && doc.documentElement && doc.documentElement.contains(current.row)) return;

          var row = findEffortRow(doc, composer);
          if (row === null) { detach(); return; }
          detach();

          var value = findValueElement(row);
          var previous = {
            // 真实 DOM 里未设置的内联属性读作 ""，这里统一成同样的语义，还原时才不会写回
            // 字面量 "undefined"（那在浏览器里是无效值，会把我们的加高留在原地）。
            height: row.style.height || "",
            flexWrap: row.style.flexWrap || "",
            paddingTop: row.style.paddingTop || "",
            paddingBottom: row.style.paddingBottom || "",
            boxShadow: row.style.boxShadow || "",
            // 数值文字原来的内联颜色（通常没设过，读作 ""）
            valueColor: value && value.style ? value.style.color || "" : "",
          };
          // 「加高那一栏的上下距离」+ 允许折行，让滑条落到第二行并铺满整行宽度。
          row.style.height = "auto";
          row.style.flexWrap = "wrap";
          row.style.paddingTop = ROW_PADDING_BLOCK;
          row.style.paddingBottom = ROW_PADDING_BLOCK;

          var container = doc.createElement("div");
          container.className = "ces-inline";
          container.setAttribute("data-ces-part", "host");
          row.appendChild(container);

          current = { row: row, container: container, value: value, previous: previous };
          onChange(current);

          // 官方菜单是"测量后固定定位"的，加高后让它重测一次（官方自己在 resize 里重测并夹取）。
          try {
            win.dispatchEvent(new win.Event("resize"));
          } catch (error) { /* 宿主没有 Event 构造器就算了，官方也会在状态变化时重测 */ }
        } catch (error) {
          try { detach(); } catch (inner) { /* 兜到底 */ }
        }
      }

      function start() {
        scan();
        // M0-S4: 共享调度器接管 body 观察与周期任务。scan 是幂等的，所以
        // 「每 400ms 兜底轮询」并进唯一 ticker 即可；不再自建 MO / setInterval。
        // vendored 代码保持自包含：运行时帮助函数不存在时静默降级（预览/测试环境）。
        if (typeof runtimeOnMutation === "function") {
          disposeMutation = runtimeOnMutation("effort-slider", scan);
        }
        if (typeof runtimeEvery === "function") {
          disposeTicker = runtimeEvery("effort-slider", scan, 400);
        }
      }

      return {
        scan: scan,
        start: start,
        /** 组件把当前该用的颜色给进来；桥负责在（重新）抓到元素时立刻应用。 */
        setSeatColor: function (color) {
          seatColor = typeof color === "string" ? color : "";
          if (seat !== null && seat.el && seat.el.style) {
            try { seat.el.style.color = seatColor; } catch (error) { /* 忽略 */ }
          }
        },
        dispose: function () {
          disposed = true;
          if (disposeMutation !== null) {
            try { disposeMutation(); } catch (error) { /* 忽略 */ }
            disposeMutation = null;
          }
          if (disposeTicker !== null) {
            try { disposeTicker(); } catch (error) { /* 忽略 */ }
            disposeTicker = null;
          }
          releaseSeat();
          detach();
        },
        host: function () { return current; },
      };
    }

    /* ════════════════════════════ 组件 ════════════════════════════ */

    /**
     * 单组件设计：锚点 + 桥 + 滑条（portal 进官方那一行）都在同一个函数里，
     * 所有 hook 都在同一个实例上，展开/收起不会改变 hook 顺序。
     */
    function CodexEffortSlider(props) {
      var sessionId = typeof props.sessionId === "string" && props.sessionId.length > 0 ? props.sessionId : null;
      var locked = props.locked === true;
      var ctx = props.__ctx;

      /* ⚠️⚠️ 本插件的两种动画**完全不受系统「减少动态效果」影响**（用户明确要求）。
         所以：reducedMotion 恒为 false —— 作者原本的"减少动态 → jumpTo"分支全部成为死代码；
         动画强度只由设置里的 motion 决定（quick = 简洁动画 / full = 完整动画）。 */
      /* ⚠️⚠️ 唯一实例守卫 —— 实测这个插件会被**加载两次**（两份模块、两个滑条组件），
         两份引擎的 draft 会渲染进官方同一行、互相打架 → 视觉上"松手乱跳"，
         而且只在**重启**后出现（热重载时只有一份，所以手感正常）。
         只允许第一份活着的实例渲染；其余返回 null。
         ⚠️ Hooks 顺序：判定只做一次且永不改变（__cesDecided），所以每个实例的 Hook 数量恒定。 */
      var __slotWin = (typeof window !== "undefined") ? window : null;
      if (!__cesDecided && __slotWin) {
        __cesDecided = true;
        if (__slotWin.__cesActiveSliderOwner == null) {
          __slotWin.__cesActiveSliderOwner = __cesOwnerToken;
          __cesIsOwner = true;
        }
      } else if (!__slotWin) {
        __cesDecided = true;
        __cesIsOwner = true;
      }
      if (__cesIsOwner) {
        // 只有 owner 会调用这个 effect（非 owner 在下面直接 return null，不调用任何 Hook）
        React.useEffect(function () {
          return function () {
            if (typeof window !== "undefined" && window.__cesActiveSliderOwner === __cesOwnerToken) {
              window.__cesActiveSliderOwner = null;   // 释放，让后来的一份还能接管
            }
          };
        }, []);
      } else {
        return null;
      }

      /** 本组件实例的编号（诊断）。 */
      var __cesInstanceId = (window.__cesInstanceSeq = (window.__cesInstanceSeq || 0) + 1);
      var reducedMotion = false;
      /** 只用于观感（星尘放缓 / 提示文案 / data-motion），取值来自设置。 */
      var effectiveReducedMotion = motionMode() === "quick";

      var settingsTick = React.useState(0);
      React.useEffect(function () {
        installSettingsUi();
        var bump = function () { settingsTick[1](function (n) { return n + 1; }); };
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
          window.addEventListener(settingsEventName(), bump);
        }
        return function () {
          if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
            window.removeEventListener(settingsEventName(), bump);
          }
        };
      }, []);

      /** 拖动安全网用的按键状态（pointerup 只挂在轨道上，轨道外松开时会丢事件）。 */
      var buttonDownRef = React.useRef(false);
      /** 当前渲染下的"已生效档位"百分比（循环闭包要读最新值，不能用闭包变量）。 */
      var effectivePctRef = React.useRef(0);
      /** 吸附完成后为等提交追上而多持有显示的帧数（兜底上限）。 */
      var holdFramesRef = React.useRef(0);
      /** 上一次"已写回宿主"的档位下标：拖动时只在**跨过档位边界**的那一刻写一次。 */
      var lastCommittedIndexRef = React.useRef(-1);
      /** 松手提交重试的代次：每次按下拖动就 +1，旧重试立即作废（绝不能覆盖新操作）。 */
      var releaseGenRef = React.useRef(0);
      /** 最近一次**有效**档位下标：档位列表暂时为空时的显示兜底（绝不用 0）。 */
      var lastValidIndexRef = React.useRef(0);
      React.useEffect(function () {
        if (typeof window === "undefined" || typeof window.addEventListener !== "function") return undefined;
        var stopDrag = function () {
          buttonDownRef.current = false;
          if (draggingRef.current) endDrag();
        };
        window.addEventListener("pointerup", stopDrag, true);
        window.addEventListener("pointercancel", stopDrag, true);
        return function () {
          window.removeEventListener("pointerup", stopDrag, true);
          window.removeEventListener("pointercancel", stopDrag, true);
        };
      }, []);

      var access = React.useMemo(
        function () {
          if (sessionId === null || !ctx) return null;
          return createDirectoryAccess(ctx, sessionId, {
            set: function (fn, delay) { return setTimeout(fn, delay); },
            clear: function (handle) { clearTimeout(handle); },
          });
        },
        [ctx, sessionId],
      );

      React.useEffect(function () {
        return function () {
          if (access !== null) access.dispose();
        };
      }, [access]);

      var subscribe = React.useCallback(
        function (onChange) { return access === null ? function () {} : access.subscribe(onChange); },
        [access],
      );
      var getSnapshot = React.useCallback(
        function () { return access === null ? EMPTY_SNAPSHOT : access.getSnapshot(); },
        [access],
      );
      var state = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

      var levels = levelsOf(state);
      var effectiveId = effectiveEffortId(state);
      var committedIndex = indexOfLevel(levels, effectiveId);
      var levelCount = levels.length;

      var draftState = React.useState(null);
      var draft = draftState[0];
      var setDraft = draftState[1];
      var optimisticState = React.useState(null);
      var optimistic = optimisticState[0];
      var setOptimistic = optimisticState[1];
      var errorState = React.useState(null);
      var errorText_ = errorState[0];
      var setError = errorState[1];
      var busyState = React.useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];
      var hostState = React.useState(null);
      var host = hostState[0];
      var setHost = hostState[1];

      var anchorRef = React.useRef(null);
      var trackRef = React.useRef(null);
      var optimisticIdRef = React.useRef(null);
      /** 拖动的"最新位置"放 ref：React 会把同一 tick 的多次 setState 合并，
       *  松手那一帧若从 state 读位置，可能读到上一次渲染的旧值，从而写错档位。 */
      var draftRef = React.useRef(null);
      var commitRef = React.useRef({ timer: null, inFlight: false, queued: null, safetyTimer: null });
      var draggingRef = React.useRef(false);
      var levelCountRef = React.useRef(0);
      var seatNamesRef = React.useRef([]); // 全部已知档位名（认官方席按钮上的那段文字用）
      var bridgeRef = React.useRef(null);
      levelCountRef.current = levelCount;

      /* 桥：找到官方菜单那一行，把滑条容器挂进去 */
      React.useEffect(function () {
        if (sessionId === null || !ctx) return undefined;
        var bridge = createMenuBridge({
          doc: typeof document === "undefined" ? null : document,
          win: typeof window === "undefined" ? null : window,
          anchor: function () { return anchorRef.current; },
          active: function () { return levelCountRef.current > 0; },
          onChange: function (next) { setHost(next); },
          // 收起态那一行显示的档位名（官方 trigger 里的文字就是它）；给全部名字更抗"官方还没重渲染"
          seatLabels: function () { return seatNamesRef.current; },
        });
        if (bridge === null) return undefined;
        bridgeRef.current = bridge;
        bridge.start();
        return function () {
          bridgeRef.current = null;
          bridge.dispose();
        };
      }, [ctx, sessionId]);

      /**
       * 档位是**后到**的（目录 load 完才有 efforts）。那时 DOM 没有任何变化，
       * MutationObserver 不会响，所以这里在档位数变化时主动重扫一次 ——
       * 少了这一句，"目录晚到"会让滑条永远挂不上去（起步期抖动变永久失效）。
       * （M0-S4 之后 400ms ticker 也会兜底，但这句保证即时挂上，不等下一拍。）
       */
      React.useEffect(function () {
        if (bridgeRef.current !== null) bridgeRef.current.scan();
      }, [levelCount]);

      // 乐观值：提交后先按用户选的那一档显示，直到宿主真实回报（或超时回滚）。
      var optimisticId = optimistic !== null && typeof optimistic.id === "string" ? optimistic.id : null;
      var optimisticIndex = optimisticId === null ? -1 : indexOfLevel(levels, optimisticId);

      // **已生效**的档位（乐观值优先，其次真实值）：收起态那一行显示的是它，不是拖动中的草稿。
      // ⚠️ 兜底**绝不能用 0**：档位列表暂时为空/未就绪时，用"最近一次有效档位"。
      //    用 0 会让显示瞬间跳到最左（实测就是"闪回最左边"那一下）。
      if (committedIndex >= 0) lastValidIndexRef.current = committedIndex;
      var effectiveIndex = committedIndex >= 0 ? committedIndex : lastValidIndexRef.current;
      if (optimisticIndex >= 0) effectiveIndex = optimisticIndex;
      var effectivePct = pctFromIndex(effectiveIndex, levelCount);
      effectivePctRef.current = effectivePct;
      var effectiveLevel = levels[effectiveIndex] || null;
      // 席按钮上可能出现的是**任意一个档位名**（档位刚切换时官方还没重渲染）
      var seatNames = [];
      for (var n = 0; n < levels.length; n += 1) {
        if (levels[n] && typeof levels[n].name === "string" && levels[n].name.length > 0) seatNames.push(levels[n].name);
      }
      seatNamesRef.current = seatNames;

      // 显示用的档位：拖动中跟着草稿，否则就是已生效那一档。
      var shownIndex = draft !== null ? draft.index : effectiveIndex;
      var shownPct = draft !== null && typeof draft.pct === "number" ? draft.pct : effectivePct;
      // 诊断：万一出现"松手抽搐"，用它一眼看出哪一帧、哪个值跳了
      tracePush({ k: "s", inst: __cesInstanceId, t: (typeof performance !== "undefined" ? Math.round(performance.now()) : 0), shown: Math.round(shownPct * 10000) / 10000, eff: Math.round(effectivePct * 10000) / 10000, draft: draft === null ? null : Math.round(draft.pct * 10000) / 10000, mode: motionMode() });
      var shownLevel = levels[shownIndex] || null;

      // 三个由**位置**连续驱动的量：填充色（蓝→紫→深紫）、能量强度（星云+星星渐入）、位置速率。
      var energy = energyFor(shownPct);
      var energyOn = energy > 0;
      var fillBackground = fillBackgroundFor(shownPct);
      var knobOffset = knobOffsetOf(shownPct);

      // 官方那一行在最高档时描一圈紫边，强度跟着能量走（写内联样式，退出时由桥还原）。
      React.useEffect(function () {
        if (host === null || !host.row || !host.row.style) return;
        host.row.style.boxShadow = energyOn
          ? "inset 0 0 0 1px rgba(218,119,86," + (0.16 + 0.34 * energy).toFixed(2) + ")"
          : "";
      }, [host, energyOn, energy]);

      // 官方那一行的**数值文字**（"Max"）也跟着位置变色：蓝 → 亮紫（用户要求）。
      // 同样写内联、退出时由桥还原；**只改颜色，文字内容一个字都不碰**。
      React.useEffect(function () {
        if (host === null || !host.value || !host.value.style) return;
        host.value.style.color = valueColorFor(shownPct, shownLevel);
      }, [host, shownPct, shownLevel]);

      // **收起态**那一行的档位文字（模型席按钮上的 "High"，菜单没打开时就看得见）也跟着变色。
      // 颜色交给桥保管：官方重渲染换了节点时，桥会在重新抓到的那一刻补上，不必等 React。
      // 注意这里用**已生效**的档位（不是拖动中的草稿）—— 收起态显示的是真实档位。
      React.useEffect(function () {
        if (bridgeRef.current === null) return;
        bridgeRef.current.setSeatColor(valueColorFor(effectivePct, effectiveLevel));
      }, [levelCount, effectivePct, effectiveLevel]);

      // 宿主追上乐观值 → 撤掉乐观态（此后以真实目录为准）。
      React.useEffect(function () {
        if (optimisticId !== null && effectiveId === optimisticId) setOptimistic(null);
      }, [effectiveId, optimisticId]);

      // 超时兜底：宿主迟迟不回报就回滚并说明，不继续假装已生效。
      React.useEffect(function () {
        if (optimisticId === null) return undefined;
        var handle = setTimeout(function () {
          if (optimisticIdRef.current === optimisticId) {
            optimisticIdRef.current = null;
            setOptimistic(null);
            setError("档位切换超时，宿主未回报结果（已回滚显示）");
          }
        }, COMMIT_DEADLINE_MS);
        return function () { clearTimeout(handle); };
      }, [optimisticId]);

      // 组件卸载：清掉降频定时器（否则会在卸载后写一次宿主）。
      React.useEffect(function () {
        return function () {
          var pending = commitRef.current;
          if (pending.timer !== null) {
            clearTimeout(pending.timer);
            pending.timer = null;
          }
          pending.queued = null;
        };
      }, []);

      function currentState() {
        return access === null ? EMPTY_SNAPSHOT : access.getSnapshot();
      }

      function flush() {
        var pending = commitRef.current;
        if (pending.timer !== null) {
          clearTimeout(pending.timer);
          pending.timer = null;
        }
        var levelId = pending.queued;
        pending.queued = null;
        if (pending.safetyTimer !== null) { clearTimeout(pending.safetyTimer); pending.safetyTimer = null; }
        tracePush({ k: "flush", id: levelId });
        if (levelId === null || levelId === undefined || access === null) return;

        var snapshot = currentState();
        var current = snapshot && snapshot.current;
        if (!current || typeof current.provider !== "string" || typeof current.model !== "string") {
          setError("模型目录尚未就绪，无法写入档位");
          return;
        }
        // 发送前再判一次：可能宿主已经把这个档位写好了（去重的第二道闸）。
        if (effectiveEffortId(snapshot) === levelId) { tracePush({ k: "flush-skip", id: levelId, why: "dedupe" }); return; }

        var directory = access.directory();
        if (directory === null || typeof directory.select !== "function") {
          setError("模型目录不可用，档位未写入");
          return;
        }

        pending.inFlight = true;
        optimisticIdRef.current = levelId;
        setOptimistic({ id: levelId });
        setError(null);
        setBusy(true);

        var result;
        try {
          // Default 不是真实档位：不带 reasoningEffort，等于交给 provider 决定
          // （官方 select 在 reasoningEffort 缺省时也走同一条路径）。
          var selection = {
            provider: current.provider,
            model: current.model,
          };
          if (levelId !== PROVIDER_DEFAULT_LEVEL_ID) selection.reasoningEffort = levelId;
          result = directory.select(selection);
        } catch (error) {
          result = Promise.reject(error);
        }

        Promise.resolve(result).then(
          function (outcome) {
            pending.inFlight = false;
            tracePush({ k: outcome && outcome.ok === false ? "commit-fail" : "commit-ok" });
            if (outcome && outcome.ok === false) {
              optimisticIdRef.current = null;
              setOptimistic(null);
              setError(errorText(outcome.error));
            }
          },
          function (error) {
            pending.inFlight = false;
            optimisticIdRef.current = null;
            setOptimistic(null);
            setError(errorText(error));
          },
        ).then(function () {
          setBusy(false);
          // 在途合并：拖动期间攒下的最新值在这里补发。
          tracePush({ k: "commit-settle", inFlight: pending.inFlight, queued: pending.queued });
          if (pending.queued !== null) flush();
        });
      }

      /** 请求写回某一档：同档位去重 + 在途合并 + 降频；immediate 用于松手/键盘。 */
      function requestCommit(levelId, immediate) {
        if (levelId === null || levelId === undefined) return;
        var pending = commitRef.current;
        var snapshot = currentState();
        if (effectiveEffortId(snapshot) === levelId && pending.queued === null && !pending.inFlight) return;
        pending.queued = levelId;
        tracePush({ k: "req", id: levelId, imm: immediate === true, inFlight: pending.inFlight, queued: pending.queued });
        if (pending.inFlight) {
          // ⚠️ 不能直接 return：那次在途的收尾可能**已经**跑完了（微任务早于本次同步调用），
          //    排队值就会永远躺在 queued 里没人发 —— 实测 eff 长期不更新就是这么来的。
          //    这里加一个**有界轮询**，直到在途结束并把它发出去。
          if (pending.safetyTimer === null) {
            var armSafety = function () {
              pending.safetyTimer = setTimeout(function () {
                pending.safetyTimer = null;
                if (pending.queued === null) return;
                if (pending.inFlight) { armSafety(); return; }
                tracePush({ k: "safety-flush", id: pending.queued });
                flush();
              }, 50);
            };
            armSafety();
          }
          return;
        }
        if (immediate === true) {
          flush();
          return;
        }
        if (pending.timer !== null) return;
        pending.timer = setTimeout(function () {
          pending.timer = null;
          flush();
        }, COMMIT_THROTTLE_MS);
      }

      /*
       * ── 引擎接线 ──
       * 四个入口（按下 / 拖动 / 松手 / 键盘）**只改 m.target 与 m.vPtr**，
       * 绝不写 m.x / m.v / m.a —— 这是整套模型的命门：
       * 一旦谁重置了运动状态，就退化成"取消旧动画播新动画"，割裂感立刻回来。
       */
      var motionRef = React.useRef(null);
      var frameRef = React.useRef(null);
      var lastTsRef = React.useRef(0);
      var lastPtrPctRef = React.useRef(null);
      /**
       * **上次 pointermove 的时刻**。单独用一个 ref，不能复用 lastTsRef ——
       * 后者是"上一帧的时刻"（帧循环每帧都改它），拿它算指针速度会得到错的 dt；
       * 而衰减判定要的正是"距上次真实指针事件过了多久"。
       */
      var lastPointerAtRef = React.useRef(0);
      /** 松手后"决定的档位"：吸附过程中档位标签要冻结在它上面，不能跟着中间位置跳。 */
      var snapIndexRef = React.useRef(null);

      function motionParams() {
        // 只看设置：「quick」= 简洁动画（紧参数）/「full」= 完整动画（他的松参数）
        return motionParamsForMode();
      }

      /** 懒建引擎：以当前显示位置为起点（**不是**从 0 或从档位点）。 */
      function ensureMotion() {
        if (motionRef.current === null) {
          var x0 = (draftRef.current !== null && typeof draftRef.current.pct === "number")
            ? draftRef.current.pct : shownPct;
          motionRef.current = { x: x0, v: 0, a: 0, target: x0, vPtr: 0 };
        }
        return motionRef.current;
      }

      /** 吸附过程中：档位冻结在决定的那个；拖动中：档位跟着位置走。 */
      function draftIndexFor(m) {
        if (draggingRef.current) return indexFromPct(m.x, levelCount);
        return snapIndexRef.current !== null ? snapIndexRef.current : indexFromPct(m.x, levelCount);
      }

      /**
       * 把引擎当前位置交给引擎之外的一切（四层渲染、能量、刻度都读 draft）。
       *
       * ⚠️ **位置没变就不惊动 React**：拖动期间帧循环现在会常驻（见 startFrames 里
       * 那段"为什么必须继续排下一帧"），如果每帧都无条件 setDraft，就变成
       * "指针按住不动也 60 次/秒重渲染整条滑条"（四层 + 22 个星星节点）——
       * 那是拿一种卡顿换另一种卡顿。所以这里先比一下。
       */
      function publishMotion(m) {
        var next = { pct: m.x, index: draftIndexFor(m) };
        var prev = draftRef.current;
        if (prev !== null && prev.pct === next.pct && prev.index === next.index) return;
        draftRef.current = next;
        setDraft(next);
      }

      /**
       * ⚠️ **引擎必须跟随"已生效档位"的变化**（这是一个真实 bug 的修法）。
       *
       * 场景（用户报的"点一下跳到 max"）：
       *   官方模型菜单是 **pane 状态机**（`root` / `model` / `effort`，见
       *   ui-model-selection 的 ModelSelect.tsx）：点进"推理等级"后 `pane='effort'`，
       *   **root 那一整块被替换掉** —— 我们注入的那一行（含滑条）随之不渲染，
       *   用户在那期间**看不到滑条**，也不可能同时拖动。
       *   选完档位回到 root 时，显示的档位已经变了（`effectivePct` 变了）。
       *
       *   而引擎 `x` 只被"滑条自己的操作"更新 —— 它**不知道**官方改了档位。实测：
       *     1) 滑块拖到 max    → 显示 1.0，引擎 x = 1.0
       *     2) 官方菜单选 low  → 显示 1/3（走 effectivePct），**引擎 x 仍是 1.0**
       *     3) 在滑块里点 max  → target=1.0 而 x 已=1.0 → **一帧内 settled**
       *                          → 显示从 1/3 直接跳成 1.0（瞬移，实测跳变 66.67%）
       *   点"显示位置 low"更明显：引擎从错误的 1.0 起点动画，
       *   会**先瞬移回 max 再往下滑**。
       *
       * 修法：**只有在引擎空闲时**（既不在拖动、也不在吸附 → `draftRef.current === null`）
       * 才把引擎对齐到 `effectivePct`。这样：
       *   · 官方改档（引擎空闲）→ 对齐到新档位 → 不再瞬移
       *   · 用户拖动/吸附中 → `draftRef.current !== null` → **不碰引擎**（用户操作优先）
       *
       * ⚠️ 绝不能把这个对齐放进 `ensureMotion()`：`endDrag()` 里也调用 `ensureMotion()`，
       * 而"快速按下即松手"时 `draftRef.current` 还是 null，那时对齐会把
       * `m.target` 改写成当前档位 → 松手算出的落点变成"原地不动" → **写回丢失**
       * （实测：60 次拖动的写回从 ≥1 次变成 0 次）。对齐必须只在"档位真的变了"时发生。
       */
      React.useEffect(function () {
        var m = motionRef.current;
        if (m === null) return;
        if (draftRef.current !== null) return;   // 拖动/吸附中：用户优先
        m.x = effectivePct;
        m.v = 0;
        m.a = 0;
        m.target = effectivePct;
        m.vPtr = 0;
      }, [effectivePct]);

      /**
       * 启动帧循环（幂等：已在跑就直接返回）。
       * dt 用**真实帧间隔**并夹到 MAX_FRAME_DT，避免切标签回来时一帧跳一大段。
       */
      function startFrames() {
        if (frameRef.current !== null) return;
        lastTsRef.current = nowMs();
        var step = function (ts) {
          frameRef.current = null;   // 诊断：能走到这里通常是卸载/重挂载
          var m = motionRef.current;
          if (m === null) return;
          var p = motionParams();
          var dt = Math.min(MAX_FRAME_DT, Math.max(0.001, (ts - lastTsRef.current) / 1000));
          lastTsRef.current = ts;
          // ⚠️ 每帧先让**陈旧的指针速度**衰减（见 decayPointerSpeed 的注释）：
          // 指针停下后不再有 pointermove，vPtr 若不衰减就会冻结成一个恒定的力，
          // 而且让下面的到位判定永远不成立（循环空转）。
          // 注意这里用**距上次 pointermove 的实际时长**（不是帧间隔 dt）——
          // dt 每帧都被重置成 ~16ms，永远跨不过 33ms 的保鲜期，等于没衰减。
          var sincePointer = (ts - lastPointerAtRef.current) / 1000;
          m.vPtr = decayPointerSpeed(m.vPtr, sincePointer, POINTER_STALE_S, POINTER_SPEED_TAU);
          motionStep(m, dt, p);
          if (motionSettled(m, p)) {
            // 到位：精确落到目标（消除浮点残差）
            m.x = m.target;
            m.v = 0;
            m.a = 0;
            if (draggingRef.current) {
              // ⚠️ 拖动中"到位"只意味着**追上了指针**，不是结束：
              // 手指还在按着，位置必须停在指针处，**不能**清掉 draft
              // （清了就会回落到已生效档位，滑块"自己跳回去"）。
              //
              // ⚠️⚠️ 而且**必须继续排下一帧**，不能在这里 return！
              // 早先在这里 return（想省掉空转），造成"拖动时的瞬间卡顿"：
              //   · 指针移动慢/短暂停顿时，滑块很容易追平 → 循环停
              //   · 下一个 pointermove 再 startFrames() → 那里会重置
              //     `lastTsRef.current = nowMs()`，于是**重启后的第一帧
              //     dt ≈ 0**（被夹到 1ms 下限）→ 那一帧位移为 0
              //   · 实测：指针只挪 0.5% 后循环 7 帧就停；重启第 1 帧位移
              //     0.0000%、第 2 帧才 0.2100% —— 视觉上就是"卡一下再动"
              //   · 快速拖动时滑块一直在追、循环不停，所以**偏偏慢拖才卡**
              // 代价：拖动期间即使指针完全不动也保持 ~0.03ms/帧 的空转，
              //       相对 16.7ms 的帧预算可以忽略。
              publishMotion(m);
              frameRef.current = scheduleFrame(step);
              return;
            }
            // 吸附完成：**只有提交回写真正追上了**，才把控制权交回 effectivePct。
            // ⚠️ 无条件交还时，提交还在路上 → 显示瞬间跳回【旧档位】= 抽搐。
            //    预览页没有这套回写管道，所以它从不跳 —— 这里对齐预览页的效果。
            if (Math.abs(effectivePctRef.current - m.target) > 0.001 && holdFramesRef.current < 45) {
              holdFramesRef.current += 1;   // 仅统计用
              draftRef.current = { pct: m.target, index: snapIndexRef.current };
              publishMotion(m);
              frameRef.current = scheduleFrame(step);
              return;   // 继续持有显示，等提交追上（~0.75s 兜底）
            }
            holdFramesRef.current = 0;
            tracePush({ k: "settle-clear", inst: __cesInstanceId, dragging: draggingRef.current, mX: Math.round(m.x * 10000) / 10000, mTarget: Math.round(m.target * 10000) / 10000 });
            draftRef.current = null;
            snapIndexRef.current = null;
            setDraft(null);
            return; // 停循环，不空转（此时确实没事可做了）
          }
          publishMotion(m);
          frameRef.current = scheduleFrame(step);
        };
        frameRef.current = scheduleFrame(step);
      }

      /** 立即到位（「减少动态效果」下的按下 / 松手 / 键盘：不做补间）。 */
      function jumpTo(targetPct) {
        var m = ensureMotion();
        m.target = targetPct;
        m.x = targetPct;
        m.v = 0;
        m.a = 0;
        m.vPtr = 0;
      }

      function pctAt(clientX) {
        var track = trackRef.current;
        if (!track || typeof track.getBoundingClientRect !== "function") return null;
        var rect = track.getBoundingClientRect();
        // 与视觉几何一致：指针落点映射到"旋钮圆心能到的那一段"，所以拖到最左/最右必定命中端点档位。
        var usable = rect.width - KNOB_RADIUS * 2;
        if (!(usable > 0)) return null;
        return clamp01((clientX - rect.left - KNOB_RADIUS) / usable);
      }

      /** 吞掉事件：滑条在官方的 <button> 里，不能让拖动触发那一行的 onClick（会跳进等级列表）。 */
      function swallow(event) {
        if (event && typeof event.stopPropagation === "function") event.stopPropagation();
      }

      /** 拖动落点：只改 target（**不碰 x/v/a**），并按指针速度更新前馈。 */
      function moveTo(clientX) {
        if (levelCount === 0) return;
        var pct = pctAt(clientX);
        if (pct === null) return;
        var m = ensureMotion();
        // 指针速度（EMA 平滑防抖）：用于前馈 + 松手外推。
        // ⚠️ 时间基准必须用**上次 pointermove 的时刻**（lastPointerAtRef），
        // 不能用 lastTsRef —— 后者是帧循环的帧时刻，两次 pointermove 之间可能夹着
        // 若干帧，拿它算 dt 会把速度算错（实测偏低，导致前馈失效）。
        var now = nowMs();
        var dtPtr = (now - lastPointerAtRef.current) / 1000;
        if (lastPtrPctRef.current !== null && dtPtr > 0.001) {
          var raw = (pct - lastPtrPctRef.current) / dtPtr;
          m.vPtr = m.vPtr * (1 - POINTER_SPEED_EMA) + clampAbs(raw, MOTION.vmax) * POINTER_SPEED_EMA;
        }
        lastPtrPctRef.current = pct;
        lastPointerAtRef.current = now; // ← 记录真实事件时刻（衰减判定也用它）
        m.target = pct; // ← 唯一被改的东西
        // 拖动即切档（用户要求"拖到哪档就变成哪一档"）：**只在跨过档位边界时**写一次。
        // 相比原来的"每 120ms 一次"，这里一次拖动通常只写 1~4 次 —— 官方那一行的档位文字随手走，
        // 又不会让「已生效档位」在拖动中反复变化（那正是之前抽搐的来源）。
        if (levelCount > 0) {
          var nowIndex = indexFromPct(pct, levelCount);
          if (nowIndex !== lastCommittedIndexRef.current) {
            lastCommittedIndexRef.current = nowIndex;
            requestCommit(levels[nowIndex].id, false);
          }
        }
        // ⚠️⚠️ 拖动期间**不写回宿主** —— 逐帧诊断得出的结论，也是唯一能根治"松手抽搐"的做法：
        //   · 拖动期写回会让「已生效档位」在拖动过程中不停变化，而引擎位置是**连续滞后**的，
        //     两者必然不同步；松手把显示交还给 effectivePct 时就会看到一次跳变（实测 10.6% / 66%）。
        //   · 参考实现（Bai-2008 的 1.3.10）把"连续拖动期间写回宿主"降到 **0 次**，原因相同。
        //   · 视觉不依赖写回：拖动中显示的是 draft（引擎位置），"会落到哪一档"由本地纯函数算。
        //   · 写回只发生在真正确定意图的时刻：**松手（endDrag）**、键盘、点击档位。
        // （原实现是 `requestCommit(levels[indexFromPct(pct, levelCount)].id, false)`，
        //   即"每秒约 8 次打宿主"——正是上述不同步的来源。要恢复旧行为把那行加回来即可。）
        if (reducedMotion) {
          // 减少动态：直接到位（仍不发散跳变，因为位置就是目标）
          jumpTo(pct);
          draftRef.current = { pct: pct, index: indexFromPct(pct, levelCount) };
          setDraft(draftRef.current);
          return;
        }
        startFrames();
      }

      function endDrag() {
        tracePush({ k: "endDrag-enter", inst: __cesInstanceId, dragging: draggingRef.current, buttonDown: buttonDownRef.current });
        if (!draggingRef.current) return;
        draggingRef.current = false;
        var m = ensureMotion();
        // ⚠️ 档位列表可能在**拖动过程中变空**（模型切换/快照刷新）。此时绝不能继续走落点计算：
        //    indexFromPct(pct, 0) 返回 0 → 滑条被动画到 0% → 本体还在原档位 → 交还时跳一大截。
        //    正确做法：保持引擎目标不动（停在指针离开的位置），不做落点、不写回。
        if (!(levelCount > 0)) {
          tracePush({ k: "release-abort", why: "levelCount=0", mTarget: Math.round(m.target * 10000) / 10000 });
          return;
        }
        tracePush({ k: "pre-release", mTarget: Math.round(m.target * 10000) / 10000, mX: Math.round(m.x * 10000) / 10000, vPtr: Math.round(m.vPtr * 1000) / 1000, levelCount: levelCount, projS: (typeof RELEASE_PROJECT_S === "undefined" ? "undef" : RELEASE_PROJECT_S), idxNow: indexFromPct(m.target, levelCount) });
        // 落点决策**与动画无关**：一律按指针速度外推。
        // （曾经让 reduced 分支跳过外推 —— 那是错的：无障碍设置只该改"怎么动"，
        //   不该改"落在哪一档"，否则同一个拖动在两种设置下结果不同。）
        var idx = releaseIndexFor(m.target, m.vPtr, levelCount);
        m.vPtr = 0;
        if (reducedMotion) {
          jumpTo(pctFromIndex(idx, levelCount));
        } else {
          // 松手：目标改为档位点，但运动状态（速度）**继承**下来 ——
          // 这样从拖到吸也是连续的，不会重播一段吸附动画。
          m.target = pctFromIndex(idx, levelCount);
        }
        snapIndexRef.current = idx;
        // 写回与视觉无关（档位已由指针决定），所以**松手瞬间就发**。
        if (idx >= 0 && idx < levelCount) requestCommit(levels[idx].id, true);
        tracePush({ k: "release", idx: idx, x: Math.round(m.x * 10000) / 10000, target: Math.round(m.target * 10000) / 10000, eff: Math.round(effectivePctRef.current * 10000) / 10000, showIdx: snapIndexRef.current });
        if (reducedMotion) {
          draftRef.current = null;
          snapIndexRef.current = null;
          setDraft(null);
          return;
        }
        publishMotion(m);
        startFrames();
      }

      function onTrackPointerDown(event) {
        if (locked || levelCount === 0) return;
        swallow(event);
        draggingRef.current = true;
        buttonDownRef.current = true;
        // 起手时对齐"已写回档位"，避免刚按下就写一次无意义的档位
        lastCommittedIndexRef.current = -1;
        holdFramesRef.current = 0;
        releaseGenRef.current += 1;   // 新操作开始：上一次松手的提交重试立即作废
        snapIndexRef.current = null;
        try {
          if (event.currentTarget && typeof event.currentTarget.setPointerCapture === "function" && event.pointerId !== undefined) {
            event.currentTarget.setPointerCapture(event.pointerId);
          }
        } catch (error) { /* 指针捕获失败不影响拖动 */ }
        // 按下 = **召唤**：目标改成指针位置，但 x/v/a 全部保留（不是"抓住滑块"，没有抓取偏移）。
        lastPtrPctRef.current = null;
        moveTo(event.clientX);
      }

      function onTrackPointerMove(event) {
        if (!draggingRef.current) return;
        // 没按着键 ⇒ 不是拖动（松手瞬间的合并事件 / pointerup 丢失的残留状态）。
        // 只忽略、不结束：在这里 endDrag() 会导致"先往左再回正"那种抽搐。
        if (event && event.buttons === 0 && buttonDownRef.current !== true) return;
        swallow(event);
        moveTo(event.clientX);
      }

      function onKeyDown(event) {
        if (locked || levelCount === 0) return;
        var key = event.key;
        var index = draftRef.current !== null ? draftRef.current.index : shownIndex;
        var next = null;
        if (key === "ArrowLeft" || key === "ArrowDown") next = Math.max(0, index - 1);
        else if (key === "ArrowRight" || key === "ArrowUp") next = Math.min(levelCount - 1, index + 1);
        else if (key === "Home") next = 0;
        else if (key === "End") next = levelCount - 1;
        else return; // Escape / Enter / Tab 交给官方菜单自己处理
        swallow(event);
        if (typeof event.preventDefault === "function") event.preventDefault();
        // 键盘改档：同样**只改目标**，运动状态延续（不瞬移）。
        var m = ensureMotion();
        var targetPct = pctFromIndex(next, levelCount);
        if (reducedMotion) {
          jumpTo(targetPct);
          snapIndexRef.current = null;
          draftRef.current = null;
          setDraft(null);
        } else {
          snapIndexRef.current = next;
          m.target = targetPct;
          m.vPtr = 0;
          publishMotion(m);
          startFrames();
        }
        requestCommit(levels[next].id, true);
      }

      // 卸载时必须停掉帧循环，否则组件销毁后还会 setDraft 到已卸载的组件
      // （官方菜单反复开关时就会发生）。
      React.useEffect(function () {
        return function () {
          cancelFrame(frameRef.current);
          frameRef.current = null;
        };
      }, []);

      var trackTitle = "推理等级" + (shownLevel !== null ? "：" + shownLevel.name : "");
      if (effectiveReducedMotion) trackTitle += "（简洁动画：粒子已放缓）";

      var tickNodes = [];
      for (var t = 0; t < levelCount; t += 1) {
        tickNodes.push(React.createElement("span", {
          key: "tick-" + levels[t].id,
          className: "ces-tick",
          "data-ces-part": "tick",
          "data-on": t <= shownIndex ? "1" : "0",
          style: { left: knobOffsetOf(pctFromIndex(t, levelCount)) },
        }));
      }

      // 星空：所有出现粒子的档位都用这一套动画（统一的横穿 + 不消失 + 亮度即大小）。
      // 速率随**位置**变化（速度变化保留）：MAX 档 1.5s 横穿，high 档 3s，左端约 8.6s。
      var positionSpeed = speedFor(shownPct);
      var starCount = starCountFor(shownPct);
      var starLayerOpacity = starLayerOpacityFor(shownPct);
      var particleNodes = [];
      for (var s = 0; s < starCount; s += 1) {
        var starBrightness = starBrightnessFor(s);
        // 「减少动态效果」的放缓在 JS 里算（时长是内联的，不走媒体查询覆盖）
        var starDuration = starDurationFor(s, positionSpeed) * (effectiveReducedMotion ? REDUCED_MOTION_SLOWDOWN : 1);
        particleNodes.push(React.createElement(
          "span",
          {
            key: "star-" + s,
            className: "ces-star",
            "data-ces-part": "star",
            style: {
              top: PARTICLES[s].y + "%",
              // ⚠️ 时长与**负相位**必须直接内联：写成 CSS 变量时真宿主里相位不生效，
              //    会出现"一打开星星全挤在起点"（见样式表里的注释）。
              animationDuration: starDuration.toFixed(3) + "s",
              animationDelay: starDelayFor(s, starDuration).toFixed(3) + "s",
            },
          },
          React.createElement("span", {
            className: "ces-star__dot",
            "data-ces-part": "particle",
            // 亮度即大小系数：越亮越大（同时也是不透明度）
            "data-brightness": starBrightness.toFixed(3),
            style: { "--ces-b": starBrightness.toFixed(3) },
          }),
        ));
      }

      var ui = null;
      if (host !== null && host.container && levelCount > 0) {
        ui = ReactDOM.createPortal(
          React.createElement(
            "div",
            {
              className: "ces-inline",
              "data-ces-part": "root",
              "data-energy": energyOn ? "1" : "0",
              "data-motion": effectiveReducedMotion ? "concise" : "full",
              "data-reached-ticks": readSettings().reachedTicks,
              "data-busy": busy ? "1" : "0",
              style: { "--ces-energy": String(energy) },
            },
            React.createElement(
              "div",
              {
                ref: trackRef,
                className: "ces-track",
                "data-ces-part": "track",
                role: "slider",
                tabIndex: locked ? -1 : 0,
                "aria-label": "推理等级",
                "aria-valuemin": 0,
                "aria-valuemax": Math.max(0, levelCount - 1),
                "aria-valuenow": shownIndex,
                "aria-valuetext": shownLevel !== null ? shownLevel.name : "",
                "aria-disabled": locked ? "true" : undefined,
                title: trackTitle,
                onPointerDown: onTrackPointerDown,
                onPointerMove: onTrackPointerMove,
                onPointerUp: endDrag,
                onPointerCancel: endDrag,
                onKeyDown: onKeyDown,
                onClick: swallow,
              },
              React.createElement("div", {
                className: "ces-fill",
                "data-ces-part": "fill",
                // 填充宽度 = 到旋钮圆心为止（不是整条轨道）；背景是"左蓝 → 当前位置颜色"的渐变。
                style: { width: knobOffset, background: fillBackground },
              }),
              // 能力层（星云 + 扫光）：透明度 = 能量强度，负责"通电"的渐入。
              React.createElement(
                "div",
                { className: "ces-energy", "data-ces-part": "energy", style: { width: knobOffset } },
                React.createElement("div", { className: "ces-energy__sweep", "data-ces-part": "sweep" }),
              ),
              // 星星单独一层：不跟星云淡入（否则 high 档星星被星云的 0.5 透明度压得看不见）。
              React.createElement(
                "div",
                {
                  className: "ces-stars",
                  "data-ces-part": "stars",
                  style: { width: knobOffset, opacity: starLayerOpacity.toFixed(3) },
                },
                particleNodes,
              ),
              tickNodes,
              React.createElement("div", {
                className: "ces-knob",
                "data-ces-part": "knob",
                style: { left: knobOffset },
              }),
            ),
            errorText_ !== null
              ? React.createElement("div", { className: "ces-error", "data-ces-part": "error", role: "status" }, errorText_)
              : null,
          ),
          host.container,
        );
      }

      // 锚点：不可见、不占位，只用来(1)拿住插槽给的 sessionId 上下文 (2)反查自己的 composer。
      return React.createElement("span", {
        ref: anchorRef,
        hidden: true,
        "data-ces-part": "anchor",
        "aria-hidden": "true",
      }, ui);
    }

    /* ════════════════════════════ 插件接线 ════════════════════════════ */

    /**
     * 三个服务都是官方客户端插件已经在用的（slots 不必说；sessions 与 modelDirectories
     * 是 client-ui-model-selection / client-ui-workspace 的既有注入面）。
     * 这里刻意**不**注入 locale / theme：多声明一个可能不存在的服务会让 fiber 停在
     * PENDING，代价远大于省下两行文案。
     *
     * ⚠️ 补充 `remote` / `remote.session`（参考实现的事故 #2）：
     *    接管官方那一席之后，本插件成了 `directoryFor()` 的**唯一调用方** —— Cordis 的服务访问
     *    跟着**调用方 ctx** 走，少声明这两个服务时，目录解析会在"会话作用域/绑定尚未就绪"时长期
     *    失败 → `modelDirectories.directoryFor(sessionId)` 拿不到目录 → **档位列表为空**
     *    （实测 `levelCount = 0`）→ 于是：拖动不开始 / 落点算成第 0 档 / 松手写回被放弃
     *    → 显示交还时跳一大截（用户看到的"松手抽搐 / 乱跳"就是这个）。
     *    诊断证据：`{"k":"release-abort","why":"levelCount=0"}` 出现 4 次。
     */
    var inject = ["slots", "sessions", "modelDirectories", "remote", "remote.session"];

    function apply(ctx) {
      installStyles();
      try {
        ctx.slots.inject(SLOT_NAME, function () {
          return ctx.slots.register(
            {
              name: SLOT_NAME,
              id: ENTRY_ID,
              order: ENTRY_ORDER,
              label: function () { return "Reasoning effort"; },
              // 会话 id 的第二条来路（标准 props 一般已经带了；两条都走 props.sessionId）。
              inject: function (sessionId) { return { sessionId: sessionId }; },
            },
            function SlotComponent(props) {
              return React.createElement(CodexEffortSlider, Object.assign({}, props, { __ctx: ctx }));
            },
          );
        });
      } catch (error) {
        // 注册失败只意味着这块控件不出现，绝不能连累宿主输入区。
        try { console.error("[codex-effort-slider] 插槽注册失败，控件不会出现：", error); } catch (e) { /* 忽略 */ }
      }
    }

    installStyles();

    exports.apply = apply;
    exports.inject = inject;
    // 离线测试用的接缝（纯函数 + 桥 + 组件本身）。运行时无副作用。
    exports.__internals = {
      CSS: CSS,
      SLOT_NAME: SLOT_NAME,
      ENTRY_ID: ENTRY_ID,
      PARTICLES: PARTICLES,
      ROW_PADDING_BLOCK: ROW_PADDING_BLOCK,
      EFFORT_ROW_LABELS: EFFORT_ROW_LABELS,
      CodexEffortSlider: CodexEffortSlider,
      createMenuBridge: createMenuBridge,
      findEffortRow: findEffortRow,
      firstSpanText: firstSpanText,
      levelsOf: levelsOf,
      modelOf: modelOf,
      effectiveEffortId: effectiveEffortId,
      indexOfLevel: indexOfLevel,
      indexFromPct: indexFromPct,
      pctFromIndex: pctFromIndex,
      energyFor: energyFor,
      speedFor: speedFor,
      particleCountFor: particleCountFor,
      starCountFor: starCountFor,
      starLayerOpacityFor: starLayerOpacityFor,
      starBrightnessFor: starBrightnessFor,
      starDurationFor: starDurationFor,
      starDelayFor: starDelayFor,
      starHash01: starHash01,
      STARFIELD_DURATION_MEAN: STARFIELD_DURATION_MEAN,
      STARFIELD_DURATION_SPREAD: STARFIELD_DURATION_SPREAD,
      STARFIELD_MIN: STARFIELD_MIN,
      GOLDEN_RATIO: GOLDEN_RATIO,
      MAX_SPEED_FACTOR: MAX_SPEED_FACTOR,
      REDUCED_MOTION_SLOWDOWN: REDUCED_MOTION_SLOWDOWN,
      readSettings: readSettings,
      writeSettings: writeSettings,
      normalizeSettings: normalizeSettings,
      schemaDefaults: schemaDefaults,
      motionMode: motionMode,
      motionParamsForMode: motionParamsForMode,
      tracePush: tracePush,
      dumpTrace: dumpTrace,
      traceClear: traceClear,
      installSettingsUi: installSettingsUi,
      openSettingsPanel: openSettingsPanel,
      SETTINGS_SCHEMA: SETTINGS_SCHEMA,
      SETTINGS_VERSION: SETTINGS_VERSION,
      SETTINGS_KEY: SETTINGS_KEY,
      SETTINGS_EVENT: SETTINGS_EVENT,
      MIN_HEIGHT_SLOTS: MIN_HEIGHT_SLOTS,
      fillColorFor: fillColorFor,
      fillBackgroundFor: fillBackgroundFor,
      valueColorFor: valueColorFor,
      isOffLevel: isOffLevel,
      findValueElement: findValueElement,
      findSeatEffort: findSeatEffort,
      knobOffsetOf: knobOffsetOf,
      KNOB_RADIUS: KNOB_RADIUS,
      KNOB_SIZE: KNOB_SIZE,
      TRACK_HEIGHT: TRACK_HEIGHT,
      BASE_SPEEDUP: BASE_SPEEDUP,
      ENERGY_START: ENERGY_START,
      ENERGY_END: ENERGY_END,
      clamp01: clamp01,
      installStyles: installStyles,
      // ── 连续运动引擎（导出是为了让测试能注入固定 dt 精确断言）──
      MOTION: MOTION,
      MOTION_REDUCED: MOTION_REDUCED,
      RELEASE_PROJECT_S: RELEASE_PROJECT_S,
      POINTER_SPEED_EMA: POINTER_SPEED_EMA,
      POINTER_STALE_S: POINTER_STALE_S,
      POINTER_SPEED_TAU: POINTER_SPEED_TAU,
      motionStep: motionStep,
      motionSettled: motionSettled,
      decayPointerSpeed: decayPointerSpeed,
      releaseIndexFor: releaseIndexFor,
      clampAbs: clampAbs,
    };

    return module.exports;
    })()

    // ── Desktop pet: DeepSeek pixel whale ───────────────────────────────────
    // A 16×16 pixel whale sits on the composer's top-right corner. The art is
    // baked into a 4-frame PNG sprite sheet with canvas at mount time, so the
    // whole pet is a single 32×32 background layer instead of hundreds of pixel
    // nodes. Frame swaps only repaint that layer; every movement is an integer
    // pixel transform, so the art never blurs. Nothing here touches host state:
    // it only observes the composer and reacts (spec: docs/PET.zh.md).
    const PET_HIDDEN_KEY = 'dsh-theme-pet-hidden'
    const PET_CLASS = 'dsh-pet'
    const PET_SPRITE_CLASS = 'dsh-pet__sprite'
    const PET_HIDE_CLASS = 'dsh-pet__hide'
    const PET_BUBBLE_CLASS = 'dsh-pet__bubble'
    const PET_RESTORE_CLASS = 'dsh-pet-restore'
    const PET_ANCHOR_CARD = 'card'
    const PET_ANCHOR_FIXED = 'fixed'
    const PET_BREATH_MS = 1600
    const PET_BLINK_MS = 120
    const PET_HAPPY_MS = 480
    const PET_DASH_MS = 600
    const PET_COOLDOWN_MS = 600
    const PET_SEND_DEDUPE_MS = 400
    const PET_BUBBLE_MS = 1200
    const PET_SPRITE_PX = 32
    const PET_OFFSET_TOP = 36
    const PET_OFFSET_SIDE = 8

    const PET_PALETTE_LIGHT = {
      K: '#152443',
      L: '#7c93ff',
      B: '#4d6bfe',
      D: '#3a65c2',
      W: '#eaf3ff',
      E: '#1d1b16',
      S: '#ffffff',
      P: '#da7756',
      C: '#9cc1e7',
      A: '#f7ad31',
    }
    const PET_PALETTE_DARK = {
      K: '#0c1326',
      L: '#8aa0ff',
      B: '#5c79ff',
      D: '#3f5bc9',
      W: '#c9d8f2',
      E: '#141210',
      S: '#ffffff',
      P: '#e08a6a',
      C: '#7fb2de',
      A: '#f7ad31',
    }

    // 16×16 character matrices straight from docs/PET.zh.md (one char = 1 px).
    const PET_FRAMES = {
      idle: [
        "................",
        "................",
        "................",
        ".....C......KKK.",
        "....C.C....KKDK.",
        ".....C....KKDDK.",
        "...KKKKKKKKDDDK.",
        ".KKKLLLLKKDDDDK.",
        "KKLLLLLLLLDDDDK.",
        "KBBSBBBBBBBKKKK.",
        "KBBEEBBBBBBKKDK.",
        "BBBBBWWWWBBDDDK.",
        "BBBBWWWWWWDDDDK.",
        "KBBWWWWWKKKKDDK.",
        "KKBBWKKKK..KKDK.",
        ".KKKKK......KKK.",
      ],
      idle_lo: [
        "................",
        "................",
        ".....C......KKK.",
        "....C.C....KKDK.",
        ".....C....KKDDK.",
        "...KKKKKKKKDDDK.",
        ".KKKLLLLKKDDDDK.",
        "KKLLLLLLLLDDDDK.",
        "KBBSBBBBBBBKKKK.",
        "KBBEEBBBBBBKKDK.",
        "BBBBBWWWWBBDDDK.",
        "BBBBWWWWWWDDDDK.",
        "KBBWWWWWKKKKDDK.",
        "KKBBWKKKK..KKDK.",
        ".KKKKK......KKK.",
        "................",
      ],
      blink: [
        "................",
        "................",
        "................",
        ".....C......KKK.",
        "....C.C....KKDK.",
        ".....C....KKDDK.",
        "...KKKKKKKKDDDK.",
        ".KKKLLLLKKDDDDK.",
        "KKLLLLLLLLDDDDK.",
        "KBBBBBBBBBBKKKK.",
        "KBBEEBBBBBBKKDK.",
        "BBBBBWWWWBBDDDK.",
        "BBBBWWWWWWDDDDK.",
        "KBBWWWWWKKKKDDK.",
        "KKBBWKKKK..KKDK.",
        ".KKKKK......KKK.",
      ],
      happy: [
        "................",
        "................",
        "....C.C.........",
        "...C.C.C....KKK.",
        "....C.C....KKDK.",
        ".....C....KKDDK.",
        "...KKKKKKKKDDDK.",
        ".KKKLLLLKKDDDDK.",
        "KKLLLLLLLLDDDDK.",
        "KBBSSBBBBBBKKKK.",
        "KBBEEBBBBBBKKDK.",
        "BPBBBWWWWBBDDDK.",
        "BBBBWWWWWWDDDDK.",
        "KBBWWWWWKKKKDDK.",
        "KKBBWKKKK..KKDK.",
        ".KKKKK......KKK.",
      ],
    }
    const PET_FRAME_ORDER = ['idle', 'idle_lo', 'blink', 'happy']

    const PET_CSS = [
      // Card-relative placement needs the card as containing block; relative on
      // its own never changes the host layout.
      '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]){position:relative!important}',
      '.dsh-pet{position:absolute;top:-36px;right:8px;width:32px;height:32px;box-sizing:border-box;z-index:3;pointer-events:none;isolation:isolate}',
      '.dsh-pet[data-anchor="fixed"]{position:fixed;top:0;left:0;right:auto;z-index:30}',
      '.dsh-pet::before{content:"";position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,rgba(77,107,254,.22),rgba(77,107,254,0) 70%);opacity:0;transition:opacity 120ms linear;pointer-events:none}',
      '.dsh-pet[data-state="hover"]::before{opacity:1}',
      '.dsh-pet__sprite{position:absolute;inset:0;display:block;pointer-events:auto;cursor:pointer;background-image:var(--dsh-pet-sheet);background-repeat:no-repeat;background-size:128px 32px;background-position:0 0;image-rendering:pixelated;transform:translateZ(0);transition:transform 120ms steps(2,jump-none);user-select:none;-webkit-user-drag:none}',
      '.dsh-pet[data-frame="idle_lo"] .dsh-pet__sprite{background-position:-32px 0}',
      '.dsh-pet[data-frame="blink"] .dsh-pet__sprite{background-position:-64px 0}',
      '.dsh-pet[data-frame="happy"] .dsh-pet__sprite{background-position:-96px 0}',
      '.dsh-pet[data-state="hover"] .dsh-pet__sprite{transform:translate3d(0,-2px,0)}',
      '.dsh-pet[data-state="happy"] .dsh-pet__sprite{animation:dsh-pet-bounce 480ms steps(1,end) 1}',
      '@keyframes dsh-pet-bounce{0%{transform:translate3d(0,0,0)}25%{transform:translate3d(0,2px,0)}60%{transform:translate3d(0,-2px,0)}100%{transform:translate3d(0,0,0)}}',
      '.dsh-pet[data-state="dash"] .dsh-pet__sprite{animation:dsh-pet-dive 600ms steps(3,end) 1}',
      '@keyframes dsh-pet-dive{0%{transform:translate3d(0,0,0)}35%{transform:translate3d(0,3px,0)}100%{transform:translate3d(0,0,0)}}',
      '.dsh-pet__hide{position:absolute;top:-6px;right:-6px;width:14px;height:14px;padding:0;border:0;border-radius:50%;background:#ece7dd;color:#7f7869;font:10px/14px "SF Mono",Consolas,monospace;text-align:center;cursor:pointer;opacity:0;transition:opacity 120ms linear;pointer-events:none}',
      '.dsh-pet:hover .dsh-pet__hide,.dsh-pet:focus-within .dsh-pet__hide,.dsh-pet__hide:focus-visible{opacity:1;pointer-events:auto}',
      '.dsh-pet__hide:hover{background:#e3ddd1;color:#1d1b16}',
      '.dsh-pet__hide:focus-visible{outline:2px solid #da7756;outline-offset:1px}',
      '.dsh-pet__bubble{position:absolute;right:0;bottom:36px;padding:2px 6px;border-radius:4px;background:#ece7dd;color:#1d1b16;font:11px/16px "SF Mono",Consolas,monospace;white-space:nowrap;opacity:0;transition:opacity 120ms linear;pointer-events:none}',
      '.dsh-pet[data-bubble="1"] .dsh-pet__bubble{opacity:1}',
      '.dsh-pet-restore{border:0;padding:0 2px;background:transparent;color:#87867f;font:12px/16px "SF Mono",Consolas,monospace;cursor:pointer}',
      '.dsh-pet-restore:hover{color:#1d1b16}',
      '.dsh-pet-restore:focus-visible{outline:2px solid #da7756;outline-offset:1px}',
      '.dsh-pet[data-collision="1"]{transform:translateY(-8px)}',
      '.dsh-pet[data-collision="2"]{display:none}',
      'body[data-ds-dark-theme] .dsh-pet::before{background:radial-gradient(circle,rgba(92,121,255,.28),rgba(92,121,255,0) 70%)}',
      'body[data-ds-dark-theme] .dsh-pet__hide{background:#322f2b;color:#b9b0a2}',
      'body[data-ds-dark-theme] .dsh-pet__bubble{background:#322f2b;color:#f0ede4}',
      '@media (max-width:720px){.dsh-pet{display:none!important}}',
      '@media (prefers-reduced-motion:reduce){.dsh-pet__sprite{transition:none;animation:none!important}.dsh-pet::before{transition:none}.dsh-pet__hide,.dsh-pet__bubble{transition:none}.dsh-pet[data-state="hover"] .dsh-pet__sprite{transform:none}}',
    ].join('\n')

    /** Paint the four matrices into one 64×16 PNG data URL (one sheet per theme). */
    function petSpriteUrl(palette) {
      const canvas = document.createElement('canvas')
      canvas.width = 16 * PET_FRAME_ORDER.length
      canvas.height = 16
      const context = canvas.getContext('2d')
      if (context === null) return null
      for (let index = 0; index < PET_FRAME_ORDER.length; index += 1) {
        const rows = PET_FRAMES[PET_FRAME_ORDER[index]]
        for (let y = 0; y < 16; y += 1) {
          const row = rows[y]
          for (let x = 0; x < 16; x += 1) {
            const color = palette[row[x]]
            if (color === undefined) continue
            context.fillStyle = color
            context.fillRect(index * 16 + x, y, 1, 1)
          }
        }
      }
      try {
        return canvas.toDataURL('image/png')
      } catch {
        return null
      }
    }

    function mountDesktopPet() {
      const reducedMotionQuery = (() => {
        try {
          return window.matchMedia('(prefers-reduced-motion: reduce)')
        } catch {
          return null
        }
      })()
      const reducedMotion = () => reducedMotionQuery !== null && reducedMotionQuery.matches === true
      const pageHidden = () => {
        try {
          return document.visibilityState === 'hidden'
        } catch {
          return false
        }
      }
      const background = () => document.body ?? document.documentElement
      const findCard = () => document.querySelector('[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])')
      const findTray = () => document.querySelector('.dsh-composer-tray')

      let disposed = false
      let styleEl = null
      let shell = null
      let sprite = null
      let hideButton = null
      let bubbleEl = null
      let restoreButton = null
      let anchor = PET_ANCHOR_CARD
      let sheetLight = null
      let sheetDark = null
      let frame = 'idle'
      let breathPhase = 0
      let state = 'idle'
      let cooldown = false
      let hiddenFlag = false
      let disposeBreath = null
      let blinkTimer = 0
      let blinkRestoreTimer = 0
      let reactionTimer = 0
      let bubbleTimer = 0
      let ensureTimer = 0
      let lastSendAt = 0
      let pointerStart = null
      let disposeMountTask = null
      let disposeThemeTask = null
      let resizeObserver = null
      let intersectionObserver = null

      try {
        hiddenFlag = window.localStorage.getItem(PET_HIDDEN_KEY) === '1'
      } catch {
        hiddenFlag = false
      }

      const readHidden = () => hiddenFlag
      const writeHidden = (hidden) => {
        hiddenFlag = hidden === true
        try {
          if (hiddenFlag) window.localStorage.setItem(PET_HIDDEN_KEY, '1')
          else window.localStorage.removeItem(PET_HIDDEN_KEY)
        } catch {
          // Restricted profiles: the toggle still works for this session.
        }
      }

      const ensureStyle = () => {
        if (styleEl !== null && styleEl.isConnected) return
        styleEl = document.createElement('style')
        styleEl.dataset.plugin = 'dsh-claude-code-desktop-theme'
        styleEl.dataset.pluginCss = 'dsh-claude-code-desktop-theme/pet.css'
        styleEl.textContent = PET_CSS
        document.head.appendChild(styleEl)
      }

      const isDarkTheme = () => {
        try {
          return document.body !== null && document.body.hasAttribute('data-ds-dark-theme')
        } catch {
          return false
        }
      }
      const applySheet = () => {
        if (shell === null) return
        if (sheetLight === null) sheetLight = petSpriteUrl(PET_PALETTE_LIGHT)
        if (sheetDark === null) sheetDark = petSpriteUrl(PET_PALETTE_DARK)
        const candidate = isDarkTheme() ? (sheetDark ?? sheetLight) : (sheetLight ?? sheetDark)
        if (typeof candidate === 'string' && candidate !== '') {
          shell.style.setProperty('--dsh-pet-sheet', 'url("' + candidate + '")')
        }
      }

      const setFrame = (next) => {
        frame = next
        if (shell !== null) shell.dataset.frame = next
      }
      const setState = (next) => {
        state = next
        if (shell !== null) shell.dataset.state = next
      }
      const idleFrame = () => (breathPhase === 0 ? 'idle' : 'idle_lo')

      const stopBreath = () => {
        if (disposeBreath !== null) {
          disposeBreath()
          disposeBreath = null
        }
      }
      /**
       * 呼吸帧并入唯一 ticker。原间隔 1600ms 远大于 200ms 基频，观感不变，
       * 因此不需要降帧。ticker 注册后会立刻到期一次，这里用 startedAt 挡掉，
       * 让第一次呼吸翻转仍在 PET_BREATH_MS 之后发生。
       */
      const startBreath = () => {
        stopBreath()
        if (disposed || shell === null || pageHidden() || reducedMotion()) return
        if (state === 'happy' || state === 'dash') return
        const startedAt = performance.now()
        disposeBreath = runtimeEvery('pet-breath', () => {
          if (disposed || pageHidden()) return
          if (state === 'happy' || state === 'dash') return
          if (performance.now() - startedAt < PET_BREATH_MS) return
          breathPhase = breathPhase === 0 ? 1 : 0
          setFrame(idleFrame())
        }, PET_BREATH_MS)
      }
      const stopBlinks = () => {
        if (blinkTimer !== 0) {
          window.clearTimeout(blinkTimer)
          blinkTimer = 0
        }
        if (blinkRestoreTimer !== 0) {
          window.clearTimeout(blinkRestoreTimer)
          blinkRestoreTimer = 0
        }
      }
      const scheduleBlink = () => {
        stopBlinks()
        if (disposed || shell === null || pageHidden() || reducedMotion()) return
        blinkTimer = window.setTimeout(() => {
          blinkTimer = 0
          if (disposed || pageHidden() || state === 'happy' || state === 'dash') {
            scheduleBlink()
            return
          }
          setFrame('blink')
          blinkRestoreTimer = window.setTimeout(() => {
            blinkRestoreTimer = 0
            if (disposed) return
            if (state !== 'happy' && state !== 'dash') setFrame(idleFrame())
            scheduleBlink()
          }, PET_BLINK_MS)
        }, 3500 + Math.floor(Math.random() * 4000))
      }

      const clearBubble = () => {
        if (bubbleTimer !== 0) {
          window.clearTimeout(bubbleTimer)
          bubbleTimer = 0
        }
        if (shell !== null) shell.removeAttribute('data-bubble')
      }
      const showBubble = (text) => {
        if (shell === null) return
        if (bubbleEl !== null) bubbleEl.textContent = text
        shell.dataset.bubble = '1'
        if (bubbleTimer !== 0) window.clearTimeout(bubbleTimer)
        bubbleTimer = window.setTimeout(() => {
          bubbleTimer = 0
          if (shell !== null) shell.removeAttribute('data-bubble')
        }, PET_BUBBLE_MS)
      }

      const stopReaction = () => {
        if (reactionTimer !== 0) {
          window.clearTimeout(reactionTimer)
          reactionTimer = 0
        }
        cooldown = false
      }
      const react = (kind) => {
        if (disposed || shell === null || cooldown || pageHidden()) return
        cooldown = true
        stopBreath()
        stopBlinks()
        const nextState = kind === 'dash' ? 'dash' : 'happy'
        setState(nextState)
        setFrame('happy')
        showBubble(kind === 'dash' ? '噗通' : '咕噜')
        stopReaction()
        cooldown = true
        reactionTimer = window.setTimeout(() => {
          reactionTimer = 0
          cooldown = false
          if (disposed) return
          const stillHovered = shell !== null && typeof shell.matches === 'function' && shell.matches(':hover')
          if (state === 'hover' || stillHovered) setState('hover')
          else setState('idle')
          setFrame(idleFrame())
          if (state === 'hover' || state === 'idle') {
            startBreath()
            scheduleBlink()
          }
        }, kind === 'dash' ? PET_DASH_MS : Math.max(PET_HAPPY_MS, PET_COOLDOWN_MS))
      }

      // pointerover/out bubble to the shell and carry `relatedTarget`, so moving
      // between the sprite and the hide button never flickers the hover state.
      const relatedInsideShell = (event) => {
        const related = event.relatedTarget
        if (related === null || typeof related !== 'object') return false
        return shell !== null && shell.contains(related) === true
      }
      const onPointerOver = (event) => {
        if (relatedInsideShell(event)) return
        if (state === 'idle' && cooldown === false) {
          setState('hover')
          startBreath()
        }
      }
      const onPointerOut = (event) => {
        if (relatedInsideShell(event)) return
        if (state === 'hover') {
          setState('idle')
          startBreath()
        }
      }
      const onSpritePointerDown = (event) => {
        // Keep the composer's focus and caret exactly where the user left them.
        event.preventDefault()
        pointerStart = { x: event.clientX, y: event.clientY, at: Date.now() }
      }
      const onSpritePointerUp = (event) => {
        const start = pointerStart
        pointerStart = null
        if (start === null) return
        if (Date.now() - start.at > 250) return
        if (Math.abs(event.clientX - start.x) > 6) return
        if (Math.abs(event.clientY - start.y) > 6) return
        react('happy')
      }
      const onPointerCancel = () => {
        pointerStart = null
      }
      const onHideClick = (event) => {
        event.preventDefault()
        event.stopPropagation()
        writeHidden(true)
        removeShell()
        ensureRestore()
      }
      const onRestoreClick = (event) => {
        event.preventDefault()
        writeHidden(false)
        removeRestore()
        ensureMounted()
      }

      const buildShell = () => {
        const node = document.createElement('div')
        node.className = PET_CLASS
        node.dataset.anchor = anchor
        node.dataset.state = 'idle'
        node.dataset.frame = 'idle'
        const image = document.createElement('span')
        image.className = PET_SPRITE_CLASS
        image.setAttribute('role', 'img')
        image.setAttribute('aria-label', 'DeepSeek 像素小鲸鱼')
        const hide = document.createElement('button')
        hide.type = 'button'
        hide.className = PET_HIDE_CLASS
        hide.setAttribute('aria-label', '隐藏小鲸鱼')
        hide.title = '隐藏小鲸鱼'
        hide.textContent = '×'
        hide.addEventListener('click', onHideClick)
        const tip = document.createElement('span')
        tip.className = PET_BUBBLE_CLASS
        tip.setAttribute('aria-hidden', 'true')
        node.append(image, hide, tip)
        node.addEventListener('pointerover', onPointerOver)
        node.addEventListener('pointerout', onPointerOut)
        image.addEventListener('pointerdown', onSpritePointerDown)
        image.addEventListener('pointerup', onSpritePointerUp)
        image.addEventListener('pointercancel', onPointerCancel)
        return { node, image, hide, tip }
      }

      const removeShell = () => {
        stopBreath()
        stopBlinks()
        stopReaction()
        clearBubble()
        if (resizeObserver !== null) {
          resizeObserver.disconnect()
          resizeObserver = null
        }
        if (intersectionObserver !== null) {
          intersectionObserver.disconnect()
          intersectionObserver = null
        }
        if (shell !== null) shell.remove()
        shell = null
        sprite = null
        hideButton = null
        bubbleEl = null
        pointerStart = null
        state = 'idle'
        frame = 'idle'
      }

      const ensureRestore = () => {
        if (disposed) return
        if (restoreButton !== null && restoreButton.isConnected) return
        const tray = findTray()
        if (tray === null) return
        const host = tray.querySelector('.dsh-tray-right') ?? tray
        restoreButton = document.createElement('button')
        restoreButton.type = 'button'
        restoreButton.className = PET_RESTORE_CLASS
        restoreButton.setAttribute('aria-label', '显示小鲸鱼')
        restoreButton.title = '显示小鲸鱼'
        restoreButton.textContent = '鲸'
        restoreButton.addEventListener('click', onRestoreClick)
        host.appendChild(restoreButton)
      }
      const removeRestore = () => {
        if (restoreButton === null) return
        restoreButton.remove()
        restoreButton = null
      }

      const overflowVisible = (element) => {
        try {
          const style = window.getComputedStyle(element)
          return style.overflow === 'visible' && style.overflowX === 'visible' && style.overflowY === 'visible'
        } catch {
          return false
        }
      }
      const chooseAnchor = (card) => (overflowVisible(card) ? PET_ANCHOR_CARD : PET_ANCHOR_FIXED)

      const position = () => {
        if (shell === null || anchor !== PET_ANCHOR_FIXED) return
        const card = findCard()
        if (card === null) return
        const rect = card.getBoundingClientRect()
        const left = Math.max(0, Math.round(rect.right - PET_OFFSET_SIDE - PET_SPRITE_PX))
        const top = Math.max(0, Math.round(rect.top - PET_OFFSET_TOP))
        shell.style.left = left + 'px'
        shell.style.top = top + 'px'
      }

      const hitTest = (offsetY) => {
        if (shell === null) return false
        const rect = shell.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return false
        const x = Math.round(rect.left + rect.width / 2)
        const y = Math.round(rect.top + rect.height / 2) - (offsetY ?? 0)
        let target = null
        try {
          target = document.elementFromPoint(x, y)
        } catch {
          return false
        }
        if (target === null) return false
        if (shell.contains(target)) return false
        if (target.closest('.dsh-pet') !== null) return false
        return target.closest('button,[role="button"],textarea,input,select,[contenteditable="true"],[contenteditable=""]') !== null
      }
      const guardCollision = () => {
        if (shell === null) return
        shell.removeAttribute('data-collision')
        position()
        if (hitTest(0) === false) return
        shell.dataset.collision = '1'
        if (hitTest(8)) shell.dataset.collision = '2'
      }

      const observeAnchor = (card) => {
        if (resizeObserver !== null) {
          resizeObserver.disconnect()
          resizeObserver = null
        }
        if (anchor !== PET_ANCHOR_FIXED) return
        try {
          resizeObserver = new ResizeObserver(() => {
            if (disposed) return
            position()
            guardCollision()
          })
          resizeObserver.observe(card)
        } catch {
          resizeObserver = null
        }
      }

      const watchIntersection = () => {
        if (shell === null) return
        if (intersectionObserver !== null) {
          intersectionObserver.disconnect()
          intersectionObserver = null
        }
        try {
          intersectionObserver = new IntersectionObserver((entries) => {
            if (disposed) return
            const entry = entries[entries.length - 1]
            if (entry === undefined) return
            if (entry.isIntersecting) {
              startBreath()
              scheduleBlink()
            } else {
              stopBreath()
              stopBlinks()
            }
          }, { threshold: 0 })
          intersectionObserver.observe(shell)
        } catch {
          intersectionObserver = null
        }
      }

      const isClipped = () => {
        if (shell === null) return false
        const rect = shell.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return false
        let target = null
        try {
          target = document.elementFromPoint(
            Math.round(rect.left + rect.width / 2),
            Math.round(rect.top + rect.height / 2),
          )
        } catch {
          return false
        }
        if (target === null) return false
        return shell.contains(target) === false
      }

      const mountShell = (card, forcedAnchor) => {
        anchor = forcedAnchor ?? chooseAnchor(card)
        const built = buildShell()
        shell = built.node
        sprite = built.image
        hideButton = built.hide
        bubbleEl = built.tip
        applySheet()
        const host = anchor === PET_ANCHOR_CARD ? card : background()
        host.appendChild(shell)
        startBreath()
        scheduleBlink()
        position()
        guardCollision()
        observeAnchor(card)
        watchIntersection()
      }

      const ensureMounted = () => {
        if (disposed) return
        ensureStyle()
        if (readHidden()) {
          removeShell()
          ensureRestore()
          return
        }
        removeRestore()
        const card = findCard()
        if (card === null) {
          removeShell()
          return
        }
        if (shell !== null && shell.isConnected) {
          position()
          return
        }
        if (shell !== null) removeShell()
        mountShell(card)
        // An ancestor of the card can clip the top-right corner even when the
        // card itself is overflow:visible; the sprite would then be invisible.
        // Re-mount once as a viewport-fixed overlay instead of guessing further.
        if (anchor === PET_ANCHOR_CARD && isClipped()) {
          const cardAgain = findCard()
          if (cardAgain !== null) {
            removeShell()
            mountShell(cardAgain, PET_ANCHOR_FIXED)
          }
        }
      }

      const scheduleEnsure = () => {
        if (disposed || ensureTimer !== 0) return
        ensureTimer = window.setTimeout(() => {
          ensureTimer = 0
          if (disposed) return
          ensureMounted()
        }, 300)
      }

      const onVisibility = () => {
        if (disposed) return
        if (pageHidden()) {
          stopBreath()
          stopBlinks()
          if (shell !== null) shell.dataset.state = 'paused'
          return
        }
        if (shell !== null && (state === 'idle' || state === 'hover')) {
          shell.dataset.state = state
          startBreath()
          scheduleBlink()
        }
        ensureMounted()
      }
      const onResize = () => {
        if (disposed) return
        position()
        guardCollision()
      }
      const onReducedMotionChange = () => {
        if (disposed) return
        if (reducedMotion()) {
          stopBreath()
          stopBlinks()
          setFrame('idle')
        } else if (state === 'idle' || state === 'hover') {
          startBreath()
          scheduleBlink()
        }
      }

      const triggerSend = () => {
        const now = Date.now()
        if (now - lastSendAt < PET_SEND_DEDUPE_MS) return
        lastSendAt = now
        react('dash')
      }
      const onKeyDown = (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
        if (event.isComposing === true || event.keyCode === 229) return
        const target = event.target
        if (target === null || typeof target !== 'object') return
        const element = target.nodeType === 1 ? target : target.parentElement
        if (element === null || typeof element.closest !== 'function') return
        if (element.closest('[class*="_root"]:has([data-lexical-editor="true"])') === null) return
        triggerSend()
      }
      const onSendPointerUp = (event) => {
        const target = event.target
        if (target === null || typeof target !== 'object') return
        const element = target.nodeType === 1 ? target : target.parentElement
        if (element === null || typeof element.closest !== 'function') return
        if (element.closest('.dsh-pet') !== null) return
        const button = element.closest('button')
        if (button === null || button.closest('[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])') === null) return
        const label = (button.getAttribute('aria-label') ?? '') + ' ' + (button.title ?? '')
        if (/发送|send/i.test(label) === false) return
        triggerSend()
      }

      const debug = () => {
        const snapshot = {
          mounted: shell !== null && shell.isConnected,
          anchor: anchor,
          state: state,
          frame: frame,
          hidden: readHidden(),
          collision: shell === null ? null : (shell.getAttribute('data-collision') ?? 'none'),
          nodes: shell === null ? 0 : 1 + shell.childElementCount,
          spriteReady: sheetLight !== null,
        }
        try {
          console.table(snapshot)
        } catch {
          // Console formatting is a nicety.
        }
        return snapshot
      }
      window.__dshClaudeThemePetDebug = debug

      ensureMounted()
      // M0-S4: both body observers fold into the shared one. `pet-mount` keeps
      // the 300ms debounce in `scheduleEnsure`; `pet-theme` watches the host
      // `data-ds-dark-theme` attribute, which the shared observer filters for.
      disposeMountTask = runtimeOnMutation('pet-mount', scheduleEnsure)
      disposeThemeTask = runtimeOnMutation('pet-theme', () => {
        if (disposed) return
        applySheet()
      })
      document.addEventListener('visibilitychange', onVisibility)
      document.addEventListener('keydown', onKeyDown, { passive: true })
      document.addEventListener('pointerup', onSendPointerUp, true)
      window.addEventListener('resize', onResize)
      try {
        reducedMotionQuery?.addEventListener?.('change', onReducedMotionChange)
      } catch {
        // Older matchMedia: reduced motion is read at mount time only.
      }

      return () => {
        disposed = true
        if (ensureTimer !== 0) {
          window.clearTimeout(ensureTimer)
          ensureTimer = 0
        }
        removeShell()
        removeRestore()
        if (disposeMountTask !== null) {
          disposeMountTask()
          disposeMountTask = null
        }
        if (disposeThemeTask !== null) {
          disposeThemeTask()
          disposeThemeTask = null
        }
        document.removeEventListener('visibilitychange', onVisibility)
        document.removeEventListener('keydown', onKeyDown)
        document.removeEventListener('pointerup', onSendPointerUp, true)
        window.removeEventListener('resize', onResize)
        try {
          reducedMotionQuery?.removeEventListener?.('change', onReducedMotionChange)
        } catch {
          // Ignore.
        }
        if (styleEl !== null) {
          styleEl.remove()
          styleEl = null
        }
        if (window.__dshClaudeThemePetDebug === debug) window.__dshClaudeThemePetDebug = undefined
      }
    }

    // ── Real-time voice input ───────────────────────────────────────────────
    // The official voice bundle records first and transcribes only on Stop. This
    // button records the microphone itself and writes a live transcript into the
    // composer draft through `inputActions.setDraft`.
    //
    // Audio path: microphone → AudioWorklet (ScriptProcessor fallback) → 16 kHz
    // mono float samples. The Host validates each upload as a canonical 16 kHz
    // mono PCM16 WAV (`validateWave` in the speech-to-text package), so capture
    // resamples explicitly instead of trusting `AudioContext({ sampleRate })`.
    // Only audio added since the previous transcript is uploaded, with a short
    // overlap that the text merger removes; Stop runs one full-recording
    // transcription whose result replaces the incremental preview. That keeps
    // encoding/upload linear instead of re-encoding the whole recording per tick.
    //
    // It is only mounted when the speech Remote is available; otherwise the
    // official microphone stays visible and untouched.
    const LIVE_VOICE_CLASS = 'dsh-live-voice'
    const VOICE_SAMPLE_RATE = 16000
    const VOICE_MAX_SECONDS = 60
    const VOICE_CHUNK_SAMPLES = VOICE_SAMPLE_RATE * 1.2
    const VOICE_OVERLAP_SAMPLES = VOICE_SAMPLE_RATE * 0.4
    const VOICE_MIN_CHUNK_SAMPLES = VOICE_SAMPLE_RATE * 0.5
    const VOICE_TICK_MS = 200
    const VOICE_SILENCE_STOP_MS = 5000
    const VOICE_NO_SPEECH_STOP_MS = 6000
    const VOICE_SPEECH_RMS = 0.01
    const VOICE_MAX_FAILURES = 3
    const VOICE_FLUSH_TIMEOUT_MS = 160
    // Microphone constraints, richest first; every entry degrades one processing
    // feature so a picky driver still yields a usable 16 kHz mono stream.
    const VOICE_MIC_ATTEMPTS = [
      { audio: { channelCount: { ideal: 1 }, echoCancellation: { ideal: true }, noiseSuppression: { ideal: true }, autoGainControl: { ideal: true } } },
      { audio: { channelCount: { ideal: 1 }, echoCancellation: { ideal: true }, noiseSuppression: { ideal: true } } },
      { audio: { channelCount: { ideal: 1 }, echoCancellation: { ideal: true } } },
      { audio: { channelCount: { ideal: 1 } } },
      { audio: true },
    ]

    /** True when the OS asks for reduced motion (no continuous animation). */
    const prefersReducedMotion = () => {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
      } catch {
        return false
      }
    }

    /**
     * Best-effort identity of the visible session: the host store first, then the
     * selected sidebar row. Used to release the microphone when the user switches
     * conversations while recording.
     */
    const currentSessionKey = () => {
      try {
        const id = bridge.currentSessionId
        if (typeof id === 'string' && id !== '') return id
      } catch {
        // Bridge not mounted on this page.
      }
      try {
        const row = document.querySelector(
          '[role="treeitem"][data-row-key^="session:"][aria-selected="true"],[role="treeitem"][data-row-key^="session:"][class*="selected"]',
        )
        const key = row === null ? '' : (row.getAttribute('data-row-key') ?? '')
        if (key.startsWith('session:')) return key.slice('session:'.length)
      } catch {
        // Restricted document.
      }
      return ''
    }

    // The worklet runs on the audio thread: resample to 16 kHz with a linear
    // interpolator that carries its phase across render quanta, and post ~64 ms
    // float chunks plus an RMS level. The main thread therefore does no
    // per-sample work during recording.
    const VOICE_WORKLET_SOURCE = [
      'class DshVoiceCaptureProcessor extends AudioWorkletProcessor {',
      '  constructor() {',
      '    super()',
      '    const rate = typeof sampleRate === "number" && sampleRate > 0 ? sampleRate : 48000',
      '    this.ratio = Math.max(0.0001, rate / 16000)',
      '    this.prev2 = 0',
      '    this.prev = 0',
      '    this.pos = 0',
      '    this.pending = new Float32Array(1024)',
      '    this.pendingLength = 0',
      '    this.port.onmessage = (event) => {',
      '      const data = event.data',
      '      if (data === null || typeof data !== "object") return',
      '      if (data.type === "flush") {',
      '        this.flush()',
      '        this.port.postMessage({ type: "flushed" })',
      '      }',
      '    }',
      '  }',
      '  flush() {',
      '    if (this.pendingLength === 0) return',
      '    const out = this.pending.slice(0, this.pendingLength)',
      '    let sum = 0',
      '    for (let i = 0; i < out.length; i += 1) sum += out[i] * out[i]',
      '    this.port.postMessage({ type: "pcm", pcm: out.buffer, rms: Math.sqrt(sum / out.length) }, [out.buffer])',
      '    this.pendingLength = 0',
      '  }',
      '  push(sample) {',
      '    if (this.pendingLength === this.pending.length) this.flush()',
      '    this.pending[this.pendingLength] = sample',
      '    this.pendingLength += 1',
      '  }',
      '  process(inputs) {',
      '    const channels = inputs[0]',
      '    if (channels === undefined || channels.length === 0) return true',
      '    const input = channels[0]',
      '    const length = input.length',
      '    if (length < 2) return true',
      '    const ratio = this.ratio',
      '    let pos = this.pos',
      '    while (pos <= length - 2) {',
      '      const index = Math.floor(pos)',
      '      let value',
      '      if (index === -1) value = this.prev + (input[0] - this.prev) * (pos + 1)',
      '      else if (index < -1) value = this.prev2 + (this.prev - this.prev2) * (pos + 2)',
      '      else value = input[index] + (input[index + 1] - input[index]) * (pos - index)',
      '      this.push(value)',
      '      pos += ratio',
      '    }',
      '    this.prev2 = this.prev',
      '    this.prev = input[length - 1]',
      '    this.pos = pos - length',
      '    return true',
      '  }',
      '}',
      'registerProcessor("dsh-voice-capture", DshVoiceCaptureProcessor)',
    ].join('\n')

    function mountRealtimeVoice(ctx) {
      let speech = null
      try {
        speech = ctx.remote?.speech ?? null
      } catch {
        speech = null
      }
      if (speech === null || typeof speech.transcribe !== 'function') return () => {}

      let catalogPromise = null
      const getCatalog = (refresh = false) => {
        if (refresh || catalogPromise === null) {
          catalogPromise = Promise.resolve()
            .then(() => (typeof speech.catalog === 'function' ? speech.catalog() : null))
            .catch(() => null)
        }
        return catalogPromise
      }

      /** Linear-interpolation resampler for the ScriptProcessor fallback. */
      class VoiceResampler {
        constructor(inputRate, outputRate) {
          this.ratio = inputRate > 0 ? inputRate / outputRate : 1
          this.prev2 = 0
          this.prev = 0
          this.pos = 0
        }

        push(input) {
          const length = input.length
          if (length < 2) return null
          const out = new Float32Array(Math.ceil(length / this.ratio) + 2)
          let count = 0
          let pos = this.pos
          while (pos <= length - 2) {
            const index = Math.floor(pos)
            let value
            if (index === -1) value = this.prev + (input[0] - this.prev) * (pos + 1)
            else if (index < -1) value = this.prev2 + (this.prev - this.prev2) * (pos + 2)
            else value = input[index] + (input[index + 1] - input[index]) * (pos - index)
            out[count] = value
            count += 1
            pos += this.ratio
          }
          this.prev2 = this.prev
          this.prev = input[length - 1]
          this.pos = pos - length
          return count === 0 ? null : out.subarray(0, count)
        }
      }

      /** Canonical 16 kHz mono PCM16 WAV → canonical base64 (Host requirement). */
      const encodeWavBase64 = (samples) => {
        const bytes = new Uint8Array(44 + samples.length * 2)
        const view = new DataView(bytes.buffer)
        const writeText = (offset, text) => {
          for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i)
        }
        writeText(0, 'RIFF')
        view.setUint32(4, bytes.length - 8, true)
        writeText(8, 'WAVE')
        writeText(12, 'fmt ')
        view.setUint32(16, 16, true)
        view.setUint16(20, 1, true)
        view.setUint16(22, 1, true)
        view.setUint32(24, VOICE_SAMPLE_RATE, true)
        view.setUint32(28, VOICE_SAMPLE_RATE * 2, true)
        view.setUint16(32, 2, true)
        view.setUint16(34, 16, true)
        writeText(36, 'data')
        view.setUint32(40, samples.length * 2, true)
        for (let i = 0; i < samples.length; i += 1) {
          const value = Math.max(-1, Math.min(1, samples[i]))
          view.setInt16(44 + i * 2, Math.round(value * (value < 0 ? 0x8000 : 0x7fff)), true)
        }
        let binary = ''
        const block = 0x2000
        for (let offset = 0; offset < bytes.length; offset += block) {
          binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + block))
        }
        return btoa(binary)
      }

      /** Concatenate the [from, to) sample range of a chunk list. */
      const sliceSamples = (chunks, from, to) => {
        const start = Math.max(0, from)
        const end = Math.max(start, to)
        const out = new Float32Array(end - start)
        let cursor = 0
        let offset = 0
        for (const chunk of chunks) {
          const chunkStart = cursor
          const chunkEnd = cursor + chunk.length
          cursor = chunkEnd
          if (chunkEnd <= start) continue
          if (chunkStart >= end) break
          const localStart = Math.max(start, chunkStart) - chunkStart
          const localEnd = Math.min(end, chunkEnd) - chunkStart
          out.set(chunk.subarray(localStart, localEnd), offset)
          offset += localEnd - localStart
        }
        // Never fabricate trailing silence for a range past the captured audio.
        return offset === out.length ? out : out.subarray(0, offset)
      }

      const VOICE_MATCH_PUNCTUATION = /[\s,，。.!！?？;；:：、'"“”‘’()（）\[\]【】{}<>《》〈〉…—–~～`·]/

      /** Strip punctuation/spaces so overlap matching survives ASR drift. */
      const normalizeTranscript = (text) => {
        let output = ''
        const map = []
        for (let i = 0; i < text.length; i += 1) {
          const character = text[i]
          if (VOICE_MATCH_PUNCTUATION.test(character)) continue
          output += character.toLowerCase()
          map.push(i)
        }
        return { text: output, map }
      }

      /**
       * Append only the new tail of an overlapping chunk transcript. Chunks share
       * ~0.4 s of audio, so their texts share a suffix/prefix seam; matching that
       * seam (exactly first, then punctuation-insensitively) removes the words a
       * naive concatenation would duplicate.
       */
      const mergeTranscript = (committed, incoming) => {
        const base = typeof committed === 'string' ? committed : ''
        const next = typeof incoming === 'string' ? incoming.trim() : ''
        if (next === '') return base
        if (base === '') return next
        if (base === next || base.endsWith(next)) return base
        const maxExact = Math.min(base.length, next.length, 48)
        for (let size = maxExact; size >= 2; size -= 1) {
          if (base.slice(base.length - size) === next.slice(0, size)) return base + next.slice(size)
        }
        const baseNormalized = normalizeTranscript(base)
        const nextNormalized = normalizeTranscript(next)
        const maxNormalized = Math.min(baseNormalized.text.length, nextNormalized.text.length, 48)
        for (let size = maxNormalized; size >= 2; size -= 1) {
          if (baseNormalized.text.slice(baseNormalized.text.length - size) === nextNormalized.text.slice(0, size)) {
            const consumed = nextNormalized.map[size - 1] + 1
            return base + next.slice(consumed)
          }
        }
        if (next.startsWith(base)) return next
        const needsSpace = /[A-Za-z0-9]$/.test(base) && /^[A-Za-z0-9]/.test(next)
        return needsSpace ? base + ' ' + next : base + next
      }

      const readComposerText = () => {
        const editor = document.querySelector('[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]) [contenteditable="true"]')
        if (editor === null) return ''
        // Lexical's contenteditable innerText carries trailing/duplicate line
        // breaks; feeding those back makes the composer grow on every recording.
        return (editor.innerText ?? '')
          .replace(/\u200b/g, '')
          .replace(/\r/g, '')
          .replace(/\n+/g, '\n')
          .replace(/^\n+/, '')
          .replace(/\n+$/, '')
      }

      function RealtimeVoiceButton(props) {
        const inputActions = props.inputActions
        const [recording, setRecording] = React.useState(false)
        const [error, setError] = React.useState('')
        const sessionRef = React.useRef(null)
        const stopRef = React.useRef(null)
        const barsRef = React.useRef([null, null, null])
        const ringRef = React.useRef(null)

        const commitDraft = (session, text) => {
          if (inputActions === undefined || typeof inputActions.setDraft !== 'function') return
          if (session !== undefined && session !== null && session.revealedText === text) return
          try {
            inputActions.setDraft(text)
            if (session !== undefined && session !== null) session.revealedText = text
          } catch {
            // The composer may be submitting; skip this tick.
          }
        }

        // Smooth the block-level transcribe results into a typewriter reveal so
        // the draft grows a few characters at a time instead of jumping a whole
        // phrase at once (the speech Remote has no token stream).
        const applyDraft = (text, session, immediate = false) => {
          if (inputActions === undefined || typeof inputActions.setDraft !== 'function') return
          if (session === undefined || session === null) {
            commitDraft(session, text)
            return
          }
          session.targetText = text
          const current = session.revealedText ?? session.base ?? ''
          // Reduced motion: no typewriter reveal, insert the transcript at once.
          if (immediate || prefersReducedMotion() || !text.startsWith(current)) {
            if (session.revealTimer) {
              window.clearInterval(session.revealTimer)
              session.revealTimer = 0
            }
            commitDraft(session, text)
            return
          }
          if (text === current) return
          if (session.revealTimer) return
          session.revealTimer = window.setInterval(() => {
            const revealed = session.revealedText ?? ''
            const target = session.targetText ?? ''
            if (revealed === target) {
              window.clearInterval(session.revealTimer)
              session.revealTimer = 0
              return
            }
            if (!target.startsWith(revealed)) {
              window.clearInterval(session.revealTimer)
              session.revealTimer = 0
              commitDraft(session, target)
              return
            }
            const step = Math.min(2, target.length - revealed.length)
            commitDraft(session, revealed + target.slice(revealed.length, revealed.length + step))
          }, 22)
        }

        const releaseReveal = (session) => {
          if (session !== null && session.revealTimer !== 0) {
            window.clearInterval(session.revealTimer)
            session.revealTimer = 0
          }
        }

        /** Disconnect every capture node and stop the microphone tracks. */
        const disposeCapture = (session) => {
          session.released = true
          const node = session.workletNode
          session.workletNode = null
          if (node !== null) {
            try {
              node.port.onmessage = null
            } catch {
              // Port already closed.
            }
            try {
              node.disconnect()
            } catch {
              // Already disconnected.
            }
          }
          const processor = session.processor
          session.processor = null
          if (processor !== null) {
            try {
              processor.onaudioprocess = null
            } catch {
              // Already released.
            }
            try {
              processor.disconnect()
            } catch {
              // Already disconnected.
            }
          }
          const source = session.source
          session.source = null
          if (source !== null) {
            try {
              source.disconnect()
            } catch {
              // Already disconnected.
            }
          }
          const silentGain = session.silentGain
          session.silentGain = null
          if (silentGain !== null) {
            try {
              silentGain.disconnect()
            } catch {
              // Already disconnected.
            }
          }
          const stream = session.stream
          session.stream = null
          if (stream !== null) {
            for (const track of stream.getTracks()) {
              try {
                track.stop()
              } catch {
                // Track already ended.
              }
            }
          }
        }

        const closeAudioContext = async (session) => {
          const context = session.audioContext
          session.audioContext = null
          if (context === null || context.state === 'closed') return
          try {
            await context.close()
          } catch {
            // Closing a suspended context can reject; nothing left to release.
          }
        }

        /** Ask the worklet to post its partial buffer, bounded by a timeout. */
        const flushWorklet = (session) => {
          const node = session.workletNode
          if (node === null || session.usingWorklet !== true) return Promise.resolve()
          return new Promise((resolve) => {
            let settled = false
            const finish = () => {
              if (settled) return
              settled = true
              if (session.flushResolve === finish) session.flushResolve = null
              resolve()
            }
            session.flushResolve = finish
            try {
              node.port.postMessage({ type: 'flush' })
            } catch {
              finish()
              return
            }
            window.setTimeout(finish, VOICE_FLUSH_TIMEOUT_MS)
          })
        }

        /** Append one resampled 16 kHz block and track speech energy. */
        const onPcm = (session, samples, rms) => {
          // `released` (not `stopping`) is the cutoff: Stop flushes the worklet
          // before releasing, so the final ~64 ms still reaches the final pass.
          if (sessionRef.current !== session || session.released) return
          if (samples.length === 0) return
          session.chunks.push(samples)
          session.total += samples.length
          session.level = rms
          if (rms > VOICE_SPEECH_RMS) {
            session.lastVoiceAt = performance.now()
            session.voiceSinceCursor = true
          }
        }

        /** Map the Host catalog onto the request fields the provider accepts. */
        const resolveSelection = (catalog) => {
          const selection = catalog !== null && typeof catalog === 'object' ? catalog.selection : null
          const providerId = typeof selection?.providerId === 'string' ? selection.providerId : ''
          const providers = Array.isArray(catalog?.providers) ? catalog.providers : []
          const provider = providers.find((item) => item !== null && typeof item === 'object' && item.id === providerId) ?? null
          const languages = Array.isArray(provider?.languages) ? provider.languages : []
          const requested = typeof selection?.language === 'string' ? selection.language : ''
          const language = requested !== '' && (languages.length === 0 || languages.includes(requested)) ? requested : ''
          const catalogSeconds = typeof catalog?.maxDurationSeconds === 'number' && catalog.maxDurationSeconds > 0
            ? catalog.maxDurationSeconds
            : VOICE_MAX_SECONDS
          const maxBytes = typeof catalog?.maxAudioBytes === 'number' && catalog.maxAudioBytes > 44
            ? catalog.maxAudioBytes
            : 4 * 1024 * 1024
          const byteSeconds = Math.floor((maxBytes - 44) / (VOICE_SAMPLE_RATE * 2))
          return {
            providerId,
            language,
            maxSeconds: Math.max(1, Math.min(VOICE_MAX_SECONDS, catalogSeconds, byteSeconds)),
            maxBytes,
          }
        }

        /** One Host transcription; failures are returned instead of thrown. */
        const transcribe = async (session, audioBase64) => {
          try {
            const request = { audioBase64 }
            if (session.selection.providerId !== '') request.providerId = session.selection.providerId
            if (session.selection.language !== '') request.language = session.selection.language
            const result = await speech.transcribe(request)
            const text = typeof result === 'string' ? result : (typeof result?.text === 'string' ? result.text : '')
            return { text: text.trim(), failure: null }
          } catch (reason) {
            return { text: '', failure: reason instanceof Error ? reason : new Error(String(reason)) }
          }
        }

        const applyIncremental = (session, text) => {
          if (text === '') return
          const merged = mergeTranscript(session.committedText, text)
          if (merged === session.committedText) return
          session.committedText = merged
          session.lastText = merged
          applyDraft(session.base + merged, session)
        }

        /**
         * Upload only the audio added since the last accepted chunk, plus the
         * overlap samples needed to rebuild the seam. A chunk that carries no
         * voice-level audio is skipped locally (no request, hallucination-proof).
         */
        const maybeTranscribe = (session) => {
          if (session.busy || session.stopping) return
          if (session.total - session.cursor < VOICE_CHUNK_SAMPLES) return
          const end = session.total
          const start = Math.max(0, session.cursor - VOICE_OVERLAP_SAMPLES)
          if (end - start < VOICE_MIN_CHUNK_SAMPLES) return
          const samples = sliceSamples(session.chunks, start, end)
          if (samples.length < VOICE_MIN_CHUNK_SAMPLES) return
          if (session.voiceSinceCursor !== true) {
            session.cursor = end
            return
          }
          session.voiceSinceCursor = false
          session.busy = true
          const audioBase64 = encodeWavBase64(samples)
          transcribe(session, audioBase64)
            .then((outcome) => {
              if (sessionRef.current !== session) return
              if (outcome.failure !== null) {
                session.failures += 1
                if (session.failures >= VOICE_MAX_FAILURES) {
                  setError(outcome.failure.message.slice(0, 80))
                  void stop('error')
                }
                return
              }
              session.failures = 0
              session.cursor = end
              applyIncremental(session, outcome.text)
            })
            .finally(() => {
              session.busy = false
            })
        }

        const stop = async (reason = 'user') => {
          const session = sessionRef.current
          if (session === null || session.stopping) return
          session.stopping = true
          setRecording(false)
          if (session.tickTimer !== 0) {
            window.clearInterval(session.tickTimer)
            session.tickTimer = 0
          }
          // Free the microphone before the final inference: the device is never
          // held open while the Host transcribes.
          await flushWorklet(session)
          disposeCapture(session)
          for (let attempt = 0; attempt < 30 && session.busy; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 100))
          }
          const applyFinal = reason === 'user' || reason === 'limit' || reason === 'silence' || reason === 'empty' || reason === 'hidden'
          if (applyFinal && session.total > 0) {
            // One full-recording pass: whole context, no chunk seams. This result
            // replaces the incremental preview and is the text that stays.
            const samples = sliceSamples(session.chunks, 0, session.total)
            const maxSamples = Math.max(1, Math.floor((session.maxBytes - 44) / 2))
            const tail = samples.length > maxSamples ? samples.subarray(samples.length - maxSamples) : samples
            const outcome = await transcribe(session, encodeWavBase64(tail))
            if (outcome.failure !== null) {
              setError(outcome.failure.message.slice(0, 80))
              if (session.lastText !== '') applyDraft(session.base + session.lastText, session, true)
              // Transcription failed: give the official microphone back.
              document.documentElement.removeAttribute('data-dsh-realtime-voice')
            } else if (outcome.text !== '') {
              session.committedText = outcome.text
              session.lastText = outcome.text
              applyDraft(session.base + outcome.text, session, true)
            } else if (session.lastText !== '') {
              applyDraft(session.base + session.lastText, session, true)
            }
          }
          // Repeated chunk failures mean the recognition path is broken: stop and
          // hand the official microphone back instead of hiding it forever.
          if (reason === 'error') document.documentElement.removeAttribute('data-dsh-realtime-voice')
          releaseReveal(session)
          await closeAudioContext(session)
          if (sessionRef.current === session) sessionRef.current = null
        }
        stopRef.current = stop

        const acquireMicrophone = async () => {
          const devices = navigator.mediaDevices
          if (devices === undefined || typeof devices.getUserMedia !== 'function') {
            throw new Error('当前环境不支持麦克风')
          }
          let lastError = null
          for (const constraints of VOICE_MIC_ATTEMPTS) {
            try {
              return await devices.getUserMedia(constraints)
            } catch (reason) {
              lastError = reason
              // A denied permission never becomes a granted one by retrying.
              if (reason instanceof DOMException && reason.name === 'NotAllowedError') break
            }
          }
          throw lastError instanceof Error ? lastError : new Error('无法访问麦克风')
        }

        /** AudioWorklet first, ScriptProcessor fallback, both resampled to 16 kHz. */
        const startCapture = async (session) => {
          const Ctor = window.AudioContext ?? window.webkitAudioContext
          if (typeof Ctor !== 'function') throw new Error('当前环境不支持录音')
          let context = null
          try {
            context = new Ctor({ sampleRate: VOICE_SAMPLE_RATE, latencyHint: 'interactive' })
          } catch {
            context = new Ctor({ latencyHint: 'interactive' })
          }
          session.audioContext = context
          if (context.state === 'suspended') {
            try {
              await context.resume()
            } catch {
              // A user gesture normally resumes it; capture still connects.
            }
          }
          const source = context.createMediaStreamSource(session.stream)
          session.source = source
          const silentGain = context.createGain()
          silentGain.gain.value = 0
          session.silentGain = silentGain
          let worklet = null
          if (context.audioWorklet !== undefined && typeof AudioWorkletNode === 'function') {
            try {
              const url = URL.createObjectURL(new Blob([VOICE_WORKLET_SOURCE], { type: 'application/javascript' }))
              try {
                await context.audioWorklet.addModule(url)
              } finally {
                URL.revokeObjectURL(url)
              }
              worklet = new AudioWorkletNode(context, 'dsh-voice-capture', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [1],
                channelCount: 1,
                channelCountMode: 'explicit',
                channelInterpretation: 'speakers',
              })
            } catch (reason) {
              // CSP-blocked blob module, unsupported worklet, or registration
              // failure: keep the already-created context and use the fallback.
              worklet = null
              session.workletError = reason instanceof Error ? reason.message : String(reason)
              console.info('[dsh-live-voice] AudioWorklet unavailable, using ScriptProcessor fallback:', session.workletError)
            }
          }
          if (worklet !== null) {
            session.workletNode = worklet
            session.usingWorklet = true
            worklet.port.onmessage = (event) => {
              const data = event.data
              if (data === null || typeof data !== 'object') return
              if (data.type === 'pcm') {
                onPcm(session, new Float32Array(data.pcm), typeof data.rms === 'number' ? data.rms : 0)
              } else if (data.type === 'flushed' && typeof session.flushResolve === 'function') {
                session.flushResolve()
              }
            }
            source.connect(worklet)
            worklet.connect(silentGain)
            silentGain.connect(context.destination)
            return
          }
          const processor = context.createScriptProcessor(4096, 1, 1)
          session.processor = processor
          session.usingWorklet = false
          session.resampler = new VoiceResampler(context.sampleRate, VOICE_SAMPLE_RATE)
          processor.onaudioprocess = (event) => {
            if (sessionRef.current !== session || session.stopping) return
            const input = event.inputBuffer.getChannelData(0)
            const resampled = session.resampler === null ? input : session.resampler.push(input)
            if (resampled === null || resampled.length === 0) return
            let sum = 0
            for (let i = 0; i < resampled.length; i += 1) sum += resampled[i] * resampled[i]
            onPcm(session, resampled, Math.sqrt(sum / resampled.length))
          }
          source.connect(processor)
          processor.connect(silentGain)
          silentGain.connect(context.destination)
        }

        const start = async () => {
          if (sessionRef.current !== null) return
          setError('')
          const base = readComposerText()
          const session = {
            base,
            chunks: [],
            total: 0,
            level: 0,
            levelSmooth: 0,
            busy: false,
            stopping: false,
            released: false,
            cursor: 0,
            committedText: '',
            lastText: '',
            revealedText: base,
            targetText: base,
            revealTimer: 0,
            failures: 0,
            lastVoiceAt: performance.now(),
            voiceSinceCursor: false,
            maxSeconds: VOICE_MAX_SECONDS,
            maxBytes: 4 * 1024 * 1024,
            selection: { providerId: '', language: '' },
            sessionKey: currentSessionKey(),
            audioContext: null,
            source: null,
            silentGain: null,
            workletNode: null,
            processor: null,
            resampler: null,
            usingWorklet: false,
            flushResolve: null,
            stream: null,
            tickTimer: 0,
          }
          sessionRef.current = session
          try {
            const catalog = await getCatalog(true)
            session.selection = resolveSelection(catalog)
            session.maxSeconds = session.selection.maxSeconds
            session.maxBytes = session.selection.maxBytes
            const stream = await acquireMicrophone()
            if (sessionRef.current !== session || session.stopping) {
              for (const track of stream.getTracks()) {
                try {
                  track.stop()
                } catch {
                  // Track already ended.
                }
              }
              if (sessionRef.current === session) sessionRef.current = null
              return
            }
            session.stream = stream
            await startCapture(session)
            if (sessionRef.current !== session || session.stopping) {
              disposeCapture(session)
              await closeAudioContext(session)
              return
            }
            session.tickTimer = window.setInterval(() => tick(session), VOICE_TICK_MS)
            document.documentElement.setAttribute('data-dsh-realtime-voice', '1')
            setRecording(true)
          } catch (reason) {
            const message = reason instanceof Error ? reason.message : String(reason)
            if (sessionRef.current === session) sessionRef.current = null
            session.stopping = true
            disposeCapture(session)
            await closeAudioContext(session)
            setRecording(false)
            setError(message.slice(0, 80))
            // Permission or capture failure: give the official microphone back.
            document.documentElement.removeAttribute('data-dsh-realtime-voice')
          }
        }

        const tick = (session) => {
          if (sessionRef.current !== session || session.stopping) return
          if (document.visibilityState === 'hidden') {
            void stop('hidden')
            return
          }
          const now = performance.now()
          const elapsed = session.total / VOICE_SAMPLE_RATE
          // If the user edited the draft by hand mid-recording, never overwrite
          // their edit with the next transcript slice.
          const currentText = readComposerText().replace(/\s+$/, '')
          const revealed = (session.revealedText ?? '').replace(/\s+$/, '')
          if (currentText !== '' && revealed !== '' && currentText !== revealed) {
            void stop('edited')
            return
          }
          const sessionKey = currentSessionKey()
          if (session.sessionKey !== '' && sessionKey !== '' && sessionKey !== session.sessionKey) {
            void stop('session')
            return
          }
          // Hard caps: advertised duration/byte limit and our own 60 s ceiling.
          if (elapsed > session.maxSeconds) {
            void stop('limit')
            return
          }
          if (elapsed * 1000 > VOICE_NO_SPEECH_STOP_MS && session.committedText === '' && session.busy === false) {
            void stop('empty')
            return
          }
          if (elapsed > 1.2 && now - session.lastVoiceAt > VOICE_SILENCE_STOP_MS) {
            void stop('silence')
            return
          }
          maybeTranscribe(session)
        }

        React.useEffect(() => {
          let alive = true
          getCatalog().then((catalog) => {
            if (!alive) return
            if (catalog === null) document.documentElement.removeAttribute('data-dsh-realtime-voice')
            else document.documentElement.setAttribute('data-dsh-realtime-voice', '1')
          })
          return () => { alive = false }
        }, [])

        // Hidden window / app switch: release the microphone immediately. The
        // final transcript is still written after the device is freed.
        React.useEffect(() => {
          const stopHidden = () => {
            const session = sessionRef.current
            if (session === null) return
            const stopCurrent = stopRef.current
            if (typeof stopCurrent === 'function') void stopCurrent('hidden')
          }
          const onVisibility = () => {
            if (document.visibilityState === 'hidden') stopHidden()
          }
          document.addEventListener('visibilitychange', onVisibility)
          window.addEventListener('pagehide', stopHidden)
          return () => {
            document.removeEventListener('visibilitychange', onVisibility)
            window.removeEventListener('pagehide', stopHidden)
          }
        }, [])

        // Unmount: no final inference (the composer may belong to another
        // session now); just release every device and timer.
        React.useEffect(() => () => {
          const session = sessionRef.current
          sessionRef.current = null
          if (session !== null) {
            session.stopping = true
            if (session.tickTimer !== 0) window.clearInterval(session.tickTimer)
            releaseReveal(session)
            disposeCapture(session)
            void closeAudioContext(session)
          }
          document.documentElement.removeAttribute('data-dsh-realtime-voice')
        }, [])

        // 60 fps level meter: rAF loop writing only transform/opacity on
        // pre-existing nodes (no layout reads, no React state per frame).
        React.useEffect(() => {
          if (!recording) return undefined
          let raf = 0
          let alive = true
          const reduced = prefersReducedMotion()
          const ring = ringRef.current
          const bars = barsRef.current ?? []
          const paint = () => {
            if (!alive) return
            const session = sessionRef.current
            if (session !== null) {
              session.levelSmooth += (session.level - session.levelSmooth) * 0.24
            }
            const level = session === null ? 0 : Math.max(0, Math.min(1, session.levelSmooth * 14))
            const amp = reduced ? 0.5 : 0.2 + level * 0.8
            const shapes = [0.55, 1, 0.75]
            for (let i = 0; i < bars.length; i += 1) {
              const bar = bars[i]
              if (bar === null || bar === undefined) continue
              const scale = Math.max(0.14, Math.min(1, amp * (shapes[i] ?? 1)))
              bar.style.transform = 'scaleY(' + scale.toFixed(3) + ')'
            }
            if (ring !== null) {
              const phase = reduced ? 0.25 : (performance.now() % 1400) / 1400
              ring.style.opacity = ((1 - phase) * 0.5).toFixed(3)
              ring.style.transform = 'scale(' + (1 + phase * 0.4).toFixed(3) + ')'
            }
            if (!reduced) raf = window.requestAnimationFrame(paint)
          }
          paint()
          return () => {
            alive = false
            if (raf !== 0) window.cancelAnimationFrame(raf)
            for (const bar of bars) {
              if (bar !== null && bar !== undefined) bar.style.removeProperty('transform')
            }
            if (ring !== null) {
              ring.style.removeProperty('opacity')
              ring.style.removeProperty('transform')
            }
          }
        }, [recording])

        const title = recording ? '点击停止并插入' : (error === '' ? '实时语音输入' : '语音输入错误：' + error)
        const barRef = (index) => (node) => {
          if (barsRef.current !== null) barsRef.current[index] = node
        }
        return React.createElement(
          'span',
          { className: 'dsh-live-voice-wrap' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: LIVE_VOICE_CLASS,
              'data-recording': recording ? 'true' : 'false',
              'aria-pressed': recording ? 'true' : 'false',
              title,
              'aria-label': recording ? '停止实时语音输入' : '实时语音输入',
              onClick: () => { if (recording) void stop('user'); else void start() },
            },
            React.createElement('span', { className: 'dsh-live-voice-ring', 'aria-hidden': 'true', ref: ringRef }),
            React.createElement('span', { className: 'dsh-live-voice-icon' },
              React.createElement('svg', { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
                React.createElement('rect', { x: 9, y: 3, width: 6, height: 12, rx: 3, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8 }),
                React.createElement('path', { d: 'M5 11a7 7 0 0 0 14 0M12 18v3', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' }),
              ),
            ),
            React.createElement('span', { className: 'dsh-live-voice-bars', 'aria-hidden': 'true' },
              React.createElement('i', { className: 'dsh-live-voice-bar', ref: barRef(0) }),
              React.createElement('i', { className: 'dsh-live-voice-bar', ref: barRef(1) }),
              React.createElement('i', { className: 'dsh-live-voice-bar', ref: barRef(2) }),
            ),
            recording ? React.createElement('span', { className: 'dsh-live-voice-dot' }) : null,
          ),
        )
      }
      const dispose = ctx.slots.inject('conversation.input.right', () =>
        ctx.slots.register({
          name: 'conversation.input.right',
          id: 'dsh-theme-live-voice',
          order: 45,
          label: () => '实时语音输入',
        }, RealtimeVoiceButton),
      )
      return () => {
        try { dispose?.() } catch { /* ignore */ }
        document.documentElement.removeAttribute('data-dsh-realtime-voice')
      }
    }

// ── M0-S4 central anchor registry + self-check ──────────────────────────
    // Every host seam this plugin depends on is declared once, with a required /
    // optional / fallback level. `__dshClaudeThemeAnchors()` reports hit, miss
    // and degraded-fallback counts for the running client, so a host upgrade
    // that renames a class or drops an attribute becomes a visible number
    // instead of a silently dead feature (01 audit: 5 dead hash selectors).
    //
    // Evidence for the host side lives in docs/HOST-PROBE.md (§2.9/§2.10).
    const SIDEBAR_RIGHT_ATTRS = [
      'session',
      'panel',
      'open',
      'tab',
      'occurrence',
      'mode',
      'toggle',
      'guide',
      'guide-entry',
      'expand',
      'unavailable',
    ]

    // data-dockkit-* produced by the shell bundle (dsh-web-frontend index-*.js).
    const DOCKKIT_ATTRS = [
      'add-tab',
      'caret',
      'cell',
      'column',
      'content',
      'divider',
      'dock-scrim',
      'dock-zone',
      'drop-active',
      'drop-zones',
      'empty',
      'float',
      'float-active',
      'float-close',
      'float-dock',
      'float-grip',
      'float-resize',
      'float-title',
      'host',
      'menu-close',
      'pane',
      'pane-active',
      'split',
      'split-blocked',
      'split-button',
      'strip',
      'strip-chrome',
      'strip-fill',
      'strip-tabs',
      'surface',
      'tab',
      'tab-close',
      'tab-menu',
      'tab-quiet',
      'tab-title',
    ]

    // Cross-hash references the plugin still uses: a CSS-module *key* substring,
    // never a build hash. Required ones gate the composer/hero/usage surfaces.
    const CSS_KEY_ANCHORS = [
      { key: 'card', level: 'required' },
      { key: 'composerHero', level: 'optional' },
      { key: 'heroWorkspaceRow', level: 'optional' },
      { key: 'cardWorkspaceTrigger', level: 'optional' },
      { key: 'sessionRow', level: 'required' },
      { key: 'treeitem', level: 'optional' },
      { key: 'triggerEffort', level: 'optional' },
      { key: 'triggerAnchor', level: 'optional' },
      { key: 'workspace', level: 'optional' },
      { key: 'headline', level: 'optional' },
      { key: 'newSession', level: 'required' },
    ]

    // Live discovery (M0-S4, 2026-10-26): the sidebar account launcher is the
    // host-declared `settings.launcher` slot seat; it carries no aria-haspopup in
    // this build, while data-signed-out exists only as an extra. Order matters.
    const ACCOUNT_TRIGGER_ANCHORS = [
      '[data-slot="settings.launcher"] button',
      '[data-slot="settings.launcher"] [role="button"]',
      'button[data-signed-out]',
      'button[aria-haspopup="dialog"][aria-label*="账户"]',
    ]

    const ANCHOR_REGISTRY = (() => {
      const entries = []
      const add = (entry) => entries.push(entry)

      // Declared slot seams (registered by this plugin; DOM evidence below).
      add({ id: 'slot.usage-card', kind: 'slot', target: 'conversation.input.dock', level: 'required', note: '用量概览卡' })
      add({ id: 'slot.data-bridge', kind: 'slot', target: 'conversation.composer.dock', level: 'required', note: '实时数据桥（headless）' })
      add({ id: 'slot.effort-slider', kind: 'slot', target: 'conversation.input.right', level: 'required', note: '推理强度滑条' })
      add({ id: 'slot.live-voice', kind: 'slot', target: 'conversation.input.right', level: 'required', note: '实时语音' })

      // Conversation frame (M1-S5 depends on the scroll/phase pair).
      add({ id: 'dom.conversation.chat', kind: 'dom', selector: '[data-conversation-region="chat"]', level: 'required', note: '主会话区域' })
      add({ id: 'dom.conversation.composer', kind: 'dom', selector: '[data-conversation-region="composer"]', level: 'required', note: 'composer 座位' })
      add({ id: 'dom.conversation.scroll', kind: 'dom', selector: '[data-conversation-scroll]', level: 'required', note: '滚动容器（M1-S5 首选锚点）' })
      add({ id: 'dom.conversation.phase', kind: 'dom', selector: '[data-content-phase]', level: 'required', note: 'hero/active/settling' })
      add({ id: 'dom.composer.seat', kind: 'dom', selector: '[data-composer-seat]', level: 'required' })
      add({ id: 'dom.composer.editor', kind: 'dom', selector: '[data-lexical-editor="true"]', level: 'required' })
      add({ id: 'dom.composer.card', kind: 'dom', selector: '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])', level: 'required', fallback: '[data-lexical-editor="true"]', note: 'composer 卡片（跨哈希子串）' })

      // Sidebar frame.
      add({ id: 'dom.sidebar.rows', kind: 'dom', selector: '[data-row-key^="session:"]', level: 'required', note: '会话行（data-row-key）' })
      add({ id: 'dom.sidebar.treeitem', kind: 'dom', selector: '[role="treeitem"][data-row-key^="session:"]', level: 'required' })
      add({ id: 'dom.sidebar.collapsed', kind: 'dom', selector: '[data-sidebar-collapsed="true"]', level: 'optional', note: '仅折叠时渲染（false 属性缺省）' })
      add({ id: 'dom.account.trigger', kind: 'dom', selector: ACCOUNT_TRIGGER_ANCHORS[0], level: 'required', fallback: ACCOUNT_TRIGGER_ANCHORS[2], note: '账户按钮（settings.launcher 槽位；data-signed-out 仅作后备）' })

      // Frame columns / shell seats.
      add({ id: 'dom.frame.rightbar-col', kind: 'dom', selector: '[data-rightbar-col]', level: 'required' })
      add({ id: 'dom.shell.bottom', kind: 'dom', selector: '[data-shell-bottom]', level: 'required' })
      add({ id: 'dom.shell.overlay', kind: 'dom', selector: '[data-shell-overlay]', level: 'required' })
      add({ id: 'dom.shell.leading', kind: 'dom', selector: '[data-shell-leading]', level: 'optional', note: '无 leading 内容时不渲染（本 profile 实测 0）' })

      // Optional conversation/tool/diff surfaces (present only in some states).
      add({ id: 'dom.hero.root', kind: 'dom', selector: '[class*="_composerHero"]', level: 'optional', note: '首页 hero' })
      add({ id: 'dom.tool.call-id', kind: 'dom', selector: '[data-chat-call-id]', level: 'optional', note: '工具调用卡（diff 微标依赖）' })
      add({ id: 'dom.tool.anchor-key', kind: 'dom', selector: '[data-chat-anchor-key]', level: 'optional' })
      add({ id: 'dom.diff.disclosure', kind: 'dom', selector: '[data-disclosure-row]', level: 'optional', note: 'Diff 微标插入点' })
      add({ id: 'dom.conversation.header', kind: 'dom', selector: '[data-conversation-header-leading], [data-conversation-header-corner]', level: 'optional', note: '会话头扩展位（M1-S2 用）' })
      add({ id: 'dom.theme.dark', kind: 'dom', selector: 'body[data-ds-dark-theme]', level: 'optional' })
      add({ id: 'dom.sidebar.right.toggle', kind: 'dom', selector: '[data-sidebar-right-toggle]', level: 'optional' })
      for (const name of SIDEBAR_RIGHT_ATTRS) {
        add({ id: 'dom.sidebarRight.' + name, kind: 'dom', selector: '[data-sidebar-right-' + name + ']', level: 'optional', note: '右栏状态属性' })
      }
      add({
        id: 'dom.dockkit.family',
        kind: 'family',
        selectors: DOCKKIT_ATTRS.map((name) => '[data-dockkit-' + name + ']'),
        level: 'optional',
        note: '右栏 Dock 家族（关闭时多为 0，属正常）',
      })

      // Cross-hash key anchors.
      for (const { key, level } of CSS_KEY_ANCHORS) {
        add({ id: 'css.' + key, kind: 'dom', selector: '[class*="_' + key + '"]', level, note: 'CSS module 键（跨构建哈希）' })
      }
      return entries
    })()

    function matchCount(selector) {
      try {
        return document.querySelectorAll(selector).length
      } catch (error) {
        return -1
      }
    }

    function evaluateAnchors() {
      const rows = []
      let required = 0
      let requiredHit = 0
      let optionalHit = 0
      let optionalMiss = 0
      let fallbackCount = 0
      const missesRequired = []
      const fallbacks = []
      const slots = []

      for (const entry of ANCHOR_REGISTRY) {
        if (entry.kind === 'slot') {
          slots.push({ id: entry.id, target: entry.target, status: 'declared', level: entry.level })
          rows.push({ entry, status: 'declared', hits: '—' })
          continue
        }
        let hits = 0
        if (entry.kind === 'family') {
          hits = entry.selectors.filter((selector) => matchCount(selector) > 0).length
          rows.push({ entry, status: hits > 0 ? 'hit' : 'optional-miss', hits: hits + '/' + entry.selectors.length })
          if (hits > 0) optionalHit += 1
          else optionalMiss += 1
          continue
        }
        hits = matchCount(entry.selector)
        let status = hits > 0 ? 'hit' : 'miss'
        let fallbackHits = null
        if (hits <= 0 && entry.fallback !== undefined) {
          fallbackHits = matchCount(entry.fallback)
          if (fallbackHits > 0) status = 'fallback'
        }
        if (entry.level === 'required') {
          required += 1
          if (status === 'hit') requiredHit += 1
        } else if (entry.level === 'optional') {
          if (status === 'hit') optionalHit += 1
          else optionalMiss += 1
        }
        if (status === 'fallback') {
          fallbackCount += 1
          fallbacks.push({ id: entry.id, fallback: entry.fallback, fallbackHits })
        }
        if (entry.level === 'required' && status !== 'hit') {
          missesRequired.push({ id: entry.id, selector: entry.selector, hits, status })
        }
        rows.push({ entry, status, hits, fallbackHits })
      }

      return {
        time: new Date().toISOString(),
        url: String(location.href).replace(/[?&]token=[^&]*/g, '?token=<redacted>'),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        runtime: activeRuntime === null ? null : activeRuntime.report(),
        required,
        requiredHit,
        requiredMiss: required - requiredHit,
        optionalHit,
        optionalMiss,
        fallback: fallbackCount,
        slots,
        missesRequired,
        fallbacks,
        rows,
      }
    }

    function formatAnchorReport(report) {
      const lines = []
      lines.push('anchors ' + report.requiredHit + '/' + report.required + ' required hit' +
        (report.requiredMiss > 0 ? ' · MISS ' + report.requiredMiss : ' · all required ok'))
      lines.push('optional ' + report.optionalHit + ' hit / ' + report.optionalMiss + ' miss · fallback ' + report.fallback +
        ' · slots declared ' + report.slots.length)
      if (report.runtime !== null) {
        lines.push('runtime: 1 observer / ' + report.runtime.intervalTasks.length + ' intervals (' + report.runtime.tickMs + 'ms tick)' +
          (report.runtime.hidden ? ' · paused(hidden)' : ''))
        lines.push('  mutation tasks: ' + report.runtime.mutationTasks.join(', '))
        lines.push('  interval tasks: ' + report.runtime.intervalTasks.map((task) => task.name + '@' + task.ms + 'ms').join(', '))
      } else {
        lines.push('runtime: inactive')
      }
      if (report.fallbacks.length > 0) {
        lines.push('fallbacks: ' + report.fallbacks.map((item) => item.id + ' → ' + item.fallback).join(' | '))
      }
      if (report.missesRequired.length > 0) {
        lines.push('required miss:')
        for (const miss of report.missesRequired) lines.push('  ' + miss.id + '  ' + miss.selector + '  hits=' + miss.hits)
      }
      return lines
    }

    function runAnchorSelfCheck() {
      const report = evaluateAnchors()
      try {
        window.__dshClaudeThemeAnchorsReport = report
        console.table(report.rows.map((row) => ({
          anchor: row.entry.id,
          kind: row.entry.kind,
          level: row.entry.level,
          status: row.status,
          hits: row.hits,
        })))
        for (const line of formatAnchorReport(report)) console.info('[dsh theme anchors] ' + line)
      } catch (error) {
        // Diagnostics must never break the page.
      }
      return report
    }    return {
      inject: ['theme', 'slots', 'locale', 'remote'],
      apply(ctx) {
        // Epoch guard: every new instance bumps a global epoch. Older instances
        // (even ones from builds that predate the dispose registry) check it on
        // a timer and dispose themselves, so two runtimes can never fight over
        // the same inline styles (the "left/right jumping" bug).
        const instanceEpoch = (window.__DSH_CLAUDE_THEME_EPOCH__ ?? 0) + 1
        window.__DSH_CLAUDE_THEME_EPOCH__ = instanceEpoch

        // Self-heal across client HMR: if a previous instance could not run its
        // disposers (failed reload, disable/enable race), tear it down first so
        // slot ids, listeners and DOM nodes never stack into a zombie instance.
        const previousDispose = window.__DSH_CLAUDE_THEME_DISPOSE__
        if (typeof previousDispose === 'function') {
          try {
            previousDispose()
          } catch (error) {
            // A broken previous instance must not block the new one.
          }
        }
        const disposers = []
        const disposeAll = () => {
          while (disposers.length > 0) {
            const dispose = disposers.pop()
            try {
              dispose?.()
            } catch (error) {
              // Keep tearing the rest down.
            }
          }
          if (window.__DSH_CLAUDE_THEME_DISPOSE__ === disposeAll) window.__DSH_CLAUDE_THEME_DISPOSE__ = undefined
          if (window.__dshClaudeThemeFontDebug === debugFont) window.__dshClaudeThemeFontDebug = undefined
        }
        window.__DSH_CLAUDE_THEME_DISPOSE__ = disposeAll

        // M0-S4: one scheduler owns every body observer and periodic task this
        // instance needs (features register tasks via runtimeOnMutation /
        // runtimeEvery). Disposed with the instance so HMR/disable leaves none.
        activeRuntime = createRuntimeScheduler()
        disposers.push(() => {
          try {
            activeRuntime?.dispose?.()
          } catch (error) {
            // Teardown must never block the rest of the disposers.
          }
          activeRuntime = null
        })

        // Mount the merged usage overview card (formerly dsh-usage-overview).
        try {
          usageOverviewPlugin.apply(ctx)
        } catch (error) {
          window.__dshUsageMergeError = String(error && error.stack ? error.stack : error)
        }


        // Mount the merged reasoning-effort slider. It waits for its own
        // services (sessions/modelDirectories) and stays out of the way when the
        // standalone dsh-codex-effort-slider is still enabled.
        try {
          const standaloneSliderPresent = () =>
            document.querySelector('style[data-plugin-css="dsh-codex-effort-slider"]') !== null
          if (standaloneSliderPresent()) {
            console.info('[dsh-claude-code-desktop-theme] standalone effort slider detected — merged slider skipped')
          } else {
            const removeSliderStyles = () => {
              document
                .querySelectorAll('style[data-plugin-css="dsh-claude-code-desktop-theme/effort-slider"]')
                .forEach((node) => node.remove())
            }
            disposers.push(removeSliderStyles)
            const sliderScope = ctx.inject(
              ['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'],
              (scope) => {
                scope.effect(() => {
                  // Give a concurrently-loading standalone slider a beat to
                  // publish its style marker before we decide to mount ours.
                  const timer = window.setTimeout(() => {
                    if (standaloneSliderPresent()) {
                      console.info('[dsh-claude-code-desktop-theme] standalone effort slider appeared — merged slider skipped')
                      return
                    }
                    try {
                      codexEffortSliderPlugin.apply(scope)
                    } catch (error) {
                      console.warn('[dsh-claude-code-desktop-theme] merged effort slider failed to mount', error)
                    }
                  }, 600)
                  return () => window.clearTimeout(timer)
                }, 'merged reasoning-effort slider')
              },
            )
            disposers.push(() => {
              try {
                sliderScope?.dispose?.()
              } catch {
                // The scope may already be disposed with the plugin fiber.
              }
            })
          }
        } catch (error) {
          console.warn('[dsh-claude-code-desktop-theme] merged effort slider setup failed', error)
        }

        // Any stale runtime notices the newer epoch within a second and retires
        // itself, releasing its intervals, observers and injected DOM.
        // M0-S4: the check rides the instance's shared ticker (disposing the
        // scheduler clears it, so an old instance leaves no timer behind).
        disposers.push(ctx.effect(() => runtimeEvery('epoch-guard', () => {
          if (window.__DSH_CLAUDE_THEME_EPOCH__ !== instanceEpoch) disposeAll()
        }, 800), 'instance epoch guard'))

        // Real account balance straight from the host account remote: fetch it
        // as soon as the app opens (no session / composer dock has to exist) and
        // keep it fresh via the account state stream + a slow poll. The remote
        // namespace is optional: profiles without an account controller still
        // load the theme and simply keep `余额 —`.
        ctx.inject(['remote.account'], (scope) => scope.effect(() => {
          const account = scope.remote?.account
          if (account === undefined) return () => {}
          const controller = new AbortController()
          const client = () => ({
            version: '0.2.1-rc.2',
            locale: ctx.locale?.getSnapshot?.().active ?? 'zh-CN',
            timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
          })
          const applyBalance = (value) => {
            if (value === null || typeof value !== 'object' || value.status !== 'ready') return false
            const wallets = Array.isArray(value.value) ? value.value : []
            const wallet = wallets.find((candidate) => candidate.currency === 'CNY') ?? wallets[0]
            if (wallet === undefined || typeof wallet.balance !== 'string') return false
            const amount = Number(wallet.balance)
            if (Number.isFinite(amount) === false) return false
            const symbol = wallet.currency === 'USD' ? '$' : '¥'
            lastKnownBalance = symbol + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            try {
              window.localStorage.setItem(BALANCE_CACHE_KEY, lastKnownBalance)
            } catch {
              // Best-effort cache only.
            }
            syncSidebarBalance()
            return true
          }
          const refresh = async () => {
            try {
              const result = await account.getBalance(client())
              if (result?.ok === true) applyBalance(result.value)
            } catch {
              // Keep the last known / dock-scraped balance.
            }
          }
          void refresh()
          // M0-S4: the slow account poll joins the shared ticker (page-hidden
          // pauses it together with everything else); the effect returns the
          // task disposer so a scope teardown unregisters it.
          const disposePoll = runtimeEvery('update-status', refresh, 10000)
          let stream
          try {
            stream = scope.remote.$stream({
              name: 'account',
              open: (signal) => account.watch(signal),
              ended: () => new Error('account stream ended'),
            })
          } catch {
            stream = undefined
          }
          if (stream !== undefined) {
            ;(async () => {
              try {
                for await (const frame of stream) {
                  if (controller.signal.aborted) break
                  frame.accept?.()
                  void refresh()
                }
              } catch {
                // Stream ended; the poll keeps the balance fresh.
              }
            })()
          }
          return () => {
            controller.abort()
            disposePoll()
            try {
              stream?.dispose?.()
            } catch {
              // Already disposed.
            }
          }
        }, 'real account balance'))

        // Headless session-data bridge under the composer: feeds the HUD tray,
        // the diff badges, the review drawer and the sidebar status dots. Its
        // ThemeLiveProbe child samples the streamed Assistant step for tok/s.
        disposers.push(ctx.effect(() => {
          bridge.registered = true
          const dispose = ctx.slots.inject('conversation.composer.dock', () =>
            ctx.slots.register({ name: 'conversation.composer.dock', id: 'dsh-theme-data', order: 100 }, ThemeDataBridge),
          )
          return () => {
            bridge.registered = false
            liveReset()
            dispose?.()
          }
        }, 'live session data bridge'))

        disposers.push(ctx.effect(() => {
          // Layer the Claude palette over the active built-in theme.
          const removeLayer = ctx.theme.overrideTokens(PLUGIN_ID, tokens)

          // Shell geometry over the host skeleton: sidebar, selection rail,
          // hero and composer chrome. Removed together with the palette.
          const style = document.createElement('style')
          style.dataset.plugin = PLUGIN_ID
          style.dataset.pluginCss = PLUGIN_ID + '/shell.css'
          style.textContent = SHELL_CSS
          document.head.appendChild(style)
          // M0-S6: start the external serif fetch immediately after the shell CSS is
          // in place. First paint uses the system serif stack; the face is swapped
          // in when the FontFace resolves (font-display: swap). The loader never
          // throws and never blocks the theme layer.
          try {
            void loadExternalSerif()
          } catch (error) {
            // Diagnostics only; the fallback stack already renders.
          }
          // One failing mount must not abort the whole layer: the loader treats a
          // thrown activation as a fatal boot error and restarts the window. Each
          // mount is isolated and degrades to a no-op disposer instead.
          const unmountOf = (mount, label) => {
            try {
              const dispose = mount()
              return typeof dispose === 'function' ? dispose : () => {}
            } catch (error) {
              console.error('[dsh-claude-code-desktop-theme] ' + label + ' failed to mount', error)
              return () => {}
            }
          }
          const unmountUpdate = unmountOf(mountUpdatePanel, 'update panel')
          const unmountLiveVoice = unmountOf(() => {
            let innerDispose = () => {}
            let scopeDispose = null
            try {
              scopeDispose = ctx.inject(['remote.speech'], (scope) => {
                innerDispose = mountRealtimeVoice(scope)
              })
            } catch (error) {
              console.warn('[dsh-claude-code-desktop-theme] real-time voice unavailable', error)
            }
            return () => {
              try { innerDispose() } catch { /* ignore */ }
              try { scopeDispose?.dispose?.() } catch { /* ignore */ }
            }
          }, 'real-time voice input')
          const unmountStatus = unmountOf(mountSessionStatus, 'session status dots')
          const unmountHeroCard = unmountOf(mountHeroDashboardCard, 'hero dashboard card')
          const unmountHeroMenus = unmountOf(mountHeroMenusUpward, 'hero menus upward')
          const unmountTray = unmountOf(mountComposerTray, 'composer tray')
          const unmountSidebarBalance = unmountOf(mountSidebarBalance, 'sidebar balance')
          const unmountUsageModelLabels = unmountOf(() => mountUsageModelLabels(ctx), 'usage model labels')
          const unmountDiff = unmountOf(mountDiffReview, 'diff review')
          const unmountPet = unmountOf(mountDesktopPet, 'desktop pet')

          // The requested look is the light variant. Follow-system users get it
          // once (persisted by the theme service); an explicit light/dark choice
          // is respected and only receives the matching palette above.
          const snapshot = ctx.theme.getTheme()
          if (snapshot.preference === 'system') ctx.theme.setTheme('light')

          return () => {
            unmountUpdate()
            unmountLiveVoice()
            unmountDiff()
            unmountPet()
            unmountHeroMenus()
            unmountHeroCard()
            unmountUsageModelLabels()
            unmountSidebarBalance()
            unmountTray()
            unmountStatus()
            style.remove()
            removeLayer()
          }
        }, PLUGIN_ID + ': shell layer'))

        disposers.push(() => {
          if (window.__DSH_CLAUDE_THEME_DISPOSE__ === disposeAll) window.__DSH_CLAUDE_THEME_DISPOSE__ = undefined
        })

        // Console diagnostics for the sidebar dots: run
        //   __dshClaudeThemeStatusDebug()
        // in DevTools to print every row's real status and the injected dot's
        // computed geometry/color/animation.
        const debugStatusDots = () => {
          const rows = [...document.querySelectorAll(SESSION_ROW_SELECTOR)].map((row) => {
            const key = row.getAttribute('data-row-key') ?? ''
            const id = key.slice(SESSION_ID_PREFIX.length)
            const status = bridge.sessions?.statuses?.get(id) ?? null
            const slot = row.querySelector('[class*="_slot"]')
            const style = slot === null ? null : window.getComputedStyle(slot, '::before')
            return {
              sessionId: id,
              title: (row.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30),
              dataStatus: row.getAttribute('data-dsh-status'),
              running: status?.running ?? null,
              pendingInteraction: status?.pendingInteraction?.kind ?? null,
              subagentsRunning: bridge.sessions?.subagents?.get(id) ?? 0,
              dot: style === null ? null : {
                content: style.content,
                width: style.width,
                height: style.height,
                backgroundColor: style.backgroundColor,
                opacity: style.opacity,
              },
            }
          })
          console.table(rows)
          return rows
        }
        window.__dshClaudeThemeStatusDebug = debugStatusDots

        // HUD diagnostics for issue reports: run __dshClaudeThemeHudDebug() in
        // DevTools to see the live window, the last provider-truth step sample
        // and the current cost state without touching the DOM.
        const debugHud = () => {
          const now = hudNow()
          const snapshot = {
            sessionId: bridge.currentSessionId,
            running: bridge.sessions?.statuses?.get(bridge.currentSessionId)?.running ?? null,
            liveTps: liveTps(now),
            liveStreaming: live.streaming,
            liveTokens: live.tokens,
            liveCum: live.cum,
            liveCalib: Number(live.calib.toFixed(3)),
            liveSamples: live.samples.length,
            lastStep: bridge.lastStep,
            lastStepHit: bridge.lastStepHit,
            lifetimeTps: bridge.tokensPerSecond,
            lifetimeHit: bridge.cacheHitPercent,
            context: bridge.context,
            cost: { id: sessionCost.id, text: sessionCost.text, source: sessionCost.source, title: sessionCost.title },
            trays: document.querySelectorAll('.' + TRAY_CLASS).length,
          }
          console.table(snapshot)
          return snapshot
        }
        window.__dshClaudeThemeHudDebug = debugHud





        // Font-rendering diagnostics for issue reports: which platform, DPI,
        // computed smoothing and whether the embedded UI serif actually loaded.
        const debugFont = () => {
          const bodyStyle = window.getComputedStyle(document.body)
          const faces = [...document.fonts]
            .filter((face) => face.family.includes('DSH Serif UI'))
            .map((face) => ({ family: face.family, weight: face.weight, status: face.status }))
          const result = {
            platform: document.documentElement.getAttribute('data-platform'),
            devicePixelRatio: window.devicePixelRatio,
            smoothing: bodyStyle.webkitFontSmoothing || bodyStyle.getPropertyValue('-webkit-font-smoothing'),
            bodyFontFamily: bodyStyle.fontFamily,
            uiSerifLoaded: document.fonts.check('400 14px "DSH Serif UI"'),
            uiSerifFaces: faces,
            dataDshFont: document.documentElement.getAttribute('data-dsh-font'),
            external: fontDebugState(),
          }
          console.table(result)
          return result
        }
        window.__dshClaudeThemeFontDebug = debugFont

        // Layout diagnostics for issue reports: dumps the hero/composer stack,
        // the usage card and the sidebar account row with their boxes, so a
        // screenshot-free report can pinpoint what overlaps what.
        const debugLayout = () => {
          const token = (element) =>
            String(element.className || '')
              .split(/\s+/)
              .filter(Boolean)
              .map((name) => name.replace(/^[A-Za-z0-9_-]+?_/, '_'))
              .join(' ')
          const box = (element) => {
            if (element === null || element === undefined) return null
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return {
              node: `${element.tagName.toLowerCase()}.${token(element)}`,
              display: style.display,
              position: style.position,
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            }
          }
          const hero = document.querySelector('[class*="_composerHero"]')
          const card = document.querySelector(
            '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])',
          )
          const duo = document.querySelector('.duo-card')
          const duoChain = []
          for (let node = duo, depth = 0; node !== null && depth < 5; node = node.parentElement, depth += 1) {
            duoChain.push(box(node))
          }
          const account = document.querySelector('[data-slot="settings.launcher"] button, button[data-signed-out]')
          return {
            viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
            hero: box(hero),
            heroChildren: hero === null ? null : [...hero.children].map(box),
            composerCard: box(card),
            duo,
            duoCard: box(duo),
            duoChain,
            account,
            accountChildren: account === null ? null : [...account.children].map(box),
            accountRow: account === null ? null : box(account.parentElement),
          }
        }
        window.__dshClaudeThemeLayoutDebug = debugLayout

        // Self-check: if the usage card and the composer card ever intersect,
        // dump the geometry once so a bug report needs no DOM poking.
        window.setTimeout(() => {
          try {
            const duo = document.querySelector('.duo-card')
            const card = document.querySelector(
              '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])',
            )
            if (duo === null || card === null) return
            const a = duo.getBoundingClientRect()
            const b = card.getBoundingClientRect()
            const overlaps = a.bottom > b.top + 2 && b.bottom > a.top + 2 && a.right > b.left && b.right > a.left
            if (overlaps) console.warn('[dsh theme] hero/card overlap detected', debugLayout())
          } catch (error) {
            /* diagnostics must never break the page */
          }
        }, 3000)











        // M0-S4 anchor self-check: registry-backed, available at startup and on
        // demand (`__dshClaudeThemeAnchors()`); logs a table and stores the last
        // report on window for bug reports.
        window.__dshClaudeThemeAnchors = () => runAnchorSelfCheck()
        window.__dshClaudeThemeRuntime = () => (activeRuntime === null ? null : activeRuntime.report())
        window.setTimeout(() => {
          try {
            const report = runAnchorSelfCheck()
            if (report.requiredMiss > 0) {
              console.warn('[dsh theme] anchor self-check: required miss ' + String(report.requiredMiss) + '/' + String(report.required))
            } else {
              console.info('[dsh theme] anchor self-check: required ' + String(report.requiredHit) + '/' + String(report.required) + ' hit')
            }
          } catch (error) {
            // Diagnostics never break the page.
          }
        }, 1500)
      },
    }
  },
})

