/**
 * dsh-claude-code-desktop-theme — Client half.
 *
 * Applies a Claude Code desktop style palette to the Harness Web GUI by
 * stacking one alias-token override layer over the active theme. The values
 * come from the requested theme spec:
 *
 *   surface  #f5f3ee   ink #1d1b16   accent #da7756
 *   contrast 60        opaque windows
 *   fonts: embedded "DSH Serif UI", code "SF Mono"
 *   semantic: diffAdded #00c853, diffRemoved #ff5f38, skill #cc7d5e
 *   code theme "Absolutely" (light and dark variants)
 *
 * Every literal color becomes a `--dsw-*` / `--shiki-*` / `--dsh-*` token so
 * the rest of the UI keeps inheriting a single coherent palette. The override
 * layer is owned by this plugin's effect: unloading or disabling the bundle
 * restores the built-in theme.
 */

window.__ModuleLoader__.load({
  id: 'dsh-claude-code-desktop-theme',
  factory(require) {
    const PLUGIN_ID = 'dsh-claude-code-desktop-theme'
    const React = require('react')

