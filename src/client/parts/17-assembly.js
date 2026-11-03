    return {
      inject: ['theme', 'slots', 'locale', 'remote'],
      apply(ctx) {
        // Epoch guard: every new instance bumps a global epoch. Older instances
        // (even ones from builds that predate the dispose registry) check it on
        // a timer and dispose themselves, so two runtimes can never fight over
        // the same inline styles (the "left/right jumping" bug).
        const instanceEpoch = (window.__DSH_CLAUDE_THEME_EPOCH__ ?? 0) + 1
        window.__DSH_CLAUDE_THEME_EPOCH__ = instanceEpoch

        // Self-heal across client HMR: if a previous instance could not run its
        // disposers (failed reload, disable/enable race), tear it down first so
        // slot ids, listeners and DOM nodes never stack into a zombie instance.
        const previousDispose = window.__DSH_CLAUDE_THEME_DISPOSE__
        if (typeof previousDispose === 'function') {
          try {
            previousDispose()
          } catch (error) {
            // A broken previous instance must not block the new one.
          }
        }
        const disposers = []
        const disposeAll = () => {
          while (disposers.length > 0) {
            const dispose = disposers.pop()
            try {
              dispose?.()
            } catch (error) {
              // Keep tearing the rest down.
            }
          }
          if (window.__DSH_CLAUDE_THEME_DISPOSE__ === disposeAll) window.__DSH_CLAUDE_THEME_DISPOSE__ = undefined
          if (window.__dshClaudeThemeFontDebug === debugFont) window.__dshClaudeThemeFontDebug = undefined
        }
        window.__DSH_CLAUDE_THEME_DISPOSE__ = disposeAll

        // M0-S4: one scheduler owns every body observer and periodic task this
        // instance needs (features register tasks via runtimeOnMutation /
        // runtimeEvery). Disposed with the instance so HMR/disable leaves none.
        activeRuntime = createRuntimeScheduler()
        disposers.push(() => {
          try {
            activeRuntime?.dispose?.()
          } catch (error) {
            // Teardown must never block the rest of the disposers.
          }
          activeRuntime = null
        })

        // Mount the merged usage overview card (formerly dsh-usage-overview).
        try {
          usageOverviewPlugin.apply(ctx)
          paneHeaderMenuPlugin.apply(ctx)
        } catch (error) {
          window.__dshUsageMergeError = String(error && error.stack ? error.stack : error)
        }


        // Mount the merged reasoning-effort slider. It waits for its own
        // services (sessions/modelDirectories) and stays out of the way when the
        // standalone dsh-codex-effort-slider is still enabled.
        try {
          const standaloneSliderPresent = () =>
            document.querySelector('style[data-plugin-css="dsh-codex-effort-slider"]') !== null
          if (standaloneSliderPresent()) {
            console.info('[dsh-claude-code-desktop-theme] standalone effort slider detected — merged slider skipped')
          } else {
            const removeSliderStyles = () => {
              document
                .querySelectorAll('style[data-plugin-css="dsh-claude-code-desktop-theme/effort-slider"]')
                .forEach((node) => node.remove())
            }
            disposers.push(removeSliderStyles)
            const sliderScope = ctx.inject(
              ['slots', 'sessions', 'modelDirectories', 'remote', 'remote.session'],
              (scope) => {
                scope.effect(() => {
                  // Give a concurrently-loading standalone slider a beat to
                  // publish its style marker before we decide to mount ours.
                  const timer = window.setTimeout(() => {
                    if (standaloneSliderPresent()) {
                      console.info('[dsh-claude-code-desktop-theme] standalone effort slider appeared — merged slider skipped')
                      return
                    }
                    try {
                      codexEffortSliderPlugin.apply(scope)
                    } catch (error) {
                      console.warn('[dsh-claude-code-desktop-theme] merged effort slider failed to mount', error)
                    }
                  }, 600)
                  return () => window.clearTimeout(timer)
                }, 'merged reasoning-effort slider')
              },
            )
            disposers.push(() => {
              try {
                sliderScope?.dispose?.()
              } catch {
                // The scope may already be disposed with the plugin fiber.
              }
            })
          }
        } catch (error) {
          console.warn('[dsh-claude-code-desktop-theme] merged effort slider setup failed', error)
        }

        // Any stale runtime notices the newer epoch within a second and retires
        // itself, releasing its intervals, observers and injected DOM.
        // M0-S4: the check rides the instance's shared ticker (disposing the
        // scheduler clears it, so an old instance leaves no timer behind).
        disposers.push(ctx.effect(() => runtimeEvery('epoch-guard', () => {
          if (window.__DSH_CLAUDE_THEME_EPOCH__ !== instanceEpoch) disposeAll()
        }, 800), 'instance epoch guard'))

        // Real account balance straight from the host account remote: fetch it
        // as soon as the app opens (no session / composer dock has to exist) and
        // keep it fresh via the account state stream + a slow poll. The remote
        // namespace is optional: profiles without an account controller still
        // load the theme and simply keep `余额 —`.
        ctx.inject(['remote.account'], (scope) => scope.effect(() => {
          const account = scope.remote?.account
          if (account === undefined) return () => {}
          const controller = new AbortController()
          const client = () => ({
            version: '0.2.1-rc.2',
            locale: ctx.locale?.getSnapshot?.().active ?? 'zh-CN',
            timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
          })
          const applyBalance = (value) => {
            if (value === null || typeof value !== 'object' || value.status !== 'ready') return false
            const wallets = Array.isArray(value.value) ? value.value : []
            const wallet = wallets.find((candidate) => candidate.currency === 'CNY') ?? wallets[0]
            if (wallet === undefined || typeof wallet.balance !== 'string') return false
            const amount = Number(wallet.balance)
            if (Number.isFinite(amount) === false) return false
            const symbol = wallet.currency === 'USD' ? '$' : '¥'
            lastKnownBalance = symbol + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            try {
              window.localStorage.setItem(BALANCE_CACHE_KEY, lastKnownBalance)
            } catch {
              // Best-effort cache only.
            }
            syncSidebarBalance()
            return true
          }
          const refresh = async () => {
            try {
              const result = await account.getBalance(client())
              if (result?.ok === true) applyBalance(result.value)
            } catch {
              // Keep the last known / dock-scraped balance.
            }
          }
          void refresh()
          // M0-S4: the slow account poll joins the shared ticker (page-hidden
          // pauses it together with everything else); the effect returns the
          // task disposer so a scope teardown unregisters it.
          const disposePoll = runtimeEvery('update-status', refresh, 10000)
          let stream
          try {
            stream = scope.remote.$stream({
              name: 'account',
              open: (signal) => account.watch(signal),
              ended: () => new Error('account stream ended'),
            })
          } catch {
            stream = undefined
          }
          if (stream !== undefined) {
            ;(async () => {
              try {
                for await (const frame of stream) {
                  if (controller.signal.aborted) break
                  frame.accept?.()
                  void refresh()
                }
              } catch {
                // Stream ended; the poll keeps the balance fresh.
              }
            })()
          }
          return () => {
            controller.abort()
            disposePoll()
            try {
              stream?.dispose?.()
            } catch {
              // Already disposed.
            }
          }
        }, 'real account balance'))

        // Headless session-data bridge under the composer: feeds the HUD tray,
        // the diff badges, the review drawer and the sidebar status dots. Its
        // ThemeLiveProbe child samples the streamed Assistant step for tok/s.
        disposers.push(ctx.effect(() => {
          bridge.registered = true
          const dispose = ctx.slots.inject('conversation.composer.dock', () =>
            ctx.slots.register({ name: 'conversation.composer.dock', id: 'dsh-theme-data', order: 100 }, ThemeDataBridge),
          )
          return () => {
            bridge.registered = false
            liveReset()
            dispose?.()
          }
        }, 'live session data bridge'))

        disposers.push(ctx.effect(() => {
          // Layer the Claude palette over the active built-in theme.
          const removeLayer = ctx.theme.overrideTokens(PLUGIN_ID, tokens)

          // Shell geometry over the host skeleton: sidebar, selection rail,
          // hero and composer chrome. Removed together with the palette.
          const style = document.createElement('style')
          style.dataset.plugin = PLUGIN_ID
          style.dataset.pluginCss = PLUGIN_ID + '/shell.css'
          style.textContent = SHELL_CSS
          document.head.appendChild(style)
          // M1-S1: sidebar skin as its own layer, injected after the shell CSS so
          // its equal-specificity !important rules win without editing host DOM.
          const sidebarStyle = document.createElement('style')
          sidebarStyle.dataset.plugin = PLUGIN_ID
          sidebarStyle.dataset.pluginCss = PLUGIN_ID + '/sidebar.css'
          sidebarStyle.textContent = SIDEBAR_CSS
          document.head.appendChild(sidebarStyle)
          // M1-S3: right-dock chrome, after the sidebar sheet. Attribute hooks
          // only; the host keeps drag, split, float and the column width.
          const dockStyle = document.createElement('style')
          dockStyle.dataset.plugin = PLUGIN_ID
          dockStyle.dataset.pluginCss = PLUGIN_ID + '/dock.css'
          dockStyle.textContent = DOCK_CSS
          document.head.appendChild(dockStyle)
          // M0-S6: start the external serif fetch immediately after the shell CSS is
          // in place. First paint uses the system serif stack; the face is swapped
          // in when the FontFace resolves (font-display: swap). The loader never
          // throws and never blocks the theme layer.
          try {
            void loadExternalSerif()
          } catch (error) {
            // Diagnostics only; the fallback stack already renders.
          }
          // One failing mount must not abort the whole layer: the loader treats a
          // thrown activation as a fatal boot error and restarts the window. Each
          // mount is isolated and degrades to a no-op disposer instead.
          const unmountOf = (mount, label) => {
            try {
              const dispose = mount()
              return typeof dispose === 'function' ? dispose : () => {}
            } catch (error) {
              console.error('[dsh-claude-code-desktop-theme] ' + label + ' failed to mount', error)
              return () => {}
            }
          }
          const unmountUpdate = unmountOf(mountUpdatePanel, 'update panel')
          const unmountLiveVoice = unmountOf(() => {
            let innerDispose = () => {}
            let scopeDispose = null
            try {
              scopeDispose = ctx.inject(['remote.speech'], (scope) => {
                innerDispose = mountRealtimeVoice(scope)
              })
            } catch (error) {
              console.warn('[dsh-claude-code-desktop-theme] real-time voice unavailable', error)
            }
            return () => {
              try { innerDispose() } catch { /* ignore */ }
              try { scopeDispose?.dispose?.() } catch { /* ignore */ }
            }
          }, 'real-time voice input')
          const unmountStatus = unmountOf(mountSessionStatus, 'session status dots')
          const unmountHeroCard = unmountOf(mountHeroDashboardCard, 'hero dashboard card')
          const unmountHeroMenus = unmountOf(mountHeroMenusUpward, 'hero menus upward')
          const unmountTray = unmountOf(mountComposerTray, 'composer tray')
          const unmountSidebarBalance = unmountOf(mountSidebarBalance, 'sidebar balance')
          const unmountUsageModelLabels = unmountOf(() => mountUsageModelLabels(ctx), 'usage model labels')
          const unmountDiff = unmountOf(mountDiffReview, 'diff review')
          const unmountPet = unmountOf(mountDesktopPet, 'desktop pet')

          // The requested look is the light variant. Follow-system users get it
          // once (persisted by the theme service); an explicit light/dark choice
          // is respected and only receives the matching palette above.
          const snapshot = ctx.theme.getTheme()
          if (snapshot.preference === 'system') ctx.theme.setTheme('light')

          return () => {
            unmountUpdate()
            unmountLiveVoice()
            unmountDiff()
            unmountPet()
            unmountHeroMenus()
            unmountHeroCard()
            unmountUsageModelLabels()
            unmountSidebarBalance()
            unmountTray()
            unmountStatus()
            style.remove()
            sidebarStyle.remove()
            dockStyle.remove()
            removeLayer()
          }
        }, PLUGIN_ID + ': shell layer'))

        disposers.push(() => {
          if (window.__DSH_CLAUDE_THEME_DISPOSE__ === disposeAll) window.__DSH_CLAUDE_THEME_DISPOSE__ = undefined
        })

        // Console diagnostics for the sidebar dots: run
        //   __dshClaudeThemeStatusDebug()
        // in DevTools to print every row's real status and the injected dot's
        // computed geometry/color/animation.
        const debugStatusDots = () => {
          const rows = [...document.querySelectorAll(SESSION_ROW_SELECTOR)].map((row) => {
            const key = row.getAttribute('data-row-key') ?? ''
            const id = key.slice(SESSION_ID_PREFIX.length)
            const status = bridge.sessions?.statuses?.get(id) ?? null
            const slot = row.querySelector('[class*="_slot"]')
            const style = slot === null ? null : window.getComputedStyle(slot, '::before')
            return {
              sessionId: id,
              title: (row.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30),
              dataStatus: row.getAttribute('data-dsh-status'),
              running: status?.running ?? null,
              pendingInteraction: status?.pendingInteraction?.kind ?? null,
              subagentsRunning: bridge.sessions?.subagents?.get(id) ?? 0,
              dot: style === null ? null : {
                content: style.content,
                width: style.width,
                height: style.height,
                backgroundColor: style.backgroundColor,
                opacity: style.opacity,
              },
            }
          })
          console.table(rows)
          return rows
        }
        window.__dshClaudeThemeStatusDebug = debugStatusDots

        // HUD diagnostics for issue reports: run __dshClaudeThemeHudDebug() in
        // DevTools to see the live window, the last provider-truth step sample
        // and the current cost state without touching the DOM.
        const debugHud = () => {
          const now = hudNow()
          const snapshot = {
            sessionId: bridge.currentSessionId,
            running: bridge.sessions?.statuses?.get(bridge.currentSessionId)?.running ?? null,
            liveTps: liveTps(now),
            liveStreaming: live.streaming,
            liveTokens: live.tokens,
            liveCum: live.cum,
            liveCalib: Number(live.calib.toFixed(3)),
            liveSamples: live.samples.length,
            lastStep: bridge.lastStep,
            lastStepHit: bridge.lastStepHit,
            lifetimeTps: bridge.tokensPerSecond,
            lifetimeHit: bridge.cacheHitPercent,
            context: bridge.context,
            cost: { id: sessionCost.id, text: sessionCost.text, source: sessionCost.source, title: sessionCost.title },
            trays: document.querySelectorAll('.' + TRAY_CLASS).length,
          }
          console.table(snapshot)
          return snapshot
        }
        window.__dshClaudeThemeHudDebug = debugHud





        // Font-rendering diagnostics for issue reports: which platform, DPI,
        // computed smoothing and whether the embedded UI serif actually loaded.
        const debugFont = () => {
          const bodyStyle = window.getComputedStyle(document.body)
          const faces = [...document.fonts]
            .filter((face) => face.family.includes('DSH Serif UI'))
            .map((face) => ({ family: face.family, weight: face.weight, status: face.status }))
          const result = {
            platform: document.documentElement.getAttribute('data-platform'),
            devicePixelRatio: window.devicePixelRatio,
            smoothing: bodyStyle.webkitFontSmoothing || bodyStyle.getPropertyValue('-webkit-font-smoothing'),
            bodyFontFamily: bodyStyle.fontFamily,
            uiSerifLoaded: document.fonts.check('400 14px "DSH Serif UI"'),
            uiSerifFaces: faces,
            dataDshFont: document.documentElement.getAttribute('data-dsh-font'),
            external: fontDebugState(),
          }
          console.table(result)
          return result
        }
        window.__dshClaudeThemeFontDebug = debugFont

        // M1-S1 sidebar inventory/diagnostics (read-only: widths, rows, states).
        window.__dshClaudeThemeSidebarDebug = sidebarDebugState

        // M1-S3 right-dock inventory (read-only: open state, panes, floats).
        window.__dshClaudeThemeDockDebug = dockDebugState

        // Layout diagnostics for issue reports: dumps the hero/composer stack,
        // the usage card and the sidebar account row with their boxes, so a
        // screenshot-free report can pinpoint what overlaps what.
        const debugLayout = () => {
          const token = (element) =>
            String(element.className || '')
              .split(/\s+/)
              .filter(Boolean)
              .map((name) => name.replace(/^[A-Za-z0-9_-]+?_/, '_'))
              .join(' ')
          const box = (element) => {
            if (element === null || element === undefined) return null
            const rect = element.getBoundingClientRect()
            const style = window.getComputedStyle(element)
            return {
              node: `${element.tagName.toLowerCase()}.${token(element)}`,
              display: style.display,
              position: style.position,
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            }
          }
          const hero = document.querySelector('[class*="_composerHero"]')
          const card = document.querySelector(
            '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])',
          )
          const duo = document.querySelector('.duo-card')
          const duoChain = []
          for (let node = duo, depth = 0; node !== null && depth < 5; node = node.parentElement, depth += 1) {
            duoChain.push(box(node))
          }
          const account = document.querySelector('[data-slot="settings.launcher"] button, button[data-signed-out]')
          return {
            viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio },
            hero: box(hero),
            heroChildren: hero === null ? null : [...hero.children].map(box),
            composerCard: box(card),
            duo,
            duoCard: box(duo),
            duoChain,
            account,
            accountChildren: account === null ? null : [...account.children].map(box),
            accountRow: account === null ? null : box(account.parentElement),
          }
        }
        window.__dshClaudeThemeLayoutDebug = debugLayout

        // Self-check: if the usage card and the composer card ever intersect,
        // dump the geometry once so a bug report needs no DOM poking.
        window.setTimeout(() => {
          try {
            const duo = document.querySelector('.duo-card')
            const card = document.querySelector(
              '[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])',
            )
            if (duo === null || card === null) return
            const a = duo.getBoundingClientRect()
            const b = card.getBoundingClientRect()
            const overlaps = a.bottom > b.top + 2 && b.bottom > a.top + 2 && a.right > b.left && b.right > a.left
            if (overlaps) console.warn('[dsh theme] hero/card overlap detected', debugLayout())
          } catch (error) {
            /* diagnostics must never break the page */
          }
        }, 3000)











        // M0-S4 anchor self-check: registry-backed, available at startup and on
        // demand (`__dshClaudeThemeAnchors()`); logs a table and stores the last
        // report on window for bug reports.
        window.__dshClaudeThemeAnchors = () => runAnchorSelfCheck()
        window.__dshClaudeThemeRuntime = () => (activeRuntime === null ? null : activeRuntime.report())
        window.setTimeout(() => {
          try {
            const report = runAnchorSelfCheck()
            if (report.requiredMiss > 0) {
              console.warn('[dsh theme] anchor self-check: required miss ' + String(report.requiredMiss) + '/' + String(report.required))
            } else {
              console.info('[dsh theme] anchor self-check: required ' + String(report.requiredHit) + '/' + String(report.required) + ' hit')
            }
          } catch (error) {
            // Diagnostics never break the page.
          }
        }, 1500)
      },
    }
  },
})

