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

