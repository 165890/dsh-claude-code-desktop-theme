    // ── Hero dropdowns open upward ──────────────────────────────────────────
    // The workspace and mode pickers sit directly above the composer now; their
    // host portals still open downward over the input. Re-anchor any open hero
    // menu above its trigger so the option list extends upward.
    const HERO_MENU_TRIGGER_SELECTOR = '[class*="_workspace"]:not([class*="_workspaceRow"]):not([class*="_workspaceLabel"]), [class*="_seat"]:not([class*="_seatIcon"]):not([class*="_seatLabel"])'
    const HERO_MENU_PANEL_SELECTOR = '[role="menu"][class*="_portal"]'

    function mountHeroMenusUpward() {
      let scheduled = 0
      const reposition = () => {
        scheduled = 0
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

