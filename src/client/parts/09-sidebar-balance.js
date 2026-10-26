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

