    // ── Sidebar footer balance ──────────────────────────────────────────────
    // The account balance is no longer shown under the input; it lives in the
    // sidebar footer row (right of the account name) and stays visible on every
    // page. Value comes from the hidden legacy bar (`余额 …`).
    const SIDEBAR_BALANCE_CLASS = 'dsh-sidebar-footer-balance'

    // The host's CSS-module class names are build hashes and change between
    // releases (`wCInkW_triggerRow` vanished in the 3.x client), so the account
    // launcher is located by its stable semantics instead: the sidebar button
    // that opens the account menu carries data-signed-out + aria-haspopup.
    const ACCOUNT_TRIGGER_SELECTOR = 'button[data-signed-out][aria-haspopup="menu"]'

    function findAccountTrigger() {
      const candidates = document.querySelectorAll(ACCOUNT_TRIGGER_SELECTOR)
      for (const candidate of candidates) {
        if (candidate.querySelector(':scope > span') !== null) return candidate
      }
      return candidates.length > 0 ? candidates[0] : null
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
      const timer = window.setInterval(ensureSidebarBalance, 1000)
      const observer = new MutationObserver(() => ensureSidebarBalance())
      observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
      return () => {
        window.clearInterval(timer)
        observer.disconnect()
        for (const node of document.querySelectorAll('.' + SIDEBAR_BALANCE_CLASS)) node.remove()
      }
    }

