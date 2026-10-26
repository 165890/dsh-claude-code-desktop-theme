/**
 * dsh-claude-code-desktop-theme — Host half.
 *
 * Owns the theme plugin row and the merged usage-overview summary route
 * (`POST /api/dsh-claude-code-desktop-theme/usage-summary`). The visual layer
 * lives in the Client half; the theme row keeps the browser bundle
 * discoverable and live-reloadable.
 */

import { execFile } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

// ── External UI serif asset (D8 / M0-S6) ───────────────────────────────────
// The browser half no longer inlines the 2.6 MB GB2312 serif; the Host serves it
// over the authenticated Connection fetch channel:
//   GET|HEAD /api/dsh-claude-code-desktop-theme/font
// The allowlist is exactly one file, so the route cannot read arbitrary package
// files. Bytes are read once from the packaged asset and cached per process.
const FONT_PATH = '/api/dsh-claude-code-desktop-theme/font'
const FONT_ASSET_NAME = 'ui-serif-gb2312.woff2'
const FONT_ASSET_URL = new URL(`./assets/${FONT_ASSET_NAME}`, import.meta.url)
const FONT_CACHE_CONTROL = 'public, max-age=31536000, immutable'

// Lazily read + cache the font asset and its validators.
let fontAsset
function readFontAsset() {
  if (fontAsset !== undefined) return fontAsset
  const stat = statSync(FONT_ASSET_URL)
  const bytes = readFileSync(FONT_ASSET_URL)
  if (bytes.byteLength === 0) throw new Error('font asset is empty')
  fontAsset = {
    bytes,
    etag: 'W/"' + bytes.byteLength.toString(16) + '-' + Math.round(stat.mtimeMs).toString(16) + '"',
    lastModified: new Date(stat.mtimeMs).toUTCString(),
  }
  return fontAsset
}

// Headers shared by GET and HEAD: static, immutable and sniff-proof.
function fontAssetHeaders(asset) {
  return {
    'content-type': 'font/woff2',
    'content-length': String(asset.bytes.byteLength),
    'cache-control': FONT_CACHE_CONTROL,
    'etag': asset.etag,
    'last-modified': asset.lastModified,
    'x-content-type-options': 'nosniff',
  }
}

// Serve the font asset on the Connection fetch channel (GET + explicit HEAD).
function installFontAssetRoute(ctx) {
  ctx.inject(['connection'], (scope) => {
    const connection = scope.get('connection')
    const register = typeof connection?.fetch?.register === 'function' ? connection.fetch.register.bind(connection.fetch) : undefined
    if (register === undefined) return
    scope.effect(
      () =>
        register(
          {
            path: FONT_PATH,
            methods: ['GET', 'HEAD'],
            fetch: async (request) => {
              try {
                const asset = readFontAsset()
                const headers = fontAssetHeaders(asset)
                if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
                return new Response(asset.bytes, { status: 200, headers })
              } catch (error) {
                return Response.json(
                  { ok: false, error: { code: 'font-asset', message: String(error?.message ?? error) } },
                  { status: 404, headers: { 'cache-control': 'no-store' } },
                )
              }
            },
          },
          'dsh-claude-code-desktop-theme: font asset route',
        ),
      'dsh-claude-code-desktop-theme: font asset route',
    )
  })
}

/**
 * Usage overview summary (merged from the former dsh-usage-overview plugin).
 *
 * Computes an aggregate usage overview across the Harness session logs and
 * serves it to the browser half over one authenticated POST route:
 *
 *   POST /api/dsh-claude-code-desktop-theme/usage-summary
 *
 * The fold is intentionally self-contained: it reads each Session's durable
 * events through `sessionQuery.observeSession()` and derives messages, token
 * totals, per-day activity, model usage and hour buckets. No other plugin's
 * projection keys are required. Results are cached for a few seconds because
 * the home screen may mount the card repeatedly while navigating.
 */

/** Browser-visible route; the fetch registry serves it under the Connection origin. */
const SUMMARY_PATH = '/api/dsh-claude-code-desktop-theme/usage-summary'
/** How long one computed summary stays fresh (ms). */
const CACHE_TTL_MS = 30_000

/** Heatmap coverage: 52 weeks like the reference card (52 columns × 7 rows). */
const HEATMAP_DAYS = 52 * 7

/** Comparison corpus for the footer line (approximate provider tokens). */
const COMPARISONS = [
  { zh: '《小王子》', en: 'The Little Prince', tokens: 6000 },
  { zh: '《老人与海》', en: 'The Old Man and the Sea', tokens: 27000 },
  { zh: '《了不起的盖茨比》', en: 'The Great Gatsby', tokens: 47000 },
  { zh: '《三体》', en: 'The Three-Body Problem', tokens: 220000 },
  { zh: '《百年孤独》', en: 'One Hundred Years of Solitude', tokens: 150000 },
  { zh: '《红楼梦》', en: 'Dream of the Red Chamber', tokens: 800000 },
]

/** The comparison whose multiple sits closest to a few hundred books. */
const TARGET_RATIO = 541

/**
 * Pick the readable comparison for one token total: a book-sized multiple
 * around the reference card's magnitude instead of always the smallest book.
 * @param {number} tokens - all-time token total.
 * @returns {{ book: { zh: string, en: string, tokens: number }, ratio: number } | undefined}
 */
function comparisonFor(tokens) {
  let best
  for (const book of COMPARISONS) {
    const ratio = Math.round(tokens / book.tokens)
    if (ratio < 2) continue
    const distance = Math.abs(Math.log(ratio) - Math.log(TARGET_RATIO))
    if (best === undefined || distance < best.distance) best = { book, ratio, distance }
  }
  return best === undefined ? undefined : { book: best.book, ratio: best.ratio }
}

/**
 * Local calendar-day key for one epoch-millisecond timestamp.
 * @param {number} time - epoch milliseconds.
 * @returns {string} YYYY-MM-DD in the Host's local time.
 */
