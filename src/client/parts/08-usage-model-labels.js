    // ── Usage card: real model display name ─────────────────────────────────
    // The usage Host folds the raw model id (e.g. "deepseek-flash") for the
    // favourite-model tile. Resolve it through the Host model catalog so the
    // tile shows the real, full display name of the model actually used most
    // (e.g. "DeepSeek-V4.1-Flash") instead of the raw text.
    const modelNamesById = new Map()

    function mountUsageModelLabels(ctx) {
      const loadCatalog = ctx.remote?.session?.modelCatalog
      if (typeof loadCatalog !== 'function') return () => {}
      let loaded = false
      const decorate = () => {
        if (modelNamesById.size === 0) return
        for (const valueEl of document.querySelectorAll('.duo-grid>.duo-tile:last-child .duo-tile-value')) {
          const raw = (valueEl.textContent ?? '').trim()
          if (raw === '') continue
          const display = modelNamesById.get(raw) ?? raw
          if (valueEl.textContent !== display) valueEl.textContent = display
          if (valueEl.getAttribute('title') !== display) valueEl.setAttribute('title', display)
        }
        for (const nameEl of document.querySelectorAll('.duo-model-name')) {
          const raw = (nameEl.textContent ?? '').trim()
          const display = modelNamesById.get(raw)
          if (display !== undefined && display !== raw) nameEl.textContent = display
        }
      }
      const load = async () => {
        try {
          const response = await loadCatalog()
          if (response?.ok !== true) return
          const groups = response.value?.groups
          if (!Array.isArray(groups)) return
          for (const group of groups) {
            if (typeof group?.id !== 'string' || !Array.isArray(group.models)) continue
            for (const model of group.models) {
              if (typeof model?.id !== 'string' || typeof model?.name !== 'string') continue
              if (model.id !== '' && model.name !== '') modelNamesById.set(model.id, model.name)
            }
          }
          loaded = true
          decorate()
        } catch {
          // Catalog unavailable: the raw id remains visible.
        }
      }
      void load()
      const poll = () => {
        if (loaded === false && modelNamesById.size === 0) void load()
        decorate()
      }
      // M0-S4: 'usage-model-labels' runs as one mutation task + one 700ms ticker
      // task on the shared scheduler instead of a private observer and interval.
      const offMutation = runtimeOnMutation('usage-model-labels', decorate)
      const offTicker = runtimeEvery('usage-model-labels', poll, 700)
      return () => {
        offMutation()
        offTicker()
      }
    }

