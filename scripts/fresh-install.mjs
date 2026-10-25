#!/usr/bin/env node
/**
 * "What does a brand-new machine actually install?"
 *
 * Why this exists
 * ---------------
 * Publishing a version and pointing `latest` at it is not enough. pnpm 11
 * enables `minimumReleaseAge` by default: a release younger than the waiting
 * period is skipped even when `latest` names it, and the resolver falls back to
 * the newest version that has cleared the wait. On 2026-10-20 that is exactly
 * what a reporter saw: 2.5.0 was live and `latest`, yet a fresh install on a
 * friend's laptop resolved 2.1.5 — because 2.2.0, 2.2.1 and 2.5.0 were all
 * younger than the window while 2.1.5 was old enough.
 *
 * `npm view` cannot show this, and neither can the registry's dist-tags. Only a
 * real resolve can, so this probe performs one: a throwaway project in the
 * system temp directory, its own pnpm cache and store, and nothing inherited
 * from the checkout. It is the same answer that laptop got.
 *
 * The probe prefers the pnpm DSH ships, because that is the binary a user's
 * plugin manager actually runs; a `pnpm` on PATH is the fallback.
 *
 * Usage
 *   node scripts/fresh-install.mjs        # what a new machine gets right now
 *   npm run check:install
 *
 * Exit codes
 *   0  a fresh install resolves the version in package.json
 *   1  a fresh install resolves an older version (supply-chain cooldown)
 *   2  no pnpm could be run, or the lockfile could not be read
 */

import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** pnpm 11's default waiting period, in minutes. */
export const MIN_RELEASE_AGE_MINUTES = 24 * 60

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** The manifest this repository would publish. */
export function readPackage(root = ROOT) {
  return JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
}

/** Quote one shell argument; `execSync` needs a command string on Windows. */
function quote(value) {
  return /^[\w@%+=:,./\\-]+$/.test(value) ? value : `"${value.replace(/"/g, '\\"')}"`
}

function run(command, args, cwd) {
  return execSync(`${command} ${args.map(quote).join(' ')}`, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
}

/**
 * Every pnpm worth asking, most faithful first. The DSH installer runs the
 * pnpm it ships, so that one answers exactly what a user's machine does.
 */
function pnpmCandidates() {
  const list = []
  const override = process.env.DSH_PNPM ?? process.env.PNPM_BIN
  if (override !== undefined && override !== '') {
    list.push(/\.c?js$/.test(override) ? `${quote(process.execPath)} ${quote(override)}` : quote(override))
  }

  const shipped = []
  if (process.env.LOCALAPPDATA !== undefined) {
    shipped.push(
      join(
        process.env.LOCALAPPDATA,
        'Programs',
        'DeepSeek Harness',
        'resources',
        'runtime',
        'primary-runtime',
        'dependencies',
        'pnpm',
        'bin',
        'pnpm.cjs',
      ),
    )
  }
  shipped.push(
    '/Applications/DeepSeek Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.cjs',
  )
  for (const cjs of shipped) {
    if (existsSync(cjs)) list.push(`${quote(process.execPath)} ${quote(cjs)}`)
  }

  list.push('pnpm')
  return list
}

/** The first pnpm that actually runs here, cached for the rest of the probe. */
let workingPnpm
function pnpm() {
  if (workingPnpm !== undefined) return workingPnpm
  const failures = []
  for (const candidate of pnpmCandidates()) {
    try {
      run(candidate, ['--version'], ROOT)
      workingPnpm = candidate
      return candidate
    } catch (error) {
      failures.push(`${candidate}: ${String(error.stderr ?? error.message).trim().split('\n')[0]}`)
    }
  }
  throw new Error(`No pnpm could be run.\n${failures.join('\n')}`)
}

/** Registry publish time of one version, or null when it cannot be read. */
function publishTimeOf(name, version) {
  try {
    const raw = JSON.parse(run('npm', ['view', name, 'time', '--json'], ROOT))[version]
    return raw === undefined ? null : new Date(raw)
  } catch {
    return null
  }
}

/**
 * Resolve `name@latest` the way a fresh machine does.
 *
 * @returns {{ ok: true, installed: string }
 *   | { ok: false, reason: 'pnpm-missing' | 'unreadable-lockfile' | 'supply-chain-cooldown',
 *       installed?: string, version: string, publishedAt?: Date | null,
 *       plainInstallFrom?: Date | null }}
 */
export function probeFreshInstall(name, version) {
  let runner
  try {
    runner = pnpm()
  } catch {
    return { ok: false, reason: 'pnpm-missing', version }
  }

  const dir = mkdtempSync(join(tmpdir(), 'dsh-fresh-install-'))
  try {
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'dsh-fresh-install-probe', private: true, version: '0.0.0' }),
    )
    run(
      runner,
      [
        'add',
        `${name}@latest`,
        '--lockfile-only',
        '--ignore-scripts',
        `--cache-dir=${join(dir, '.cache')}`,
        `--store-dir=${join(dir, '.store')}`,
      ],
      dir,
    )

    const lockfile = readFileSync(join(dir, 'pnpm-lock.yaml'), 'utf8')
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = new RegExp(`^\\s+${escaped}@([^:\\s]+):`, 'm').exec(lockfile)
    if (match === null) return { ok: false, reason: 'unreadable-lockfile', version }

    const installed = match[1]
    if (installed === version) return { ok: true, installed }

    const publishedAt = publishTimeOf(name, version)
    const plainInstallFrom =
      publishedAt === null ? null : new Date(publishedAt.getTime() + MIN_RELEASE_AGE_MINUTES * 60_000)
    return {
      ok: false,
      reason: 'supply-chain-cooldown',
      installed,
      version,
      publishedAt,
      plainInstallFrom,
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** One plain-language paragraph for whoever has to answer the reporter. */
export function describeProbe(name, version, result) {
  if (result.ok) return `a fresh install resolves ${name}@${result.installed}`
  if (result.reason === 'pnpm-missing') return 'no pnpm could be run, so a fresh install was not resolved'
  if (result.reason === 'unreadable-lockfile') return 'pnpm wrote a lockfile this probe could not read'

  const lines = [
    `a fresh install resolves ${name}@${result.installed}, not ${version}`,
    `pnpm 11 skips releases younger than ${MIN_RELEASE_AGE_MINUTES / 60} h (minimumReleaseAge) and falls back to the newest older version.`,
  ]
  if (result.plainInstallFrom !== null && result.plainInstallFrom !== undefined) {
    lines.push(
      `${version} becomes installable without a version pin after ${result.plainInstallFrom.toLocaleString()}.`,
    )
  }
  lines.push(`Until then users must install the exact version: ${name}@${version}`)
  return lines.join('\n')
}

function main() {
  const pkg = readPackage()
  const result = probeFreshInstall(pkg.name, pkg.version)
  console.log(describeProbe(pkg.name, pkg.version, result))

  if (result.ok) process.exit(0)
  if (result.reason === 'pnpm-missing' || result.reason === 'unreadable-lockfile') process.exit(2)
  process.exit(1)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}