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
        const hero = document.querySelector('[class*="_composerHero"]')
        document.documentElement.dataset.dshHero = hero === null ? 'false' : 'true'
        const card = document.querySelector('.duo-card')
        const row = document.querySelector('[class*="_heroWorkspaceRow"]')
        const composerCard = document.querySelector(
          '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])',
        )
        const composer = composerCard === null ? null : composerCard.closest('[class*="_root"]')
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

