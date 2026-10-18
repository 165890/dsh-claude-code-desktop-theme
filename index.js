/**
 * dsh-claude-code-desktop-theme — Host half.
 *
 * Owns the theme plugin row and the merged usage-overview summary route
 * (`POST /api/dsh-claude-code-desktop-theme/usage-summary`). The visual layer
 * lives in the Client half; the theme row keeps the browser bundle
 * discoverable and live-reloadable.
 */

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
 * Official per-million-token prices (CNY) for the model ids DeepSeek Harness
 * routes in this profile. Used only for the in-app spend estimate when the
 * companion bottom-info-bar plugin is absent; the ledger-owned figure wins
 * whenever it is available.
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
}

const PROVIDER_SCOPED_PRICING = {
  'deepseek:deepseek-flash': 'deepseek-flash',
  'deepseek:deepseek-v4-flash': 'deepseek-v4-flash',
  'deepseek:deepseek-v4-flash-vision-exp': 'deepseek-v4-flash-vision-exp',
  'deepseek:deepseek-v4-pro': 'deepseek-v4-pro',
  'deepseek:deepseek-chat': 'deepseek-chat',
}

function pricingFor(provider, model) {
  if (typeof model !== 'string' || model === '') return null
  const scoped = typeof provider === 'string' ? PROVIDER_SCOPED_PRICING[provider + ':' + model] : undefined
  const key = scoped ?? model
  return Object.hasOwn(PRICING, key) ? PRICING[key] : null
}

/** Beijing-time peak window: weekdays 09:00–12:00 and 14:00–18:00. */
function isPeakTime(time) {
  const beijing = new Date(time + 8 * 60 * 60 * 1000)
  const day = beijing.getUTCDay()
  if (day === 0 || day === 6) return false
  const hour = beijing.getUTCHours()
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

const SESSION_COST_CACHE_MS = 5 * 1000
const sessionCostCache = new Map()

/**
 * Price the assistant usage samples of one Session with the built-in table.
 * This is a real token-based estimate, not a billing statement: unknown
 * providers/models stay unpriced and therefore report `priced: false`.
 * @param {object} sessionQuery - Host session-query service.
 * @param {string} sessionId - Session id to fold.
 * @returns {Promise<object>} `{ sessionId, cost, currency, priced, model }`.
 */
async function buildSessionCost(sessionQuery, sessionId) {
  const key = String(sessionId)
  const cached = sessionCostCache.get(key)
  if (cached !== undefined && Date.now() - cached.at < SESSION_COST_CACHE_MS) return cached.value

  const observed = await sessionQuery.observeSession(sessionId, { projectionMode: 'none' })
  let model
  let provider
  let cost = 0
  let priced = true
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
    const entry = pricingFor(provider, model)
    if (entry === null) {
      priced = false
      continue
    }
    const rates = entry.mode === 'peak-valley'
      ? (isPeakTime(typeof event.time === 'number' ? event.time : Date.now()) ? entry.peak : entry.offpeak)
      : entry.price
    const n = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
    const miss = n(usage.inputTokens) + n(usage.cacheWriteTokens)
    cost += (n(usage.cacheReadTokens) * rates.inputCacheHit + miss * rates.inputCacheMiss + n(usage.outputTokens) * rates.output) / 1e6
  }

  const value = {
    sessionId: key,
    cost: priced ? Math.round(cost * 10000) / 10000 : null,
    currency: 'CNY',
    priced,
    model: model ?? null,
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


/** Loader entry: install the merged usage summary route. */
export function apply(ctx) {
  installUsageSummaryRoute(ctx)
}
