/**
 * dsh-claude-code-desktop-theme — Client half.
 *
 * Applies a Claude Code desktop style palette to the Harness Web GUI by
 * stacking one alias-token override layer over the active theme. The values
 * come from the requested theme spec:
 *
 *   surface  #f5f3ee   ink #1d1b16   accent #da7756
 *   contrast 60        opaque windows
 *   fonts: ui "思源宋体 VF" (Source Han Serif / Noto Serif SC), code "SF Mono"
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

    // ── Merged usage overview card (formerly the dsh-usage-overview plugin) ──
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

    // ── Embedded hero serif ─────────────────────────────────────────────────
    // This Electron renderer resolves locally installed Latin families such as
    // Georgia but not locally installed CJK families: "Noto Serif SC" silently
    // fell through to the sans CJK fallback. The 3.9 KB subset below (Noto Serif
    // SC, SIL OFL 1.1) covers the Chinese hero headline (探索未至之境) and is
    // registered under the same family name the reference stack asks for, so
    // the serif face no longer depends on local font matching.
    const HERO_SERIF_BASE64 = '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'

    const HERO_SERIF_FACE = '@font-face{font-family:"Noto Serif SC";font-style:normal;font-weight:400;font-display:swap;'
      + 'src:url(data:font/ttf;base64,' + HERO_SERIF_BASE64 + ') format("truetype")}'

    const SHELL_CSS = [
      HERO_SERIF_FACE,
      // Sidebar column fill.
      `${LIGHT} ._2H3hWW_root{background:${SHELL.sidebarFill}}`,
      // New Session: every stroke removed, 32px tall, 6px corners.
      `${LIGHT} ._2H3hWW_root:not(._2H3hWW_collapsed) ._2H3hWW_newSession{border:0!important;background:${SHELL.newSessionFill}!important;height:32px;min-height:32px;padding:0 12px;border-radius:6px}`,
      `${LIGHT} ._2H3hWW_root:not(._2H3hWW_collapsed) ._2H3hWW_newSession:hover{background:${SHELL.newSessionHover}!important}`,
      // Selected session row: cream fill plus a forced 2px terracotta rail on
      // the row's own left edge. A pseudo-element keeps it glued to the item
      // through scrolling, resizing and re-renders, with no runtime geometry.
      `${LIGHT} .hIlkoa_sessionRow.hIlkoa_selected{background:${SHELL.navActiveFill}!important}`,
      `${LIGHT} .hIlkoa_sessionRow.hIlkoa_selected:hover{background:${SHELL.navActiveFill}!important}`,
      `.hIlkoa_sessionRow.hIlkoa_selected{position:relative!important}`,
      `.hIlkoa_sessionRow.hIlkoa_selected::before{content:""!important;position:absolute!important;left:0!important;top:50%!important;transform:translateY(-50%)!important;width:2px!important;height:18px!important;border-radius:1px;background:${SHELL.navActiveRail}!important;pointer-events:none!important;z-index:2}`,
      // Status semantics (real layer): the dot is a CSS pseudo-element on the
      // host's own leading slot, driven by `data-dsh-status`. A pseudo-element
      // is computed style, not a React child, so a sidebar re-render can never
      // delete it -- the dot cannot blink out of existence.
      `.hIlkoa_sessionRow[data-dsh-status] .hIlkoa_slot{display:inline-flex!important;flex:none;align-items:center!important;justify-content:center!important}`,
      `.hIlkoa_sessionRow[data-dsh-status]:not([data-dsh-status="busy"]) .hIlkoa_slot::before{content:""!important;display:inline-block!important;width:6px!important;height:6px!important;min-width:6px!important;min-height:6px!important;box-sizing:border-box!important;border-radius:50%!important;background:#7f7869!important;opacity:.5!important;flex:none!important;pointer-events:none!important}`,
      `.hIlkoa_sessionRow[data-dsh-status="waiting"] .hIlkoa_slot::before{background:#da7756!important;opacity:1!important}`,
      // Busy rows use the host's native rotating arc spinner (14px): keep it,
      // recolour it to the theme accent, and hide the pseudo dot instead.
      `.hIlkoa_sessionRow[data-dsh-status="busy"] .hIlkoa_slot::before{display:none!important}`,
      `.hIlkoa_sessionRow[data-dsh-status="busy"] .hIlkoa_slot>svg[data-state="ongoing"]{display:inline-block!important;flex:none!important;width:14px!important;height:14px!important;color:#da7756!important}`,
      `.hIlkoa_sessionRow[data-dsh-status="busy"] .hIlkoa_slot>svg[data-state="ongoing"] circle{stroke:#da7756!important;stroke-width:2px!important}`,
      `.hIlkoa_sessionRow[data-dsh-status="busy"] .hIlkoa_slot>svg[data-state="ongoing"] [class*="Track"]{stroke:rgba(218,119,86,.25)!important}`,
      `@media (prefers-reduced-motion:reduce){.hIlkoa_sessionRow[data-dsh-status="busy"] .hIlkoa_slot>svg[data-state="ongoing"] *{animation:none!important}}`,
      // Hero: force the serif display face, a lighter and slightly smaller
      // headline, and the ink color (all !important so host sheets cannot win).
      `${LIGHT} .Hqq-bq_headline,${LIGHT} .Hqq-bq_titleGroup>span:not([class]){color:${SHELL.heroInk}!important;font-family:Georgia,"Noto Serif SC",serif!important;font-size:22px!important;font-weight:400!important;line-height:30px}`,
      `body[data-ds-dark-theme] .Hqq-bq_headline,body[data-ds-dark-theme] .Hqq-bq_titleGroup>span:not([class]){font-family:Georgia,"Noto Serif SC",serif!important;font-size:22px!important;font-weight:400!important;line-height:30px}`,
      `${LIGHT} .Hqq-bq_fish{color:${SHELL.heroInk}!important}`,
      `${LIGHT} .Hqq-bq_previewBadge{background:${SHELL.previewFill}!important;border-color:transparent!important;color:${SHELL.previewInk}!important}`,
      // ── Hero dashboard layout (2026-10-18 · 阶段十三) ─────────────────────
      // No big hero title at all: the whole title block is removed from flow.
      // Hero mode becomes a top-left dashboard: card first, then the workspace
      // selector row sitting directly above the composer, left aligned.
      `.Dc7zOa_composerHero .Hqq-bq_root{display:none!important}`,
      `.Dc7zOa_composerHero{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:0!important}`,
      `.Dc7zOa_composerHero .duo-card{order:1!important;width:calc(100% - 32px)!important;max-width:none!important;margin:0 16px 28px!important}`,
      // Usage card: favourite-model tile shows the full model name (wraps instead of ellipsis).
      `.duo-grid>.duo-tile:last-child .duo-tile-value{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:break-word!important;word-break:break-word!important;font-size:12px!important;line-height:16px!important}`,
      // Usage card model tile: a smaller dedicated font keeps long real model names on two lines.
      `.duo-grid>.duo-tile:last-child .duo-tile-value--model{font-size:12px!important;line-height:16px!important}`,
      `.duo-model-name{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}`,
      `.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow{order:2!important;position:relative!important;margin:0 0 10px!important;padding:0 16px!important;background:transparent!important;border:0!important;box-shadow:none!important;display:flex!important;align-items:center!important;gap:4px!important;min-height:26px!important;z-index:2}`,
      `.Dc7zOa_composerHero .RlGAzG_root{order:3!important}`,
      // Lightweight pill menus above the composer: transparent, gray text,
      // darker on hover; the host's background blocks are removed.
      `.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow .Hqq-bq_workspace,.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow ._oGoKq_seat{background:transparent!important;border:0!important;box-shadow:none!important;color:#87867F!important;font-size:13px!important;font-weight:400!important;line-height:20px!important;padding:0 8px!important;border-radius:999px!important;min-height:26px!important;gap:4px!important}`,
      `.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow .Hqq-bq_workspace:hover,.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow ._oGoKq_seat:hover,.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow .Hqq-bq_workspace[aria-expanded="true"],.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow ._oGoKq_seat[aria-expanded="true"]{background:transparent!important;color:#1d1b16!important}`,
      `.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow .Hqq-bq_folder,.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow .Hqq-bq_chevron,.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow ._oGoKq_seatLabel{color:inherit!important}`,
      `.Dc7zOa_composerHero .Dc7zOa_heroWorkspaceRow svg{color:inherit!important}`,
      // Composer: soft warm fill, hairline stroke, one very light float shadow.
      `${LIGHT} .RlGAzG_card{background:${SHELL.composerFill}!important;border:1px solid ${SHELL.composerBorder}!important;box-shadow:${SHELL.composerShadow}!important}`,
      // Composer controls: no fills, muted glyphs.
      `${LIGHT} .RlGAzG_add{background:transparent!important;color:${SHELL.controlInk}}`,
      `${LIGHT} .RlGAzG_add:hover:not(:disabled){background:${SHELL.controlHover}!important}`,
      `${LIGHT} .Gyyz9a_trigger{background:transparent!important;color:${SHELL.controlInk}}`,
      `${LIGHT} .Gyyz9a_trigger:hover:not(:disabled){background:${SHELL.controlHover}!important}`,
      `${LIGHT} .wq12jW_trigger,${LIGHT} .wq12jW_triggerEffort,${LIGHT} .wq12jW_chevron{color:${SHELL.controlInk}}`,
      // Composer cleanup: keep the toolbar row as two clean ends. The 1017
      // model-version tag (from the model-label plugin), the voice trigger and
      // the old bottom stats tray are hidden; the HUD tray below the card
      // replaces the old bar.
      `.wq12jW_trigger span[class*="_tag_"]{display:none!important}`,
      `.RlGAzG_activity{display:none!important}`,
      `.RlGAzG_dock{display:none!important}`,
      // Composer HUD tray: one quiet 16px line directly below the composer card
      // (8px gap), two ends aligned, monospace 12px. It is injected as a
      // sibling of the card, so the card itself never grows.
      `.dsh-composer-tray{display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);margin:8px auto 0;padding:0 2px;overflow:hidden;font-family:"SF Mono","Consolas",monospace;font-size:12px;line-height:16px;color:${SHELL.controlInk};white-space:nowrap;font-variant-numeric:tabular-nums}`,
      `.dsh-tray-group{display:inline-flex;align-items:center;min-width:0}`,
      `.dsh-tray-left{gap:14px;flex:none}`,
      `.dsh-tray-right{gap:8px;flex:0 1 auto;justify-content:flex-end;overflow:hidden}`,
      `.dsh-tray-sep{color:#b4ab99;flex:none}`,
      `.dsh-sidebar-footer-balance{position:absolute!important;right:10px!important;top:50%!important;transform:translateY(-50%)!important;font-family:inherit!important;font-size:12px!important;line-height:16px!important;color:#7f7869!important;white-space:nowrap!important;pointer-events:none!important;z-index:2!important}`,
      `.wCInkW_triggerRow .dsh-sidebar-footer-balance{font-family:"思源宋体 VF","Source Han Serif","Noto Serif SC",serif!important}`,
      `.wCInkW_triggerRow{position:relative!important}`,
      `.dsh-hud-part{display:inline-flex;align-items:center;gap:6px;flex:none;min-width:0}`,
      `.dsh-hud-value{color:#1d1b16}`,
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
      `html,body{font-family:"思源宋体 VF","Source Han Serif","Noto Serif SC",serif!important}`,
      `body,body *{font-family:"思源宋体 VF","Source Han Serif","Noto Serif SC",serif!important}`,
      `code,code *,pre,pre *,kbd,kbd *,samp,samp *,.shiki,.shiki *,.dsh-composer-tray,.dsh-composer-tray *,.dsh-diff-badge,.dsh-diff-badge *,.dsh-review-drawer,.dsh-review-drawer *{font-family:"SF Mono","Consolas",monospace!important}`,
      `body{background-color:#f5f3ee!important;color:#1d1b16!important}`,
      `._2H3hWW_root{background:#f5f3ee!important}`,
      `.RlGAzG_card{background:#f5f3ee!important}`,
      `.dsh-composer-tray{color:#7f7869!important}`,
      `.dsh-hud-value,.dsh-hud-agent-label,.dsh-hud-context-label{color:#1d1b16!important}`,
      `.dsh-hud-ring-track{stroke:#e3ddd1!important}`,
      `.dsh-hud-ring-progress{stroke:#da7756!important}`,
      `.dsh-hud-agent-dot{background:#da7756!important}`,
      `.dsh-diff-badge{background:#ece7dd!important}`,
      `.dsh-diff-add{color:#00c853!important}`,
      `.dsh-diff-del{color:#ff5f38!important}`,
      `.dsh-diff-line[data-kind="add"]{background:#00c853!important;color:#1d1b16!important}`,
      `.dsh-diff-line[data-kind="del"]{background:#ff5f38!important;color:#1d1b16!important}`,
      `.dsh-diff-line[data-kind="meta"]{color:#7f7869!important}`,
      `.dsh-review-drawer,.dsh-review-body,.dsh-review-preview{background-color:#f5f3ee!important;color:#1d1b16!important}`,
      `.dsh-review-head{background:#ece7dd!important}`,
      `.dsh-review-title,.dsh-review-close{color:#1d1b16!important}`,
      `.hIlkoa_sessionRow[data-dsh-status="waiting"] .hIlkoa_slot::before{background:#da7756!important;opacity:1!important}`,
      `.hIlkoa_sessionRow[data-dsh-status="idle"] .hIlkoa_slot::before{background:#7f7869!important;opacity:.5!important}`,
      `${LIGHT} .Hqq-bq_headline,${LIGHT} .Hqq-bq_titleGroup>span:not([class]){font-family:"思源宋体 VF","Source Han Serif","Noto Serif SC",serif!important;color:#1d1b16!important}`,
      `body[data-ds-dark-theme] .Hqq-bq_headline,body[data-ds-dark-theme] .Hqq-bq_titleGroup>span:not([class]){font-family:"思源宋体 VF","Source Han Serif","Noto Serif SC",serif!important}`,
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
    // A 500ms timer, one observer and the bridge's change listeners keep it in
    // sync; losing `busy` switches back to the idle dot instantly.
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
      const timer = window.setInterval(apply, 500)
      const observer = new MutationObserver(apply)
      observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
      bridgeListeners.add(apply)
      return () => {
        bridgeListeners.delete(apply)
        window.clearInterval(timer)
        observer.disconnect()
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
        scheduled = 0
        const hero = document.querySelector('.Dc7zOa_composerHero')
        const card = document.querySelector('.duo-card')
        const row = document.querySelector('[class*="heroWorkspaceRow"]')
        const composer = document.querySelector('.RlGAzG_root')
        if (hero === null || card === null || row === null || composer === null) {
          reset()
          return
        }
        const nodeChanged = card !== state.card || row !== state.row || composer !== state.composer
        if (nodeChanged) {
          reset()
          state.card = card
          state.row = row
          state.composer = composer
        }
        const sidebar = document.querySelector('._2H3hWW_root')
        const sidebarRect = sidebar === null ? null : sidebar.getBoundingClientRect()
        const sidebarHidden = sidebarRect === null || sidebarRect.width < 100
        const sidebarRight = sidebarHidden ? 0 : sidebarRect.right
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight
        const contentWidth = Math.max(360, viewportWidth - sidebarRight)
        // The usage card keeps the exact full-screen layout and is uniformly
        // scaled down by the window: base width is the full-screen card width,
        // height stays content-driven at that width (so the aspect ratio never
        // changes), and a CSS transform scales card + type together.
        const CARD_BASE_WIDTH = 427
        const REFERENCE_CONTENT_WIDTH = 1427
        const availableWidth = sidebarHidden ? viewportWidth : contentWidth
        // Keep the card readable in narrow windows: never shrink much below the
        // full-screen look, and still guarantee it fits the available width.
        const preferredScale = Math.min(1, Math.max(0.85, availableWidth / REFERENCE_CONTENT_WIDTH))
        const fitScale = Math.max(0.3, (availableWidth - 32) / CARD_BASE_WIDTH)
        const cardScale = Math.min(preferredScale, fitScale)
        const cardVisualWidth = CARD_BASE_WIDTH * cardScale
        // No sidebar → centre the card in the full window; with a sidebar keep
        // the full-screen left offset, also scaled.
        const cardLeft = sidebarHidden
          ? Math.round((viewportWidth - cardVisualWidth) / 2)
          : Math.round(sidebarRight + 82 * cardScale)
        const cardTop = Math.round(Math.max(16, viewportHeight * 0.123))
        const composerWidth = Math.round(Math.min(945, Math.max(480, contentWidth * 0.662)))
        const composerLeft = Math.round(sidebarRight + (contentWidth - composerWidth) / 2)
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
        scheduled = window.requestAnimationFrame(apply)
      }
      schedule()
      const timer = window.setInterval(apply, 800)
      window.addEventListener('resize', schedule)
      const observer = new MutationObserver(schedule)
      observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
      return () => {
        window.clearInterval(timer)
        window.removeEventListener('resize', schedule)
        observer.disconnect()
        if (scheduled !== 0) window.cancelAnimationFrame(scheduled)
        reset()
      }
    }

    // ── Hero dropdowns open upward ──────────────────────────────────────────
    // The workspace and mode pickers sit directly above the composer now; their
    // host portals still open downward over the input. Re-anchor any open hero
    // menu above its trigger so the option list extends upward.
    const HERO_MENU_TRIGGER_SELECTOR = '.Hqq-bq_workspace, [class*="_oGoKq_seat"]'
    const HERO_MENU_PANEL_SELECTOR = '[role="menu"][class*="_portal_"]'

    function mountHeroMenusUpward() {
      let scheduled = 0
      const reposition = () => {
        scheduled = 0
        const hero = document.querySelector('.Dc7zOa_composerHero')
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
        scheduled = window.requestAnimationFrame(reposition)
      }
      schedule()
      const timer = window.setInterval(reposition, 200)
      const observer = new MutationObserver(schedule)
      observer.observe(document.body ?? document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'aria-expanded'],
      })
      return () => {
        window.clearInterval(timer)
        observer.disconnect()
        if (scheduled !== 0) window.cancelAnimationFrame(scheduled)
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
      const timer = window.setInterval(() => {
        if (loaded === false && modelNamesById.size === 0) void load()
        decorate()
      }, 700)
      const observer = new MutationObserver(decorate)
      observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true, characterData: true })
      return () => {
        window.clearInterval(timer)
        observer.disconnect()
      }
    }

    // ── Sidebar footer balance ──────────────────────────────────────────────
    // The account balance is no longer shown under the input; it lives in the
    // sidebar footer row (right of the account name) and stays visible on every
    // page. Value comes from the hidden legacy bar (`余额 …`).
    const SIDEBAR_BALANCE_CLASS = 'dsh-sidebar-footer-balance'

    function ensureSidebarBalance() {
      const row = document.querySelector('.wCInkW_triggerRow')
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
      const timer = window.setInterval(ensureSidebarBalance, 1000)
      const observer = new MutationObserver(() => ensureSidebarBalance())
      observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
      return () => {
        window.clearInterval(timer)
        observer.disconnect()
        for (const node of document.querySelectorAll('.' + SIDEBAR_BALANCE_CLASS)) node.remove()
      }
    }

    // ── Composer HUD tray ───────────────────────────────────────────────────
    // A quiet 16px line rendered directly below the composer card (8px gap),
    // two ends aligned. Left: context ring + cache countdown. Right: session
    // cost, account balance and agents. The cost/balance values are scraped
    // from the old bottom bar (`.RlGAzG_dock`, kept mounted but display:none),
    // so the legacy plugin keeps computing them while the new tray stays on a
    // single line. Injected as a sibling of `.RlGAzG_card`, so the card never
    // grows; a MutationObserver re-creates it when the composer re-renders.
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
        '<span class="dsh-hud-part dsh-hud-context">' + ring + '<span class="dsh-hud-context-label">上下文 —</span></span>',
        '<span class="dsh-hud-part dsh-hud-cache">缓存 —</span>',
        '</div>',
        '<div class="dsh-tray-group dsh-tray-right">',
        '<span class="dsh-hud-part dsh-hud-cost">本次花费 <span class="dsh-hud-value">' + TRAY_COST_FALLBACK + '</span></span>',
        '<span class="dsh-tray-sep" aria-hidden="true">·</span>',
        '<span class="dsh-hud-part dsh-hud-tps"><span class="dsh-hud-value">—</span></span>',
        '<span class="dsh-tray-sep dsh-tray-sep-agents" aria-hidden="true">·</span>',
        '<span class="dsh-hud-part dsh-hud-agents" style="display:none"><span class="dsh-hud-agent-dot" aria-hidden="true"></span><span class="dsh-hud-agent-label">0 Agents</span></span>',
        '</div>',
      ].join('')
      return tray
    }

    let lastKnownBalance = null
    let lastKnownTps = null

    /** Read cost / balance / tokens-per-second out of the hidden legacy bar. */
    function readLegacyStats() {
      const dock = document.querySelector('.RlGAzG_dock')
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
      if (balance !== undefined) lastKnownBalance = balance
      if (tpsMatch !== null) lastKnownTps = tpsMatch[1] + ' tok/s'
      return {
        cost: format(pick(/(?:本会话|本次花费|本次)[^¥￥$0-9]{0,8}([¥￥$]?\s*[\d][\d,.]*)/) ?? TRAY_COST_FALLBACK),
        balance,
        tps: tpsMatch === null ? lastKnownTps : tpsMatch[1] + ' tok/s',
        cacheHit: cacheMatch === null ? null : cacheMatch[1],
      }
    }

    /**
     * Mount the HUD tray below every composer card and tick the cache
     * countdown. The tray is a sibling of the card, so it never changes the
     * card's height; the observer re-creates it after React re-renders.
     * @returns a dispose callback that removes the trays and the timer.
     */
    function mountComposerTray() {
      const render = () => {
        const money = readLegacyStats()
        const cacheText = money.cacheHit === null ? '缓存 —' : '缓存命中 ' + money.cacheHit
        // tok/s is live: only a running Session has a decode speed, otherwise 0.
        const sessionStatus = bridge.sessions?.statuses?.get(bridge.currentSessionId) ?? null
        const sessionSummary = bridge.sessions?.byId?.[bridge.currentSessionId] ?? null
        const running = sessionStatus?.running ?? sessionSummary?.running ?? false
        const tpsText = running ? (money.tps ?? '0 tok/s') : '0 tok/s'
        const context = bridge.context
        const percent = context === null ? 0 : context.percent
        const contextLabelText = context === null ? '上下文 —' : '上下文 ' + percent + '%'
        const contextTitle = context === null
          ? ''
          : formatTokens(context.usedTokens) + ' / ' + formatTokens(context.contextWindow) + ' tokens'
        const agents = bridge.agentsKnown ? bridge.agents : 0
        // A brand-new (blank) Session has no conversation yet: hide the whole
        // tray so the home page never shows a fake 上下文/花费/余额 readout.
        // The hero headline is the reliable "not started yet" UI signal; the
        // bridge flag covers blank sessions that render without the hero.
        const blank = bridge.blank === true || document.querySelector('[class*="Hqq-bq_headline"]') !== null
        for (const tray of document.querySelectorAll('.' + TRAY_CLASS)) {
          const display = blank ? 'none' : ''
          if (tray.style.display !== display) tray.style.display = display
          if (blank) continue
          const cache = tray.querySelector('.dsh-hud-cache')
          if (cache !== null && cache.textContent !== cacheText) cache.textContent = cacheText
          const cost = tray.querySelector('.dsh-hud-cost .dsh-hud-value')
          if (cost !== null && cost.textContent !== money.cost) cost.textContent = money.cost
          const tps = tray.querySelector('.dsh-hud-tps .dsh-hud-value')
          if (tps !== null && tps.textContent !== tpsText) tps.textContent = tpsText
          syncSidebarBalance()
          const progress = tray.querySelector('.dsh-hud-ring-progress')
          if (progress !== null) {
            const offset = (TRAY_RING_LENGTH * (1 - percent / 100)).toFixed(2)
            if (progress.getAttribute('stroke-dashoffset') !== offset) progress.setAttribute('stroke-dashoffset', offset)
          }
          const contextLabel = tray.querySelector('.dsh-hud-context-label')
          if (contextLabel !== null && contextLabel.textContent !== contextLabelText) contextLabel.textContent = contextLabelText
          const contextPart = tray.querySelector('.dsh-hud-context')
          if (contextPart !== null) {
            const current = contextPart.getAttribute('title')
            if (current !== contextTitle) {
              if (contextTitle === '') contextPart.removeAttribute('title')
              else contextPart.setAttribute('title', contextTitle)
            }
          }
          const agentsPart = tray.querySelector('.dsh-hud-agents')
          if (agentsPart !== null) {
            const display = agents > 0 ? '' : 'none'
            if (agentsPart.style.display !== display) agentsPart.style.display = display
            const agentLabel = agentsPart.querySelector('.dsh-hud-agent-label')
            const agentText = agents + ' Agents'
            if (agentLabel !== null && agentLabel.textContent !== agentText) agentLabel.textContent = agentText
          }
          const agentsSep = tray.querySelector('.dsh-tray-sep-agents')
          if (agentsSep !== null) {
            const display = agents > 0 ? '' : 'none'
            if (agentsSep.style.display !== display) agentsSep.style.display = display
          }
        }
      }
      const ensure = () => {
        for (const root of document.querySelectorAll('.RlGAzG_root')) {
          const card = root.querySelector(':scope > .RlGAzG_card')
          if (card === null) continue
          if (root.querySelector(':scope > .' + TRAY_CLASS) === null) card.after(createComposerTray())
        }
        for (const tray of document.querySelectorAll('.' + TRAY_CLASS)) {
          const card = tray.previousElementSibling
          if (card === null || card.classList.contains('RlGAzG_card') === false) tray.remove()
        }
      }
      ensure()
      render()
      bridgeListeners.add(render)
      const timer = window.setInterval(render, 1000)
      let scheduled = 0
      const schedule = () => {
        if (scheduled !== 0) return
        scheduled = window.requestAnimationFrame(() => {
          scheduled = 0
          ensure()
          render()
        })
      }
      const observer = new MutationObserver(schedule)
      observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
      return () => {
        bridgeListeners.delete(render)
        window.clearInterval(timer)
        observer.disconnect()
        if (scheduled !== 0) window.cancelAnimationFrame(scheduled)
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
      /** Rewrite every badge from the bridge's real tool diff map. */
      const syncBadges = () => {
        for (const badge of document.querySelectorAll('.' + DIFF_BADGE_CLASS)) {
          const card = badge.closest('[data-tool]')
          const callId = card === null ? null : card.closest('[data-chat-call-id]')?.getAttribute('data-chat-call-id')
          const tool = callId === null ? undefined : bridge.tools.get(callId)
          if (tool === undefined || tool.lines.length === 0) {
            if (badge.style.display !== 'none') badge.style.display = 'none'
            continue
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
      const badgeTimer = window.setInterval(syncBadges, 700)
      let scheduled = 0
      const schedule = () => {
        if (scheduled !== 0) return
        scheduled = window.requestAnimationFrame(() => {
          scheduled = 0
          decorate()
        })
      }
      const observer = new MutationObserver(schedule)
      observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
      return () => {
        window.clearInterval(badgeTimer)
        observer.disconnect()
        if (scheduled !== 0) window.cancelAnimationFrame(scheduled)
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
        bridge.blank = input.blank === true
        bridge.nodeCount = (input.nodes || []).length
        bridge.currentSessionId = input.sessionId ?? null
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
      const projections = useSessions((state) => state.projectionsBySession)
      const summaries = useSessions((state) => state.byId)
      const cwd = useSessions((state) => state.byId[sessionId]?.cwd)
      const statuses = useSessionStatus((value) => value)
      React.useEffect(() => {
        try {
          const summary = summaries?.[sessionId]
          const blank = summary?.blank === true || (nodes?.length ?? 0) === 0
          updateBridge({ nodes, pressure, projections, summaries, statuses, sessionId, cwd, blank })
        } catch (error) {
          bridge.lastError = String(error && error.message ? error.message : error)
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

    // ── Typography (v1 spec) ────────────────────────────────────────────────
    // The requested UI face leads the stack. The embedded Noto Serif SC subset
    // stays only as the CJK fallback that this Electron renderer can actually
    // resolve; SF Mono leads the code stack and Consolas covers Windows.
    const UI_FONT = '"思源宋体 VF", "Source Han Serif", "Noto Serif SC", serif'
    const CODE_FONT = '"SF Mono", "Consolas", monospace'

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

    return {
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
        }
        window.__DSH_CLAUDE_THEME_DISPOSE__ = disposeAll

        // Mount the merged usage overview card (formerly dsh-usage-overview).
        try {
          usageOverviewPlugin.apply(ctx)
        } catch (error) {
          window.__dshUsageMergeError = String(error && error.stack ? error.stack : error)
        }

        // Any stale runtime notices the newer epoch within a second and retires
        // itself, releasing its intervals, observers and injected DOM.
        disposers.push(ctx.effect(() => {
          const timer = window.setInterval(() => {
            if (window.__DSH_CLAUDE_THEME_EPOCH__ !== instanceEpoch) disposeAll()
          }, 800)
          return () => window.clearInterval(timer)
        }, 'instance epoch guard'))

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
          const poll = window.setInterval(refresh, 10000)
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
            window.clearInterval(poll)
            try {
              stream?.dispose?.()
            } catch {
              // Already disposed.
            }
          }
        }, 'real account balance'))

        // Headless session-data bridge under the composer: feeds the HUD tray,
        // the diff badges, the review drawer and the sidebar status dots.
        disposers.push(ctx.effect(() => {
          bridge.registered = true
          const dispose = ctx.slots.inject('conversation.composer.dock', () =>
            ctx.slots.register({ name: 'conversation.composer.dock', id: 'dsh-theme-data', order: 100 }, ThemeDataBridge),
          )
          return () => {
            bridge.registered = false
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
          const unmountStatus = unmountOf(mountSessionStatus, 'session status dots')
          const unmountHeroCard = unmountOf(mountHeroDashboardCard, 'hero dashboard card')
          const unmountHeroMenus = unmountOf(mountHeroMenusUpward, 'hero menus upward')
          const unmountTray = unmountOf(mountComposerTray, 'composer tray')
          const unmountSidebarBalance = unmountOf(mountSidebarBalance, 'sidebar balance')
          const unmountUsageModelLabels = unmountOf(() => mountUsageModelLabels(ctx), 'usage model labels')
          const unmountDiff = unmountOf(mountDiffReview, 'diff review')

          // The requested look is the light variant. Follow-system users get it
          // once (persisted by the theme service); an explicit light/dark choice
          // is respected and only receives the matching palette above.
          const snapshot = ctx.theme.getTheme()
          if (snapshot.preference === 'system') ctx.theme.setTheme('light')

          return () => {
            unmountDiff()
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
            const slot = row.querySelector('.hIlkoa_slot')
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





      },
    }
  },
})
