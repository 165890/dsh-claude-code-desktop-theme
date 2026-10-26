// ── M0-S4 central anchor registry + self-check ──────────────────────────
    // Every host seam this plugin depends on is declared once, with a required /
    // optional / fallback level. `__dshClaudeThemeAnchors()` reports hit, miss
    // and degraded-fallback counts for the running client, so a host upgrade
    // that renames a class or drops an attribute becomes a visible number
    // instead of a silently dead feature (01 audit: 5 dead hash selectors).
    //
    // Evidence for the host side lives in docs/HOST-PROBE.md (§2.9/§2.10).
    const SIDEBAR_RIGHT_ATTRS = [
      'session',
      'panel',
      'open',
      'tab',
      'occurrence',
      'mode',
      'toggle',
      'guide',
      'guide-entry',
      'expand',
      'unavailable',
    ]

    // data-dockkit-* produced by the shell bundle (dsh-web-frontend index-*.js).
    const DOCKKIT_ATTRS = [
      'add-tab',
      'caret',
      'cell',
      'column',
      'content',
      'divider',
      'dock-scrim',
      'dock-zone',
      'drop-active',
      'drop-zones',
      'empty',
      'float',
      'float-active',
      'float-close',
      'float-dock',
      'float-grip',
      'float-resize',
      'float-title',
      'host',
      'menu-close',
      'pane',
      'pane-active',
      'split',
      'split-blocked',
      'split-button',
      'strip',
      'strip-chrome',
      'strip-fill',
      'strip-tabs',
      'surface',
      'tab',
      'tab-close',
      'tab-menu',
      'tab-quiet',
      'tab-title',
    ]

    // Cross-hash references the plugin still uses: a CSS-module *key* substring,
    // never a build hash. Required ones gate the composer/hero/usage surfaces.
    const CSS_KEY_ANCHORS = [
      { key: 'card', level: 'required' },
      { key: 'composerHero', level: 'optional' },
      { key: 'heroWorkspaceRow', level: 'optional' },
      { key: 'cardWorkspaceTrigger', level: 'optional' },
      { key: 'sessionRow', level: 'required' },
      { key: 'treeitem', level: 'optional' },
      { key: 'triggerEffort', level: 'optional' },
      { key: 'triggerAnchor', level: 'optional' },
      { key: 'workspace', level: 'optional' },
      { key: 'headline', level: 'optional' },
      { key: 'newSession', level: 'required' },
    ]

    // Live discovery (M0-S4, 2026-10-26): the sidebar account launcher is the
    // host-declared `settings.launcher` slot seat; it carries no aria-haspopup in
    // this build, while data-signed-out exists only as an extra. Order matters.
    const ACCOUNT_TRIGGER_ANCHORS = [
      '[data-slot="settings.launcher"] button',
      '[data-slot="settings.launcher"] [role="button"]',
      'button[data-signed-out]',
      'button[aria-haspopup="dialog"][aria-label*="账户"]',
    ]

    const ANCHOR_REGISTRY = (() => {
      const entries = []
      const add = (entry) => entries.push(entry)

      // Declared slot seams (registered by this plugin; DOM evidence below).
      add({ id: 'slot.usage-card', kind: 'slot', target: 'conversation.input.dock', level: 'required', note: '用量概览卡' })
      add({ id: 'slot.data-bridge', kind: 'slot', target: 'conversation.composer.dock', level: 'required', note: '实时数据桥（headless）' })
      add({ id: 'slot.effort-slider', kind: 'slot', target: 'conversation.input.right', level: 'required', note: '推理强度滑条' })
      add({ id: 'slot.live-voice', kind: 'slot', target: 'conversation.input.right', level: 'required', note: '实时语音' })

      // Conversation frame (M1-S5 depends on the scroll/phase pair).
      add({ id: 'dom.conversation.chat', kind: 'dom', selector: '[data-conversation-region="chat"]', level: 'required', note: '主会话区域' })
      add({ id: 'dom.conversation.composer', kind: 'dom', selector: '[data-conversation-region="composer"]', level: 'required', note: 'composer 座位' })
      add({ id: 'dom.conversation.scroll', kind: 'dom', selector: '[data-conversation-scroll]', level: 'required', note: '滚动容器（M1-S5 首选锚点）' })
      add({ id: 'dom.conversation.phase', kind: 'dom', selector: '[data-content-phase]', level: 'required', note: 'hero/active/settling' })
      add({ id: 'dom.composer.seat', kind: 'dom', selector: '[data-composer-seat]', level: 'required' })
      add({ id: 'dom.composer.editor', kind: 'dom', selector: '[data-lexical-editor="true"]', level: 'required' })
      add({ id: 'dom.composer.card', kind: 'dom', selector: '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])', level: 'required', fallback: '[data-lexical-editor="true"]', note: 'composer 卡片（跨哈希子串）' })

      // Sidebar frame.
      add({ id: 'dom.sidebar.rows', kind: 'dom', selector: '[data-row-key^="session:"]', level: 'required', note: '会话行（data-row-key）' })
      add({ id: 'dom.sidebar.treeitem', kind: 'dom', selector: '[role="treeitem"][data-row-key^="session:"]', level: 'required' })
      add({ id: 'dom.sidebar.collapsed', kind: 'dom', selector: '[data-sidebar-collapsed="true"]', level: 'optional', note: '仅折叠时渲染（false 属性缺省）' })
      add({ id: 'dom.account.trigger', kind: 'dom', selector: ACCOUNT_TRIGGER_ANCHORS[0], level: 'required', fallback: ACCOUNT_TRIGGER_ANCHORS[2], note: '账户按钮（settings.launcher 槽位；data-signed-out 仅作后备）' })

      // Frame columns / shell seats.
      add({ id: 'dom.frame.rightbar-col', kind: 'dom', selector: '[data-rightbar-col]', level: 'required' })
      add({ id: 'dom.shell.bottom', kind: 'dom', selector: '[data-shell-bottom]', level: 'required' })
      add({ id: 'dom.shell.overlay', kind: 'dom', selector: '[data-shell-overlay]', level: 'required' })
      add({ id: 'dom.shell.leading', kind: 'dom', selector: '[data-shell-leading]', level: 'optional', note: '无 leading 内容时不渲染（本 profile 实测 0）' })

      // Optional conversation/tool/diff surfaces (present only in some states).
      add({ id: 'dom.hero.root', kind: 'dom', selector: '[class*="_composerHero"]', level: 'optional', note: '首页 hero' })
      add({ id: 'dom.tool.call-id', kind: 'dom', selector: '[data-chat-call-id]', level: 'optional', note: '工具调用卡（diff 微标依赖）' })
      add({ id: 'dom.tool.anchor-key', kind: 'dom', selector: '[data-chat-anchor-key]', level: 'optional' })
      add({ id: 'dom.diff.disclosure', kind: 'dom', selector: '[data-disclosure-row]', level: 'optional', note: 'Diff 微标插入点' })
      add({ id: 'dom.conversation.header', kind: 'dom', selector: '[data-conversation-header-leading], [data-conversation-header-corner]', level: 'optional', note: '会话头扩展位（M1-S2 用）' })
      add({ id: 'dom.theme.dark', kind: 'dom', selector: 'body[data-ds-dark-theme]', level: 'optional' })
      add({ id: 'dom.sidebar.right.toggle', kind: 'dom', selector: '[data-sidebar-right-toggle]', level: 'optional' })
      for (const name of SIDEBAR_RIGHT_ATTRS) {
        add({ id: 'dom.sidebarRight.' + name, kind: 'dom', selector: '[data-sidebar-right-' + name + ']', level: 'optional', note: '右栏状态属性' })
      }
      add({
        id: 'dom.dockkit.family',
        kind: 'family',
        selectors: DOCKKIT_ATTRS.map((name) => '[data-dockkit-' + name + ']'),
        level: 'optional',
        note: '右栏 Dock 家族（关闭时多为 0，属正常）',
      })

      // Cross-hash key anchors.
      for (const { key, level } of CSS_KEY_ANCHORS) {
        add({ id: 'css.' + key, kind: 'dom', selector: '[class*="_' + key + '"]', level, note: 'CSS module 键（跨构建哈希）' })
      }
      return entries
    })()

    function matchCount(selector) {
      try {
        return document.querySelectorAll(selector).length
      } catch (error) {
        return -1
      }
    }

    function evaluateAnchors() {
      const rows = []
      let required = 0
      let requiredHit = 0
      let optionalHit = 0
      let optionalMiss = 0
      let fallbackCount = 0
      const missesRequired = []
      const fallbacks = []
      const slots = []

      for (const entry of ANCHOR_REGISTRY) {
        if (entry.kind === 'slot') {
          slots.push({ id: entry.id, target: entry.target, status: 'declared', level: entry.level })
          rows.push({ entry, status: 'declared', hits: '—' })
          continue
        }
        let hits = 0
        if (entry.kind === 'family') {
          hits = entry.selectors.filter((selector) => matchCount(selector) > 0).length
          rows.push({ entry, status: hits > 0 ? 'hit' : 'optional-miss', hits: hits + '/' + entry.selectors.length })
          if (hits > 0) optionalHit += 1
          else optionalMiss += 1
          continue
        }
        hits = matchCount(entry.selector)
        let status = hits > 0 ? 'hit' : 'miss'
        let fallbackHits = null
        if (hits <= 0 && entry.fallback !== undefined) {
          fallbackHits = matchCount(entry.fallback)
          if (fallbackHits > 0) status = 'fallback'
        }
        if (entry.level === 'required') {
          required += 1
          if (status === 'hit') requiredHit += 1
        } else if (entry.level === 'optional') {
          if (status === 'hit') optionalHit += 1
          else optionalMiss += 1
        }
        if (status === 'fallback') {
          fallbackCount += 1
          fallbacks.push({ id: entry.id, fallback: entry.fallback, fallbackHits })
        }
        if (entry.level === 'required' && status !== 'hit') {
          missesRequired.push({ id: entry.id, selector: entry.selector, hits, status })
        }
        rows.push({ entry, status, hits, fallbackHits })
      }

      return {
        time: new Date().toISOString(),
        url: String(location.href).replace(/[?&]token=[^&]*/g, '?token=<redacted>'),
        viewport: { w: window.innerWidth, h: window.innerHeight },
        runtime: activeRuntime === null ? null : activeRuntime.report(),
        required,
        requiredHit,
        requiredMiss: required - requiredHit,
        optionalHit,
        optionalMiss,
        fallback: fallbackCount,
        slots,
        missesRequired,
        fallbacks,
        rows,
      }
    }

    function formatAnchorReport(report) {
      const lines = []
      lines.push('anchors ' + report.requiredHit + '/' + report.required + ' required hit' +
        (report.requiredMiss > 0 ? ' · MISS ' + report.requiredMiss : ' · all required ok'))
      lines.push('optional ' + report.optionalHit + ' hit / ' + report.optionalMiss + ' miss · fallback ' + report.fallback +
        ' · slots declared ' + report.slots.length)
      if (report.runtime !== null) {
        lines.push('runtime: 1 observer / ' + report.runtime.intervalTasks.length + ' intervals (' + report.runtime.tickMs + 'ms tick)' +
          (report.runtime.hidden ? ' · paused(hidden)' : ''))
        lines.push('  mutation tasks: ' + report.runtime.mutationTasks.join(', '))
        lines.push('  interval tasks: ' + report.runtime.intervalTasks.map((task) => task.name + '@' + task.ms + 'ms').join(', '))
      } else {
        lines.push('runtime: inactive')
      }
      if (report.fallbacks.length > 0) {
        lines.push('fallbacks: ' + report.fallbacks.map((item) => item.id + ' → ' + item.fallback).join(' | '))
      }
      if (report.missesRequired.length > 0) {
        lines.push('required miss:')
        for (const miss of report.missesRequired) lines.push('  ' + miss.id + '  ' + miss.selector + '  hits=' + miss.hits)
      }
      return lines
    }

    function runAnchorSelfCheck() {
      const report = evaluateAnchors()
      try {
        window.__dshClaudeThemeAnchorsReport = report
        console.table(report.rows.map((row) => ({
          anchor: row.entry.id,
          kind: row.entry.kind,
          level: row.entry.level,
          status: row.status,
          hits: row.hits,
        })))
        for (const line of formatAnchorReport(report)) console.info('[dsh theme anchors] ' + line)
      } catch (error) {
        // Diagnostics must never break the page.
      }
      return report
    }