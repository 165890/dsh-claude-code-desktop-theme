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
const KB = 1024
size <= 4.5 * MB ? ok(`bundle size ${(size / MB).toFixed(2)} MB <= 4.5 MB`) : fail('bundle size', `${size} B`)
size <= 1.2 * MB ? ok(`bundle size after font externalization ${(size / KB).toFixed(0)} KB <= 1.2 MB`) : fail('font still inlined? artifact too large', `${size} B`)
client.includes('data:font/woff2') ? fail('inline woff2 base64 marker still present') : ok('no inline woff2 base64 in client.js')
client.includes('UI_SERIF_BASE64') ? fail('UI_SERIF_BASE64 symbol still present') : ok('UI_SERIF_BASE64 symbol removed')
client.includes('data:font/ttf') ? ok('hero serif subset stays inline (3.9 KB, intentional)') : fail('hero serif subset missing')

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
  ['external serif loader', 'loadExternalSerif'],
  ['font source diagnostic', 'fontDebugState'],
]
for (const [label, needle] of required) {
  client.includes(needle) ? ok(`capability present: ${label}`) : fail(`capability missing: ${label}`)
}

// 4. host routes stay in the Host half
for (const route of ['usage-summary', 'update-status', 'update-apply', 'font']) {
  index.includes(route) ? ok(`host route present: ${route}`) : fail(`host route missing: ${route}`)
}

// 4b. external font transport (D8/M0-S6): exact allowlist, GET+HEAD, immutable
const fontPath = '/api/dsh-claude-code-desktop-theme/font'
index.includes(fontPath) ? ok('font route path present') : fail('font route path missing')
index.includes("methods: ['GET', 'HEAD']") ? ok('font route declares GET + HEAD') : fail('font route methods missing')
index.includes("'content-type': 'font/woff2'") ? ok('font route content-type font/woff2') : fail('font content-type missing')
index.includes('public, max-age=31536000, immutable') ? ok('font route immutable cache-control') : fail('font cache-control missing')
index.includes('asset.etag') && index.includes('last-modified') ? ok('font route ETag + Last-Modified') : fail('font validators missing')
index.includes('ui-serif-gb2312.woff2') ? ok('font allowlist names the packaged asset') : fail('font allowlist missing')
index.includes('base64') ? fail('host index.js still embeds base64') : ok('host index.js has no base64 payload')
Math.max(...index.split('\n').map((line) => line.length)) < 20000 ? ok('index.js lines stay small (no inlined payload)') : fail('index.js has an oversized line')

// 4c. asset shipped in the npm package and byte-identical to the retired base64
const assetRel = 'assets/ui-serif-gb2312.woff2'
const assetPath = join(root, assetRel)
const assetBytes = readFileSync(assetPath)
const assetSha = createHash('sha256').update(assetBytes).digest('hex')
assetBytes.length === 2620392 ? ok('font asset bytes 2,620,392') : fail('font asset size', `${assetBytes.length} B`)
assetSha === 'ca4a4fcd091a87b9dc98b62a2c62f743c225b122a467778d530e52a6abae2fe8'
  ? ok('font asset sha256 ca4a4fcd… (matches decoded base64)')
  : fail('font asset sha256 changed', assetSha)
assetBytes.subarray(0, 4).toString('latin1') === 'wOF2' ? ok('font asset has woff2 magic') : fail('font asset magic wrong')
const manifestFiles = JSON.parse(read('package.json')).files ?? []
manifestFiles.includes(assetRel) ? ok('package.json files includes font asset') : fail('package.json files missing font asset')

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