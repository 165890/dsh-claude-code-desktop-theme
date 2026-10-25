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