function dayKey(time) {
  const date = new Date(time)
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parse a YYYY-MM-DD key into a UTC day number so streaks ignore DST shifts.
 * @param {string} key - local calendar day.
 * @returns {number} days since the Unix epoch.
 */
function dayNumber(key) {
  const [year, month, day] = key.split('-').map(Number)
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

/**
 * One UTC day number back into a YYYY-MM-DD key.
 * @param {number} value - days since the Unix epoch.
 * @returns {string} calendar day key.
 */
function keyOfDayNumber(value) {
  const date = new Date(value * 86_400_000)
  const year = String(date.getUTCFullYear()).padStart(4, '0')
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** One empty per-day accumulator. */
function emptyDay() {
  return {
    tokens: 0,
    messages: 0,
    requests: 0,
    hours: new Array(24).fill(0),
    models: new Map(),
  }
}

/**
 * Fold one Session's durable events into the overview inputs.
 * @param {Array<object>} events - durable Session events in log order.
 * @param {{ root: boolean, createdAt: number }} meta - Session facts.
 * @returns {{ root: boolean, createdAt: number, days: Map<string, object> }}
 */
function foldSession(events, meta) {
  const days = new Map()
  let model
  let provider
  let stepStart

  const bucket = (time) => {
    const key = dayKey(time)
    let day = days.get(key)
    if (day === undefined) {
      day = emptyDay()
      days.set(key, day)
    }
    return day
  }

  for (const event of events) {
    const type = event?.type
    const time = typeof event?.time === 'number' ? event.time : undefined

    if (type === 'request/header') {
      const config = event?.data?.header?.config
      if (typeof config?.model === 'string' && config.model !== '') model = config.model
      if (typeof config?.provider === 'string' && config.provider !== '') provider = config.provider
      continue
    }
    if (type === 'step/start') {
      stepStart = time
      continue
    }
    if (type === 'user/message') {
      if (time === undefined) continue
      const day = bucket(time)
      day.messages += 1
      day.hours[new Date(time).getHours()] += 1
      continue
    }
    if (type !== 'assistant/message') continue

    const at = stepStart ?? time
    if (at === undefined) continue
    const usage = event?.data?.usage
    let tokens = 0
    if (usage !== undefined && usage !== null && typeof usage === 'object') {
      const n = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
      tokens = n(usage.inputTokens) + n(usage.cacheReadTokens) + n(usage.cacheWriteTokens) + n(usage.outputTokens)
    }
    const day = bucket(at)
    day.messages += 1
    day.requests += 1
    day.tokens += tokens
    day.hours[new Date(at).getHours()] += 1
    if (model !== undefined) {
      let entry = day.models.get(model)
      if (entry === undefined) {
        entry = { tokens: 0, messages: 0, requests: 0, provider }
        day.models.set(model, entry)
      }
      entry.tokens += tokens
      entry.messages += 1
      entry.requests += 1
    }
  }

  return { root: meta.root, createdAt: meta.createdAt, days }
}

/**
 * Sum a per-day map into one range metric.
 * @param {Map<string, object>} dayMap - merged per-day accumulator.
 * @param {Array<{root: boolean, createdAt: number, days: Map<string, object>}>} sessions - per-Session folds.
 * @param {number | null} startDay - first included UTC day number, or null for all time.
 * @param {number} endDay - last included UTC day number.
 * @returns {object} the range metric.
 */
function rangeMetric(dayMap, sessions, startDay, endDay) {
  const included = []
  for (const [key, day] of dayMap) {
    const number = dayNumber(key)
    if (number >= startDay && number <= endDay) included.push([key, day, number])
  }
  included.sort((left, right) => left[2] - right[2])

  let tokens = 0
  let messages = 0
  let requests = 0
  const hours = new Array(24).fill(0)
  const models = new Map()

  for (const [, day] of included) {
    tokens += day.tokens
    messages += day.messages
    requests += day.requests
    for (let index = 0; index < 24; index += 1) hours[index] += day.hours[index]
    for (const [name, entry] of day.models) {
      let merged = models.get(name)
      if (merged === undefined) {
        merged = { tokens: 0, messages: 0, requests: 0, provider: entry.provider }
        models.set(name, merged)
      }
      merged.tokens += entry.tokens
      merged.messages += entry.messages
      merged.requests += entry.requests
      if (merged.provider === undefined && entry.provider !== undefined) merged.provider = entry.provider
    }
  }

  const activeDayNumbers = [...new Set(included.filter(([, day]) => day.messages > 0 || day.requests > 0 || day.tokens > 0).map(([, , number]) => number))].sort((a, b) => a - b)

  let longestStreak = 0
  let run = 0
  let previous
  for (const number of activeDayNumbers) {
    if (previous !== undefined && number === previous + 1) run += 1
    else run = 1
    if (run > longestStreak) longestStreak = run
    previous = number
  }

  let currentStreak = 0
  const activeSet = new Set(activeDayNumbers)
  let cursor = endDay
  if (!activeSet.has(cursor)) cursor -= 1
  while (activeSet.has(cursor)) {
    currentStreak += 1
    cursor -= 1
  }

  let peakHour
  let peakCount = -1
  for (let index = 0; index < 24; index += 1) {
    if (hours[index] > peakCount) {
      peakCount = hours[index]
      peakHour = index
    }
  }
  if (peakCount <= 0) peakHour = undefined

  const sessionCount = sessions.filter((session) => {
    if (!session.root) return false
    for (const key of session.days.keys()) {
      const number = dayNumber(key)
      if (number >= startDay && number <= endDay) return true
    }
    return false
  }).length

  const modelList = [...models.entries()]
    .map(([name, entry]) => ({ model: name, provider: entry.provider, tokens: entry.tokens, messages: entry.messages, requests: entry.requests }))
    .sort((left, right) => right.tokens - left.tokens || right.messages - left.messages)

  return {
    sessions: sessionCount,
    messages,
    tokens,
    requests,
    activeDays: activeDayNumbers.length,
    currentStreak,
    longestStreak,
    peakHour,
    favoriteModel: modelList[0]?.model,
    models: modelList,
  }
}

/**
 * Compute the complete overview from the given session query service.
 * @param {object} sessionQuery - Host `sessionQuery` service.
 * @param {object} logger - Host logger for non-fatal fold failures.
 * @returns {Promise<object>} the summary payload.
 */
async function buildSummary(sessionQuery, logger) {
  const records = await sessionQuery.listSessions()
  const sessions = []
  for (const record of Array.isArray(records) ? records : []) {
    const header = record?.header
    if (header === undefined || typeof header.id !== 'string') continue
    let observation
    try {
      observation = await sessionQuery.observeSession(header.id, { projectionMode: 'none' })
    } catch (error) {
      logger?.warn?.(`dsh-claude-code-desktop-theme: cannot read session "${header.id}": ${String(error?.message ?? error)}`)
      continue
    }
    try {
      const events = Array.isArray(observation?.events) ? observation.events : []
      if (events.length === 0) continue
      const root = header.origin !== 'subagent' && header.parentSession === undefined
      sessions.push(foldSession(events, { root, createdAt: header.createdAt ?? 0 }))
    } finally {
      try {
        observation?.[Symbol.dispose]?.()
      } catch {
        // disposal failures do not affect the aggregate
      }
    }
  }

  const dayMap = new Map()
  for (const session of sessions) {
    for (const [key, day] of session.days) {
      let merged = dayMap.get(key)
      if (merged === undefined) {
        merged = emptyDay()
        dayMap.set(key, merged)
      }
      merged.tokens += day.tokens
      merged.messages += day.messages
      merged.requests += day.requests
      for (let index = 0; index < 24; index += 1) merged.hours[index] += day.hours[index]
      for (const [name, entry] of day.models) {
        let model = merged.models.get(name)
        if (model === undefined) {
          model = { tokens: 0, messages: 0, requests: 0, provider: entry.provider }
          merged.models.set(name, model)
        }
        model.tokens += entry.tokens
        model.messages += entry.messages
        model.requests += entry.requests
      }
    }
  }

  const now = Date.now()
  const today = dayNumber(dayKey(now))
  const all = rangeMetric(dayMap, sessions, Number.NEGATIVE_INFINITY, today)
  const last30 = rangeMetric(dayMap, sessions, today - 29, today)
  const last7 = rangeMetric(dayMap, sessions, today - 6, today)

  const heatmap = {}
  const heatmapStart = today - (HEATMAP_DAYS - 1)
  for (let number = heatmapStart; number <= today; number += 1) {
    const key = keyOfDayNumber(number)
    const day = dayMap.get(key)
    heatmap[key] = day === undefined ? { tokens: 0, messages: 0 } : { tokens: day.tokens, messages: day.messages }
  }

  const compare = all.tokens > 0 ? comparisonFor(all.tokens) : undefined

  return {
    version: 1,
    generatedAt: now,
    today: keyOfDayNumber(today),
    heatmap,
    compare,
    ranges: { all, '30d': last30, '7d': last7 },
  }
}

/**
 * Per-million-token list prices for the models this plugin can estimate.
 *
 * Every row answers "what does one million tokens cost", in `currency`, and is
 * either a flat `price` row or a `peak`/`offpeak` pair for the official
 * DeepSeek time-of-day table. The first rows are the DeepSeek Harness models
 * this plugin shipped with and are kept exactly as they were. The rest keep the
 * HUD useful when a request is routed through an external OpenAI-compatible
 * gateway (pi-ai, qwen-token-plan-cn, …): the catalog catches the well-known
 * ids, `MODEL_FAMILY_RULES` catches every variant of the same family, and a
 * conservative fallback covers ids nobody has seen yet.
 *
 * List prices move. This table is a snapshot and never a billing statement;
 * `~/.dsh/dsh-claude-code-desktop-theme/pricing.json` is the supported way to
 * correct a number the provider has changed.
 */
const PRICING = {
  'deepseek-flash': { currency: 'CNY', mode: 'peak-valley',
    peak: { inputCacheHit: 0.04, inputCacheMiss: 2.0, output: 8.0 },
    offpeak: { inputCacheHit: 0.02, inputCacheMiss: 1.0, output: 4.0 } },
  'deepseek-v4-flash': { currency: 'CNY', mode: 'peak-valley',
    peak: { inputCacheHit: 0.04, inputCacheMiss: 2.0, output: 8.0 },
    offpeak: { inputCacheHit: 0.02, inputCacheMiss: 1.0, output: 4.0 } },
  'deepseek-v4-flash-vision-exp': { currency: 'CNY', mode: 'peak-valley',
    peak: { inputCacheHit: 0.04, inputCacheMiss: 2.0, output: 8.0 },
    offpeak: { inputCacheHit: 0.02, inputCacheMiss: 1.0, output: 4.0 } },
  'deepseek-v4-pro': { currency: 'CNY', mode: 'peak-valley',
    peak: { inputCacheHit: 0.30, inputCacheMiss: 9.0, output: 27.0 },
    offpeak: { inputCacheHit: 0.15, inputCacheMiss: 4.5, output: 13.5 } },
  'deepseek-chat': { currency: 'CNY', mode: 'flat',
    price: { inputCacheHit: 0.5, inputCacheMiss: 2.0, output: 8.0 } },
  'deepseek-reasoner': { currency: 'CNY', mode: 'flat',
    price: { inputCacheHit: 1.0, inputCacheMiss: 4.0, output: 16.0 } },
  'deepseek-r1': { currency: 'CNY', mode: 'flat',
    price: { inputCacheHit: 1.0, inputCacheMiss: 4.0, output: 16.0 } },
}

/** Unit every rate in this file uses: currency per 1,000,000 tokens. */
export const PRICING_UNIT = 'per-1m-tokens'

/** Flat row shorthand for family defaults: a cached input token costs 10%. */
function familyPrice(currency, inputCacheMiss, output, inputCacheHit = inputCacheMiss * 0.1) {
  return {
    currency,
    mode: 'flat',
    price: {
      inputCacheHit: Math.round(inputCacheHit * 10_000) / 10_000,
      inputCacheMiss,
      output,
    },
  }
}

/** Official DeepSeek rows reused by the family rules so the numbers never drift. */
const DEEPSEEK_FLASH_RATES = PRICING['deepseek-flash']
const DEEPSEEK_PRO_RATES = PRICING['deepseek-v4-pro']

/**
 * Family defaults, first match wins. These are estimates for model ids that are
 * not in the exact catalog: a new vendor variant, a dated snapshot id such as
 * `deepseek-v4.1-flash-1017`, or a gateway alias. Reference prices are public
 * list prices per 1M tokens and may lag the provider; override them with
 * `pricing.json` when precision matters.
 */
const MODEL_FAMILY_RULES = [
  // DeepSeek (CNY) — official peak/valley table reused for unknown descendants.
  { id: 'deepseek-pro', test: /^deepseek.*(?:pro|reasoner|r1)/, price: DEEPSEEK_PRO_RATES },
  { id: 'deepseek-flash', test: /^deepseek/, price: DEEPSEEK_FLASH_RATES },

  // Alibaba Qwen / DashScope (CNY).
  { id: 'qwen-max', test: /^(?:qwen|qwq).*(?:max|omni)/, price: familyPrice('CNY', 2.4, 9.6) },
  { id: 'qwen-coder', test: /^(?:qwen|qwq).*coder/, price: familyPrice('CNY', 4, 16, 0.4) },
  { id: 'qwen-plus', test: /^(?:qwen|qwq).*(?:plus|long)/, price: familyPrice('CNY', 0.8, 2, 0.08) },
  { id: 'qwen-turbo', test: /^(?:qwen|qwq).*(?:turbo|flash|lite)/, price: familyPrice('CNY', 0.3, 0.6, 0.03) },
  { id: 'qwen', test: /^(?:qwen|qwq)/, price: familyPrice('CNY', 0.8, 2, 0.08) },

  // Zhipu GLM (CNY).
  { id: 'glm-air', test: /^(?:glm|chatglm|zhipu).*(?:air|flash|free)/, price: familyPrice('CNY', 0.8, 2, 0.08) },
  { id: 'glm', test: /^(?:glm|chatglm|zhipu)/, price: familyPrice('CNY', 4, 16, 0.4) },

  // Moonshot Kimi (CNY).
  { id: 'kimi-128k', test: /^(?:kimi|moonshot).*128k/, price: familyPrice('CNY', 60, 60, 6) },
  { id: 'kimi-32k', test: /^(?:kimi|moonshot).*32k/, price: familyPrice('CNY', 24, 24, 2.4) },
  { id: 'kimi-8k', test: /^(?:kimi|moonshot).*8k/, price: familyPrice('CNY', 12, 12, 1.2) },
  { id: 'kimi-k2', test: /^(?:kimi|moonshot).*(?:k2|k3|thinking)/, price: familyPrice('CNY', 4, 16, 1) },
  { id: 'kimi', test: /^(?:kimi|moonshot)/, price: familyPrice('CNY', 4, 16, 1) },

  // MiniMax (CNY).
  { id: 'minimax-m2', test: /^(?:minimax|abab).*(?:m2|m1)/, price: familyPrice('CNY', 2.1, 8.4, 0.21) },
  { id: 'minimax', test: /^(?:minimax|abab)/, price: familyPrice('CNY', 2, 8, 0.2) },

  // OpenAI GPT (USD list prices).
  { id: 'gpt-5-mini', test: /^gpt-?5.*mini/, price: familyPrice('USD', 0.25, 2, 0.025) },
  { id: 'gpt-5', test: /^gpt-?5/, price: familyPrice('USD', 1.25, 10, 0.125) },
  { id: 'o-mini', test: /^o[134].*mini/, price: familyPrice('USD', 1.1, 4.4, 0.275) },
  { id: 'o-series', test: /^o[134](?:[^a-z]|$)/, price: familyPrice('USD', 2, 8, 0.5) },
  { id: 'gpt-4o-mini', test: /^gpt-?4o.*mini/, price: familyPrice('USD', 0.15, 0.6, 0.075) },
  { id: 'gpt-4', test: /^gpt-?4/, price: familyPrice('USD', 2.5, 10, 1.25) },
  { id: 'gpt', test: /^(?:gpt|chatgpt|o[134])/, price: familyPrice('USD', 2, 8, 0.5) },

  // Anthropic Claude (USD list prices).
  { id: 'claude-opus', test: /^claude.*opus/, price: familyPrice('USD', 15, 75, 1.5) },
  { id: 'claude-sonnet', test: /^claude.*sonnet/, price: familyPrice('USD', 3, 15, 0.3) },
  { id: 'claude-haiku', test: /^claude.*haiku/, price: familyPrice('USD', 1, 5, 0.1) },
  { id: 'claude', test: /^claude/, price: familyPrice('USD', 3, 15, 0.3) },

  // Google Gemini and xAI Grok (USD list prices).
  { id: 'gemini-flash', test: /^gemini.*(?:flash|lite)/, price: familyPrice('USD', 0.3, 2.5, 0.075) },
  { id: 'gemini', test: /^gemini/, price: familyPrice('USD', 1.25, 10, 0.31) },
  { id: 'grok', test: /^grok/, price: familyPrice('USD', 3, 15, 1.5) },
]

/** Provider names a gateway may use for a known family (prefix match). */
const PROVIDER_FAMILY_RULES = [
  { id: 'deepseek', test: /^deepseek/i, familyId: 'deepseek-flash' },
  { id: 'qwen', test: /^(?:qwen|dashscope|aliyun|bailian|tongyi)/i, familyId: 'qwen' },
  { id: 'glm', test: /^(?:glm|zhipu|bigmodel|chatglm)/i, familyId: 'glm' },
  { id: 'kimi', test: /^(?:kimi|moonshot)/i, familyId: 'kimi' },
  { id: 'minimax', test: /^(?:minimax|abab)/i, familyId: 'minimax' },
  { id: 'gpt', test: /^(?:openai|gpt|azure)/i, familyId: 'gpt' },
  { id: 'claude', test: /^(?:anthropic|claude|bedrock)/i, familyId: 'claude' },
  { id: 'gemini', test: /^(?:google|gemini|vertex)/i, familyId: 'gemini' },
  { id: 'grok', test: /^(?:xai|grok)/i, familyId: 'grok' },
]

const FAMILY_PRICE_BY_ID = new Map(MODEL_FAMILY_RULES.map((rule) => [rule.id, rule.price]))

/**
 * Conservative mid-tier fallback for a model id no rule recognises. The HUD
 * shows a clearly-marked estimate instead of "—"; `priceSource: 'none'` tells
 * the Client this row guessed.
 */
const UNKNOWN_MODEL_PRICING = {
  currency: 'CNY',
  mode: 'flat',
  price: { inputCacheHit: 0.2, inputCacheMiss: 2, output: 8 },
}

/**
 * Optional per-user price overrides:
 *
 *   ~/.dsh/dsh-claude-code-desktop-theme/pricing.json
 *
 * `DSH_THEME_PRICING_FILE` points the loader at a different file (used by the
 * offline check script). The file is optional: a missing or unreadable file is
 * ignored and the built-in catalog is used.
 */
const PRICING_OVERRIDE_ENV = 'DSH_THEME_PRICING_FILE'
const PRICING_OVERRIDE_PATH = join(homedir(), '.dsh', 'dsh-claude-code-desktop-theme', 'pricing.json')
const PRICING_OVERRIDE_TTL_MS = 10_000

/** Default peak window: Beijing weekdays 09:00–12:00 and 14:00–18:00. */
const DEFAULT_PEAK_VALLEY = Object.freeze({
  enabled: true,
  utcOffsetMinutes: 480,
  weekdays: Object.freeze([1, 2, 3, 4, 5]),
  windows: Object.freeze([Object.freeze([540, 720]), Object.freeze([840, 1080])]),
})

/** Money is rounded to four decimals: token spend is routinely sub-cent. */
function roundCost(value) {
  return Math.round(value * 10_000) / 10_000
}

/** Non-negative finite number, or null. */
function nonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/** The override file to read: `DSH_THEME_PRICING_FILE` wins over the default. */
export function pricingFilePath() {
  const custom = process.env[PRICING_OVERRIDE_ENV]
  return typeof custom === 'string' && custom.trim() !== '' ? custom.trim() : PRICING_OVERRIDE_PATH
}

/**
 * Strip a gateway vendor prefix (`openai/gpt-5`, `models/...`) and lowercase
 * the id. The vendor prefix is not part of the family name.
 */
function normalizeModelName(model) {
  let name = String(model).trim().toLowerCase()
  const slash = name.lastIndexOf('/')
  if (slash !== -1) name = name.slice(slash + 1)
  return name
}

/** `HH:MM` or a bare hour count into minutes after midnight, or null. */
function toMinutes(value) {
  const number = nonNegativeNumber(value)
  if (number === null) return null
  // Bare numbers <= 24 are hours (9 -> 09:00); larger numbers are minutes.
  if (number <= 24) return Math.round(number * 60)
  return number <= 1440 ? Math.round(number) : null
}

/** One `["09:00","12:00"]` / `"09:00-12:00"` / `[9,12]` peak window. */
function parsePeakWindow(raw) {
  if (Array.isArray(raw) && raw.length === 2) {
    const start = toMinutes(raw[0])
    const end = toMinutes(raw[1])
    return start !== null && end !== null && end > start ? [start, end] : null
  }
  if (typeof raw === 'string') {
    const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(raw.trim())
    if (match === null) return null
    const start = Number(match[1]) * 60 + Number(match[2])
    const end = Number(match[3]) * 60 + Number(match[4])
    return start >= 0 && end <= 1440 && end > start ? [start, end] : null
  }
  return null
}

/** Merge the optional `peakValley` object over the built-in default. */
function normalizePeakValley(raw, errors) {
  const config = {
    enabled: true,
    utcOffsetMinutes: 480,
    weekdays: [1, 2, 3, 4, 5],
    windows: [[540, 720], [840, 1080]],
  }
  if (raw === undefined || raw === null) return config
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    errors.push('pricing.json: peakValley must be an object; using defaults')
    return config
  }
  if (raw.enabled === false) config.enabled = false
  const offset = nonNegativeNumber(raw.utcOffsetMinutes ?? raw.utcOffset)
  if (offset !== null && offset <= 14 * 60) config.utcOffsetMinutes = Math.trunc(offset)
  if (Array.isArray(raw.weekdays)) {
    const days = raw.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    if (days.length > 0) config.weekdays = days
  }
  if (Array.isArray(raw.windows)) {
    const windows = raw.windows.map(parsePeakWindow).filter((window) => window !== null)
    if (windows.length > 0) config.windows = windows
  }
  return config
}

/** A flat/peak-valley row from a user override entry, or null when malformed. */
function normalizeOverrideRow(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const miss = nonNegativeNumber(raw.inputCacheMiss ?? raw.input)
  const output = nonNegativeNumber(raw.output)
  if (miss === null || output === null) return null
  const hit = nonNegativeNumber(raw.inputCacheHit ?? raw.cacheRead)
  return { inputCacheHit: hit ?? miss * 0.1, inputCacheMiss: miss, output }
}

/** One `{ input, output, cacheRead, currency }` override entry, or null. */
function normalizeOverrideEntry(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const currency =
    typeof raw.currency === 'string' && raw.currency.trim() !== ''
      ? raw.currency.trim().toUpperCase()
      : 'CNY'
  if (raw.mode === 'peak-valley') {
    const peak = normalizeOverrideRow(raw.peak)
    const offpeak = normalizeOverrideRow(raw.offpeak)
    if (peak === null || offpeak === null) return null
    return { currency, mode: 'peak-valley', peak, offpeak }
  }
  const inputCacheMiss = nonNegativeNumber(raw.input)
  const output = nonNegativeNumber(raw.output)
  if (inputCacheMiss === null || output === null) return null
  const inputCacheHit = nonNegativeNumber(raw.cacheRead) ?? inputCacheMiss * 0.1
  return { currency, mode: 'flat', price: { inputCacheHit, inputCacheMiss, output } }
}

/** Escape a `*` glob into an anchored regular expression. */
function globToRegExp(pattern) {
  return new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
}

/**
 * Turn `{ models: { "key": {...} } }` into matchable rules. A key may be an
 * exact model id, a prefix of one, a `*` glob, or `provider:model` scoped.
 */
function parseOverrideRules(document) {
  const models = document?.models
  if (models === null || typeof models !== 'object' || Array.isArray(models)) return []
  const rules = []
  for (const [rawKey, rawEntry] of Object.entries(models)) {
    const entry = normalizeOverrideEntry(rawEntry)
    if (entry === null) continue
    const key = String(rawKey).trim().toLowerCase()
    if (key === '') continue
    const colon = key.indexOf(':')
    const provider = colon === -1 ? null : key.slice(0, colon).trim()
    const pattern = (colon === -1 ? key : key.slice(colon + 1)).trim()
    if (pattern === '' || provider === '') continue
    const glob = pattern.includes('*')
    rules.push({
      rawKey: String(rawKey).trim(),
      provider,
      pattern,
      glob,
      regex: glob ? globToRegExp(pattern) : null,
      entry,
    })
  }
  return rules
}

/** Score one override rule against the requested model (0 = no match). */
function overrideScore(rule, lowerProvider, candidates) {
  const providerScoped = rule.provider !== null
  if (providerScoped && (lowerProvider === '' || !lowerProvider.startsWith(rule.provider))) return 0
  if (rule.glob) {
    for (const candidate of candidates) {
      if (rule.regex.test(candidate)) return providerScoped ? 2 : 1
    }
    return 0
  }
  // Exact id beats a prefix, and a provider-scoped rule beats a bare one.
  for (const candidate of candidates) {
    if (candidate === rule.pattern) return providerScoped ? 6 : 5
  }
  for (const candidate of candidates) {
    if (candidate.startsWith(rule.pattern)) return providerScoped ? 4 : 3
  }
  return 0
}

/** The best user override for this provider/model pair, or undefined. */
function matchOverride(rules, provider, model) {
  if (rules.length === 0) return undefined
  const lowerProvider = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  const raw = String(model).trim().toLowerCase()
  const normalized = normalizeModelName(model)
  const candidates = normalized === raw ? [normalized] : [normalized, raw]
  let best
  for (const rule of rules) {
    const score = overrideScore(rule, lowerProvider, candidates)
    if (score === 0) continue
    // Longer patterns are more specific; they win a same-kind tie.
    const weighted = score * 1_000_000 + rule.pattern.length
    if (best === undefined || weighted > best.weighted) best = { weighted, rule }
  }
  return best?.rule
}

let pricingStateCache = { path: '', mtime: -1, at: 0, value: undefined }

/**
 * Load and cache the optional override document. Cached for a short TTL and
 * invalidated as soon as the file's mtime changes, so editing pricing.json is
 * reflected in the HUD without a restart.
 *
 * @param {{ force?: boolean }} [options] - force bypasses the TTL cache.
 * @returns {{ path: string, found: boolean, rules: Array<object>, peakValley: object, errors: Array<string>, loadedAt: number }}
 */
export function loadPricingState(options = {}) {
  const path = pricingFilePath()
  let mtime = -1
  try {
    mtime = statSync(path).mtimeMs
  } catch {
    mtime = -1
  }
  const now = Date.now()
  const cached = pricingStateCache
  if (
    options.force !== true &&
    cached.value !== undefined &&
    cached.path === path &&
    cached.mtime === mtime &&
    now - cached.at < PRICING_OVERRIDE_TTL_MS
  ) {
    return cached.value
  }

  const errors = []
  const document = mtime === -1 ? undefined : readJsonFile(path)
  if (mtime !== -1 && document === undefined) {
    errors.push('pricing.json is not valid JSON; using the built-in catalog')
  }
  const value = {
    path,
    found: mtime !== -1,
    rules: parseOverrideRules(document),
    peakValley: normalizePeakValley(document?.peakValley, errors),
    errors,
    loadedAt: now,
  }
  pricingStateCache = { path, mtime, at: now, value }
  return value
}

/** Confidence order used when one Session mixes several price sources. */
const PRICE_SOURCE_RANK = { none: 0, family: 1, catalog: 2, override: 3 }

/**
 * Resolve the price table row for one provider/model pair.
 *
 * Matching priority (highest first):
 *   1. override exact — `provider:model` then bare model id;
 *   2. override prefix / `*` glob, longest pattern first;
 *   3. built-in exact catalog — provider-scoped id then bare model id;
 *   4. built-in family rules — model id first, then provider name prefix;
 *   5. none — conservative fallback estimate so the HUD never shows "—".
 *
 * @param {string | undefined} provider - request provider id.
 * @param {string | undefined} model - request model id.
 * @param {{ state?: object }} [options] - reuse a loaded override state.
 * @returns {{ entry: object, currency: string, priceSource: 'catalog'|'override'|'family'|'none', matchedKey: string|null, estimated: boolean, unit: string } | null}
 */
export function resolvePricing(provider, model, options = {}) {
  if (typeof model !== 'string' || model.trim() === '') return null
  const state = options.state ?? loadPricingState()
  const lowerProvider = typeof provider === 'string' ? provider.trim().toLowerCase() : ''
  const normalized = normalizeModelName(model)
  const raw = String(model).trim().toLowerCase()

  const override = matchOverride(state.rules, provider, model)
  if (override !== undefined) {
    return {
      entry: override.entry,
      currency: override.entry.currency,
      priceSource: 'override',
      matchedKey: override.rawKey,
      estimated: true,
      unit: PRICING_UNIT,
    }
  }

  const scopedKey =
    lowerProvider === '' ? undefined : PROVIDER_SCOPED_PRICING[lowerProvider + ':' + normalized]
  const catalogKey =
    scopedKey ?? (Object.hasOwn(PRICING, normalized) ? normalized : Object.hasOwn(PRICING, raw) ? raw : undefined)
  if (catalogKey !== undefined) {
    const entry = PRICING[catalogKey]
    return {
      entry,
      currency: entry.currency,
      priceSource: 'catalog',
      matchedKey: catalogKey,
      estimated: true,
      unit: PRICING_UNIT,
    }
  }

  for (const rule of MODEL_FAMILY_RULES) {
    if (!rule.test.test(normalized)) continue
    return {
      entry: rule.price,
      currency: rule.price.currency,
      priceSource: 'family',
      matchedKey: 'family:' + rule.id,
      estimated: true,
      unit: PRICING_UNIT,
    }
  }

  for (const rule of PROVIDER_FAMILY_RULES) {
    if (lowerProvider === '' || !rule.test.test(lowerProvider)) continue
    const price = FAMILY_PRICE_BY_ID.get(rule.familyId)
    if (price === undefined) continue
    return {
      entry: price,
      currency: price.currency,
      priceSource: 'family',
      matchedKey: 'provider:' + rule.id,
      estimated: true,
      unit: PRICING_UNIT,
    }
  }

  return {
    entry: UNKNOWN_MODEL_PRICING,
    currency: UNKNOWN_MODEL_PRICING.currency,
    priceSource: 'none',
    matchedKey: null,
    estimated: true,
    unit: PRICING_UNIT,
  }
}

/**
 * Official provider+model pairs. The provider prefix keeps a future provider
 * that reuses a model id from inheriting the DeepSeek row by accident.
 */
const PROVIDER_SCOPED_PRICING = {
  'deepseek:deepseek-flash': 'deepseek-flash',
  'deepseek:deepseek-v4-flash': 'deepseek-v4-flash',
  'deepseek:deepseek-v4-flash-vision-exp': 'deepseek-v4-flash-vision-exp',
  'deepseek:deepseek-v4-pro': 'deepseek-v4-pro',
  'deepseek:deepseek-chat': 'deepseek-chat',
  'deepseek:deepseek-reasoner': 'deepseek-reasoner',
  'deepseek:deepseek-r1': 'deepseek-r1',
}

/**
 * Whether one timestamp falls inside the configured peak window.
 *
 * Defaults reproduce the original Beijing-time rule (weekdays 09:00–12:00 and
 * 14:00–18:00). `pricing.json` may override the time zone offset, the weekday
 * set and the windows; `{ enabled: false }` turns peak pricing off entirely,
 * which bills every call at the off-peak rate.
 *
 * @param {number} time - epoch milliseconds.
 * @param {{ enabled?: boolean, utcOffsetMinutes?: number, weekdays?: number[], windows?: number[][] }} [peakValley]
 * @returns {boolean}
 */
export function isPeakTime(time, peakValley = DEFAULT_PEAK_VALLEY) {
  const config = peakValley ?? DEFAULT_PEAK_VALLEY
  if (config.enabled === false) return false
  const offset = Number.isFinite(config.utcOffsetMinutes) ? config.utcOffsetMinutes : 480
  const shifted = new Date((typeof time === 'number' ? time : Date.now()) + offset * 60_000)
  const weekdays = Array.isArray(config.weekdays) ? config.weekdays : DEFAULT_PEAK_VALLEY.weekdays
  if (!weekdays.includes(shifted.getUTCDay())) return false
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
  const windows = Array.isArray(config.windows) ? config.windows : DEFAULT_PEAK_VALLEY.windows
  return windows.some(([start, end]) => minutes >= start && minutes < end)
}

/** The `{ inputCacheHit, inputCacheMiss, output }` row in force at one time. */
function ratesFor(entry, time, peakValley) {
  if (entry === null || typeof entry !== 'object') return null
  if (entry.mode !== 'peak-valley') return entry.price ?? null
  return isPeakTime(time, peakValley) ? entry.peak : entry.offpeak
}

const SESSION_COST_CACHE_MS = 5 * 1000
const sessionCostCache = new Map()

/**
 * Price the assistant usage samples of one Session and report where the number
 * came from. Every token is priced through `resolvePricing`, so an external
 * provider (pi-ai, qwen-token-plan-cn, …) gets a family-level estimate instead
 * of "—".
 *
 * This is never a billing statement: `estimated: true` means the value was
 * computed locally from recorded usage, and the Client keeps preferring the
 * ledger figure owned by the bottom-info-bar plugin whenever it is present.
 *
 * `cost` is only `null` when at least one usage sample could not be priced at
 * all (no model known yet); partially priced sessions are not silently
 * understated. When a session mixes currencies, no FX conversion is invented:
 * `currency` names the largest subtotal and `costByCurrency` lists the rest.
 *
 * @param {object} sessionQuery - Host session-query service.
 * @param {string} sessionId - Session id to fold.
 * @returns {Promise<object>} `{ sessionId, cost, currency, priced, estimated,
 *   priceSource, matchedKey, unit, model, provider, costByCurrency,
 *   mixedCurrencies, unpricedSamples }`.
 */
export async function buildSessionCost(sessionQuery, sessionId) {
  const key = String(sessionId)
  const cached = sessionCostCache.get(key)
  if (cached !== undefined && Date.now() - cached.at < SESSION_COST_CACHE_MS) return cached.value

  const observed = await sessionQuery.observeSession(sessionId, { projectionMode: 'none' })
  const pricing = loadPricingState()
  const n = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
  const totals = new Map()
  let model
  let provider
  let unpricedSamples = 0
  let weakest

  for (const event of observed.events) {
    if (event?.type === 'request/header') {
      const config = event?.data?.header?.config
      if (typeof config?.model === 'string' && config.model !== '') model = config.model
      if (typeof config?.provider === 'string' && config.provider !== '') provider = config.provider
      continue
    }
    if (event?.type !== 'assistant/message') continue
    const usage = event?.data?.usage
    if (usage === null || typeof usage !== 'object') continue
    if (typeof model !== 'string' || model === '') {
      unpricedSamples += 1
      continue
    }
    const resolved = resolvePricing(provider, model, { state: pricing })
    if (resolved === null) {
      unpricedSamples += 1
      continue
    }
    const rates = ratesFor(resolved.entry, typeof event.time === 'number' ? event.time : Date.now(), pricing.peakValley)
    if (rates === null) {
      unpricedSamples += 1
      continue
    }
    const miss = n(usage.inputTokens) + n(usage.cacheWriteTokens)
    const amount =
      (n(usage.cacheReadTokens) * rates.inputCacheHit + miss * rates.inputCacheMiss + n(usage.outputTokens) * rates.output) / 1e6
    totals.set(resolved.currency, (totals.get(resolved.currency) ?? 0) + amount)
    const rank = PRICE_SOURCE_RANK[resolved.priceSource] ?? 0
    if (weakest === undefined || rank < weakest.rank) {
      weakest = { rank, source: resolved.priceSource, matchedKey: resolved.matchedKey }
    }
  }

  const priced = unpricedSamples === 0
  const entries = [...totals.entries()]
  let currency = 'CNY'
  let cost = 0
  if (priced && entries.length > 0) {
    entries.sort((a, b) => b[1] - a[1])
    currency = entries[0][0]
    cost = roundCost(entries[0][1])
  }
  const costByCurrency = {}
  for (const [code, amount] of entries) costByCurrency[code] = roundCost(amount)

  const value = {
    sessionId: key,
    cost: priced ? cost : null,
    currency,
    priced,
    // A locally computed number, never a provider charge. `priceSource` tells
    // the Client how exact the rate was: catalog/override = exact model row,
    // family = same-family default, none = generic fallback guess.
    estimated: priced,
    priceSource: weakest === undefined ? 'none' : weakest.source,
    matchedKey: weakest === undefined ? null : weakest.matchedKey,
    unit: PRICING_UNIT,
    model: model ?? null,
    provider: provider ?? null,
    costByCurrency,
    mixedCurrencies: entries.length > 1,
    unpricedSamples,
  }
  sessionCostCache.set(key, { at: Date.now(), value })
  return value
}

/**
 * Register the summary route. The route is served on the authenticated
 * Connection fetch channel and therefore needs no extra token handling.
 * @param {import('@deepseek-ai/cordis').Context} ctx - Host plugin context.
 */
function installUsageSummaryRoute(ctx) {
  let cache = { at: 0, value: undefined }
  let inflight

  const summary = async () => {
    if (cache.value !== undefined && Date.now() - cache.at < CACHE_TTL_MS) return cache.value
    if (inflight !== undefined) return inflight
    inflight = (async () => {
      try {
        const value = await buildSummary(query, ctx.logger)
        cache = { at: Date.now(), value }
        return value
      } finally {
        inflight = undefined
      }
    })()
    return inflight
  }

  let query
  ctx.inject(['connection', 'sessionQuery'], (scope) => {
    const connection = scope.get('connection')
    query = scope.get('sessionQuery')
    const register = typeof connection?.fetch?.register === 'function' ? connection.fetch.register.bind(connection.fetch) : undefined
    if (register === undefined || query === undefined) return
    scope.effect(
      () =>
        register({
          path: SUMMARY_PATH,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            try {
              let sessionId
              try {
                const body = await request.json()
                if (body !== null && typeof body === 'object' && typeof body.sessionId === 'string') sessionId = body.sessionId
              } catch {
                // The usage card posts an empty body; the cost field is optional.
              }
              const value = await summary()
              if (sessionId !== undefined) {
                const sessionCost = await buildSessionCost(query, sessionId)
                return Response.json(
                  { ok: true, value: { ...value, sessionCost } },
                  { headers: { 'cache-control': 'no-store' } },
                )
              }
              return Response.json(
                { ok: true, value },
                { headers: { 'cache-control': 'no-store' } },
              )
            } catch (error) {
              ctx.logger?.warn?.(`dsh-claude-code-desktop-theme: summary failed: ${String(error?.message ?? error)}`)
              return Response.json(
                { ok: false, error: { code: 'dsh-claude-code-desktop-theme/internal', message: String(error?.message ?? error) } },
                { status: 200, headers: { 'cache-control': 'no-store' } },
              )
            }
          },
        }),
      'dsh-claude-code-desktop-theme: usage summary route',
    )
  })
}


/* ── Self-update endpoints ───────────────────────────────────────────────── */

/**
 * DSH shows an "update" action only for its own optional bundles; a third
 * party profile plugin has to be uninstalled and reinstalled by hand. These
 * two routes give the plugin page enough information to offer a real button.
 *
 *   POST /api/dsh-claude-code-desktop-theme/update-status -> installed + latest
 *   POST /api/dsh-claude-code-desktop-theme/update-apply  -> pnpm add latest
 *
 * Host code runs outside the workspace sandbox, so it may spawn pnpm. The
 * apply route only ever touches this one package and never accepts a spec from
 * the request body.
 */
const THEME_PACKAGE = 'dsh-claude-code-desktop-theme'
const UPDATE_STATUS_PATH = '/api/dsh-claude-code-desktop-theme/update-status'
const UPDATE_APPLY_PATH = '/api/dsh-claude-code-desktop-theme/update-apply'
const UPDATE_QUERY_TTL_MS = 10 * 60 * 1000
const PROFILE_NAMES = ['desktop', 'web']

let updateCache = { at: 0, value: undefined }

/** pnpm 11's default `minimumReleaseAge`: releases younger than this are skipped. */
const RELEASE_WAIT_MS = 24 * 60 * 60 * 1000

/** Read one JSON file, or return undefined when it is missing or malformed. */
function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

/** Version of the copy installed in the profile — what the next restart loads. */
function installedVersion(profileDir) {
  const manifest = readJsonFile(join(profileDir, 'node_modules', THEME_PACKAGE, 'package.json'))
  return typeof manifest?.version === 'string' ? manifest.version : null
}

/** Parse `pnpm view <pkg> <field> --json` output, or null when it is not JSON. */
function parseJsonOutput(text) {
  const trimmed = String(text ?? '').trim()
  if (trimmed === '') return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

/** Version of the copy that is currently running. */
function runningVersion() {
  try {
    const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
    return typeof manifest?.version === 'string' ? manifest.version : '0.0.0'
  } catch {
    return '0.0.0'
  }
}

/**
 * Find the profile that depends on this package and report how it was
 * installed. A `link:` spec points at a working copy, where "updating" means
 * pulling the checkout, so pnpm must not be involved.
 */
function installedSource() {
  for (const name of PROFILE_NAMES) {
    const dir = join(homedir(), '.dsh', 'profiles', name)
    try {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      const spec = manifest?.dependencies?.[THEME_PACKAGE]
      if (typeof spec === 'string' && spec.length > 0) {
        return { dir, spec, kind: spec.startsWith('link:') ? 'link' : 'registry' }
      }
    } catch {
      // profile may not exist; keep looking
    }
  }
  return undefined
}

/** Run pnpm once. Never retries; the caller decides what a failure means. */
function runPnpm(args, timeoutMs) {
  return new Promise((resolve) => {
    const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
    execFile(
      command,
      args,
      {
        cwd: homedir(),
        timeout: timeoutMs,
        windowsHide: true,
        shell: process.platform === 'win32',
        maxBuffer: 4 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({ ok: error === null, output: `${stdout ?? ''}${stderr ?? ''}`.trim() })
      },
    )
  })
}

function isNewer(candidate, baseline) {
  const a = String(candidate).split('.').map((n) => Number.parseInt(n, 10) || 0)
  const b = String(baseline).split('.').map((n) => Number.parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  }
  return false
}

async function readUpdateStatus() {
  if (updateCache.value !== undefined && Date.now() - updateCache.at < UPDATE_QUERY_TTL_MS) {
    return updateCache.value
  }
  const installed = installedSource()
  const current = runningVersion()
  const base = {
    current,
    installed: installed === undefined ? null : installedVersion(installed.dir),
    source: installed?.kind ?? 'unknown',
    profile: installed?.dir ?? null,
    spec: installed?.spec ?? null,
  }

  // Resolve the published version for every install source. A `link:` checkout
  // cannot be installed over, but its owner still needs to know whether the
  // working copy is ahead of, level with, or behind what npm serves.
  const versionResult = await runPnpm(['view', THEME_PACKAGE, 'version', '--json'], 30_000)
  if (!versionResult.ok) {
    const value = { ...base, latest: null, hasUpdate: false, canApply: false, cooldown: null, error: versionResult.output.slice(-500) }
    updateCache = { at: Date.now(), value }
    return value
  }
  const parsedVersion = parseJsonOutput(versionResult.output)
  const latest =
    typeof parsedVersion === 'string' ? parsedVersion : versionResult.output.replace(/["\s]/g, '')
  if (typeof latest !== 'string' || latest.length === 0) {
    const value = { ...base, latest: null, hasUpdate: false, canApply: false, cooldown: null, error: 'unreadable-version' }
    updateCache = { at: Date.now(), value }
    return value
  }

  // When was that release published? pnpm 11 refuses to resolve a version
  // younger than `minimumReleaseAge`, so a just-published release is invisible
  // to a plain install. Reporting the window is what stops "the update did
  // nothing" from looking like a broken plugin.
  let publishedAt = null
  const timeResult = await runPnpm(['view', THEME_PACKAGE, 'time', '--json'], 30_000)
  if (timeResult.ok) {
    const table = parseJsonOutput(timeResult.output)
    const raw = table !== null && typeof table === 'object' ? table[latest] : undefined
    if (typeof raw === 'string' && !Number.isNaN(Date.parse(raw))) publishedAt = raw
  }
  const cooldownUntil =
    publishedAt === null ? null : new Date(Date.parse(publishedAt) + RELEASE_WAIT_MS).toISOString()
  const cooldownActive = cooldownUntil !== null && Date.now() < Date.parse(cooldownUntil)
  const baseline = base.installed ?? current

  const value = {
    ...base,
    latest,
    latestPublishedAt: publishedAt,
    cooldownUntil,
    cooldownActive,
    // Only a registry install can be replaced; a `link:` checkout reports the
    // gap but its "update" is a git pull in the working copy.
    canApply: base.source === 'registry',
    hasUpdate: isNewer(latest, baseline),
  }
  updateCache = { at: Date.now(), value }
  return value
}

async function applyUpdate() {
  const installed = installedSource()
  if (installed === undefined) return { ok: false, reason: 'no-profile' }
  if (installed.kind === 'link') {
    return { ok: false, reason: 'link', message: 'This profile links a working copy; update it with git pull.' }
  }

  // Resolve the target here, never from the request body: a route that accepts
  // a spec is a route that can install anything.
  const versionResult = await runPnpm(['view', THEME_PACKAGE, 'version', '--json'], 30_000)
  if (!versionResult.ok) {
    return { ok: false, reason: 'registry', message: versionResult.output.slice(-1000) }
  }
  const parsedVersion = parseJsonOutput(versionResult.output)
  const target =
    typeof parsedVersion === 'string' ? parsedVersion : versionResult.output.replace(/["\s]/g, '')
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(target)) {
    return { ok: false, reason: 'registry', message: `unreadable latest version: ${target.slice(0, 120)}` }
  }

  const before = installedVersion(installed.dir) ?? runningVersion()
  if (!isNewer(target, before)) {
    return {
      ok: true,
      from: before,
      to: before,
      alreadyInstalled: true,
      restartRequired: runningVersion() !== before,
    }
  }

  // Install the exact version, not the `latest` tag. pnpm 11's minimumReleaseAge
  // skips a release younger than 24 h even when `latest` names it, which is
  // exactly how users ended up on an older build after a successful publish.
  const result = await runPnpm(['add', `${THEME_PACKAGE}@${target}`, '--dir', installed.dir], 240_000)
  updateCache = { at: 0, value: undefined }
  if (!result.ok) return { ok: false, reason: 'pnpm', message: result.output.slice(-2000) }

  const after = installedVersion(installed.dir)
  if (after !== target) {
    return {
      ok: false,
      reason: 'verify',
      message:
        `pnpm reported success but ${join(installed.dir, 'node_modules', THEME_PACKAGE)} ` +
        `reads ${after ?? 'missing'}, expected ${target}.`,
      output: result.output.slice(-2000),
    }
  }
  return {
    ok: true,
    from: before,
    to: target,
    restartRequired: runningVersion() !== target,
    output: result.output.slice(-2000),
  }
}

function installUpdateRoutes(ctx) {
  ctx.inject(['connection'], (scope) => {
    const connection = scope.get('connection')
    const register = typeof connection?.fetch?.register === 'function' ? connection.fetch.register.bind(connection.fetch) : undefined
    if (register === undefined) return

    const routes = [
      [UPDATE_STATUS_PATH, readUpdateStatus, 'theme update status route'],
      [UPDATE_APPLY_PATH, applyUpdate, 'theme update apply route'],
    ]

    for (const [path, handler, label] of routes) {
      scope.effect(
        () =>
          register(
            {
              path,
              methods: ['POST'],
              requestBody: 'buffered',
              fetch: async () => {
                try {
                  return Response.json(
                    { ok: true, value: await handler() },
                    { headers: { 'cache-control': 'no-store' } },
                  )
                } catch (error) {
                  return Response.json(
                    { ok: false, error: { code: 'theme-update', message: String(error?.message ?? error) } },
                    { status: 200, headers: { 'cache-control': 'no-store' } },
                  )
                }
              },
            },
            `dsh-claude-code-desktop-theme: ${label}`,
          ),
        label,
      )
    }
  })
}

/** Loader entry: install the merged usage summary route. */
export function apply(ctx) {
  installUsageSummaryRoute(ctx)
  try {
    installFontAssetRoute(ctx)
  } catch (error) {
    ctx.logger?.warn?.(`dsh-claude-code-desktop-theme: font route failed: ${String(error?.message ?? error)}`)
  }
  try {
    installUpdateRoutes(ctx)
  } catch (error) {
    ctx.logger?.warn?.(`dsh-claude-code-desktop-theme: update routes failed: ${String(error?.message ?? error)}`)
  }
}
