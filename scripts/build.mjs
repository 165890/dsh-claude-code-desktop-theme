#!/usr/bin/env node
/**
 * Zero-dependency build for the Client half.
 *
 * `client.js` is one dynamic-package module (single file, no import/export,
 * no JSX) that the Harness Module Loader evaluates as a whole. The split into
 * `src/client/parts/*` is therefore a *concatenation*, not a module graph:
 *
 *   client.js == parts[0] + parts[1] + ... + parts[n]   (byte for byte)
 *
 * The M0-S3 migration kept the concatenated bytes identical to the sealed
 * baseline (see docs/BUILD.zh.md). Do not reorder parts, add banners, or
 * insert separators: order is behavior.
 *
 * Usage:
 *   node scripts/build.mjs           write client.js from the manifest
 *   node scripts/build.mjs --check   fail when client.js is stale
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = join(root, 'src/client/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const output = manifest.output ?? 'client.js'
const outPath = join(root, output)
const check = process.argv.includes('--check')

if (!Array.isArray(manifest.parts) || manifest.parts.length === 0) {
  console.error('build: src/client/manifest.json has no parts')
  process.exit(2)
}

const chunks = []
for (const rel of manifest.parts) {
  const partPath = join(root, rel)
  if (!existsSync(partPath)) {
    console.error(`build: missing part ${rel}`)
    process.exit(2)
  }
  const bytes = readFileSync(partPath)
  if (bytes.length === 0) {
    console.error(`build: empty part ${rel}`)
    process.exit(2)
  }
  chunks.push(bytes)
}

const built = Buffer.concat(chunks)
const sha = createHash('sha256').update(built).digest('hex')
const pretty = `${built.length.toLocaleString('en-US')} B / ${sha.slice(0, 16)}…`

if (check) {
  if (!existsSync(outPath)) {
    console.error(`build --check: ${output} is missing; run "npm run build"`)
    process.exit(1)
  }
  const current = readFileSync(outPath)
  if (!current.equals(built)) {
    console.error(
      `build --check: ${output} is stale (${current.length} B vs built ${built.length} B); run "npm run build"`,
    )
    process.exit(1)
  }
  console.log(`build --check: ${output} matches ${manifest.parts.length} parts (${pretty})`)
} else if (existsSync(outPath) && readFileSync(outPath).equals(built)) {
  console.log(`build: unchanged (${manifest.parts.length} parts, ${pretty})`)
} else {
  writeFileSync(outPath, built)
  console.log(`build: wrote ${output} (${manifest.parts.length} parts, ${pretty})`)
}