    /** One value for both color schemes. */
    function both(value) {
      return { light: value, dark: value }
    }

    /** Explicit light/dark pair. */
    function pair(light, dark) {
      return { light, dark }
    }

    // ── Static palette scales ────────────────────────────────────────────────
    // The host sheets declare the --dsw-static-* scales once on body and let
    // both palettes reference them. Warming the neutral, brand and state scales
    // recolors every derived alias we do not override explicitly (hover fills,
    // skeletons, menus, plugin surfaces).
    const STATIC_SCALES = {
      'neutral-00': '#fffdf9',
      'neutral-50': '#faf7f2',
      'neutral-100': '#f3efe8',
      'neutral-150': '#ece7dd',
      'neutral-200': '#e3ddd1',
      'neutral-250': '#dad3c5',
      'neutral-300': '#d0c8b8',
      'neutral-400': '#b4ab99',
      'neutral-500': '#9a9080',
      'neutral-550': '#857b6b',
      'neutral-600': '#70665a',
      'neutral-700': '#5b5248',
      'neutral-800': '#3f3932',
      'neutral-850': '#332f2a',
      'neutral-900': '#26231f',
      'neutral-1000': '#131110',

      'neutral-bluish-00': '#fffdf8',
      'neutral-bluish-50': '#faf7f0',
      'neutral-bluish-60': '#f6f2e9',
      'neutral-bluish-75': '#f2eee4',
      'neutral-bluish-100': '#ede8dd',
      'neutral-bluish-150': '#e8e2d5',
      'neutral-bluish-200': '#e1dbcd',
      'neutral-bluish-300': '#d2cab9',
      'neutral-bluish-400': '#b6ad9b',
      'neutral-bluish-500': '#9c9382',
      'neutral-bluish-600': '#7f7666',
      'neutral-bluish-700': '#625a4c',
      'neutral-bluish-750': '#4d4640',
      'neutral-bluish-800': '#3c3832',
      'neutral-bluish-850': '#312e29',
      'neutral-bluish-875': '#2a2723',
      'neutral-bluish-900': '#252320',
      'neutral-bluish-950': '#1f1d1a',
      'neutral-bluish-1000': '#12100e',

      'deepseek-50': '#fdf4ef',
      'deepseek-100': '#f9e6dc',
      'deepseek-200': '#f1d0be',
      'deepseek-300': '#e8b598',
      'deepseek-400': '#df9671',
      'deepseek-450': ACCENT,
      'deepseek-500': '#cb6845',
      'deepseek-600': '#b05537',
      'deepseek-700-delete': '#8f452c',
      'deepseek-800': '#6f3622',
      'deepseek-900': '#552a1b',

      'green-50': '#eefaf2',
      'green-100': '#dcf7e6',
      'green-400': '#37d06c',
      'green-500': '#00c853',
      'green-500-a08': '#00c85314',
      'green-500-a12': '#00c8531f',
      'green-900': '#173a24',

      'red-50': '#fff1ec',
      'red-100': '#ffddd3',
      'red-400': '#ff7a58',
      'red-500': '#fa5b34',
      'red-600': '#e14a24',
      'red-600-a08': '#e14a2414',
      'red-400-a12': '#ff7a581f',
      'red-900': '#4a1a0e',

      'amber-100': '#fbf2de',
      'amber-400': '#f2c15c',
      'amber-500': '#e0a43a',
      'amber-600': '#b9832a',
      'amber-900': '#3a2d16',
    }

    const tokens = {}
    for (const [name, value] of Object.entries(STATIC_SCALES)) {
      tokens['--dsw-static-' + name] = both(value)
    }

    Object.assign(tokens, {
      '--dsh-font-family-text': both(UI_FONT),
      '--dsh-font-family-code': both(CODE_FONT),
      '--dsh-font-family-terminal': both(CODE_FONT),
    })

    // ── Alias tokens ────────────────────────────────────────────────────────
    Object.assign(tokens, {
      // Surfaces
      '--dsw-alias-bg-base': pair(SURFACE, '#24221f'),
      '--dsw-alias-bg-layer-1': pair('#fbf9f4', '#2b2825'),
      '--dsw-alias-bg-layer-2': pair('#efebe2', '#322f2b'),
      '--dsw-alias-bg-layer-3': pair('#e7e2d7', '#393530'),
      '--dsw-alias-bg-overlay': pair('#fbf9f4', '#302d29'),
      '--dsw-alias-bg-document-preview': pair('#f0ece3', '#2b2825'),
      '--dsw-alias-bg-document-selection': pair('color-mix(in srgb, ' + ACCENT + ' 32%, transparent)', 'color-mix(in srgb, ' + ACCENT + ' 40%, transparent)'),
      '--dsw-alias-bg-module-platform': pair('#f0ece3', '#322f2b'),
      '--dsw-alias-bg-multi-select': pair('#f0ece3', '#322f2b'),
      '--dsw-alias-bg-skeleton': pair('#1d1b160a', '#f5f3ee14'),
      '--dsw-alias-bg-mask-drop': pair('#f5f3eeb3', '#272730b3'),

      // Borders (warm ink hairlines instead of blue-black)
      '--dsw-alias-border-l1': pair('#1d1b160d', '#f5f3ee0f'),
      '--dsw-alias-border-l2': pair('#1d1b161a', '#f5f3ee1f'),
      '--dsw-alias-border-l2-darkmode-thin': pair('#1d1b161a', '#f5f3ee0f'),
      '--dsw-alias-border-l3': pair('#1d1b1621', '#f5f3ee29'),
      '--dsw-alias-border-l4': pair('#1d1b1629', '#f5f3ee33'),

      // Brand / actions
      '--dsw-alias-brand-primary': both(ACCENT),
      '--dsw-alias-brand-primary-invert': pair('#fbf9f4', '#1d1b16'),
      '--dsw-alias-brand-primary-new-colorprimary-new-color': both(ACCENT),
      '--dsw-alias-brand-text': pair(INK, '#f0ede4'),
      '--dsw-alias-button-contrast-fill': pair('#4a463f', '#f0ede4'),
      '--dsw-alias-button-elevated-fill': pair('#fbf9f4', '#322f2b'),
      '--dsw-alias-button-floating-fill': pair('#fbf9f4', '#2b2825'),
      '--dsw-alias-button-floating-hover': pair('#efebe2', '#393530'),
      '--dsw-alias-button-ghost-active-border': pair('#a89f90', '#5b5248'),
      '--dsw-alias-button-ghost-active-fill': pair('#efebe2', '#322f2b'),
      '--dsw-alias-button-ghost-active-hover': pair('#e7e2d7', '#393530'),
      '--dsw-alias-button-info-fill': both(ACCENT),
      '--dsw-alias-button-info-hover': both(ACCENT_HOVER),
      '--dsw-alias-button-primary-dimmed': pair('#f3ddd1', '#4a352b'),
      '--dsw-alias-button-primary-hover': both(ACCENT_HOVER),
      '--dsw-alias-button-tool-bar-fill': pair('#6f665680', '#54555780'),
      '--dsw-alias-button-tool-bar-fill-invisible': pair('#2a28245c', '#1f1f1f5c'),
      '--dsw-alias-button-tool-bar-hover': pair('#6f665699', '#54555799'),

      // Interaction fills
      '--dsw-alias-interactive-bg-active': pair('#1d1b1617', '#f5f3ee24'),
      '--dsw-alias-interactive-bg-hover': pair('#1d1b160d', '#f5f3ee14'),
      '--dsw-alias-interactive-bg-hover-accent': pair('#da775624', '#da77563d'),
      '--dsw-alias-interactive-bg-hover-danger': pair('#e14a2414', '#ff5f3826'),
      '--dsw-alias-interactive-bg-hover-solid': pair('#ece7dd', '#393530'),

      // Text
      '--dsw-alias-label-primary': pair(INK, '#f0ede4'),
      '--dsw-alias-label-secondary': pair('#635f56', '#bdb6a9'),
      '--dsw-alias-label-tertiary': pair('#7f7869', '#9a9285'),
      '--dsw-alias-label-caption': pair('#948d7e', '#857e71'),
      '--dsw-alias-label-dimmed': pair('#ddd7ca', '#3d3934'),
      '--dsw-alias-label-primary-dimmed': pair('#3a362f', '#d6d0c4'),
      '--dsw-alias-label-primary-foreground': both('#fffdf8'),
      '--dsw-alias-label-primary-inverted': pair('#fbf9f4', '#1d1b16'),
      '--dsw-alias-label-primary-bluish': pair('#6b4a38', '#e0b6a1'),
      '--dsw-alias-label-document-preview': pair('#4a463f', '#bdb6a9'),
      '--dsw-alias-label-deep-diving': pair('color-mix(in srgb, ' + ACCENT + ' 70%, #3a2a20)', 'color-mix(in srgb, #e0957a 55%, #b3aa98)'),
      '--dsw-alias-label-deep-diving-shimmer': pair('color-mix(in srgb, ' + ACCENT + ' 30%, #3a2a20)', 'color-mix(in srgb, #e0957a 35%, #f0ede4)'),
      '--dsw-alias-label-shimmer': pair('color-mix(in srgb, #1d1b16 30%, transparent)', 'color-mix(in srgb, #f5f3ee 45%, transparent)'),
      '--dsw-alias-menu-icon': pair('#4a463f', '#d6d0c4'),
      '--dsw-alias-link': pair('#ad5738', '#e39170'),

      // Menus, tooltips, toasts — opaque windows
      '--dsw-menu-surface-fill': pair('#fbf9f4', '#302d29'),
      '--dsw-alias-menu-group-header-fill': pair('#f7f4ed', '#35322f'),
      '--dsw-specific-menu': pair('#fbf9f4', '#302d29'),
      '--dsw-mask-blur': both('none'),
      '--dsw-menu-backdrop-filter': both('none'),
      '--dsw-alias-toast-bg': pair('#2a2824', '#3d3933'),
      '--dsw-alias-toast-label': pair('#fbf9f4', '#f0ede4'),
      '--dsw-alias-tooltip-bg': pair('#2a2824', '#3d3933'),
      '--dsw-alias-tooltip-key-bg': pair('color-mix(in srgb, #2a2824, white 18%)', 'color-mix(in srgb, #3d3933, white 18%)'),

      // Markdown and code
      '--dsw-alias-markdown-code-block': pair('#f7f5f0', CODE_BG),
      '--dsw-alias-markdown-code-block-banner': pair('#efebe2', '#34322f'),
      '--dsw-alias-markdown-code-segment-selected': pair('#fbf9f4', '#3a3732'),
      '--dsw-alias-markdown-code-segment-unselected': pair('#efebe2', '#262421'),
      '--dsw-alias-markdown-inline-code': pair('#ede8dd', '#3a3732'),
      '--dsw-alias-markdown-placeholder': pair('#e9e4d9', '#34322f'),
      '--dsw-alias-markdown-tag': pair('#efebe2', '#34322f'),
      '--dsw-alias-markdown-citation': pair('#f0ece3', '#34322f'),
      '--dsw-alias-turn-trigger-bg': pair('#f7f5f0', '#2f2c28'),
      '--dsw-alias-turn-trigger-bg-hover': pair('#efece4', '#393530'),

      // Sidebar and composer
      '--dsw-specific-sidebar-fill': pair(SHELL.sidebarFill, '#1e1d1a'),
      '--dsw-specific-sidebar-nav-item-active': pair(SHELL.navActiveFill, '#2f2c28'),
      '--dsw-specific-sidebar-nav-item-active-accent': pair('#f4e0d5', '#4a3a30'),
      '--dsw-specific-sidebar-nav-item-hover': pair('#eae5db', '#292723'),
      '--dsw-specific-input-major': pair('#fffdf8', '#2b2825'),
      '--dsw-specific-login-input': pair('#f0ece3', '#262421'),
      '--dsw-specific-selector': pair('#f0ece3', '#2c2a26'),
      '--dsw-specific-tip': pair('#f0ece3', '#2c2a26'),
      '--dsw-specific-bubble': pair('#f0ebe1', '#35322d'),
      '--dsw-specific-bubble-highlight': pair('#e6dfd2', '#403c35'),

      // Scrollbars
      '--dsw-alias-scrollbar-bg-l1': pair('#d9d2c3', '#46423b'),
      '--dsw-alias-scrollbar-bg-l2': pair('#d9d2c3', '#46423b'),
      '--dsw-alias-scrollbar-hover-l1': pair('#c7bfad', '#55504a'),
      '--dsw-alias-scrollbar-hover-l2': pair('#c7bfad', '#55504a'),

      // State colors (semanticColors from the spec)
      '--dsw-alias-state-business-primary': both(ACCENT),
      // The official menu row paints a focus ring when the merged effort
      // slider is interacted with; keep it on the theme accent (host default
      // is violet).
      '--dsw-focus-ring-color': pair(ACCENT, '#e8a184'),
      '--dsw-focus-ring-width': both('2px'),
      '--dsw-alias-state-business-tertiary': pair('#f4e0d5', '#4a352b'),
      '--dsw-alias-state-success-primary': pair('#009c3f', '#37d06c'),
      '--dsw-alias-state-success-secondary': both('#00c853'),
      '--dsw-alias-state-success-tertiary': pair('#dcf7e6', '#1f3a28'),
      '--dsw-alias-state-error-primary': pair('#e14a24', '#ff7a58'),
      '--dsw-alias-state-error-secondary': pair('#ff5f38', '#ff8a6c'),
      '--dsw-alias-state-warn-label': pair('#b07a22', '#f2c15c'),
      '--dsw-alias-state-warn-primary': pair('#d99a2b', '#e0a43a'),
      '--dsw-alias-state-warn-secondary': pair('#f0b64a', '#f2c15c'),
      '--dsw-alias-state-warn-tertiary': pair('#fbf2de', '#3a2d16'),
      '--dsw-alias-state-idle-primary': pair('#cfc7b6', '#4d4640'),
      '--dsw-alias-switch-thumb': pair('#fffdf8', '#f0ede4'),

      // Diffs
      '--dsw-alias-code-diff-added': pair('#00c8531f', '#00c85326'),
      '--dsw-alias-code-diff-deleted': pair('#e14a2414', '#ff5f3826'),
      '--dsw-alias-file-diff-added-bg': pair('#e9f8ee', '#1f3427'),
      '--dsw-alias-file-diff-added-gutter': pair('#eefaf2', '#233b2c'),
      '--dsw-alias-file-diff-added-marker': pair('#00a344', '#37d06c'),
      '--dsw-alias-file-diff-deleted-bg': pair('#fdeae4', '#3c221a'),
      '--dsw-alias-file-diff-deleted-gutter': pair('#fdf0ec', '#43271e'),
      '--dsw-alias-file-diff-deleted-marker': pair('#d94a26', '#ff7a58'),

      // Onboarding accents (used by the welcome/onboarding surfaces)
      '--dsw-alias-onboarding-accent': both(ACCENT),

      // Think fade gradients must match the surface they fade into
      '--dsw-linear-gradient-think': pair(
        'linear-gradient(180deg, ' + SURFACE + ' 20.19%, ' + SURFACE + '00 100%)',
        'linear-gradient(180deg, #24221f 20.19%, #24221f00 100%)'
      ),
      '--dsw-linear-think-select': pair(
        'linear-gradient(180deg, #efebe2 20.19%, #efebe200 100%)',
        'linear-gradient(180deg, #322f2b 20.19%, #322f2b00 100%)'
      ),

      // Syntax colors — the "Absolutely" code theme (light + dark variants)
      '--shiki-foreground': pair(CODE_FG_LIGHT, CODE_FG_DARK),
      '--shiki-background': pair('#f9f9f7', CODE_BG),
      '--shiki-token-constant': pair('#ff5f38', '#ff5f38'),
      '--shiki-token-string': pair('#00c853', '#00c853'),
      '--shiki-token-comment': pair('#939391', '#b2b2b0'),
      '--shiki-token-keyword': pair('#ff5f38', '#ff5f38'),
      '--shiki-token-parameter': pair('#bc7559', '#d28e73'),
      '--shiki-token-function': pair(CODE_FG_LIGHT, CODE_FG_DARK),
      '--shiki-token-string-expression': pair('#00c853', '#00c853'),
      '--shiki-token-punctuation': pair('#6f6d68', '#a8a6a2'),
      '--shiki-token-link': pair('#cc7d5e', '#cc7d5e'),
    })

