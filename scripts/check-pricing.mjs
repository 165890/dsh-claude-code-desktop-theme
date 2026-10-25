#!/usr/bin/env node
/**
 * Offline check for the Host spend-estimate resolver.
 *
 * Runs without a Harness host, network access or a user profile: it imports
 * `index.js`, points `DSH_THEME_PRICING_FILE` at a throwaway temp file and
 * walks every layer of the estimator:
 *
 *   1. exact catalog rows for the official DeepSeek models;
 *   2. family rules for external providers (deepseek / qwen / glm / kimi /
 *      minimax / gpt / claude / gemini / grok) and the unknown-model fallback;
 *   3. the configurable peak/valley clock;
 *   4. the optional `pricing.json` override file (exact, `provider:model`,
 *      prefix, `*` glob, malformed entries, malformed JSON);
 *   5. the end-to-end `buildSessionCost` fold, including a mixed-currency
 *      session and a session with no model information.
 *
 * Usage:
 *   node scripts/check-pricing.mjs
 *   npm run check          (once package.json's `check` script includes it)
 *
 * Exit code 0 means every case passed; 1 means at least one failure.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const tempDir = mkdtempSync(join(tmpdir(), 'dsh-pricing-check-'))
const overridePath = join(tempDir, 'pricing.json')
// Redirect the loader before anything reads the user's real override file.
process.env.DSH_THEME_PRICING_FILE = overridePath

const { resolvePricing, isPeakTime, loadPricingState, buildSessionCost, pricingFilePath, PRICING_UNIT } =
  await import(new URL('../index.js', import.meta.url).href)

const results = []
let crashed = false

/** Record one named case; a thrown error marks it failed. */
function check(name, run) {
  try {
    const detail = run()
    results.push({ ok: true, name, detail: detail ?? '' })
  } catch (error) {
    results.push({ ok: false, name, detail: String(error?.message ?? error) })
  }
}

/** Minimal assertion helper (keeps the script dependency-free). */
function expect(condition, message) {
  if (!condition) throw new Error(message)
}

function expectEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}

/** `{ observeSession }` stub for buildSessionCost. */
function fakeSession(events) {
  return { observeSession: async () => ({ events }) }
}

function header(provider, model) {
  return { type: 'request/header', data: { header: { config: { provider, model } } } }
}

function usageEvent(time, usage) {
  return { type: 'assistant/message', time, data: { usage } }
}

/** Beijing weekday peak moment: Monday 2026-10-19 10:00 (02:00Z). */
const PEAK_MONDAY = Date.UTC(2026, 9, 19, 2, 0, 0)
const OFFPEAK_MONDAY_LUNCH = Date.UTC(2026, 9, 19, 4, 30, 0) // 12:30 Beijing
const OFFPEAK_MONDAY_EVENING = Date.UTC(2026, 9, 19, 10, 0, 0) // 18:00 Beijing
const PEAK_SATURDAY = Date.UTC(2026, 9, 24, 2, 0, 0) // Saturday 10:00 Beijing

