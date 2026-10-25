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
