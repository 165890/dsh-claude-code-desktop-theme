// ── M0-S4 runtime scheduler ─────────────────────────────────────────────
    // One body MutationObserver + one ticker replace the per-feature observers
    // and intervals this plugin used to create (01 audit: 10 body observers /
    // 12 setInterval). Features register named tasks instead:
    //
    //   runtimeOnMutation('status-dots', apply)   // run after DOM mutations
    //   runtimeEvery('hero-layout', apply, 800)   // coalesced into one ticker
    //
    // Everything pauses while the page is hidden, and `dispose()` (owned by the
    // plugin instance) tears the observer, ticker and tasks down so HMR /
    // disable leaves no residue.
    const RUNTIME_TICK_MS = 200
    // Attribute mutations are narrowed to host-owned state that features need to
    // observe. Plugin-owned attributes/styles are deliberately excluded so a
    // task's own writes cannot re-trigger the observer in a loop.
    const RUNTIME_ATTRIBUTE_FILTER = [
      'class',
      'aria-selected',
      'aria-expanded',
      'aria-haspopup',
      'data-content-phase',
      'data-row-key',
      'data-sidebar-collapsed',
      'data-rightbar-collapsed',
      'data-rightbar-fullscreen',
      'data-dockkit-pane-active',
      'data-dockkit-float-active',
      'data-sidebar-right-panel',
      'data-sidebar-right-open',
      'data-sidebar-right-tab',
      'data-ds-dark-theme',
    ]

    function createRuntimeScheduler() {
      const mutationTasks = new Map()
      const intervalTasks = new Map()
      let observer = null
      let frame = 0
      let ticker = 0
      let hidden = false
      let disposed = false

      const runMutationTasks = () => {
        frame = 0
        if (hidden || disposed) return
        for (const [name, task] of mutationTasks) {
          if (hidden || disposed) return
          try {
            task()
          } catch (error) {
            console.warn('[dsh-claude-code-desktop-theme] runtime task failed: ' + name, error)
          }
        }
      }
      const requestMutationRun = () => {
        if (frame !== 0 || hidden || disposed) return
        frame = window.requestAnimationFrame(runMutationTasks)
      }
      const runTick = () => {
        if (hidden || disposed) return
        const now = performance.now()
        for (const [name, task] of intervalTasks) {
          if (task.next > now) continue
          task.next = now + task.ms
          try {
            task.fn()
          } catch (error) {
            console.warn('[dsh-claude-code-desktop-theme] runtime interval failed: ' + name, error)
          }
        }
      }
      const startTicker = () => {
        if (ticker !== 0 || disposed) return
        ticker = window.setInterval(runTick, RUNTIME_TICK_MS)
      }
      const stopTicker = () => {
        if (ticker === 0) return
        window.clearInterval(ticker)
        ticker = 0
      }
      const onVisibilityChange = () => {
        hidden = document.visibilityState === 'hidden'
        if (hidden) {
          stopTicker()
          if (frame !== 0) {
            window.cancelAnimationFrame(frame)
            frame = 0
          }
        } else {
          startTicker()
          requestMutationRun()
        }
      }

      observer = new MutationObserver(requestMutationRun)
      const root = document.body ?? document.documentElement
      if (root !== null) {
        observer.observe(root, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: RUNTIME_ATTRIBUTE_FILTER,
        })
      }
      document.addEventListener('visibilitychange', onVisibilityChange)
      startTicker()

      return {
        onMutation(name, task) {
          mutationTasks.set(name, task)
          requestMutationRun()
          return () => {
            mutationTasks.delete(name)
          }
        },
        every(name, task, ms) {
          intervalTasks.set(name, { fn: task, ms: Math.max(ms, RUNTIME_TICK_MS), next: 0 })
          return () => {
            intervalTasks.delete(name)
          }
        },
        report() {
          return {
            tickMs: RUNTIME_TICK_MS,
            mutationTasks: [...mutationTasks.keys()],
            intervalTasks: [...intervalTasks.entries()].map(([name, task]) => ({ name, ms: task.ms })),
            hidden,
          }
        },
        dispose() {
          if (disposed) return
          disposed = true
          try {
            observer.disconnect()
          } catch (error) {
            // Already disconnected by a stale instance.
          }
          stopTicker()
          if (frame !== 0) {
            window.cancelAnimationFrame(frame)
            frame = 0
          }
          document.removeEventListener('visibilitychange', onVisibilityChange)
          mutationTasks.clear()
          intervalTasks.clear()
        },
      }
    }

    // The active instance's scheduler. Assembly creates it before mounting and
    // disposes it with the instance; features stay safe if they mount first.
    let activeRuntime = null

    function runtimeOnMutation(name, task) {
      return activeRuntime === null ? () => {} : activeRuntime.onMutation(name, task)
    }

    function runtimeEvery(name, task, ms) {
      return activeRuntime === null ? () => {} : activeRuntime.every(name, task, ms)
    }