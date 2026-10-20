#!/usr/bin/env node
/**
 * One-shot release for dsh-claude-code-desktop-theme.
 *
 * Why this exists
 * ---------------
 * `npm publish` against a version that is already sitting in npm's staging
 * area fails with HTTP 409 ("Cannot publish over previously staged version"),
 * and staged versions never show up in `npm view`. Checking `npm view` in a
 * retry loop therefore looks like a permanent failure: it produced 60 `npm
 * view` calls, 38 `npm publish` attempts and seven repeats of the same
 * `npm stage approve` in one night.
 *
 * This script never loops. Every step runs at most once, and when it stops it
 * prints the exact command to run next.
 *
 * Usage
 *   npm run release           # publish the version in package.json
 *   npm run release -- --dry  # run every check, write nothing
 *
 * Requires an npm Automation token. See docs/RELEASE.md.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DRY = process.argv.includes('--dry')

const tty = process.stdout.isTTY === true
const paint = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s)
const dim = paint('2')
const red = paint('31')
const green = paint('32')
const yellow = paint('33')

function step(message) {
  console.log(`${dim('>')} ${message}`)
}

function stop(message) {
  console.error(`\n${red('FAILED')}\n${message}\n`)
  process.exit(1)
}

/** Run npm once. Never retries. */
function npm(args, { allowFail = false } = {}) {
  const command = `npm ${args}`
  try {
    const out = execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    return { ok: true, out: out.trim() }
  } catch (error) {
    const out = `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
    if (allowFail) return { ok: false, out }
    stop(`Command failed: ${command}\n${out}`)
  }
}

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
const NAME = pkg.name
const VERSION = pkg.version

console.log(`\n${NAME}@${VERSION}${DRY ? dim('   (dry run)') : ''}\n`)

// 1. A dirty tree means the published tarball would not match any commit.
let status = ''
try {
  status = execSync('git status --porcelain', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()
} catch (error) {
  stop(`Could not read git status. Run this from a git checkout.\n${error.message}`)
}
if (status !== '') {
  stop(
    `Working tree has uncommitted changes. Commit them first so the\n` +
      `published tarball matches a known commit.\n\n${status}`,
  )
}

// 2. Syntax gate, same check CI runs.
step('syntax check')
const check = npm('run check', { allowFail: true })
if (!check.ok) stop(`Syntax check failed:\n${check.out}`)

// 3. Package size, so a surprise multi-megabyte upload is visible up front.
step('package preview')
const pack = npm('pack --dry-run --json', { allowFail: true })
if (pack.ok) {
  try {
    const parsed = JSON.parse(pack.out)
    const info = Array.isArray(parsed) ? parsed[0] : parsed
    if (info?.size) {
      const mb = (info.size / 1024 / 1024).toFixed(2)
      const count = info.files?.length ?? info.entryCount ?? '?'
      console.log(`  ${info.filename ?? 'tarball'}  ${mb} MB  (${count} files)`)
    }
  } catch {
    // size is informational only
  }
}

function readTags() {
  const res = npm(`dist-tag ls ${NAME}`, { allowFail: true })
  const map = {}
  for (const line of res.out.split(/\r?\n/)) {
    const at = line.indexOf(':')
    if (at > 0) map[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return map
}

/** Point `latest` at VERSION when it is not already there. One attempt. */
function ensureLatest({ soft = false } = {}) {
  step('align latest tag')
  const tags = readTags()
  if (tags.latest === VERSION) {
    console.log(green(`  latest is already ${VERSION}`))
    return
  }
  if (DRY) {
    console.log(yellow(`  latest=${tags.latest ?? '(none)'}; a real run would move it to ${VERSION}`))
    return
  }
  console.log(`  latest=${tags.latest ?? '(none)'} -> ${VERSION}`)
  const res = npm(`dist-tag add ${NAME}@${VERSION} latest`, { allowFail: true })
  if (!res.ok) {
    const hint =
      `Could not move the latest tag:\n${res.out}\n\n` +
      `The version itself may already be published. Fix the tag manually:\n\n` +
      `  npm dist-tag add ${NAME}@${VERSION} latest`
    if (soft) {
      console.log(yellow(`  ${hint}`))
      return
    }
    stop(hint)
  }
  console.log(green(`  latest -> ${VERSION}`))
}

/** Exactly one confirmation read. A cached CDN response is not a failure. */
function verifyOnce() {
  step('verify (single read)')
  const seen = npm(`view ${NAME}@${VERSION} version`, { allowFail: true })
  if (seen.ok && seen.out.trim() === VERSION) {
    console.log(green(`  ${VERSION} is live on npm`))
  } else {
    console.log(yellow(`  npm view does not show ${VERSION} yet (CDN cache, usually 1-2 min).`))
    console.log(yellow('  That is normal. Do not publish again.'))
  }
  const tags = readTags()
  for (const [tag, version] of Object.entries(tags)) console.log(`  ${tag}: ${version}`)
}

/** Find a staged build for this exact version, if npm is new enough to list it. */
function findStaged() {
  const res = npm(`stage list ${NAME}`, { allowFail: true })
  if (!res.ok) return null
  const blocks = []
  let current = null
  for (const line of res.out.split(/\r?\n/)) {
    if (line.trim() === '') {
      if (current !== null) {
        blocks.push(current)
        current = null
      }
      continue
    }
    const match = /^([A-Za-z][A-Za-z ]*?):\s*(.*)$/.exec(line)
    if (match === null) continue
    const key = match[1].trim().toLowerCase()
    if (key === 'id') {
      if (current !== null) blocks.push(current)
      current = { id: match[2].trim() }
    } else if (current !== null) {
      current[key] = match[2].trim()
    }
  }
  if (current !== null) blocks.push(current)
  const hit = blocks.find((b) => b.version === VERSION && b.status === 'staged')
  return hit?.id ?? null
}

// 4. Already published? Then only the tag can be wrong.
step(`check whether ${NAME}@${VERSION} is already published`)
const existing = npm(`view ${NAME}@${VERSION} version`, { allowFail: true })
if (existing.ok && existing.out.trim() === VERSION) {
  console.log(yellow(`  ${VERSION} is already on npm, skipping publish`))
  ensureLatest()
  verifyOnce()
  console.log(green(`\nDone: ${NAME}@${VERSION} is available\n`))
  process.exit(0)
}

// 5. A leftover staged build blocks publish with 409. Approve it instead.
step('check npm staging')
const stagedId = findStaged()
if (stagedId !== null) {
  console.log(yellow(`  found a staged build for ${VERSION}: ${stagedId}`))
  if (DRY) {
    console.log(yellow('  --dry: a real run would approve this record instead of publishing again'))
    console.log(yellow('\n--dry: all checks passed, nothing was written\n'))
    process.exit(0)
  }
  step('approve the staged build instead of publishing again')
  const approved = npm(`stage approve ${stagedId}`, { allowFail: true })
  if (!approved.ok) {
    stop(
      `Approval failed. This step usually needs a 2FA one-time password.\n` +
        `Run it once in an interactive terminal, finish the browser prompt,\n` +
        `then run "npm run release" again:\n\n` +
        `  npm stage approve ${stagedId}\n\n${approved.out}`,
    )
  }
  ensureLatest()
  verifyOnce()
  console.log(green(`\nDone: ${NAME}@${VERSION} is published\n`))
  process.exit(0)
}

if (DRY) {
  console.log(yellow('\n--dry: all checks passed, npm publish was not executed\n'))
  process.exit(0)
}

// 6. Publish. One attempt; known failures get a concrete next step.
step(`publish ${NAME}@${VERSION}`)
const published = npm('publish --access public', { allowFail: true })
if (!published.ok) {
  if (/409/.test(published.out) && /staged version/i.test(published.out)) {
    stop(
      `This version already exists in npm's staging area, so a normal\n` +
        `publish cannot overwrite it. List the record, then approve its id:\n\n` +
        `  npm stage list ${NAME}\n` +
        `  npm stage approve <id>\n\n${published.out}`,
    )
  }
  if (/EOTP|one-time password|requires a one-time/i.test(published.out)) {
    stop(
      `npm asked for a 2FA one-time password, which means the current token\n` +
        `is not an Automation token. Create one at\n` +
        `https://www.npmjs.com/settings/~/tokens (type: Automation) and put it in\n` +
        `~/.npmrc:\n\n` +
        `  //registry.npmjs.org/:_authToken=<automation token>\n\n` +
        `See docs/RELEASE.md for the full checklist.\n\n${published.out}`,
    )
  }
  stop(`npm publish failed:\n${published.out}`)
}

console.log(green('  publish accepted'))
ensureLatest({ soft: true })
verifyOnce()
console.log(green(`\nDone: ${NAME}@${VERSION}\n`))
