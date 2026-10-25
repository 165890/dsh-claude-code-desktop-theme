    // ── Desktop pet: DeepSeek pixel whale ───────────────────────────────────
    // A 16×16 pixel whale sits on the composer's top-right corner. The art is
    // baked into a 4-frame PNG sprite sheet with canvas at mount time, so the
    // whole pet is a single 32×32 background layer instead of hundreds of pixel
    // nodes. Frame swaps only repaint that layer; every movement is an integer
    // pixel transform, so the art never blurs. Nothing here touches host state:
    // it only observes the composer and reacts (spec: docs/PET.zh.md).
    const PET_HIDDEN_KEY = 'dsh-theme-pet-hidden'
    const PET_CLASS = 'dsh-pet'
    const PET_SPRITE_CLASS = 'dsh-pet__sprite'
    const PET_HIDE_CLASS = 'dsh-pet__hide'
    const PET_BUBBLE_CLASS = 'dsh-pet__bubble'
    const PET_RESTORE_CLASS = 'dsh-pet-restore'
    const PET_ANCHOR_CARD = 'card'
    const PET_ANCHOR_FIXED = 'fixed'
    const PET_BREATH_MS = 1600
    const PET_BLINK_MS = 120
    const PET_HAPPY_MS = 480
    const PET_DASH_MS = 600
    const PET_COOLDOWN_MS = 600
    const PET_SEND_DEDUPE_MS = 400
    const PET_BUBBLE_MS = 1200
    const PET_SPRITE_PX = 32
    const PET_OFFSET_TOP = 36
    const PET_OFFSET_SIDE = 8

    const PET_PALETTE_LIGHT = {
      K: '#152443',
      L: '#7c93ff',
      B: '#4d6bfe',
      D: '#3a65c2',
      W: '#eaf3ff',
      E: '#1d1b16',
      S: '#ffffff',
      P: '#da7756',
      C: '#9cc1e7',
      A: '#f7ad31',
    }
    const PET_PALETTE_DARK = {
      K: '#0c1326',
      L: '#8aa0ff',
      B: '#5c79ff',
      D: '#3f5bc9',
      W: '#c9d8f2',
      E: '#141210',
      S: '#ffffff',
      P: '#e08a6a',
      C: '#7fb2de',
      A: '#f7ad31',
    }

    // 16×16 character matrices straight from docs/PET.zh.md (one char = 1 px).
    const PET_FRAMES = {
      idle: [
        "................",
        "................",
        "................",
        ".....C......KKK.",
        "....C.C....KKDK.",
        ".....C....KKDDK.",
        "...KKKKKKKKDDDK.",
        ".KKKLLLLKKDDDDK.",
        "KKLLLLLLLLDDDDK.",
        "KBBSBBBBBBBKKKK.",
        "KBBEEBBBBBBKKDK.",
        "BBBBBWWWWBBDDDK.",
        "BBBBWWWWWWDDDDK.",
        "KBBWWWWWKKKKDDK.",
        "KKBBWKKKK..KKDK.",
        ".KKKKK......KKK.",
      ],
      idle_lo: [
        "................",
        "................",
        ".....C......KKK.",
        "....C.C....KKDK.",
        ".....C....KKDDK.",
        "...KKKKKKKKDDDK.",
        ".KKKLLLLKKDDDDK.",
        "KKLLLLLLLLDDDDK.",
        "KBBSBBBBBBBKKKK.",
        "KBBEEBBBBBBKKDK.",
        "BBBBBWWWWBBDDDK.",
        "BBBBWWWWWWDDDDK.",
        "KBBWWWWWKKKKDDK.",
        "KKBBWKKKK..KKDK.",
        ".KKKKK......KKK.",
        "................",
      ],
      blink: [
        "................",
        "................",
        "................",
        ".....C......KKK.",
        "....C.C....KKDK.",
        ".....C....KKDDK.",
        "...KKKKKKKKDDDK.",
        ".KKKLLLLKKDDDDK.",
        "KKLLLLLLLLDDDDK.",
        "KBBBBBBBBBBKKKK.",
        "KBBEEBBBBBBKKDK.",
        "BBBBBWWWWBBDDDK.",
        "BBBBWWWWWWDDDDK.",
        "KBBWWWWWKKKKDDK.",
        "KKBBWKKKK..KKDK.",
        ".KKKKK......KKK.",
      ],
      happy: [
        "................",
        "................",
        "....C.C.........",
        "...C.C.C....KKK.",
        "....C.C....KKDK.",
        ".....C....KKDDK.",
        "...KKKKKKKKDDDK.",
        ".KKKLLLLKKDDDDK.",
        "KKLLLLLLLLDDDDK.",
        "KBBSSBBBBBBKKKK.",
        "KBBEEBBBBBBKKDK.",
        "BPBBBWWWWBBDDDK.",
        "BBBBWWWWWWDDDDK.",
        "KBBWWWWWKKKKDDK.",
        "KKBBWKKKK..KKDK.",
        ".KKKKK......KKK.",
      ],
    }
    const PET_FRAME_ORDER = ['idle', 'idle_lo', 'blink', 'happy']

    const PET_CSS = [
      // Card-relative placement needs the card as containing block; relative on
      // its own never changes the host layout.
      '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]){position:relative!important}',
      '.dsh-pet{position:absolute;top:-36px;right:8px;width:32px;height:32px;box-sizing:border-box;z-index:3;pointer-events:none;isolation:isolate}',
      '.dsh-pet[data-anchor="fixed"]{position:fixed;top:0;left:0;right:auto;z-index:30}',
      '.dsh-pet::before{content:"";position:absolute;inset:-6px;border-radius:50%;background:radial-gradient(circle,rgba(77,107,254,.22),rgba(77,107,254,0) 70%);opacity:0;transition:opacity 120ms linear;pointer-events:none}',
      '.dsh-pet[data-state="hover"]::before{opacity:1}',
      '.dsh-pet__sprite{position:absolute;inset:0;display:block;pointer-events:auto;cursor:pointer;background-image:var(--dsh-pet-sheet);background-repeat:no-repeat;background-size:128px 32px;background-position:0 0;image-rendering:pixelated;transform:translateZ(0);transition:transform 120ms steps(2,jump-none);user-select:none;-webkit-user-drag:none}',
      '.dsh-pet[data-frame="idle_lo"] .dsh-pet__sprite{background-position:-32px 0}',
      '.dsh-pet[data-frame="blink"] .dsh-pet__sprite{background-position:-64px 0}',
      '.dsh-pet[data-frame="happy"] .dsh-pet__sprite{background-position:-96px 0}',
      '.dsh-pet[data-state="hover"] .dsh-pet__sprite{transform:translate3d(0,-2px,0)}',
      '.dsh-pet[data-state="happy"] .dsh-pet__sprite{animation:dsh-pet-bounce 480ms steps(1,end) 1}',
      '@keyframes dsh-pet-bounce{0%{transform:translate3d(0,0,0)}25%{transform:translate3d(0,2px,0)}60%{transform:translate3d(0,-2px,0)}100%{transform:translate3d(0,0,0)}}',
      '.dsh-pet[data-state="dash"] .dsh-pet__sprite{animation:dsh-pet-dive 600ms steps(3,end) 1}',
      '@keyframes dsh-pet-dive{0%{transform:translate3d(0,0,0)}35%{transform:translate3d(0,3px,0)}100%{transform:translate3d(0,0,0)}}',
      '.dsh-pet__hide{position:absolute;top:-6px;right:-6px;width:14px;height:14px;padding:0;border:0;border-radius:50%;background:#ece7dd;color:#7f7869;font:10px/14px "SF Mono",Consolas,monospace;text-align:center;cursor:pointer;opacity:0;transition:opacity 120ms linear;pointer-events:none}',
      '.dsh-pet:hover .dsh-pet__hide,.dsh-pet:focus-within .dsh-pet__hide,.dsh-pet__hide:focus-visible{opacity:1;pointer-events:auto}',
      '.dsh-pet__hide:hover{background:#e3ddd1;color:#1d1b16}',
      '.dsh-pet__hide:focus-visible{outline:2px solid #da7756;outline-offset:1px}',
      '.dsh-pet__bubble{position:absolute;right:0;bottom:36px;padding:2px 6px;border-radius:4px;background:#ece7dd;color:#1d1b16;font:11px/16px "SF Mono",Consolas,monospace;white-space:nowrap;opacity:0;transition:opacity 120ms linear;pointer-events:none}',
      '.dsh-pet[data-bubble="1"] .dsh-pet__bubble{opacity:1}',
      '.dsh-pet-restore{border:0;padding:0 2px;background:transparent;color:#87867f;font:12px/16px "SF Mono",Consolas,monospace;cursor:pointer}',
      '.dsh-pet-restore:hover{color:#1d1b16}',
      '.dsh-pet-restore:focus-visible{outline:2px solid #da7756;outline-offset:1px}',
      '.dsh-pet[data-collision="1"]{transform:translateY(-8px)}',
      '.dsh-pet[data-collision="2"]{display:none}',
      'body[data-ds-dark-theme] .dsh-pet::before{background:radial-gradient(circle,rgba(92,121,255,.28),rgba(92,121,255,0) 70%)}',
      'body[data-ds-dark-theme] .dsh-pet__hide{background:#322f2b;color:#b9b0a2}',
      'body[data-ds-dark-theme] .dsh-pet__bubble{background:#322f2b;color:#f0ede4}',
      '@media (max-width:720px){.dsh-pet{display:none!important}}',
      '@media (prefers-reduced-motion:reduce){.dsh-pet__sprite{transition:none;animation:none!important}.dsh-pet::before{transition:none}.dsh-pet__hide,.dsh-pet__bubble{transition:none}.dsh-pet[data-state="hover"] .dsh-pet__sprite{transform:none}}',
    ].join('\n')

    /** Paint the four matrices into one 64×16 PNG data URL (one sheet per theme). */
    function petSpriteUrl(palette) {
      const canvas = document.createElement('canvas')
      canvas.width = 16 * PET_FRAME_ORDER.length
      canvas.height = 16
      const context = canvas.getContext('2d')
      if (context === null) return null
      for (let index = 0; index < PET_FRAME_ORDER.length; index += 1) {
        const rows = PET_FRAMES[PET_FRAME_ORDER[index]]
        for (let y = 0; y < 16; y += 1) {
          const row = rows[y]
          for (let x = 0; x < 16; x += 1) {
            const color = palette[row[x]]
            if (color === undefined) continue
            context.fillStyle = color
            context.fillRect(index * 16 + x, y, 1, 1)
          }
        }
      }
      try {
        return canvas.toDataURL('image/png')
      } catch {
        return null
      }
    }

    function mountDesktopPet() {
      const reducedMotionQuery = (() => {
        try {
          return window.matchMedia('(prefers-reduced-motion: reduce)')
        } catch {
          return null
        }
      })()
      const reducedMotion = () => reducedMotionQuery !== null && reducedMotionQuery.matches === true
      const pageHidden = () => {
        try {
          return document.visibilityState === 'hidden'
        } catch {
          return false
        }
      }
      const background = () => document.body ?? document.documentElement
      const findCard = () => document.querySelector('[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])')
      const findTray = () => document.querySelector('.dsh-composer-tray')

      let disposed = false
      let styleEl = null
      let shell = null
      let sprite = null
      let hideButton = null
      let bubbleEl = null
      let restoreButton = null
      let anchor = PET_ANCHOR_CARD
      let sheetLight = null
      let sheetDark = null
      let frame = 'idle'
      let breathPhase = 0
      let state = 'idle'
      let cooldown = false
      let hiddenFlag = false
      let breathTimer = 0
      let blinkTimer = 0
      let blinkRestoreTimer = 0
      let reactionTimer = 0
      let bubbleTimer = 0
      let ensureTimer = 0
      let lastSendAt = 0
      let pointerStart = null
      let mountObserver = null
      let themeObserver = null
      let resizeObserver = null
      let intersectionObserver = null

      try {
        hiddenFlag = window.localStorage.getItem(PET_HIDDEN_KEY) === '1'
      } catch {
        hiddenFlag = false
      }

      const readHidden = () => hiddenFlag
      const writeHidden = (hidden) => {
        hiddenFlag = hidden === true
        try {
          if (hiddenFlag) window.localStorage.setItem(PET_HIDDEN_KEY, '1')
          else window.localStorage.removeItem(PET_HIDDEN_KEY)
        } catch {
          // Restricted profiles: the toggle still works for this session.
        }
      }

      const ensureStyle = () => {
        if (styleEl !== null && styleEl.isConnected) return
        styleEl = document.createElement('style')
        styleEl.dataset.plugin = 'dsh-claude-code-desktop-theme'
        styleEl.dataset.pluginCss = 'dsh-claude-code-desktop-theme/pet.css'
        styleEl.textContent = PET_CSS
        document.head.appendChild(styleEl)
      }

      const isDarkTheme = () => {
        try {
          return document.body !== null && document.body.hasAttribute('data-ds-dark-theme')
        } catch {
          return false
        }
      }
      const applySheet = () => {
        if (shell === null) return
        if (sheetLight === null) sheetLight = petSpriteUrl(PET_PALETTE_LIGHT)
        if (sheetDark === null) sheetDark = petSpriteUrl(PET_PALETTE_DARK)
        const candidate = isDarkTheme() ? (sheetDark ?? sheetLight) : (sheetLight ?? sheetDark)
        if (typeof candidate === 'string' && candidate !== '') {
          shell.style.setProperty('--dsh-pet-sheet', 'url("' + candidate + '")')
        }
      }

      const setFrame = (next) => {
        frame = next
        if (shell !== null) shell.dataset.frame = next
      }
      const setState = (next) => {
        state = next
        if (shell !== null) shell.dataset.state = next
      }
      const idleFrame = () => (breathPhase === 0 ? 'idle' : 'idle_lo')

      const stopBreath = () => {
        if (breathTimer !== 0) {
          window.clearInterval(breathTimer)
          breathTimer = 0
        }
      }
      const startBreath = () => {
        stopBreath()
        if (disposed || shell === null || pageHidden() || reducedMotion()) return
        if (state === 'happy' || state === 'dash') return
        breathTimer = window.setInterval(() => {
          if (disposed || pageHidden()) return
          if (state === 'happy' || state === 'dash') return
          breathPhase = breathPhase === 0 ? 1 : 0
          setFrame(idleFrame())
        }, PET_BREATH_MS)
      }
      const stopBlinks = () => {
        if (blinkTimer !== 0) {
          window.clearTimeout(blinkTimer)
          blinkTimer = 0
        }
        if (blinkRestoreTimer !== 0) {
          window.clearTimeout(blinkRestoreTimer)
          blinkRestoreTimer = 0
        }
      }
      const scheduleBlink = () => {
        stopBlinks()
        if (disposed || shell === null || pageHidden() || reducedMotion()) return
        blinkTimer = window.setTimeout(() => {
          blinkTimer = 0
          if (disposed || pageHidden() || state === 'happy' || state === 'dash') {
            scheduleBlink()
            return
          }
          setFrame('blink')
          blinkRestoreTimer = window.setTimeout(() => {
            blinkRestoreTimer = 0
            if (disposed) return
            if (state !== 'happy' && state !== 'dash') setFrame(idleFrame())
            scheduleBlink()
          }, PET_BLINK_MS)
        }, 3500 + Math.floor(Math.random() * 4000))
      }

      const clearBubble = () => {
        if (bubbleTimer !== 0) {
          window.clearTimeout(bubbleTimer)
          bubbleTimer = 0
        }
        if (shell !== null) shell.removeAttribute('data-bubble')
      }
      const showBubble = (text) => {
        if (shell === null) return
        if (bubbleEl !== null) bubbleEl.textContent = text
        shell.dataset.bubble = '1'
        if (bubbleTimer !== 0) window.clearTimeout(bubbleTimer)
        bubbleTimer = window.setTimeout(() => {
          bubbleTimer = 0
          if (shell !== null) shell.removeAttribute('data-bubble')
        }, PET_BUBBLE_MS)
      }

      const stopReaction = () => {
        if (reactionTimer !== 0) {
          window.clearTimeout(reactionTimer)
          reactionTimer = 0
        }
        cooldown = false
      }
      const react = (kind) => {
        if (disposed || shell === null || cooldown || pageHidden()) return
        cooldown = true
        stopBreath()
        stopBlinks()
        const nextState = kind === 'dash' ? 'dash' : 'happy'
        setState(nextState)
        setFrame('happy')
        showBubble(kind === 'dash' ? '噗通' : '咕噜')
        stopReaction()
        cooldown = true
        reactionTimer = window.setTimeout(() => {
          reactionTimer = 0
          cooldown = false
          if (disposed) return
          const stillHovered = shell !== null && typeof shell.matches === 'function' && shell.matches(':hover')
          if (state === 'hover' || stillHovered) setState('hover')
          else setState('idle')
          setFrame(idleFrame())
          if (state === 'hover' || state === 'idle') {
            startBreath()
            scheduleBlink()
          }
        }, kind === 'dash' ? PET_DASH_MS : Math.max(PET_HAPPY_MS, PET_COOLDOWN_MS))
      }

      // pointerover/out bubble to the shell and carry `relatedTarget`, so moving
      // between the sprite and the hide button never flickers the hover state.
      const relatedInsideShell = (event) => {
        const related = event.relatedTarget
        if (related === null || typeof related !== 'object') return false
        return shell !== null && shell.contains(related) === true
      }
      const onPointerOver = (event) => {
        if (relatedInsideShell(event)) return
        if (state === 'idle' && cooldown === false) {
          setState('hover')
          startBreath()
        }
      }
      const onPointerOut = (event) => {
        if (relatedInsideShell(event)) return
        if (state === 'hover') {
          setState('idle')
          startBreath()
        }
      }
      const onSpritePointerDown = (event) => {
        // Keep the composer's focus and caret exactly where the user left them.
        event.preventDefault()
        pointerStart = { x: event.clientX, y: event.clientY, at: Date.now() }
      }
      const onSpritePointerUp = (event) => {
        const start = pointerStart
        pointerStart = null
        if (start === null) return
        if (Date.now() - start.at > 250) return
        if (Math.abs(event.clientX - start.x) > 6) return
        if (Math.abs(event.clientY - start.y) > 6) return
        react('happy')
      }
      const onPointerCancel = () => {
        pointerStart = null
      }
      const onHideClick = (event) => {
        event.preventDefault()
        event.stopPropagation()
        writeHidden(true)
        removeShell()
        ensureRestore()
      }
      const onRestoreClick = (event) => {
        event.preventDefault()
        writeHidden(false)
        removeRestore()
        ensureMounted()
      }

      const buildShell = () => {
        const node = document.createElement('div')
        node.className = PET_CLASS
        node.dataset.anchor = anchor
        node.dataset.state = 'idle'
        node.dataset.frame = 'idle'
        const image = document.createElement('span')
        image.className = PET_SPRITE_CLASS
        image.setAttribute('role', 'img')
        image.setAttribute('aria-label', 'DeepSeek 像素小鲸鱼')
        const hide = document.createElement('button')
        hide.type = 'button'
        hide.className = PET_HIDE_CLASS
        hide.setAttribute('aria-label', '隐藏小鲸鱼')
        hide.title = '隐藏小鲸鱼'
        hide.textContent = '×'
        hide.addEventListener('click', onHideClick)
        const tip = document.createElement('span')
        tip.className = PET_BUBBLE_CLASS
        tip.setAttribute('aria-hidden', 'true')
        node.append(image, hide, tip)
        node.addEventListener('pointerover', onPointerOver)
        node.addEventListener('pointerout', onPointerOut)
        image.addEventListener('pointerdown', onSpritePointerDown)
        image.addEventListener('pointerup', onSpritePointerUp)
        image.addEventListener('pointercancel', onPointerCancel)
        return { node, image, hide, tip }
      }

      const removeShell = () => {
        stopBreath()
        stopBlinks()
        stopReaction()
        clearBubble()
        if (resizeObserver !== null) {
          resizeObserver.disconnect()
          resizeObserver = null
        }
        if (intersectionObserver !== null) {
          intersectionObserver.disconnect()
          intersectionObserver = null
        }
        if (shell !== null) shell.remove()
        shell = null
        sprite = null
        hideButton = null
        bubbleEl = null
        pointerStart = null
        state = 'idle'
        frame = 'idle'
      }

      const ensureRestore = () => {
        if (disposed) return
        if (restoreButton !== null && restoreButton.isConnected) return
        const tray = findTray()
        if (tray === null) return
        const host = tray.querySelector('.dsh-tray-right') ?? tray
        restoreButton = document.createElement('button')
        restoreButton.type = 'button'
        restoreButton.className = PET_RESTORE_CLASS
        restoreButton.setAttribute('aria-label', '显示小鲸鱼')
        restoreButton.title = '显示小鲸鱼'
        restoreButton.textContent = '鲸'
        restoreButton.addEventListener('click', onRestoreClick)
        host.appendChild(restoreButton)
      }
      const removeRestore = () => {
        if (restoreButton === null) return
        restoreButton.remove()
        restoreButton = null
      }

      const overflowVisible = (element) => {
        try {
          const style = window.getComputedStyle(element)
          return style.overflow === 'visible' && style.overflowX === 'visible' && style.overflowY === 'visible'
        } catch {
          return false
        }
      }
      const chooseAnchor = (card) => (overflowVisible(card) ? PET_ANCHOR_CARD : PET_ANCHOR_FIXED)

      const position = () => {
        if (shell === null || anchor !== PET_ANCHOR_FIXED) return
        const card = findCard()
        if (card === null) return
        const rect = card.getBoundingClientRect()
        const left = Math.max(0, Math.round(rect.right - PET_OFFSET_SIDE - PET_SPRITE_PX))
        const top = Math.max(0, Math.round(rect.top - PET_OFFSET_TOP))
        shell.style.left = left + 'px'
        shell.style.top = top + 'px'
      }

      const hitTest = (offsetY) => {
        if (shell === null) return false
        const rect = shell.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return false
        const x = Math.round(rect.left + rect.width / 2)
        const y = Math.round(rect.top + rect.height / 2) - (offsetY ?? 0)
        let target = null
        try {
          target = document.elementFromPoint(x, y)
        } catch {
          return false
        }
        if (target === null) return false
        if (shell.contains(target)) return false
        if (target.closest('.dsh-pet') !== null) return false
        return target.closest('button,[role="button"],textarea,input,select,[contenteditable="true"],[contenteditable=""]') !== null
      }
      const guardCollision = () => {
        if (shell === null) return
        shell.removeAttribute('data-collision')
        position()
        if (hitTest(0) === false) return
        shell.dataset.collision = '1'
        if (hitTest(8)) shell.dataset.collision = '2'
      }

      const observeAnchor = (card) => {
        if (resizeObserver !== null) {
          resizeObserver.disconnect()
          resizeObserver = null
        }
        if (anchor !== PET_ANCHOR_FIXED) return
        try {
          resizeObserver = new ResizeObserver(() => {
            if (disposed) return
            position()
            guardCollision()
          })
          resizeObserver.observe(card)
        } catch {
          resizeObserver = null
        }
      }

      const watchIntersection = () => {
        if (shell === null) return
        if (intersectionObserver !== null) {
          intersectionObserver.disconnect()
          intersectionObserver = null
        }
        try {
          intersectionObserver = new IntersectionObserver((entries) => {
            if (disposed) return
            const entry = entries[entries.length - 1]
            if (entry === undefined) return
            if (entry.isIntersecting) {
              startBreath()
              scheduleBlink()
            } else {
              stopBreath()
              stopBlinks()
            }
          }, { threshold: 0 })
          intersectionObserver.observe(shell)
        } catch {
          intersectionObserver = null
        }
      }

      const isClipped = () => {
        if (shell === null) return false
        const rect = shell.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) return false
        let target = null
        try {
          target = document.elementFromPoint(
            Math.round(rect.left + rect.width / 2),
            Math.round(rect.top + rect.height / 2),
          )
        } catch {
          return false
        }
        if (target === null) return false
        return shell.contains(target) === false
      }

      const mountShell = (card, forcedAnchor) => {
        anchor = forcedAnchor ?? chooseAnchor(card)
        const built = buildShell()
        shell = built.node
        sprite = built.image
        hideButton = built.hide
        bubbleEl = built.tip
        applySheet()
        const host = anchor === PET_ANCHOR_CARD ? card : background()
        host.appendChild(shell)
        startBreath()
        scheduleBlink()
        position()
        guardCollision()
        observeAnchor(card)
        watchIntersection()
      }

      const ensureMounted = () => {
        if (disposed) return
        ensureStyle()
        if (readHidden()) {
          removeShell()
          ensureRestore()
          return
        }
        removeRestore()
        const card = findCard()
        if (card === null) {
          removeShell()
          return
        }
        if (shell !== null && shell.isConnected) {
          position()
          return
        }
        if (shell !== null) removeShell()
        mountShell(card)
        // An ancestor of the card can clip the top-right corner even when the
        // card itself is overflow:visible; the sprite would then be invisible.
        // Re-mount once as a viewport-fixed overlay instead of guessing further.
        if (anchor === PET_ANCHOR_CARD && isClipped()) {
          const cardAgain = findCard()
          if (cardAgain !== null) {
            removeShell()
            mountShell(cardAgain, PET_ANCHOR_FIXED)
          }
        }
      }

      const scheduleEnsure = () => {
        if (disposed || ensureTimer !== 0) return
        ensureTimer = window.setTimeout(() => {
          ensureTimer = 0
          if (disposed) return
          ensureMounted()
        }, 300)
      }

      const onVisibility = () => {
        if (disposed) return
        if (pageHidden()) {
          stopBreath()
          stopBlinks()
          if (shell !== null) shell.dataset.state = 'paused'
          return
        }
        if (shell !== null && (state === 'idle' || state === 'hover')) {
          shell.dataset.state = state
          startBreath()
          scheduleBlink()
        }
        ensureMounted()
      }
      const onResize = () => {
        if (disposed) return
        position()
        guardCollision()
      }
      const onReducedMotionChange = () => {
        if (disposed) return
        if (reducedMotion()) {
          stopBreath()
          stopBlinks()
          setFrame('idle')
        } else if (state === 'idle' || state === 'hover') {
          startBreath()
          scheduleBlink()
        }
      }

      const triggerSend = () => {
        const now = Date.now()
        if (now - lastSendAt < PET_SEND_DEDUPE_MS) return
        lastSendAt = now
        react('dash')
      }
      const onKeyDown = (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
        if (event.isComposing === true || event.keyCode === 229) return
        const target = event.target
        if (target === null || typeof target !== 'object') return
        const element = target.nodeType === 1 ? target : target.parentElement
        if (element === null || typeof element.closest !== 'function') return
        if (element.closest('[class*="_root"]:has([data-lexical-editor="true"])') === null) return
        triggerSend()
      }
      const onSendPointerUp = (event) => {
        const target = event.target
        if (target === null || typeof target !== 'object') return
        const element = target.nodeType === 1 ? target : target.parentElement
        if (element === null || typeof element.closest !== 'function') return
        if (element.closest('.dsh-pet') !== null) return
        const button = element.closest('button')
        if (button === null || button.closest('[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])') === null) return
        const label = (button.getAttribute('aria-label') ?? '') + ' ' + (button.title ?? '')
        if (/发送|send/i.test(label) === false) return
        triggerSend()
      }

      const debug = () => {
        const snapshot = {
          mounted: shell !== null && shell.isConnected,
          anchor: anchor,
          state: state,
          frame: frame,
          hidden: readHidden(),
          collision: shell === null ? null : (shell.getAttribute('data-collision') ?? 'none'),
          nodes: shell === null ? 0 : 1 + shell.childElementCount,
          spriteReady: sheetLight !== null,
        }
        try {
          console.table(snapshot)
        } catch {
          // Console formatting is a nicety.
        }
        return snapshot
      }
      window.__dshClaudeThemePetDebug = debug

      ensureMounted()
      try {
        mountObserver = new MutationObserver(scheduleEnsure)
        mountObserver.observe(background(), { childList: true, subtree: true })
      } catch {
        mountObserver = null
      }
      try {
        themeObserver = new MutationObserver(() => {
          if (disposed) return
          applySheet()
        })
        themeObserver.observe(background(), { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
      } catch {
        themeObserver = null
      }
      document.addEventListener('visibilitychange', onVisibility)
      document.addEventListener('keydown', onKeyDown, { passive: true })
      document.addEventListener('pointerup', onSendPointerUp, true)
      window.addEventListener('resize', onResize)
      try {
        reducedMotionQuery?.addEventListener?.('change', onReducedMotionChange)
      } catch {
        // Older matchMedia: reduced motion is read at mount time only.
      }

      return () => {
        disposed = true
        if (ensureTimer !== 0) {
          window.clearTimeout(ensureTimer)
          ensureTimer = 0
        }
        removeShell()
        removeRestore()
        if (mountObserver !== null) mountObserver.disconnect()
        if (themeObserver !== null) themeObserver.disconnect()
        document.removeEventListener('visibilitychange', onVisibility)
        document.removeEventListener('keydown', onKeyDown)
        document.removeEventListener('pointerup', onSendPointerUp, true)
        window.removeEventListener('resize', onResize)
        try {
          reducedMotionQuery?.removeEventListener?.('change', onReducedMotionChange)
        } catch {
          // Ignore.
        }
        if (styleEl !== null) {
          styleEl.remove()
          styleEl = null
        }
        if (window.__dshClaudeThemePetDebug === debug) window.__dshClaudeThemePetDebug = undefined
      }
    }

