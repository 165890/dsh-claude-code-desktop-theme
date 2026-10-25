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

