    // Claude Code desktop chrome + "Absolutely" code theme palette.
    const ACCENT = '#da7756'
    const ACCENT_HOVER = '#c4633f'
    const SURFACE = '#f5f3ee'
    const INK = '#1d1b16'
    const CODE_BG = '#2d2d2b'
    const CODE_FG_LIGHT = '#2d2d2b'
    const CODE_FG_DARK = '#f9f9f7'

    // ── Skeleton layer ──────────────────────────────────────────────────────
    // The token layer above carries the palette; this layer carries the shell
    // geometry that Claude desktop uses and tokens cannot express: the flat
    // 32px New Session button, the 2px selection rail at the sidebar's left
    // edge, the smaller serif hero and the airy composer card. Everything is
    // scoped to the light appearance and to the shell components, so the
    // transcript and the docked cards keep their existing surfaces.
    const SHELL = {
      sidebarFill: '#f5f3ee',
      navActiveFill: '#ece7dd',
      navActiveRail: '#da7756',
      newSessionFill: '#e3ddd1',
      newSessionHover: '#E0DDD2',
      heroInk: '#1d1b16',
      previewFill: '#e3ddd1',
      previewInk: '#7f7869',
      composerFill: '#f5f3ee',
      composerBorder: '#e3ddd1',
      composerShadow: '0 10px 30px rgba(29, 27, 22, 0.10), 0 2px 8px rgba(29, 27, 22, 0.04)',
      controlInk: '#7f7869',
      controlHover: 'rgba(0, 0, 0, 0.04)',
    }

    const LIGHT = 'body:not([data-ds-dark-theme])'
    const DARK = 'body[data-ds-dark-theme]'

    // ── Embedded hero serif ─────────────────────────────────────────────────
    // The 3.9 KB hero subset (SIL OFL 1.1) covers the Chinese headline
    // (探索未至之境) and is registered under the family name the reference
    // stack asks for, so the display face never depends on local font matching.
    const HERO_SERIF_BASE64 = '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'

    const HERO_SERIF_FACE = '@font-face{font-family:"Noto Serif SC";font-style:normal;font-weight:400;font-display:swap;'
      + 'src:url(data:font/ttf;base64,' + HERO_SERIF_BASE64 + ') format("truetype")}'

    // ── External UI serif (D8 / M0-S6) ──────────────────────────────────────
    // The 2.6 MB GB2312 variable serif is no longer inlined. The Host half serves
    // it as a static asset over the authenticated Connection fetch route
    // (GET/HEAD /api/dsh-claude-code-desktop-theme/font). The client fetches the
    // bytes once, registers a FontFace, and degrades to the system serif stack if
    // the route, the FontFace API or the 8s budget is unavailable.
    const UI_SERIF_FAMILY = 'DSH Serif UI'
    const UI_SERIF_ROUTE = '/api/dsh-claude-code-desktop-theme/font'
    const UI_SERIF_TIMEOUT_MS = 8000
    const SYSTEM_SERIF_STACK = '"Noto Serif SC", "Songti SC", "SimSun", "STSong"'
    let uiSerifState = 'pending' // pending | external | fallback
    let uiSerifError = ''
    let uiSerifFace = null

    /** Diagnostics for `__dshClaudeThemeFontDebug()`: external vs fallback. */
    function fontDebugState() {
      return {
        source: uiSerifState,
        family: UI_SERIF_FAMILY,
        route: UI_SERIF_ROUTE,
        faceStatus: uiSerifFace === null ? null : uiSerifFace.status,
        error: uiSerifError,
      }
    }

    /** Publish the load state on <html> so screenshots/reports show the source. */
    function markFontState(state) {
      uiSerifState = state
      try {
        document.documentElement.setAttribute('data-dsh-font', state)
      } catch (error) {
        // Diagnostics only; a detached document must not break the theme.
      }
    }

    /** Drop FontFaces from previous instances (HMR re-applies the same plugin). */
    function dropStaleSerifFaces() {
      try {
        for (const face of [...document.fonts]) {
          if (typeof face.family === 'string' && face.family.includes(UI_SERIF_FAMILY)) document.fonts.delete(face)
        }
      } catch (error) {
        // The font set may be unavailable in exotic renderers.
      }
    }

    /**
     * Fetch the external GB2312 serif and register it as a FontFace.
     * Never throws: on any failure it logs one warning and leaves the system
     * serif fallback in place, so the page renders immediately and cannot hang.
     * @returns {Promise<boolean>} true when the external serif is active.
     */
    async function loadExternalSerif() {
      if (uiSerifState === 'external') return true
      const hasApi =
        typeof fetch === 'function' &&
        typeof FontFace === 'function' &&
        typeof document !== 'undefined' &&
        document.fonts !== undefined
      if (!hasApi) {
        uiSerifError = 'font-api-unavailable'
        markFontState('fallback')
        console.warn('[dsh-claude-code-desktop-theme] FontFace API unavailable; using the system serif fallback')
        return false
      }
      const controller = typeof AbortController === 'function' ? new AbortController() : null
      const timer = controller === null ? 0 : window.setTimeout(() => controller.abort(), UI_SERIF_TIMEOUT_MS)
      try {
        // Relative route: the shell routes it through the authenticated
        // Connection channel (same mechanism as the usage-summary fetch).
        const response = await fetch(UI_SERIF_ROUTE, {
          signal: controller === null ? undefined : controller.signal,
          cache: 'force-cache',
        })
        if (response.ok !== true) throw new Error('HTTP ' + String(response.status))
        const bytes = await response.arrayBuffer()
        if (bytes.byteLength === 0) throw new Error('empty font response')
        dropStaleSerifFaces()
        const face = new FontFace(UI_SERIF_FAMILY, bytes, {
          style: 'normal',
          weight: '200 900',
          display: 'swap',
        })
        await face.load()
        document.fonts.add(face)
        uiSerifFace = face
        markFontState('external')
        return true
      } catch (error) {
        const aborted = error !== null && typeof error === 'object' && error.name === 'AbortError'
        uiSerifError = aborted ? 'timeout' : String(error?.message ?? error)
        markFontState('fallback')
        console.warn(
          '[dsh-claude-code-desktop-theme] external UI serif unavailable (' +
            uiSerifError +
            '); using the system serif fallback',
        )
        return false
      } finally {
        if (timer !== 0) window.clearTimeout(timer)
      }
    }

    // ── Typography: one embedded, self-contained stack ──────────────────────
    const UI_FONT = '"DSH Serif UI", ' + SYSTEM_SERIF_STACK + ', "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif'
    const CODE_FONT = '"SF Mono", "Consolas", monospace'

