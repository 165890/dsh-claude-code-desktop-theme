    // ── Composer HUD tray ───────────────────────────────────────────────────
    // A quiet 16px line rendered directly below the composer card (8px gap),
    // two ends aligned. Left: context ring + cache countdown. Right: session
    // cost, account balance and agents. The cost/balance values are scraped
    // from the old bottom bar (`[class*="_root"]:has([data-lexical-editor="true"]) [class*="_dock"]`, kept mounted but display:none),
    // so the legacy plugin keeps computing them while the new tray stays on a
    // single line. Injected as a sibling of `[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])`, so the card never
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

      const anchorFor = () => {
        const nodes = document.querySelectorAll('div,dl,li')
        for (const node of nodes) {
          if (node.childElementCount > 2) continue
          const text = (node.textContent ?? '').trim()
          if (text.length > 24) continue
          if (text.startsWith('当前版本') || /^Current version/i.test(text)) return node
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
        // Cheap gate: only the plugin page renders this label, so the full
        // scan below never runs on a chat session.
        const body = document.body.textContent ?? ''
        if (!body.includes('当前版本') && !body.includes('Current version')) return
        const anchor = anchorFor()
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

      const observer = new MutationObserver(schedule)
      observer.observe(document.body, { childList: true, subtree: true })

      ensure()
      void check()

      return () => {
        disposed = true
        observer.disconnect()
        if (debounce !== null) window.clearTimeout(debounce)
        const panel = document.getElementById(UPDATE_ROW_ID)
        if (panel !== null) panel.remove()
      }
    }

    /**
     * Mount the HUD tray below every composer card and tick the cache
     * countdown. The tray is a sibling of the card, so it never changes the
     * card's height; the observer re-creates it after React re-renders.
     * @returns a dispose callback that removes the trays and the timer.
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
      // Two cadences: a streaming Session needs a 2 Hz sample, an idle one only has
      // to keep cost/balance honest. The timeout is re-armed per tick so the
      // cadence can change without tearing anything down.
      const HUD_ACTIVE_TICK_MS = 500
      const HUD_IDLE_TICK_MS = 2000
      let timer = 0
      let disposed = false
      let scheduled = 0

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
      const armTicker = () => {
        if (disposed) return
        if (timer !== 0) window.clearTimeout(timer)
        if (pageHidden()) {
          timer = 0
          return
        }
        timer = window.setTimeout(() => {
          timer = 0
          renderNow()
          armTicker()
        }, sessionRunning() ? HUD_ACTIVE_TICK_MS : HUD_IDLE_TICK_MS)
      }
      // Projection frames still paint immediately: provider truth must land at
      // once. The ticker only covers values that move between frames (live
      // tok/s decay, cost refresh, the context ring while streaming).
      const onBridgeChange = () => renderNow()
      const onVisibility = () => {
        if (pageHidden()) {
          if (timer !== 0) window.clearTimeout(timer)
          timer = 0
          return
        }
        renderNow()
        armTicker()
      }
      ensure()
      renderNow()
      bridgeListeners.add(onBridgeChange)
      document.addEventListener('visibilitychange', onVisibility)
      armTicker()
      // The body observer is mount maintenance only: React re-renders the
      // composer freely while streaming, and repainting the whole tray on every
      // one of those mutations was the old observer's biggest cost.
      const scheduleEnsure = () => {
        if (scheduled !== 0) return
        scheduled = window.requestAnimationFrame(() => {
          scheduled = 0
          if (disposed) return
          ensure()
        })
      }
      const observer = new MutationObserver(scheduleEnsure)
      observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
      return () => {
        disposed = true
        bridgeListeners.delete(onBridgeChange)
        document.removeEventListener('visibilitychange', onVisibility)
        if (timer !== 0) window.clearTimeout(timer)
        observer.disconnect()
        if (scheduled !== 0) window.cancelAnimationFrame(scheduled)
        liveReset()
        for (const tray of document.querySelectorAll('.' + TRAY_CLASS)) tray.remove()
      }
    }

