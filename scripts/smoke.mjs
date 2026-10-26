#!/usr/bin/env node
/**
 * Static smoke for the 2.5.2+ theme package. Zero dependencies, no browser.
 *
 * Complements (does not replace) the manual checklist in docs/SMOKE.zh.md:
 * this catches packaging/build regressions in the single client.js artifact
 * and keeps debug probes from ever shipping. `npm run check` runs it after
 * the build and syntax checks.
 */
import { createHash } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const failures = []
let passed = 0
const ok = (label) => {
  passed += 1
  console.log(`ok   ${label}`)
}
const fail = (label, detail) => {
  failures.push(label)
  console.error(`FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`)
}

const read = (rel) => readFileSync(join(root, rel), 'utf8')
const client = read('client.js')
const index = read('index.js')
const size = statSync(join(root, 'client.js')).size
const sha = createHash('sha256').update(readFileSync(join(root, 'client.js'))).digest('hex')

// 1. artifact shape: one module loader call, factory form, nothing else top-level
const loaderCalls = (client.match(/window\.__ModuleLoader__\.load\(/g) ?? []).length
loaderCalls === 1 ? ok('client.js has exactly one __ModuleLoader__.load()') : fail('loader call count', loaderCalls)
client.includes('factory(require)') ? ok('client.js keeps the factory(require) form') : fail('factory form missing')
client.includes("id: 'dsh-claude-code-desktop-theme'") ? ok('module id present') : fail('module id missing')
client.trimEnd().endsWith('})') ? ok('client.js closes the loader call') : fail('client.js tail unexpected')

// 2. package budget (D6: <= 4.5 MB)
const MB = 1024 * 1024
size <= 4.5 * MB ? ok(`bundle size ${(size / MB).toFixed(2)} MB <= 4.5 MB`) : fail('bundle size', `${size} B`)
size > 3.5 * MB ? ok('embedded font still inlined (expected until D8/M0-S6)') : fail('font missing? artifact too small')

// 3. preserve the capabilities the manual SMOKE covers
const required = [
  ['usage card slot', 'conversation.input.dock'],
  ['data bridge slot', 'conversation.composer.dock'],
  ['effort slider slot', 'conversation.input.right'],
  ['realtime voice', 'dsh-theme-live-voice'],
  ['desktop pet', 'mountDesktopPet'],
  ['diff review', 'mountDiffReview'],
  ['sidebar status dots', 'mountSessionStatus'],
  ['composer hud', 'mountComposerTray'],
  ['theme tokens layer', 'overrideTokens'],
  ['diagnostics: font', '__dshClaudeThemeFontDebug'],
  ['diagnostics: layout', '__dshClaudeThemeLayoutDebug'],
  ['diagnostics: hud', '__dshClaudeThemeHudDebug'],
  ['diagnostics: pet', '__dshClaudeThemePetDebug'],
  ['diagnostics: status', '__dshClaudeThemeStatusDebug'],
  ['diagnostics: anchors', '__dshClaudeThemeAnchors'],
  ['diagnostics: runtime', '__dshClaudeThemeRuntime'],
]
for (const [label, needle] of required) {
  client.includes(needle) ? ok(`capability present: ${label}`) : fail(`capability missing: ${label}`)
}

// 4. host routes stay in the Host half
for (const route of ['usage-summary', 'update-status', 'update-apply']) {
  index.includes(route) ? ok(`host route present: ${route}`) : fail(`host route missing: ${route}`)
}

// 5. no debug probes ship
for (const probe of ['TEMP-M0S3', 'M0S3 RELOAD OK', 'TEMP-M0S4', 'm0s2Probe', '__m0s2Probe', 'M0-S2 probe']) {
  client.includes(probe) ? fail(`debug probe leaked: ${probe}`) : ok(`no probe: ${probe}`)
}

console.log(`\nsmoke: client.js ${(size / MB).toFixed(2)} MB sha256=${sha.slice(0, 16)}…`)
if (failures.length > 0) {
  console.error(`smoke: ${failures.length} failure(s)`)
  process.exit(1)
}
console.log(`smoke: ${passed} checks passed`)