try {
  // ── 1. built-in catalog ────────────────────────────────────────────────
  check('官方模型：deepseek-v4-pro 命中精确价格目录', () => {
    const resolved = resolvePricing('deepseek', 'deepseek-v4-pro')
    expect(resolved !== null, 'no resolution')
    expectEqual(resolved.priceSource, 'catalog', 'priceSource')
    expectEqual(resolved.matchedKey, 'deepseek-v4-pro', 'matchedKey')
    expectEqual(resolved.currency, 'CNY', 'currency')
    expectEqual(resolved.estimated, true, 'estimated')
    expectEqual(resolved.entry.mode, 'peak-valley', 'mode')
    expectEqual(resolved.unit, PRICING_UNIT, 'unit')
    return `${resolved.priceSource} ${resolved.matchedKey} ${resolved.currency}`
  })

  check('官方模型：provider 前缀 + 模型 id 双重命中', () => {
    const resolved = resolvePricing('deepseek', 'deepseek-chat')
    expectEqual(resolved.priceSource, 'catalog', 'priceSource')
    expectEqual(resolved.matchedKey, 'deepseek-chat', 'matchedKey')
    expectEqual(resolved.entry.price.inputCacheMiss, 2, 'inputCacheMiss')
    return `${resolved.priceSource} ${resolved.matchedKey}`
  })

  check('官方模型：大小写不敏感', () => {
    const resolved = resolvePricing('deepseek', 'DeepSeek-V4-Pro')
    expectEqual(resolved.priceSource, 'catalog', 'priceSource')
    expectEqual(resolved.matchedKey, 'deepseek-v4-pro', 'matchedKey')
    return resolved.matchedKey
  })

  check('官方模型：deepseek-reasoner 有独立官方价', () => {
    const resolved = resolvePricing('deepseek', 'deepseek-reasoner')
    expectEqual(resolved.priceSource, 'catalog', 'priceSource')
    expectEqual(resolved.entry.price.output, 16, 'output')
    return 'catalog deepseek-reasoner'
  })

  // ── 2. external provider family rules ──────────────────────────────────
  check('外接：pi-ai 的 deepseek-v4.1-flash-1017 落到 DeepSeek 族', () => {
    const resolved = resolvePricing('pi-ai', 'deepseek-v4.1-flash-1017')
    expectEqual(resolved.priceSource, 'family', 'priceSource')
    expectEqual(resolved.matchedKey, 'family:deepseek-flash', 'matchedKey')
    expectEqual(resolved.currency, 'CNY', 'currency')
    expectEqual(resolved.entry.mode, 'peak-valley', 'mode')
    return `${resolved.matchedKey} ${resolved.currency}`
  })

  check('外接：qwen-token-plan-cn 的 qwen3.8-max 落到 qwen-max 档', () => {
    const resolved = resolvePricing('qwen-token-plan-cn', 'qwen3.8-max')
    expectEqual(resolved.priceSource, 'family', 'priceSource')
    expectEqual(resolved.matchedKey, 'family:qwen-max', 'matchedKey')
    expectEqual(resolved.entry.price.inputCacheMiss, 2.4, 'inputCacheMiss')
    expectEqual(resolved.entry.price.output, 9.6, 'output')
    expectEqual(resolved.currency, 'CNY', 'currency')
    return `${resolved.matchedKey} ${resolved.currency}`
  })

  check('外接：qwen-plus 变体落到 qwen-plus 档', () => {
    const resolved = resolvePricing('qwen-token-plan-cn', 'qwen-plus-2026-01')
    expectEqual(resolved.matchedKey, 'family:qwen-plus', 'matchedKey')
    return resolved.matchedKey
  })

  check('外接：glm-5.3 落到 glm 族', () => {
    const resolved = resolvePricing('zhipu', 'glm-5.3')
    expectEqual(resolved.matchedKey, 'family:glm', 'matchedKey')
    expectEqual(resolved.currency, 'CNY', 'currency')
    return `${resolved.matchedKey} ${resolved.currency}`
  })

  check('外接：kimi-k2.5 落到 kimi-k2 档', () => {
    const resolved = resolvePricing('moonshot', 'kimi-k2.5')
    expectEqual(resolved.matchedKey, 'family:kimi-k2', 'matchedKey')
    expectEqual(resolved.currency, 'CNY', 'currency')
    return resolved.matchedKey
  })

  check('外接：MiniMax-M2.5 落到 minimax-m2 档', () => {
    const resolved = resolvePricing('minimax', 'MiniMax-M2.5')
    expectEqual(resolved.matchedKey, 'family:minimax-m2', 'matchedKey')
    expectEqual(resolved.currency, 'CNY', 'currency')
    return resolved.matchedKey
  })

  check('外接：gpt-5.4 落到 gpt-5 档（USD）', () => {
    const resolved = resolvePricing('openai', 'gpt-5.4')
    expectEqual(resolved.matchedKey, 'family:gpt-5', 'matchedKey')
    expectEqual(resolved.currency, 'USD', 'currency')
    return `${resolved.matchedKey} ${resolved.currency}`
  })

  check('外接：claude-sonnet-4.6 落到 sonnet 档（USD）', () => {
    const resolved = resolvePricing('anthropic', 'claude-sonnet-4.6')
    expectEqual(resolved.matchedKey, 'family:claude-sonnet', 'matchedKey')
    expectEqual(resolved.entry.price.output, 15, 'output')
    expectEqual(resolved.currency, 'USD', 'currency')
    return `${resolved.matchedKey} ${resolved.currency}`
  })

  check('外接：模型名无族信息时按 provider 前缀兜底', () => {
    const resolved = resolvePricing('qwen-token-plan-cn', 'gateway-alias-7')
    expectEqual(resolved.priceSource, 'family', 'priceSource')
    expectEqual(resolved.matchedKey, 'provider:qwen', 'matchedKey')
    return resolved.matchedKey
  })

  check('未知模型：给出保守估算而不是空值', () => {
    const resolved = resolvePricing('mystery-gateway', 'acme-ultra-9000')
    expect(resolved !== null, 'no resolution')
    expectEqual(resolved.priceSource, 'none', 'priceSource')
    expectEqual(resolved.matchedKey, null, 'matchedKey')
    expectEqual(resolved.estimated, true, 'estimated')
    expectEqual(resolved.entry.price.inputCacheMiss > 0, true, 'fallback input rate')
    expectEqual(resolved.entry.price.output > 0, true, 'fallback output rate')
    return `none fallback ${resolved.currency}`
  })

  check('空模型 id 不产生价格', () => {
    expectEqual(resolvePricing('qwen', ''), null, 'empty model')
    expectEqual(resolvePricing('qwen', '   '), null, 'blank model')
    return 'null'
  })

  check('价格单位固定为每百万 tokens', () => {
    expectEqual(PRICING_UNIT, 'per-1m-tokens', 'unit')
    return PRICING_UNIT
  })

  // ── 3. configurable peak/valley clock ─────────────────────────────────
  check('峰谷：北京时间工作日 10:00 为峰时', () => {
    expectEqual(isPeakTime(PEAK_MONDAY), true, '10:00 Beijing')
    return 'peak'
  })

  check('峰谷：北京时间 12:00–14:00 与 18:00 后为谷时', () => {
    expectEqual(isPeakTime(OFFPEAK_MONDAY_LUNCH), false, '12:30 Beijing')
    expectEqual(isPeakTime(OFFPEAK_MONDAY_EVENING), false, '18:00 Beijing')
    return 'off-peak'
  })

  check('峰谷：周末全天谷时', () => {
    expectEqual(isPeakTime(PEAK_SATURDAY), false, 'Saturday')
    return 'off-peak'
  })

  check('峰谷：可关闭', () => {
    expectEqual(isPeakTime(PEAK_MONDAY, { enabled: false }), false, 'disabled')
    return 'disabled'
  })

  check('峰谷：可配置时区与窗口', () => {
    const utcConfig = { enabled: true, utcOffsetMinutes: 0, weekdays: [1], windows: [[540, 600]] }
    expectEqual(isPeakTime(Date.UTC(2026, 9, 19, 9, 30), utcConfig), true, 'UTC 09:30 Monday')
    expectEqual(isPeakTime(Date.UTC(2026, 9, 19, 10, 30), utcConfig), false, 'UTC 10:30 Monday')
    return 'custom window'
  })

  // ── 4. user overrides ─────────────────────────────────────────────────
  check('覆盖文件：路径可由 DSH_THEME_PRICING_FILE 指定', () => {
    expectEqual(pricingFilePath(), overridePath, 'pricingFilePath')
    return overridePath
  })

  writeFileSync(
    overridePath,
    JSON.stringify(
      {
        models: {
          'qwen3.8-max': { input: 0.5, output: 2, cacheRead: 0.05, currency: 'CNY' },
          'deepseek-v4-pro': { input: 1, output: 3, currency: 'USD' },
          'pi-ai:custom-gateway-model': { input: 1, output: 3, currency: 'USD' },
          'vendor-*': { input: 2, output: 4 },
          'bad-model': { input: 'not-a-number' },
        },
        peakValley: { enabled: false },
      },
      null,
      2,
    ),
    'utf8',
  )
  loadPricingState({ force: true })

  check('覆盖文件：精确模型覆盖优先于内置族规则', () => {
    const resolved = resolvePricing('qwen-token-plan-cn', 'qwen3.8-max')
    expectEqual(resolved.priceSource, 'override', 'priceSource')
    expectEqual(resolved.matchedKey, 'qwen3.8-max', 'matchedKey')
    expectEqual(resolved.entry.price.inputCacheMiss, 0.5, 'input')
    expectEqual(resolved.entry.price.inputCacheHit, 0.05, 'cacheRead')
    expectEqual(resolved.currency, 'CNY', 'currency')
    return `override ${resolved.matchedKey}`
  })

  check('覆盖文件：用户价覆盖内置精确目录', () => {
    const resolved = resolvePricing('deepseek', 'deepseek-v4-pro')
    expectEqual(resolved.priceSource, 'override', 'priceSource')
    expectEqual(resolved.currency, 'USD', 'currency')
    expectEqual(resolved.entry.price.inputCacheMiss, 1, 'input')
    return `override ${resolved.currency}`
  })

  check('覆盖文件：支持 provider:model 限定', () => {
    const resolved = resolvePricing('pi-ai', 'custom-gateway-model')
    expectEqual(resolved.priceSource, 'override', 'priceSource')
    expectEqual(resolved.matchedKey, 'pi-ai:custom-gateway-model', 'matchedKey')
    const other = resolvePricing('some-other-gateway', 'custom-gateway-model')
    expectEqual(other.priceSource, 'none', 'other provider source')
    return resolved.matchedKey
  })

  check('覆盖文件：支持 * 通配前缀', () => {
    const resolved = resolvePricing('acme', 'vendor-x-1')
    expectEqual(resolved.priceSource, 'override', 'priceSource')
    expectEqual(resolved.matchedKey, 'vendor-*', 'matchedKey')
    return resolved.matchedKey
  })

  check('覆盖文件：非法条目被忽略而不是崩溃', () => {
    const resolved = resolvePricing('acme', 'bad-model')
    expectEqual(resolved.priceSource, 'none', 'priceSource')
    return 'ignored'
  })

  check('覆盖文件：peakValley 可关闭', () => {
    const state = loadPricingState()
    expectEqual(state.peakValley.enabled, false, 'enabled')
    expectEqual(isPeakTime(PEAK_MONDAY, state.peakValley), false, 'peak monday')
    return 'disabled by override'
  })

  writeFileSync(overridePath, '{ this is not json', 'utf8')
  check('覆盖文件：损坏 JSON 被忽略并记录错误', () => {
    const state = loadPricingState({ force: true })
    expect(state.errors.length > 0, 'expected an error note')
    expectEqual(state.rules.length, 0, 'rules')
    const resolved = resolvePricing('qwen-token-plan-cn', 'qwen3.8-max')
    expectEqual(resolved.priceSource, 'family', 'falls back to family')
    return state.errors[0]
  })

  rmSync(overridePath, { force: true })
  check('覆盖文件：缺失时静默回退内置目录', () => {
    const state = loadPricingState({ force: true })
    expectEqual(state.found, false, 'found')
    expectEqual(state.rules.length, 0, 'rules')
    expectEqual(resolvePricing('qwen-token-plan-cn', 'qwen3.8-max').priceSource, 'family', 'source')
    return 'missing file ignored'
  })

  // ── 5. end-to-end buildSessionCost ────────────────────────────────────
  await checkAsync('端到端：外接 qwen 会话得到估算金额', async () => {
    const cost = await buildSessionCost(
      fakeSession([
        header('qwen-token-plan-cn', 'qwen3.8-max'),
        usageEvent(PEAK_MONDAY, { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0 }),
      ]),
      'check-qwen-flat',
    )
    expectEqual(cost.priced, true, 'priced')
    expectEqual(cost.estimated, true, 'estimated')
    expectEqual(cost.priceSource, 'family', 'priceSource')
    expectEqual(cost.matchedKey, 'family:qwen-max', 'matchedKey')
    expectEqual(cost.currency, 'CNY', 'currency')
    expectEqual(cost.cost, 12, 'cost (2.4 input + 9.6 output)')
    expectEqual(cost.model, 'qwen3.8-max', 'model')
    expectEqual(cost.unit, PRICING_UNIT, 'unit')
    return `¥${cost.cost} ${cost.priceSource}`
  })

  await checkAsync('端到端：官方 DeepSeek 峰时按峰时价计费', async () => {
    const cost = await buildSessionCost(
      fakeSession([
        header('deepseek', 'deepseek-v4-pro'),
        usageEvent(PEAK_MONDAY, { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0 }),
      ]),
      'check-deepseek-peak',
    )
    expectEqual(cost.priced, true, 'priced')
    expectEqual(cost.priceSource, 'catalog', 'priceSource')
    expectEqual(cost.currency, 'CNY', 'currency')
    expectEqual(cost.cost, 36, 'cost (9 peak input + 27 peak output)')
    return `¥${cost.cost} peak`
  })

  await checkAsync('端到端：未知模型仍给出估算金额', async () => {
    const cost = await buildSessionCost(
      fakeSession([
        header('mystery-gateway', 'acme-ultra-9000'),
        usageEvent(PEAK_MONDAY, { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0 }),
      ]),
      'check-unknown',
    )
    expectEqual(cost.priced, true, 'priced')
    expectEqual(cost.priceSource, 'none', 'priceSource')
    expectEqual(cost.matchedKey, null, 'matchedKey')
    expectEqual(cost.cost, 10, 'fallback cost (2 + 8)')
    return `¥${cost.cost} fallback`
  })

  await checkAsync('端到端：多币种不静默相加，保留分币种小计', async () => {
    const cost = await buildSessionCost(
      fakeSession([
        header('deepseek', 'deepseek-chat'),
        usageEvent(PEAK_MONDAY, { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0 }),
        header('anthropic', 'claude-sonnet-4.6'),
        usageEvent(PEAK_MONDAY, { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 0 }),
      ]),
      'check-mixed-currency',
    )
    expectEqual(cost.priced, true, 'priced')
    expectEqual(cost.mixedCurrencies, true, 'mixedCurrencies')
    expectEqual(cost.currency, 'USD', 'primary currency')
    expectEqual(cost.cost, 18, 'USD subtotal (3 + 15)')
    expectEqual(cost.costByCurrency.CNY, 10, 'CNY subtotal')
    expectEqual(cost.costByCurrency.USD, 18, 'USD subtotal')
    return `USD ${cost.cost} / CNY ${cost.costByCurrency.CNY}`
  })

  await checkAsync('端到端：缺少模型信息时标记为无法定价', async () => {
    const cost = await buildSessionCost(
      fakeSession([usageEvent(PEAK_MONDAY, { inputTokens: 1000, outputTokens: 1000, cacheReadTokens: 0 })]),
      'check-no-model',
    )
    expectEqual(cost.priced, false, 'priced')
    expectEqual(cost.cost, null, 'cost')
    expectEqual(cost.estimated, false, 'estimated')
    expectEqual(cost.priceSource, 'none', 'priceSource')
    expectEqual(cost.unpricedSamples, 1, 'unpricedSamples')
    return 'unpriced'
  })

  await checkAsync('端到端：空会话金额为 0 而不是错误', async () => {
    const cost = await buildSessionCost(fakeSession([]), 'check-empty')
    expectEqual(cost.priced, true, 'priced')
    expectEqual(cost.cost, 0, 'cost')
    expectEqual(cost.currency, 'CNY', 'currency')
    return '¥0'
  })
} catch (error) {
  crashed = true
  console.error('check-pricing: unexpected failure:', error)
} finally {
  try {
    rmSync(tempDir, { recursive: true, force: true })
  } catch {
    // Best effort only.
  }
}

/** Same as `check`, for async cases that must be awaited in order. */
async function checkAsync(name, run) {
  try {
    const detail = await run()
    results.push({ ok: true, name, detail: detail ?? '' })
  } catch (error) {
    results.push({ ok: false, name, detail: String(error?.message ?? error) })
  }
}

// ── report ───────────────────────────────────────────────────────────────
const failed = results.filter((result) => !result.ok)
for (const result of results) {
  const mark = result.ok ? '✔' : '✘'
  console.log(`${mark} ${result.name}${result.detail === '' ? '' : ` — ${result.detail}`}`)
}
console.log('')
console.log(`pricing check: ${results.length - failed.length} passed, ${failed.length} failed`)
if (crashed) console.log('pricing check: aborted by an unexpected error (see above)')
process.exitCode = failed.length === 0 && !crashed ? 0 : 1