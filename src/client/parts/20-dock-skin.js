// ── Right dock skin (M1-S3) ─────────────────────────────────────────────────
    // Skin-only layer for the host-owned right sidebar dock (ui-sidebar-right +
    // ui-dockkit). It never calls split / float / dock, never writes layout
    // state, and never replaces tab bodies. Drag, split, resize and float stay
    // on the host's own gestures. Stable hooks only: data-dockkit-* and
    // data-sidebar-right-* (docs/HOST-PROBE.md §2.9). CSS-module hashes are not
    // used. Geometry the host owns is left alone: panel width (inline), the
    // 0px split divider, the slide transform on [data-dockkit-host="dock"], and
    // float left/top/width/height.
    //
    // Live contract (ui-dockkit DockLayout, as mounted by SidebarRight):
    //   div[data-sidebar-right-session][data-sidebar-right-panel=push|fullscreen]
    //     div[data-dockkit-surface]
    //       div[data-dockkit-split?]
    //         div[data-dockkit-host=dock] > section[data-dockkit-pane]
    //           div[data-dockkit-strip] > [data-dockkit-tab] + add/split/chrome
    //         div[data-dockkit-divider]          (only while split)
    //         div[data-dockkit-empty]            (pane with no tabs)
    //         section[data-dockkit-float]        (fixed overlay; host positions it)
    const DOCK_CSS = [
      // ── panel ground (width / slide stay on the host) ─────────────────────
      `[data-sidebar-right-session]{background:var(--dsw-alias-bg-base)!important;color:var(--dsw-alias-label-primary)!important;font-family:var(--dsh-font-family-text)!important}`,
      `[data-dockkit-surface]{background:var(--dsw-alias-bg-base)!important}`,
      `[data-dockkit-host="dock"]>[data-dockkit-pane],[data-dockkit-empty]{background:var(--dsw-alias-bg-layer-1)!important}`,
      `[data-dockkit-pane-active]{box-shadow:inset 2px 0 0 var(--dsw-alias-brand-primary)!important}`,
      // ── tab strip: keep the host 10px+28px hit row; restyle the chips ──────
      `[data-dockkit-strip]{font-family:var(--dsh-font-family-text)!important;color:var(--dsw-alias-label-secondary)!important}`,
      `[data-dockkit-tab]{min-width:96px!important;max-width:180px!important;height:28px!important;border-radius:8px!important;font-family:var(--dsh-font-family-text)!important;font-size:12.5px!important;font-weight:500!important;color:var(--dsw-alias-label-secondary)!important;background:transparent!important}`,
      `[data-dockkit-tab] [data-sidebar-right-tab]{font-family:var(--dsh-font-family-text)!important;font-size:12.5px!important;color:inherit!important}`,
      `[data-dockkit-strip] [data-dockkit-tab]:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `[data-dockkit-strip] [data-dockkit-tab][aria-selected="true"]{background:var(--dsw-specific-sidebar-nav-item-active)!important;color:var(--dsw-alias-label-primary)!important;font-weight:600!important;box-shadow:inset 0 -2px 0 var(--dsw-alias-brand-primary)!important}`,
      `[data-dockkit-strip] [data-dockkit-tab][data-dockkit-tab-quiet],[data-dockkit-strip] [data-dockkit-tab][data-dockkit-tab-quiet]:hover{background:transparent!important;box-shadow:none!important;color:var(--dsw-alias-label-primary)!important;font-weight:600!important;cursor:default!important}`,
      `[data-dockkit-caret]::before{width:2px!important;height:18px!important;border-radius:1px!important;background:var(--dsw-alias-brand-primary)!important}`,
      // ── strip controls (add / split / fullscreen / collapse) ───────────────
      `[data-dockkit-add-tab],[data-dockkit-split-button],[data-dockkit-tab-close],[data-dockkit-strip-chrome] button,[data-sidebar-right-mode],[data-sidebar-right-toggle],[data-sidebar-right-expand]{border-radius:6px!important;color:var(--dsw-alias-label-secondary)!important}`,
      `[data-dockkit-add-tab]:hover,[data-dockkit-split-button]:hover:not(:disabled),[data-dockkit-tab-close]:hover,[data-dockkit-strip-chrome] button:hover,[data-sidebar-right-mode]:hover,[data-sidebar-right-toggle]:hover,[data-sidebar-right-expand]:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `[data-dockkit-split-button]:disabled,[data-dockkit-split-blocked]{opacity:.4!important}`,
      `[data-dockkit-tab]:focus-visible,[data-dockkit-strip] button:focus-visible,[data-dockkit-float] button:focus-visible,[data-sidebar-right-expand]:focus-visible,[data-dockkit-tab-menu] [role="menuitem"]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary)!important;outline-offset:-1px!important}`,
      // ── split hairline: color only; the 0px divider and its 8px hit stay ──
      `[data-dockkit-divider]::before{background:var(--dsw-alias-border-l2)!important}`,
      `@media (hover:hover){[data-dockkit-divider]:hover::after{opacity:1!important;background:linear-gradient(to bottom,transparent,var(--dsw-alias-brand-primary) 50%,transparent) center / 1px 100% no-repeat!important}}`,
      // ── drop hints (host paints the zones; we only recolor the cards) ─────
      `[data-dockkit-dock-scrim]{background:color-mix(in srgb,var(--dsw-alias-bg-base) 72%,transparent)!important}`,
      `[data-dockkit-dock-zone]>*{border-radius:10px!important;border:1.5px dashed var(--dsw-alias-border-l2)!important;color:var(--dsw-alias-label-tertiary)!important;font-family:var(--dsh-font-family-text)!important}`,
      `[data-dockkit-dock-zone][data-dockkit-drop-active]>*{border:2px dashed var(--dsw-alias-brand-primary)!important;background:var(--dsw-alias-interactive-bg-hover-accent)!important;color:var(--dsw-alias-label-primary)!important}`,
      // ── empty pane: host copy, themed type only ───────────────────────────
      `[data-dockkit-empty] p{margin:0!important;padding:16px!important;font-family:var(--dsh-font-family-text)!important;font-size:12.5px!important;line-height:1.5!important;color:var(--dsw-alias-label-caption)!important;text-align:center!important}`,
      `[data-sidebar-right-unavailable]{font-family:var(--dsh-font-family-text)!important;color:var(--dsw-alias-label-tertiary)!important;font-size:12.5px!important}`,
      `[data-sidebar-right-guide],[data-sidebar-right-guide-entry]{font-family:var(--dsh-font-family-text)!important}`,
      // ── floating panel: do not touch left/top/width/height/overflow ───────
      `[data-dockkit-float]{--dsw-radius-panel:10px;background:var(--dsw-alias-bg-layer-1)!important;color:var(--dsw-alias-label-primary)!important;font-family:var(--dsh-font-family-text)!important;border-radius:10px!important;box-shadow:0 0 0 .5px var(--dsw-alias-border-l2),0 24px 64px rgba(29,27,22,.18)!important}`,
      `${DARK} [data-dockkit-float]{box-shadow:0 0 0 .5px var(--dsw-alias-border-l2),0 24px 64px rgba(0,0,0,.45)!important}`,
      `[data-dockkit-float-grip]{font-family:var(--dsh-font-family-text)!important}`,
      `[data-dockkit-float-title]{font-family:var(--dsh-font-family-text)!important;font-size:12.5px!important;font-weight:600!important;color:var(--dsw-alias-label-primary)!important;border-radius:8px!important}`,
      `[data-dockkit-float-active] [data-dockkit-float-grip]{box-shadow:inset 0 -2px 0 var(--dsw-alias-brand-primary)!important}`,
      `[data-dockkit-float-dock],[data-dockkit-float-close]{border-radius:6px!important;color:var(--dsw-alias-label-secondary)!important}`,
      `[data-dockkit-float-dock]:hover,[data-dockkit-float-close]:hover{background:var(--dsw-alias-interactive-bg-hover)!important;color:var(--dsw-alias-label-primary)!important}`,
      `[data-dockkit-float-resize]::after{border-color:var(--dsw-alias-brand-primary)!important}`,
      // ── tab context menu ──────────────────────────────────────────────────
      `[data-dockkit-tab-menu]{font-family:var(--dsh-font-family-text)!important;background:var(--dsw-alias-bg-overlay)!important;border:1px solid var(--dsw-alias-border-l2)!important;border-radius:10px!important;box-shadow:0 18px 44px rgba(29,27,22,.18),0 2px 8px rgba(29,27,22,.08)!important}`,
      `${DARK} [data-dockkit-tab-menu]{box-shadow:0 18px 44px rgba(0,0,0,.5),0 2px 8px rgba(0,0,0,.3)!important}`,
      `[data-dockkit-tab-menu] [role="menuitem"]{border-radius:7px!important;font-family:inherit!important;font-size:12.5px!important;color:var(--dsw-alias-label-primary)!important}`,
      `[data-dockkit-tab-menu] [role="menuitem"]:hover{background:var(--dsw-alias-interactive-bg-hover)!important}`,
      `@media (prefers-reduced-motion:reduce){[data-dockkit-tab],[data-dockkit-divider]::after,[data-dockkit-float-resize]::after,[data-dockkit-dock-scrim]{transition:none!important;animation:none!important}}`,
    ].join('\n')

    /** Live dock facts for diagnostics (no writes, no layout changes). */
    function dockDebugState() {
      const panel = document.querySelector('[data-sidebar-right-session]')
      const rect = panel === null ? null : panel.getBoundingClientRect()
      return {
        present: panel !== null,
        open: panel === null ? null : panel.hasAttribute('data-sidebar-right-open'),
        panel: panel === null ? null : panel.getAttribute('data-sidebar-right-panel'),
        columnWidth: rect === null ? null : Math.round(rect.width),
        tabs: document.querySelectorAll('[data-dockkit-tab]').length,
        panes: document.querySelectorAll('[data-dockkit-pane]').length,
        floats: document.querySelectorAll('[data-dockkit-float]').length,
        split: document.querySelector('[data-dockkit-split]') !== null,
        empty: document.querySelectorAll('[data-dockkit-empty]').length,
        dropActive: document.querySelector('[data-dockkit-drop-active]') !== null,
        hostBehavior: 'ui-dockkit owns drag/split/float; this layer only restyles chrome',
      }
    }
