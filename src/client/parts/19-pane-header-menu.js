// ── Pane header menu (M1-S2) ────────────────────────────────────────────────
    // A 28×28 "⊞+" button registered through the official
    // `conversation.session.header.actions` list slot, plus a 220px menu with the
    // five entries from F04. Only host capabilities that really exist are
    // enabled: Preview/Terminal open real right-dock tabs, Tasks opens the host
    // schedules page, Diff stays disabled until M3, Plan needs a host plan
    // resource that this menu cannot synthesize.
// React.createElement alias — factory has React but no shared h; usage-overview's h is IIFE-local.
    const h = React.createElement

        const PANEL_MENU_CSS = [
      // ── pane header (F10) ────────────────────────────────────────────────
      `[class*="_titleRow"]{height:40px!important;min-height:40px!important;align-items:center!important;gap:8px!important;padding:0 12px 0 16px!important;box-sizing:border-box!important}`,
      `[class*="_titleRow"] [class*="_titleCluster"]{gap:8px!important;min-width:0!important;align-items:center!important}`,
      `[class*="_titleRow"] [class*="_crumbs"]{min-width:0!important;overflow:hidden!important;align-items:center!important}`,
      `[class*="_titleRow"] [class*="_crumb"]{font-family:var(--dsh-font-family-text)!important;color:var(--dsw-alias-label-tertiary)!important;font-size:12.5px!important;line-height:1.35!important}`,
      `[class*="_titleRow"] [class*="_crumbCurrent"]{font-family:var(--dsh-font-family-text)!important;color:var(--dsw-alias-label-primary)!important;font-size:14px!important;font-weight:600!important;letter-spacing:.01em!important;max-width:380px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}`,
      `[class*="_titleRow"] [class*="_headerActions"]{display:inline-flex!important;align-items:center!important;gap:2px!important;height:28px!important}`,
      `[class*="_titleRow"] [class*="_headerActions"] button{height:28px!important;min-width:28px!important;padding:0 4px!important;border-radius:7px!important;color:var(--dsw-alias-label-secondary)!important;background:transparent!important}`,
      `[class*="_titleRow"] [class*="_headerActions"] button:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `[class*="_titleRow"] [class*="_headerUtilities"] button,[class*="_titleRow"] [class*="_headerCorner"] button{height:24px!important;min-width:24px!important;border-radius:6px!important}`,
      `[class*="_titleRow"] [class*="_headerCorner"]{height:28px!important;align-items:center!important}`,
      `[class*="_tabs"]{height:28px!important}`,
      `[class*="_tabs"] [class*="_tab"]{font-family:var(--dsh-font-family-text)!important;font-size:12.5px!important}`,
      // ── trigger + popover ────────────────────────────────────────────────
      `.dsh-panel-trigger{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:28px!important;height:28px!important;border-radius:7px!important;color:var(--dsw-alias-label-secondary)!important}`,
      `.dsh-panel-trigger:hover,.dsh-panel-trigger[aria-expanded="true"]{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `.dsh-panel-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary)!important;outline-offset:-1px!important}`,
      `.dsh-panel-menu{position:fixed;z-index:1200;box-sizing:border-box;width:220px;padding:4px;border-radius:10px;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);box-shadow:0 18px 44px rgba(29,27,22,.18),0 2px 8px rgba(29,27,22,.08);font-family:var(--dsh-font-family-text);outline:none}`,
      `body[data-ds-dark-theme] .dsh-panel-menu{box-shadow:0 18px 44px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.3)}`,
      `.dsh-panel-menu-item{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 8px;border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;line-height:1;text-align:left;cursor:pointer}`,
      `.dsh-panel-menu-item:hover,.dsh-panel-menu-item:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}`,
      `.dsh-panel-menu-item[aria-disabled="true"]{opacity:.4;cursor:default}`,
      `.dsh-panel-menu-item[aria-disabled="true"]:hover{background:transparent}`,
      `.dsh-panel-menu-icon{display:inline-flex;width:16px;height:16px;flex:none;color:var(--dsw-alias-label-tertiary);align-items:center;justify-content:center}`,
      `.dsh-panel-menu-item:hover .dsh-panel-menu-icon,.dsh-panel-menu-item:focus-visible .dsh-panel-menu-icon{color:var(--dsw-alias-label-primary)}`,
      `.dsh-panel-menu-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`,
      `.dsh-panel-menu-key{flex:none;color:var(--dsw-alias-label-caption);font-family:var(--dsh-font-family-text);font-size:10.5px}`,
      `.dsh-panel-menu-sep{height:1px;margin:4px 6px;background:var(--dsw-alias-border-l1)}`,
      `.dsh-panel-menu-tooltip{display:none;position:absolute;left:8px;right:8px;top:calc(100% + 4px);padding:6px 8px;border-radius:6px;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-overlay);font-size:11px;line-height:1.4;pointer-events:none;z-index:1}`,
      `.dsh-panel-menu-item[aria-disabled="true"]:hover .dsh-panel-menu-tooltip,.dsh-panel-menu-item[aria-disabled="true"]:focus-visible .dsh-panel-menu-tooltip{display:block}`,
      `@media (prefers-reduced-motion:reduce){.dsh-panel-menu,.dsh-panel-menu-item,.dsh-panel-trigger{transition:none!important}}`,
    ].join('\n')

    /** Small inline icons (16px) for the menu entries. */
    function panelMenuIcon(kind) {
      const common = { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' }
      if (kind === 'preview') {
        return h('svg', common,
          h('rect', { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
          h('path', { d: 'M1.5 5.5h13', stroke: 'currentColor', strokeWidth: 1.3 }),
          h('circle', { cx: 4, cy: 4, r: 0.7, fill: 'currentColor' }))
      }
      if (kind === 'diff') {
        return h('svg', common,
          h('path', { d: 'M4 2.5v11M12 2.5v11', stroke: 'currentColor', strokeWidth: 1.3 }),
          h('path', { d: 'M6.5 5.5h3M6.5 8.5h3M6.5 11.5h3', stroke: 'currentColor', strokeWidth: 1.3, opacity: 0.6 }))
      }
      if (kind === 'terminal') {
        return h('svg', common,
          h('rect', { x: 1.5, y: 2.5, width: 13, height: 11, rx: 2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
          h('path', { d: 'M4 6l2.5 2L4 10M8.5 10.5h3.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }))
      }
      if (kind === 'tasks') {
        return h('svg', common,
          h('path', { d: 'M2.5 4.5l1.5 1.5 2.5-2.5M2.5 9.5l1.5 1.5 2.5-2.5M9 5h4.5M9 10h4.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }))
      }
      return h('svg', common,
        h('rect', { x: 2.5, y: 2.5, width: 11, height: 11, rx: 1.5, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
        h('path', { d: 'M5 6h6M5 8.5h6M5 11h4', stroke: 'currentColor', strokeWidth: 1.2, opacity: 0.7 }))
    }

    /** Lazily reads an optional host service by name (never throws). */
    function readHostService(ctx, name) {
      try {
        return ctx.get(name)
      } catch (error) {
        return undefined
      }
    }

    /**
     * Standalone client plugin: owns the header action registration and the F10
     * header skin. Applied from the assembly next to the other slot plugins, so
     * the registration lives on the plugin's own fiber (same path as the usage
     * card that is known to render).
     */
    const paneHeaderMenuPlugin = {
      inject: ['slots'],
      apply(ctx) {
        const api = {
          // Resolved lazily on render/click: the right-dock services may still be
          // registering while this plugin mounts.
          sidebarRight: () => readHostService(ctx, 'sidebarRight'),
          layout: () => readHostService(ctx, 'layout'),
          hasKind: (kind) => {
            try {
              const registry = readHostService(ctx, 'sidebarRightTabs')
              return typeof registry?.get === 'function' ? registry.get(kind) !== undefined : false
            } catch (error) {
              return false
            }
          },
        }
        window.__dshClaudeThemePaneMenuDebug = { stage: 'mount', kindBrowser: api.hasKind('browser'), kindTerminal: api.hasKind('terminal') }
        for (const probeId of ['m1s2-diag', 'm1s2-test-label', 'm1s2-header-probe']) {
          const probe = document.getElementById(probeId)
          if (probe !== null) probe.remove()
        }
        // Match the working effort-slider pattern: keep the inject disposer,
        // bind session scope via register.inject, and sit between host seats
        // (order 15) so a trailing-seat clip cannot hide us.
        let injectDispose = null
        try {
          injectDispose = ctx.slots.inject('conversation.session.header.actions', () => {
            const registerDispose = ctx.slots.register(
              {
                name: 'conversation.session.header.actions',
                id: 'dsh-theme-panel-menu',
                order: 15,
                label: () => '面板菜单',
                inject: (sessionId) => ({ sessionId }),
              },
              function PanelMenuSeat(props) {
                return h(PanelMenuButton, { api, sessionId: props?.sessionId })
              },
            )
            window.__dshClaudeThemePaneMenuDebug.stage = 'captured'
            window.__dshClaudeThemePaneMenuDebug.registerType = typeof registerDispose
            window.__dshClaudeThemePaneMenuDebug.order = 15
            return registerDispose
          })
          window.__dshClaudeThemePaneMenuDebug.stage = 'injected'
          window.__dshClaudeThemePaneMenuDebug.injectType = typeof injectDispose
        } catch (error) {
          window.__dshClaudeThemePaneMenuDebug.stage = 'error'
          window.__dshClaudeThemePaneMenuDebug.error = String(error && error.message ? error.message : error)
          console.warn('[dsh-claude-code-desktop-theme] pane menu unavailable', error)
        }
        ctx.effect(() => () => {
          try { if (typeof injectDispose === 'function') injectDispose() } catch (error) { /* ignored */ }
        }, 'dsh-claude-code-desktop-theme: pane menu cleanup')
        ctx.effect(() => {
          // F10: long titles truncate in CSS; mirror the full text into title= so
          // the hover tooltip exists without touching the host DOM structure.
          const syncTitle = () => {
            const node = document.querySelector('[class*="_titleRow"] [class*="_crumbCurrent"]')
            if (node === null) return
            const text = String(node.textContent ?? '').trim()
            if (text !== '' && node.getAttribute('title') !== text) node.setAttribute('title', text)
          }
          syncTitle()
          const offTitle = runtimeOnMutation('pane-header-title', syncTitle)
          const style = document.createElement('style')
          style.dataset.plugin = PLUGIN_ID
          style.dataset.pluginCss = PLUGIN_ID + '/pane-header.css'
          style.textContent = PANEL_MENU_CSS
          document.head.appendChild(style)
          return () => {
            style.remove()
            offTitle()
          }
        }, 'dsh-claude-code-desktop-theme: pane header skin')
      },
    }

    /** Header trigger plus the F04 popover. */
    function PanelMenuButton(props) {
      try {
        const debug = window.__dshClaudeThemePaneMenuDebug
        if (debug !== undefined) debug.componentRenders = (debug.componentRenders ?? 0) + 1
      } catch (error) { /* diag */ }
      const api = props.api
      const [open, setOpen] = React.useState(false)
      const [position, setPosition] = React.useState({ left: 0, top: 0 })
      const [activeIndex, setActiveIndex] = React.useState(-1)
      const [servicesReady, setServicesReady] = React.useState(false)
      const rootRef = React.useRef(null)
      const triggerRef = React.useRef(null)
      const itemRefs = React.useRef([])
      React.useEffect(() => {
        // One deferred tick lets the right-dock types finish registering; it is a
        // one-shot timeout owned by React, never a body observer/interval.
        const timer = window.setTimeout(() => setServicesReady(true), 400)
        return () => window.clearTimeout(timer)
      }, [])
      const hasTasks = () => document.querySelector('button[aria-label="自动化任务"]') !== null
      const hasBrowser = api.hasKind('browser')
      const hasTerminal = api.hasKind('terminal')
      const hasTasksPanel = hasTasks() && typeof api.layout()?.selectPanel === 'function'
      const items = [
        {
          id: 'preview',
          label: 'Preview',
          key: '⌘⇧B',
          enabled: hasBrowser && api.sidebarRight() !== undefined,
          reason: '当前 profile 未启用浏览器面板',
          run: () => api.sidebarRight()?.openTab?.('browser'),
        },
        { id: 'diff', label: 'Diff', key: '⌘⇧G', enabled: false, reason: 'M3 接入 Git Diff', run: () => {} },
        {
          id: 'terminal',
          label: 'Terminal',
          key: '⌘J',
          enabled: hasTerminal && api.sidebarRight() !== undefined,
          reason: '宿主未注册终端 Tab',
          run: () => api.sidebarRight()?.openTab?.('terminal'),
        },
        {
          id: 'tasks',
          label: 'Tasks',
          key: '',
          enabled: hasTasksPanel,
          reason: '宿主未提供独立 Tasks 面板（任务在自动化任务页）',
          run: () => api.layout()?.selectPanel?.('schedules'),
        },
        { id: 'plan', label: 'Plan', key: '', enabled: false, reason: 'Plan 需在宿主计划卡片上下文打开', run: () => {} },
      ]
      // The availability values above are read lazily; servicesReady only forces
      // one extra render once the deferred tick has passed.
      void servicesReady
      const enabledIndexes = []
      for (let index = 0; index < items.length; index += 1) if (items[index].enabled) enabledIndexes.push(index)
      const firstEnabled = enabledIndexes.length === 0 ? -1 : enabledIndexes[0]
      const close = React.useCallback((focusBack) => {
        setOpen(false)
        setActiveIndex(-1)
        if (focusBack) triggerRef.current?.focus?.()
      }, [])
      const openMenu = () => {
        const rect = triggerRef.current?.getBoundingClientRect?.()
        if (rect === undefined) return
        const left = Math.max(8, Math.min(rect.right - 220, window.innerWidth - 228))
        setPosition({ left, top: rect.bottom + 6 })
        setOpen(true)
        setActiveIndex(firstEnabled)
      }
      React.useEffect(() => {
        if (open === false) return undefined
        const onPointerDown = (event) => {
          if (rootRef.current?.contains?.(event.target) === true) return
          close(false)
        }
        const onKeyDown = (event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            close(true)
          }
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        const frame = window.requestAnimationFrame(() => itemRefs.current[firstEnabled]?.focus?.())
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown, true)
          window.cancelAnimationFrame(frame)
        }
      }, [open, close, firstEnabled])
      const move = (delta) => {
        if (enabledIndexes.length === 0) return
        const current = enabledIndexes.indexOf(activeIndex)
        const next = (current + delta + enabledIndexes.length) % enabledIndexes.length
        setActiveIndex(enabledIndexes[next])
        itemRefs.current[enabledIndexes[next]]?.focus?.()
      }
      const onMenuKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          move(1)
        } else if (event.key === 'ArrowUp') {
          event.preventDefault()
          move(-1)
        } else if (event.key === 'Home') {
          event.preventDefault()
          setActiveIndex(firstEnabled)
          itemRefs.current[firstEnabled]?.focus?.()
        } else if (event.key === 'End') {
          event.preventDefault()
          const last = enabledIndexes.length === 0 ? -1 : enabledIndexes[enabledIndexes.length - 1]
          setActiveIndex(last)
          itemRefs.current[last]?.focus?.()
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          const item = items[activeIndex]
          if (item !== undefined && item.enabled) {
            item.run()
            close(true)
          }
        } else if (event.key === 'Tab') {
          close(false)
        }
      }
      return h(
        'div',
        { ref: rootRef, className: 'dsh-panel-menu-root', style: { position: 'relative', display: 'inline-flex' } },
        h(
          'button',
          {
            ref: triggerRef,
            type: 'button',
            className: 'dsh-panel-trigger',
            'aria-label': '面板菜单',
            'aria-haspopup': 'menu',
            'aria-expanded': open ? 'true' : 'false',
            'data-dsh-panel-menu-trigger': 'true',
            onClick: () => (open ? close(true) : openMenu()),
            onKeyDown: (event) => {
              if (event.key === 'ArrowDown' && open === false) {
                event.preventDefault()
                openMenu()
              }
            },
          },
          h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' },
            h('rect', { x: 1.5, y: 1.5, width: 5, height: 5, rx: 1.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 }),
            h('rect', { x: 9.5, y: 1.5, width: 5, height: 5, rx: 1.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 }),
            h('rect', { x: 1.5, y: 9.5, width: 5, height: 5, rx: 1.2, fill: 'none', stroke: 'currentColor', strokeWidth: 1.2 }),
            h('path', { d: 'M12 9.5v5M9.5 12h5', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }),
          ),
        ),
        open
          ? h(
              'div',
              {
                className: 'dsh-panel-menu',
                role: 'menu',
                'aria-label': '面板菜单',
                tabIndex: -1,
                style: { left: position.left + 'px', top: position.top + 'px' },
                onKeyDown: onMenuKeyDown,
                'data-dsh-panel-menu': 'true',
              },
              items.map((item, index) =>
                h(
                  React.Fragment,
                  { key: item.id },
                  item.id === 'terminal' ? h('div', { className: 'dsh-panel-menu-sep', role: 'separator' }) : null,
                  h(
                    'button',
                    {
                      ref: (node) => {
                        itemRefs.current[index] = node
                      },
                      type: 'button',
                      role: 'menuitem',
                      className: 'dsh-panel-menu-item',
                      'data-menu-item': item.id,
                      'aria-disabled': item.enabled ? 'false' : 'true',
                      tabIndex: -1,
                      onClick: () => {
                        if (item.enabled) {
                          item.run()
                          close(true)
                        }
                      },
                    },
                    h('span', { className: 'dsh-panel-menu-icon' }, panelMenuIcon(item.id)),
                    h('span', { className: 'dsh-panel-menu-label' }, item.label),
                    item.key === '' ? null : h('span', { className: 'dsh-panel-menu-key' }, item.key),
                    item.enabled ? null : h('span', { className: 'dsh-panel-menu-tooltip', role: 'tooltip' }, item.reason),
                  ),
                ),
              ),
            )
          : null,
      )
    }