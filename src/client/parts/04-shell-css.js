    const SHELL_CSS = [
      HERO_SERIF_FACE,
      UI_SERIF_FACE,
      // Sidebar column fill.
      `${LIGHT} ._2H3hWW_root{background:${SHELL.sidebarFill}}`,
      // New Session: every stroke removed, 32px tall, 6px corners.
      `${LIGHT} ._2H3hWW_root:not(._2H3hWW_collapsed) ._2H3hWW_newSession{border:0!important;background:${SHELL.newSessionFill}!important;height:32px;min-height:32px;padding:0 12px;border-radius:6px}`,
      `${LIGHT} ._2H3hWW_root:not(._2H3hWW_collapsed) ._2H3hWW_newSession:hover{background:${SHELL.newSessionHover}!important}`,
      // Selected session row: cream fill plus a forced 2px terracotta rail on
      // the row's own left edge. A pseudo-element keeps it glued to the item
      // through scrolling, resizing and re-renders, with no runtime geometry.
      `${LIGHT} [class*="_sessionRow"][class*="_selected"]{background:${SHELL.navActiveFill}!important}`,
      `${LIGHT} [class*="_sessionRow"][class*="_selected"]:hover{background:${SHELL.navActiveFill}!important}`,
      `[class*="_sessionRow"][class*="_selected"]{position:relative!important}`,
      `[class*="_sessionRow"][class*="_selected"]::before{content:""!important;position:absolute!important;left:0!important;top:50%!important;transform:translateY(-50%)!important;width:2px!important;height:18px!important;border-radius:1px;background:${SHELL.navActiveRail}!important;pointer-events:none!important;z-index:2}`,
      // Status semantics (real layer): the dot is a CSS pseudo-element on the
      // host's own leading slot, driven by `data-dsh-status`. A pseudo-element
      // is computed style, not a React child, so a sidebar re-render can never
      // delete it -- the dot cannot blink out of existence.
      `[class*="_sessionRow"][data-dsh-status] [class*="_slot"]{display:inline-flex!important;flex:none;align-items:center!important;justify-content:center!important}`,
      `[class*="_sessionRow"][data-dsh-status]:not([data-dsh-status="busy"]) [class*="_slot"]::before{content:""!important;display:inline-block!important;width:6px!important;height:6px!important;min-width:6px!important;min-height:6px!important;box-sizing:border-box!important;border-radius:50%!important;background:#7f7869!important;opacity:.5!important;flex:none!important;pointer-events:none!important}`,
      `[class*="_sessionRow"][data-dsh-status="waiting"] [class*="_slot"]::before{background:#da7756!important;opacity:1!important}`,
      // Busy rows use the host's native rotating arc spinner (14px): keep it,
      // recolour it to the theme accent, and hide the pseudo dot instead.
      `[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]::before{display:none!important}`,
      `[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]>svg[data-state="ongoing"]{display:inline-block!important;flex:none!important;width:14px!important;height:14px!important;color:#da7756!important}`,
      `[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]>svg[data-state="ongoing"] circle{stroke:#da7756!important;stroke-width:2px!important}`,
      `[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]>svg[data-state="ongoing"] [class*="Track"]{stroke:rgba(218,119,86,.25)!important}`,
      `@media (prefers-reduced-motion:reduce){[class*="_sessionRow"][data-dsh-status="busy"] [class*="_slot"]>svg[data-state="ongoing"] *{animation:none!important}}`,
      // Hero: force the serif display face, a lighter and slightly smaller
      // headline, and the ink color (all !important so host sheets cannot win).
      `${LIGHT} [class*="_composerHero"] [class*="_headline"],${LIGHT} [class*="_composerHero"] [class*="_titleGroup"]>span:not([class]){color:${SHELL.heroInk}!important;font-family:${UI_FONT}!important;font-size:22px!important;font-weight:400!important;line-height:30px}`,
      `body[data-ds-dark-theme] [class*="_composerHero"] [class*="_headline"],body[data-ds-dark-theme] [class*="_composerHero"] [class*="_titleGroup"]>span:not([class]){font-family:${UI_FONT}!important;font-size:22px!important;font-weight:400!important;line-height:30px}`,
      `${LIGHT} [class*="_fish"]:not([class*="_fishHitbox"]){color:${SHELL.heroInk}!important}`,
      `${LIGHT} [class*="_previewBadge"]{background:${SHELL.previewFill}!important;border-color:transparent!important;color:${SHELL.previewInk}!important}`,
      // ── Hero dashboard layout ─────────────────────────────────────────────
      // Home layout: the usage card is pinned to the top-left of the chat area
      // (aligned with the composer card), and the composer itself is pushed to
      // the bottom of the window. Both positions are measured at runtime into
      // CSS vars, so they follow the host's sidebar/header geometry instead of
      // guessing. The title block is removed; the workspace row keeps the host
      // order right above the composer.
      `[class*="_composerHero"] [class*="_root"]:has([class*="_headline"]){display:none!important}`,
      `[class*="_composerHero"] .duo-card{position:fixed!important;left:var(--dsh-hero-left,280px)!important;top:var(--dsh-hero-top,72px)!important;width:var(--dsh-hero-width,720px)!important;max-width:var(--dsh-hero-width,720px)!important;max-height:calc(100vh - var(--dsh-hero-top,72px) - 340px)!important;overflow:auto!important;margin:0!important;z-index:6!important}`,
      `[class*="_composerHero"] .duo-card::-webkit-scrollbar{width:6px}`,
      `[class*="_composerHero"] .duo-card::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:999px}`,
      `html[data-dsh-hero="false"] .duo-card{display:none!important}`,
      // Usage card: favourite-model tile shows the full model name (wraps instead of ellipsis).
      `.duo-grid>.duo-tile:last-child .duo-tile-value{white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:break-word!important;word-break:break-word!important;font-size:12px!important;line-height:16px!important}`,
      // Usage card model tile: a smaller dedicated font keeps long real model names on two lines.
      `.duo-grid>.duo-tile:last-child .duo-tile-value--model{font-size:12px!important;line-height:16px!important}`,
      `.duo-model-name{white-space:normal!important;overflow:visible!important;text-overflow:clip!important}`,
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"]{position:relative!important;margin:0 0 8px!important;padding:0 16px!important;background:transparent!important;border:0!important;box-shadow:none!important;display:flex!important;align-items:center!important;gap:4px!important;min-height:26px!important;z-index:2}`,
      // Lightweight pill menus above the composer: transparent, gray text,
      // darker on hover; the host's background blocks are removed.
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_workspace"]:not([class*="_workspaceRow"]):not([class*="_workspaceLabel"]),[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_seat"]:not([class*="_seatIcon"]):not([class*="_seatLabel"]){background:transparent!important;border:0!important;box-shadow:none!important;color:#87867F!important;font-size:13px!important;font-weight:400!important;line-height:20px!important;padding:0 8px!important;border-radius:999px!important;min-height:26px!important;gap:4px!important}`,
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_workspace"]:not([class*="_workspaceRow"]):not([class*="_workspaceLabel"]):hover,[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_seat"]:not([class*="_seatIcon"]):not([class*="_seatLabel"]):hover,[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_workspace"]:not([class*="_workspaceRow"]):not([class*="_workspaceLabel"])[aria-expanded="true"],[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_seat"]:not([class*="_seatIcon"]):not([class*="_seatLabel"])[aria-expanded="true"]{background:transparent!important;color:#1d1b16!important}`,
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_folder"],[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_chevron"],[class*="_composerHero"] [class*="_heroWorkspaceRow"] [class*="_seatLabel"]{color:inherit!important}`,
      `[class*="_composerHero"] [class*="_heroWorkspaceRow"] svg{color:inherit!important}`,
      // Composer: soft warm fill, hairline stroke, one very light float shadow.
      `${LIGHT} [class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]){background:${SHELL.composerFill}!important;border:1px solid ${SHELL.composerBorder}!important;box-shadow:${SHELL.composerShadow}!important}`,
      // Composer controls: no fills, muted glyphs.
      `${LIGHT} [class*="_root"]:has([data-lexical-editor="true"]) [class*="_add"]{background:transparent!important;color:${SHELL.controlInk}}`,
      `${LIGHT} [class*="_root"]:has([data-lexical-editor="true"]) [class*="_add"]:hover:not(:disabled){background:${SHELL.controlHover}!important}`,
      `${LIGHT} [class*="_triggerAnchor"] [class*="_trigger"]{background:transparent!important;color:${SHELL.controlInk}}`,
      `${LIGHT} [class*="_triggerAnchor"] [class*="_trigger"]:hover:not(:disabled){background:${SHELL.controlHover}!important}`,
      `${LIGHT} [class*="_trigger"]:has([class*="_triggerEffort"]),${LIGHT} [class*="_triggerEffort"],${LIGHT} [class*="_trigger"]:has([class*="_triggerEffort"]) [class*="_chevron"]{color:${SHELL.controlInk}}`,
      // Composer cleanup: keep the toolbar row as two clean ends. The 1017
      // model-version tag (from the model-label plugin), the voice trigger and
      // the old bottom stats tray are hidden; the HUD tray below the card
      // replaces the old bar.
      `[class*="_trigger"]:has([class*="_triggerEffort"]) span[class*="_tag_"]{display:none!important}`,
      // The official experimental Voice Input bundle mounts its microphone in
      // the activity slot. That slot is also where the old activity row used to
      // live, so only hide the legacy dock stats — never the whole activity row.
      `[class*="_triggerAnchor"]{flex:none;display:inline-flex;align-items:center}`,
      `html[data-dsh-realtime-voice="1"] [class*="_triggerAnchor"]{display:none!important}`,
      // Live voice button: fixed 30×30 footprint so recording can never change the
      // composer geometry. The recording state is painted by a rAF loop that only
      // writes transform/opacity (bars scaleY + expanding ring), never width,
      // height, margin or box-shadow.
      `.dsh-live-voice-wrap{position:relative;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;flex:none;order:999;contain:layout}`,
      `.dsh-live-voice{position:relative;width:30px;height:30px;padding:0;border:0;border-radius:999px;background:transparent;color:#7f7869;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;overflow:visible;transition:background-color .2s ease,color .2s ease}`,
      `.dsh-live-voice:hover{background:rgba(218,119,86,.10);color:#da7756}`,
      `body[data-ds-dark-theme] .dsh-live-voice{color:#b9b0a2}`,
      `.dsh-live-voice[data-recording="true"]{background:#da7756;color:#fff8f3}`,
      `.dsh-live-voice-ring{position:absolute;left:0;top:0;width:30px;height:30px;border-radius:999px;border:1.5px solid rgba(218,119,86,.55);opacity:0;pointer-events:none;will-change:transform,opacity}`,
      `.dsh-live-voice-icon{position:relative;z-index:1;display:inline-flex;align-items:center;justify-content:center;transition:opacity .15s ease}`,
      `.dsh-live-voice-bars{position:absolute;left:50%;top:50%;display:inline-flex;align-items:center;justify-content:center;gap:2.5px;width:20px;height:16px;margin:-8px 0 0 -10px;opacity:0;pointer-events:none;will-change:opacity}`,
      `.dsh-live-voice-bar{display:block;width:2.5px;height:14px;border-radius:999px;background:#fff8f3;transform-origin:center center;transform:scaleY(.16);transition:opacity .15s ease}`,
      `.dsh-live-voice[data-recording="true"] .dsh-live-voice-icon{opacity:0}`,
      `.dsh-live-voice[data-recording="true"] .dsh-live-voice-bars{opacity:1}`,
      `.dsh-live-voice-dot{position:absolute;right:2px;top:2px;width:6px;height:6px;border-radius:50%;background:#fff8f3;box-shadow:0 0 0 2px rgba(218,119,86,.5);pointer-events:none}`,
      `@media (prefers-reduced-motion:reduce){.dsh-live-voice,.dsh-live-voice-icon,.dsh-live-voice-bars,.dsh-live-voice-bar{transition:none!important}}`,
      `[class*="_triggerAnchor"] [class*="_trigger"]{width:30px;height:30px;padding:0;border-radius:999px;background:transparent!important;color:#7f7869!important;transition:background-color .15s ease,color .15s ease}`,
      `[class*="_triggerAnchor"] [class*="_trigger"]:hover:not(:disabled){background:rgba(218,119,86,.10)!important;color:#da7756!important}`,
      `[class*="_triggerAnchor"] [class*="_trigger"]:focus-visible{outline:2px solid rgba(218,119,86,.55)!important;outline-offset:2px}`,
      `[class*="_captureRow"]{align-items:center;gap:12px;padding:2px 2px 2px 4px;border-radius:999px;background:rgba(218,119,86,.07)}`,
      `[class*="_roundButton"]{width:32px;height:32px;background:#da7756!important;color:#fff8f3!important;box-shadow:0 2px 8px rgba(218,119,86,.28)}`,
      `[class*="_roundButton"]:hover:not(:disabled){background:#c4633f!important}`,
      `[class*="_waveform"]{color:#da7756!important}`,
      `[class*="_activityMessage"]{color:#7f7869!important;font-size:12px}`,
      `[class*="_captureRow"] [class*="_progress"]{accent-color:#da7756!important}`,
      `@keyframes dsh-voice-pulse{0%,100%{box-shadow:0 0 0 0 rgba(218,119,86,.25)}50%{box-shadow:0 0 0 5px rgba(218,119,86,.10)}}`,
      `[class*="_captureRow"] [class*="_roundButton"]:first-of-type{animation:dsh-voice-pulse 1.8s ease-in-out infinite}`,
      `@media (prefers-reduced-motion:reduce){[class*="_captureRow"] [class*="_roundButton"]:first-of-type{animation:none!important}}`,
      `[class*="_root"]:has([data-lexical-editor="true"]) [class*="_dock"]{display:none!important}`,
      // Composer HUD tray: one quiet 16px line directly below the composer card
      // (8px gap), two ends aligned, monospace 12px. It is injected as a
      // sibling of the card, so the card itself never grows.
      `.dsh-composer-tray{display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);margin:8px auto 0;padding:0 2px;overflow:hidden;contain:layout style;font-family:"SF Mono","Consolas",monospace;font-size:12px;line-height:16px;color:${SHELL.controlInk};white-space:nowrap;font-variant-numeric:tabular-nums}`,
      `.dsh-tray-group{display:inline-flex;align-items:center;min-width:0}`,
      `.dsh-tray-left{gap:14px;flex:none}`,
      `.dsh-tray-right{gap:8px;flex:0 1 auto;justify-content:flex-end;overflow:hidden}`,
      `.dsh-tray-sep{color:#b4ab99;flex:none}`,
      `.dsh-sidebar-footer-balance{flex:0 1 auto!important;min-width:0!important;align-self:center!important;margin-left:auto!important;padding-left:8px!important;max-width:52%!important;overflow:hidden!important;text-overflow:ellipsis!important;text-align:right!important;font-family:${UI_FONT}!important;font-size:12px!important;line-height:16px!important;color:#7f7869!important;white-space:nowrap!important;pointer-events:none!important}`,
      `button[data-signed-out][aria-haspopup="menu"]{overflow:hidden!important}`,
      `[data-collapsed="true"] .dsh-sidebar-footer-balance{display:none!important}`,
      `.dsh-hud-part{display:inline-flex;align-items:center;gap:6px;flex:none;min-width:0}`,
      // Numbers own a fixed-width, right-aligned slot: a value change updates
      // text only and cannot rewrap the row (no layout shift per tick).
      `.dsh-hud-num{display:inline-block;text-align:right;font-variant-numeric:tabular-nums;color:#1d1b16}`,
      `.dsh-hud-context-value{min-width:4.2ch}`,
      `.dsh-hud-cache-value{min-width:5.2ch}`,
      `.dsh-hud-tps-value{min-width:3.6ch}`,
      `.dsh-hud-cost-value{min-width:6.6ch}`,
      `.dsh-hud-tps-unit{color:inherit}`,
      `.dsh-hud-cost[data-price-source="none"] .dsh-hud-cost-value{opacity:.72}`,
      `@media (prefers-reduced-motion:reduce){.dsh-hud-num{transition:none}}`,
      `.dsh-hud-ring{display:block;flex:none}`,
      `.dsh-hud-ring-progress{transition:stroke-dashoffset .3s ease}`,
      `.dsh-hud-agents{display:inline-flex;align-items:center;gap:5px;flex:none}`,
      `.dsh-hud-agent-dot{width:5px;height:5px;border-radius:50%;background:${SHELL.navActiveRail};box-shadow:0 0 4px rgba(218,119,86,.9),0 0 8px rgba(218,119,86,.45);flex:none}`,
      // ── Diff micro-badge + review drawer ───────────────────────────────────
      `.dsh-diff-badge{margin-left:auto;flex:none;display:inline-flex;align-items:center;gap:6px;background:#ece7dd;border:0;border-radius:4px;padding:1px 7px;font-family:"SF Mono","Consolas",monospace;font-size:11px;line-height:16px;color:#7f7869;cursor:pointer;user-select:none}`,
      `.dsh-diff-badge:hover{background:#e3ddd1}`,
      `.dsh-diff-badge:focus-visible{outline:2px solid #da7756;outline-offset:1px}`,
      `.dsh-diff-add{color:#00c853}`,
      `.dsh-diff-del{color:#ff5f38}`,
      `.dsh-review-drawer{position:fixed;top:0;right:0;bottom:0;z-index:1200;display:flex;flex-direction:column;box-sizing:border-box;width:400px;max-width:100vw;background:#f5f3ee;color:#1d1b16;box-shadow:-4px 0 24px rgba(0,0,0,.08);transform:translateX(100%);transition:transform 200ms ease;will-change:transform;pointer-events:none;font-family:"SF Mono","Consolas",monospace}`,
      `.dsh-review-drawer[data-open="true"]{transform:translateX(0);pointer-events:auto}`,
      `.dsh-review-overlay{position:fixed;inset:0;z-index:1199;background:rgba(0,0,0,.1);opacity:0;pointer-events:none;transition:opacity 200ms ease}`,
      `.dsh-review-overlay[data-open="true"]{opacity:1;pointer-events:auto}`,
      `.dsh-review-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex:none;height:52px;padding:0 16px;background:#ece7dd;border-bottom:1px solid #e3ddd1}`,
      `.dsh-review-title{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:18px;color:#1d1b16}`,
      `.dsh-review-close{width:28px;height:28px;flex:none;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:#1d1b16;cursor:pointer;padding:0;position:relative;z-index:1}`,
      `.dsh-review-close:hover{background:#e3ddd1;color:#1d1b16}`,
      `.dsh-review-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:16px;padding:16px;overflow:auto}`,
      `.dsh-review-label{font-size:11px;line-height:16px;letter-spacing:.04em;text-transform:uppercase;color:#7f7869}`,
      `.dsh-review-diff{margin:0;flex:none;max-height:52vh;overflow:auto;border:1px solid #e3ddd1;border-radius:8px;background:#fff;padding:8px 0}`,
      `.dsh-diff-line{white-space:pre;padding:0 12px;font-size:12px;line-height:20px;color:#1d1b16}`,
      `.dsh-diff-line[data-kind="add"]{background:#00c853;color:#1d1b16}`,
      `.dsh-diff-line[data-kind="del"]{background:#ff5f38;color:#1d1b16}`,
      `.dsh-diff-line[data-kind="meta"]{color:#7f7869}`,
      `.dsh-review-preview{flex:none;display:flex;flex-direction:column;min-height:140px;border:1px solid #b4ab99;border-radius:8px;overflow:hidden;background:#f5f3ee}`,
      `.dsh-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;border-bottom:1px solid #e3ddd1;font-size:11px;line-height:16px;color:#7f7869}`,
      `.dsh-preview-refresh{width:22px;height:22px;flex:none;display:grid;place-items:center;border:0;border-radius:5px;background:transparent;color:#7f7869;cursor:pointer;padding:0}`,
      `.dsh-preview-refresh:hover{background:#e3ddd1;color:#1d1b16}`,
      `.dsh-preview-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:16px;font-size:11px;line-height:16px;color:#7f7869}`,
      `.dsh-preview-body strong{font-weight:400;color:#1d1b16}`,
      // ── v1 forced layer (the last word) ───────────────────────────────────
      // Applies the original "warm, elegant" spec globally with !important:
      // serif UI face first, SF Mono for every code/mono surface, surface
      // #f5f3ee, ink #1d1b16, accent #da7756 and the v1 diff semantics.
      `html,body{font-family:${UI_FONT}!important;font-weight:400!important;font-synthesis:none!important}`,
      `body,body *{font-family:${UI_FONT}!important}`,
      `code,code *,pre,pre *,kbd,kbd *,samp,samp *,.shiki,.shiki *,.xterm,.xterm *,.monaco-editor,.monaco-editor *,.duo-tile-value,.duo-tile-value *,.duo-model-tokens,.duo-model-tokens *,.dsh-composer-tray,.dsh-composer-tray *,.dsh-diff-badge,.dsh-diff-badge *,.dsh-review-drawer,.dsh-review-drawer *{font-family:${CODE_FONT}!important}`,
      `${LIGHT}{background-color:#f5f3ee!important;color:#1d1b16!important}`,
      `${DARK}{background-color:#24221f!important;color:#ece7dd!important}`,
      `${LIGHT} ._2H3hWW_root{background:#f5f3ee!important}`,
      `${DARK} ._2H3hWW_root{background:#24221f!important}`,
      `${LIGHT} [class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]){background:#f5f3ee!important}`,
      `${DARK} [class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"]){background:#2b2825!important}`,
      `${LIGHT} .dsh-composer-tray{color:#7f7869!important}`,
      `${DARK} .dsh-composer-tray{color:#9a9285!important}`,
      `${LIGHT} .dsh-hud-num,${LIGHT} .dsh-hud-agent-label,${LIGHT} .dsh-hud-context-label{color:#1d1b16!important}`,
      `${DARK} .dsh-hud-num,${DARK} .dsh-hud-agent-label,${DARK} .dsh-hud-context-label{color:#ece7dd!important}`,
      `${LIGHT} .dsh-hud-ring-track{stroke:#e3ddd1!important}`,
      `${DARK} .dsh-hud-ring-track{stroke:#4a443c!important}`,
      `${LIGHT} .dsh-hud-ring-progress{stroke:#da7756!important}`,
      `${DARK} .dsh-hud-ring-progress{stroke:#e8a184!important}`,
      `.dsh-hud-agent-dot{background:#da7756!important}`,
      `${LIGHT} .dsh-diff-badge{background:#ece7dd!important}`,
      `${DARK} .dsh-diff-badge{background:#3a3732!important}`,
      `.dsh-diff-add{color:#00c853!important}`,
      `.dsh-diff-del{color:#ff5f38!important}`,
      `.dsh-diff-line[data-kind="add"]{background:#00c853!important;color:#1d1b16!important}`,
      `.dsh-diff-line[data-kind="del"]{background:#ff5f38!important;color:#1d1b16!important}`,
      `.dsh-diff-line[data-kind="meta"]{color:#7f7869!important}`,
      `${LIGHT} .dsh-review-drawer,${LIGHT} .dsh-review-body,${LIGHT} .dsh-review-preview{background-color:#f5f3ee!important;color:#1d1b16!important}`,
      `${DARK} .dsh-review-drawer,${DARK} .dsh-review-body,${DARK} .dsh-review-preview{background-color:#24221f!important;color:#ece7dd!important}`,
      `${LIGHT} .dsh-review-head{background:#ece7dd!important}`,
      `${DARK} .dsh-review-head{background:#3a3732!important}`,
      `${LIGHT} .dsh-review-title,${LIGHT} .dsh-review-close{color:#1d1b16!important}`,
      `${DARK} .dsh-review-title,${DARK} .dsh-review-close{color:#ece7dd!important}`,
      `[class*="_sessionRow"][data-dsh-status="waiting"] [class*="_slot"]::before{background:#da7756!important;opacity:1!important}`,
      `[class*="_sessionRow"][data-dsh-status="idle"] [class*="_slot"]::before{background:#7f7869!important;opacity:.5!important}`,
      `${LIGHT} [class*="_composerHero"] [class*="_headline"],${LIGHT} [class*="_composerHero"] [class*="_titleGroup"]>span:not([class]){font-family:${UI_FONT}!important;color:#1d1b16!important}`,
      `body[data-ds-dark-theme] [class*="_composerHero"] [class*="_headline"],body[data-ds-dark-theme] [class*="_composerHero"] [class*="_titleGroup"]>span:not([class]){font-family:${UI_FONT}!important;color:#f0ede4!important}`,
    ].join('\n')

