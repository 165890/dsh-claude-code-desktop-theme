// ── Shell sidebar (M1-S1) ───────────────────────────────────────────────────
    // Skin-only layer for the host-owned session sidebar. It never changes the
    // host column width (264–420, default 280), ordering, grouping or slots: it
    // only restyles what ui-workspace already renders, using the --dsw-* token
    // layer so light/dark follow the active theme.
    //
    // Live inventory (M1-S1 probe, 2026-10-27, expanded 280px):
    //   div._root._quietBars 280
    //     div._logoRow 40 → button._brand._wide 24 (span._brandMark 18 / span._brandName)
    //     button[aria-label=收起侧边栏] > svg._panelIcon
    //     button._newSession 32 > span._newSessionLabelMask > span._newSessionLabel/_Content/_Shortcut
    //     nav._panelList 112 > button._panelRow 36 > span._panelGlyph + span._panelTitle
    //     div[data-slot=sidebar.workspaces] > div._root
    //       div._sectionHeader 36 > div._headerActions 28 + span._sectionLabel + button._searchButton 28
    //       div._listArea 464 > div._list[role=tree] > div._groupSection
    //         div._projectRow 34 (workspace) > svg._arrow + span._title + span._rowActions
    //         div._sessionRow 32 (aria-selected) > spinner / [data-slot=sidebar.session.row.leading]
    //           + span._title + span._rowActions + [data-slot=sidebar.workspaces.session.row.action]
    //           + button[aria-label=归档会话] + button[aria-label=置顶会话]
    //       div._footerActions (0 高) + div._settingsArea 52 > [data-slot=sidebar.settings]
    //   collapsed: div._frame[data-sidebar-collapsed=true]; root._collapsed._railIn* width 0
    // Pinned is host-native: pinned sessions lead ordinary rows; there is no
    // separate Pinned heading and no data-pinned marker, so this layer styles the
    // rows uniformly and never clones or fakes a pin section.
    const SIDEBAR_CSS = [
      // ── brand row ──────────────────────────────────────────────────────────
      `[class*="_logoRow"]{height:36px!important;min-height:36px!important;padding:0 10px!important;box-sizing:border-box!important;align-items:center!important;gap:6px!important}`,
      `button[class*="_brand"]{height:28px!important;min-width:0!important;padding:0 4px!important;border-radius:6px!important;gap:6px!important;color:var(--dsw-alias-label-primary)!important;background:transparent!important}`,
      `button[class*="_brand"]:hover{background:var(--dsw-alias-interactive-bg-hover)!important}`,
      `[class*="_brandMark"]{width:18px!important;height:18px!important;flex:none!important}`,
      `[class*="_brandName"]{font-family:var(--dsh-font-family-text)!important;font-size:13px!important;font-weight:600!important;letter-spacing:.01em!important;color:var(--dsw-alias-label-primary)!important;white-space:nowrap!important}`,
      // ── collapse toggle + new session ──────────────────────────────────────
      `button[aria-label="收起侧边栏"],button[aria-label="打开侧边栏"]{width:24px!important;height:24px!important;min-width:24px!important;border-radius:6px!important;color:var(--dsw-alias-label-tertiary)!important}`,
      `button[aria-label="收起侧边栏"]:hover,button[aria-label="打开侧边栏"]:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `[class*="_panelIcon"]{width:16px!important;height:16px!important;color:inherit!important}`,
      `button[class*="_newSession"]{height:32px!important;min-height:32px!important;margin:2px 10px 6px!important;padding:0 10px!important;border:0!important;border-radius:6px!important;box-shadow:none!important;gap:8px!important;background:${SHELL.newSessionFill}!important}`,
      `button[class*="_newSession"]:hover{background:${SHELL.newSessionHover}!important}`,
      `[class*="_newSessionLabelMask"]{height:22px!important;align-items:center!important}`,
      `[class*="_newSessionLabel"]{font-family:var(--dsh-font-family-text)!important;font-size:12.5px!important;font-weight:500!important;color:var(--dsw-alias-label-primary)!important}`,
      `[class*="_newSessionShortcut"]{font-family:var(--dsh-font-family-text)!important;font-size:10.5px!important;color:var(--dsw-alias-label-caption)!important;opacity:.9!important}`,
      // ── nav rows (插件 / 自动化任务 / 更多) ─────────────────────────────────
      `nav[class*="_panelList"]{padding:4px 8px!important;box-sizing:border-box!important;display:flex!important;flex-direction:column!important;gap:2px!important}`,
      `button[class*="_panelRow"]{height:28px!important;min-height:28px!important;padding:0 8px!important;border-radius:6px!important;gap:8px!important;color:var(--dsw-alias-label-secondary)!important;background:transparent!important;position:relative!important}`,
      `button[class*="_panelRow"]:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `button[class*="_panelRow"][aria-expanded="true"]{background:var(--dsw-specific-sidebar-nav-item-active)!important;color:var(--dsw-alias-label-primary)!important}`,
      `button[class*="_panelRow"][aria-expanded="true"]::before{content:""!important;position:absolute!important;left:0!important;top:50%!important;transform:translateY(-50%)!important;width:2px!important;height:14px!important;border-radius:1px!important;background:${SHELL.navActiveRail}!important;pointer-events:none!important}`,
      `[class*="_panelGlyph"]{width:16px!important;height:16px!important;color:inherit!important;opacity:.9!important;flex:none!important}`,
      `[class*="_panelTitle"]{font-family:var(--dsh-font-family-text)!important;font-size:12.5px!important;font-weight:500!important;color:inherit!important}`,
      // ── workspace section header / search ─────────────────────────────────
      `[data-slot="sidebar.workspaces"]{padding:0 8px!important;box-sizing:border-box!important}`,
      `div[class*="_sectionHeader"]{height:28px!important;min-height:28px!important;padding:0 2px!important;gap:2px!important;align-items:center!important}`,
      `span[class*="_sectionLabel"]{font-family:var(--dsh-font-family-text)!important;font-size:10.5px!important;font-weight:600!important;letter-spacing:.08em!important;color:var(--dsw-alias-label-caption)!important}`,
      `div[class*="_headerActions"]{height:24px!important;gap:2px!important;align-items:center!important}`,
      `button[class*="_searchButton"]{width:24px!important;height:24px!important;min-width:24px!important;border-radius:5px!important;color:var(--dsw-alias-label-tertiary)!important}`,
      `button[class*="_searchButton"]:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `div[class*="_searchSlot"],div[class*="_search"]{height:24px!important}`,
      `input[class*="_searchInput"]{height:26px!important;border-radius:6px!important;border:1px solid var(--dsw-alias-border-l2)!important;background:var(--dsw-alias-bg-layer-1)!important;color:var(--dsw-alias-label-primary)!important;font-family:var(--dsh-font-family-text)!important;font-size:12px!important;padding:0 8px!important}`,
      `input[class*="_searchInput"]:focus{outline:none!important;border-color:${ACCENT}!important;box-shadow:0 0 0 2px rgba(218,119,86,.22)!important}`,
      // ── list, workspace rows, session rows ────────────────────────────────
      `div[class*="_listArea"]{padding:2px 0 4px!important}`,
      `div[class*="_list"][role="tree"]{padding:0!important}`,
      `div[class*="_projectRow"]{height:26px!important;min-height:26px!important;margin:1px 0!important;padding:0 6px!important;border-radius:6px!important;gap:6px!important;color:var(--dsw-alias-label-primary)!important}`,
      `div[class*="_projectRow"]:hover{background:var(--dsw-alias-interactive-bg-hover)!important}`,
      `div[class*="_projectRow"] [class*="_title"]{font-family:var(--dsh-font-family-text)!important;font-size:12.5px!important;font-weight:600!important;color:inherit!important}`,
      `div[class*="_projectRow"] svg[class*="_arrow"]{width:12px!important;height:12px!important;color:var(--dsw-alias-label-tertiary)!important}`,
      `div[class*="_sessionRow"]{height:30px!important;min-height:30px!important;margin:1px 0!important;padding:0 6px!important;border-radius:6px!important;gap:6px!important;position:relative!important}`,
      `div[class*="_sessionRow"]:hover{background:var(--dsw-alias-interactive-bg-hover)!important}`,
      `div[class*="_sessionRow"][aria-selected="true"]{background:${SHELL.navActiveFill}!important}`,
      `div[class*="_sessionRow"][aria-selected="true"]:hover{background:${SHELL.navActiveFill}!important}`,
      `div[class*="_sessionRow"][aria-selected="true"]::before{content:""!important;position:absolute!important;left:0!important;top:50%!important;transform:translateY(-50%)!important;width:2px!important;height:18px!important;border-radius:1px!important;background:${SHELL.navActiveRail}!important;pointer-events:none!important;z-index:2!important}`,
      `div[class*="_sessionRow"] [class*="_title"]{font-family:var(--dsh-font-family-text)!important;font-size:12.5px!important;line-height:1.3!important;color:var(--dsw-alias-label-secondary)!important}`,
      `div[class*="_sessionRow"][aria-selected="true"] [class*="_title"]{color:var(--dsw-alias-label-primary)!important;font-weight:600!important}`,
      `[class*="_rowActions"]{margin-left:auto!important;gap:0!important;align-items:center!important;opacity:0!important;transition:opacity 120ms ease!important}`,
      `[class*="_sessionRow"]:hover [class*="_rowActions"],[class*="_projectRow"]:hover [class*="_rowActions"],[class*="_rowActions"]:focus-within{opacity:1!important}`,
      `[class*="_rowActions"] button{width:18px!important;height:18px!important;min-width:18px!important;border-radius:4px!important;color:var(--dsw-alias-label-tertiary)!important}`,
      `[class*="_rowActions"] button:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `[class*="_rowActions"] svg{width:12px!important;height:12px!important}`,
      `[data-slot="sidebar.workspaces.session.row.action"]{display:inline-flex!important;gap:0!important;align-items:center!important}`,
      // ── empty / loading / error (host-rendered states) ────────────────────
      `[class*="_listArea"] [class*="_placeholder"],[class*="_listArea"] [class*="_empty"],[class*="_listArea"] [class*="_emptyState"]{padding:12px 8px!important;color:var(--dsw-alias-label-caption)!important;font-family:var(--dsh-font-family-text)!important;font-size:11.5px!important;line-height:1.5!important;text-align:center!important}`,
      `[class*="_skeleton"]{background:var(--dsw-alias-bg-skeleton)!important;border-radius:4px!important}`,
      `[class*="_listArea"] [class*="_error"]{color:var(--dsw-alias-state-error-primary)!important;font-size:11.5px!important}`,
      // ── footer / settings / account row ───────────────────────────────────
      `div[class*="_footerActions"]{padding:2px 8px!important;gap:2px!important}`,
      `div[class*="_footerActions"] button{height:24px!important;border-radius:6px!important;color:var(--dsw-alias-label-tertiary)!important}`,
      `div[class*="_footerActions"] button:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `div[class*="_settingsArea"]{height:44px!important;min-height:44px!important;padding:6px 8px!important;box-sizing:border-box!important;border-top:1px solid var(--dsw-alias-border-l1)!important}`,
      `div[data-slot="sidebar.settings"]{height:32px!important;min-height:32px!important;border-radius:8px!important}`,
      `div[data-slot="sidebar.settings"] button,[data-slot="settings.launcher"] button{height:32px!important;padding:0 6px!important;border-radius:8px!important;gap:8px!important;background:transparent!important;color:var(--dsw-alias-label-primary)!important}`,
      `div[data-slot="sidebar.settings"] button:hover,[data-slot="settings.launcher"] button:hover{background:var(--dsw-alias-interactive-bg-hover)!important}`,
      `.dsh-sidebar-footer-balance{font-family:var(--dsh-font-family-text)!important;font-size:11px!important;line-height:16px!important;color:var(--dsw-alias-label-caption)!important}`,
      `[data-sidebar-collapsed="true"] .dsh-sidebar-footer-balance{display:none!important}`,
      // ── collapsed rail (host width untouched: 56) ─────────────────────────
      `[data-sidebar-collapsed="true"] [class*="_logoRow"]{height:36px!important;min-height:36px!important;padding:0!important;justify-content:center!important}`,
      `[data-sidebar-collapsed="true"] button[class*="_brand"]{justify-content:center!important;padding:0!important}`,
      `[data-sidebar-collapsed="true"] [class*="_brandName"],[data-sidebar-collapsed="true"] [class*="_newSessionLabelMask"],[data-sidebar-collapsed="true"] [class*="_panelTitle"],[data-sidebar-collapsed="true"] [class*="_newSessionShortcut"]{display:none!important}`,
      `[data-sidebar-collapsed="true"] nav[class*="_panelList"],[data-sidebar-collapsed="true"] [data-slot="sidebar.workspaces"],[data-sidebar-collapsed="true"] div[class*="_settingsArea"],[data-sidebar-collapsed="true"] div[class*="_footerActions"]{display:none!important}`,
      `[data-sidebar-collapsed="true"] button[class*="_newSession"]{width:32px!important;min-width:32px!important;height:32px!important;margin:4px auto!important;padding:0!important;justify-content:center!important}`,
      `[data-sidebar-collapsed="true"] button[aria-label="打开侧边栏"]{width:28px!important;height:28px!important;margin:2px auto!important;border-radius:7px!important;color:var(--dsw-alias-label-secondary)!important}`,
      `[data-sidebar-collapsed="true"] button[aria-label="打开侧边栏"]:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      // ── dark pairs (layout tokens already follow the theme) ───────────────
      `${DARK} button[class*="_newSession"]{background:var(--dsw-alias-bg-layer-2)!important}`,
      `${DARK} button[class*="_newSession"]:hover{background:var(--dsw-alias-bg-layer-3)!important}`,
      `${DARK} div[class*="_sessionRow"][aria-selected="true"]{background:var(--dsw-specific-sidebar-nav-item-active)!important}`,
      `${DARK} div[class*="_sessionRow"][aria-selected="true"] [class*="_title"]{color:var(--dsw-alias-label-primary)!important}`,
      // ── reduced motion ────────────────────────────────────────────────────
      `@media (prefers-reduced-motion:reduce){[class*="_rowActions"]{transition:none!important}[class*="_sessionRow"] [class*="_title"]{transition:none!important}}`,
    ].join('\n')

    /** Live sidebar facts for diagnostics/tests (no writes, no layout changes). */
    function sidebarDebugState() {
      const frame = document.querySelector('[class*="_frame"]')
      const root = document.querySelector('div[class*="_quietBars"]')
      const rows = [...document.querySelectorAll('[role="treeitem"][data-row-key^="session:"]')]
      return {
        columnWidth: root === null ? null : Math.round(root.getBoundingClientRect().width),
        collapsed: frame === null ? null : frame.getAttribute('data-sidebar-collapsed'),
        sessionRows: rows.length,
        selectedRow: rows.findIndex((row) => row.getAttribute('aria-selected') === 'true'),
        workspaceRows: document.querySelectorAll('div[class*="_projectRow"]').length,
        rowHeight: rows.length === 0 ? null : Math.round(rows[0].getBoundingClientRect().height),
        navRows: document.querySelectorAll('button[class*="_panelRow"]').length,
        pinnedMarkers: document.querySelectorAll('[class*="_pin"],[data-pinned],[aria-label*="置顶"]').length,
        hostPinnedSupport: 'ui-workspace: pin action in session menu/row action; pinned lead rows; no separate heading',
      }
    }