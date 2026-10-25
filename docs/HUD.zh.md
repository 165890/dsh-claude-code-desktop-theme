# HUD 实时性诊断：上下文 / 缓存命中 / tok·s / 花费

> 分析阶段产物（只读 + 本文档）。仓库：`dsh-claude-code-desktop-theme`，版本 `2.5.2`。
> 结论先行：**HUD 的刷新实现不是主要问题，数据粒度才是。**
> 「上下文」「缓存命中」「tok·s」三个数都来自宿主**按请求（step）结算**的投影，
> 在一次长 decode 期间宿主根本不会产生新样本；而 HUD 显示的 tok·s 用的是**整段会话累计平均**，
> 所以它天然「几乎不动」。要做出实时观感，必须新增一条**客户端流式文本 → token 增量**的旁路，
> 并配合 500ms 采样窗口 + 数字过渡；只调定时器是没用的。

---

## 一、症状与三条根因

用户反馈：HUD 上「缓存命中 / 上下文 / tok 每秒」变化间隔太长，不像实时；tok/s 数字几乎不动。

| # | 根因 | 一句话 |
|---|---|---|
| A | **tok/s 算法是整段会话平均** | `sessionStats.decodeTokens / decodeMs` 是全会话累计值，只增不减、越用越钝；且只在 `assistant/message` 落库时变一次。 |
| B | **上下文 / 缓存命中只有「请求粒度」** | `contextPressure.pressureTokens` 是「最近一次请求的 prompt 大小」（provider 上报），decode 期间不增长；`tokenUsage` 也是按请求累加。再叠加 **上下文百分比整数取整**（1M 窗口下 1% = 10 486 token），一整个 turn 可能一个像素都不变。 |
| C | **HUD 没有「正在流式」这一层，且 DOM 更新无过渡** | 现有实现是「投影帧即时重绘 + 1s 兜底 tick」，数值变化被静默替换；同时托盘 render 里混入了一个 1s 的侧栏余额 ticker，外加整页 `MutationObserver` 反向触发重绘。观感死板且有无谓开销。 |

附加两条次要项：

| # | 问题 | 影响 |
|---|---|---|
| D | 花费走「DOM 抓取 → HTTP 轮询」两级缓存（客户端 5s + 宿主 5s） | 花费最迟钝；外接 provider 下先显示 `—`，且旧字段没有 `estimated/currency/priceSource`。 |
| E | 托盘 `createComposerTray` 里 8 个 `querySelector` + 文本宽度不受约束 | 每次重绘都有小规模样式计算；数字变长（`0` → `262`）会推着右半行重新排布。 |

---

## 二、数据通路：一个数字是怎么来的

```
Host（会话事件日志，已提交/durable）
  └─ @deepseek-ai/dsh-session-projection：每个已提交事件同步驱动所有投影单元，
     wire view 变化才推一帧 ──► session control stream（无节流，立即广播）
        └─ 客户端 ProjectionValueStore.apply（microtask 批量） ──► useProjection()
             └─ client.js ThemeDataBridge（无渲染 React 桥，useEffect 每次渲染跑一次）
                  └─ updateBridge() 折叠进模块级 bridge 快照
                       └─ mountComposerTray().render() 把值写进 DOM
```

另一条完全独立的通路（本次改造要用）：

```
Host 会话 follow 流（assistantStream: true）
  └─ assistant-stream {start|chunk|end} 帧（每帧带 index/time）
       └─ 客户端合成 assistant/live-chunk 伪事件（仅前端，不进日志、不进投影）
            └─ chat 快照的 legacy.partial.blocks（每个 animation frame 发布一次）
                 └─ 当前主题的 useChat 只取了 legacy.nodes，**没有订阅 partial**
```

证据（安装包 `app.asar` 内只读核对，路径为包内路径）：

| 事实 | 出处 |
|---|---|
| 投影由「每个已提交事件」同步驱动，wire view 引用变化才通知；载体即时广播（无节流） | `@deepseek-ai/dsh-session-projection/lib/index.js` + `README.zh.md`「驱动与检查点流程」；`@deepseek-ai/dsh-api-session-controller/lib/index.js` `SessionControlController` 构造器中 `onChanged → broadcast` |
| `sessionStats` 只在 `assistant/message`（步结束）/`step/end`/`tool/result` 改变；decode 期间无事件 | `@deepseek-ai/dsh-session-stats/lib/types/projection.js` `apply()`（第 82–152 行）、`wire.view`（第 153–165 行）；模块注释明确「whole-log」 |
| `tokenUsage` 只在 `assistant/message`/`assistant/attempt` 用 usage 样本累加；wire view **只给 totals，不含最近一步 buckets** | `@deepseek-ai/dsh-token-meter/lib/types/usage-projection.js` `apply()`（第 90–117 行）、`wire: view: state => state.totals`（第 117 行） |
| `contextPressure.pressureTokens` = 最近一次请求的 prompt 大小（uncached input + cache read/write），**流式不增长**；`projectedTokens` 只是在样本上加「surface 自采样以来的启发式增减」 | 同上 `pressureFrom()`（第 56–57 行）、`wire.view`（第 177–186 行）；Host schema 描述原文「Response output is excluded, so this does not grow as the current turn streams」 |
| surface 只在消息 append / compaction 时变化（工具结果、assistant 消息落库） | `@deepseek-ai/dsh-token-meter/lib/types/surface-projection.js` `foldSurfaceProjection()`（第 36–66 行） |
| 客户端确实收到逐 chunk 流并合成 `assistant/live-chunk`，chat 快照按 animation frame 发布会话原文 | `@deepseek-ai/dsh-api-session-controller/lib/client.js`（`assistantStream: true`、`assistant/live-chunk` 合成；约第 433、2038、2101 行）；`@deepseek-ai/dsh-client-ui-chat/lib/client.js` `assistantDefinition.publication`（`"animation-frame"`）与 `legacy.partial`（`{turn, step, blocks}`，约第 9125–9170 行） |

---

## 三、现状表

`client.js` 行号对应当前工作区版本（`2.5.2`，5763 行）。

| 指标 | 数据源 | 触发方式 | 推断刷新间隔 | 问题 |
|---|---|---|---|---|
| **tok/s** | `bridge.tokensPerSecond` ← `useProjection('sessionStats')` 的 `decodeTokens / (decodeMs/1000)`，四舍五入（`updateBridge` 2186 行）；兜底为隐藏底栏 `.RlGAzG_dock` 文本里的 `N tok/s`（`readLegacyStats` 1178–1187 行） | sessionStats 投影帧 → `bridgeListeners` 立即重绘 + 1s 定时器兜底（1762–1763 行） | **一个 step 一次**（等于一次 `assistant/message`），长回答 10–60s；数值本身是会话累计平均，逐步收敛 | 数值是「整段 decode 平均」，不是当前速度；decode 期间零帧，数字冻住；`running=false` 时归零（1676–1678 行，这部分是对的，保留） |
| **上下文** | `bridge.context` ← `useProjection('contextPressure')`：`projectedTokens ?? pressureTokens` / `contextWindow`，`Math.round(percent)`（`updateBridge` 2166–2176 行） | 同上（投影帧 + 1s tick） | **请求边界**（每次 API 请求结算）+ surface append（工具结果/消息落库）；纯文本回答时**一个 turn 只变一次** | ① 整数百分比：1 048 576 窗口下 1% = 10 486 token，普通 turn 增量 <1% → 整轮不变；② `pressureTokens` 不含正在生成的输出；③ 工具轮之间会跳变，但两跳之间空白很长 |
| **缓存命中** | `bridge.cacheHitPercent` ← `useProjection('tokenUsage').totals`：`cacheRead / (cacheRead+uncached+write)`，`toFixed(1)`（`updateBridge` 2191–2204 行）；兜底同底栏文本正则（1179 行） | 同上（投影帧 + 1s tick） | **一步一次**；且分母是全会话累计，命中率长期收敛（DeepSeek 前缀缓存下通常 97–99.x%） | 每步变化常 <0.1%，两位有效位看不出来；`tokenUsage` 的 wire view 不含「最近一步 buckets」，客户端只能自己差分 |
| **花费** | 优先抓隐藏底栏 `.RlGAzG_dock` 文本（`本次花费/本会话`，1180、1692 行）；拿不到才 `POST /api/dsh-claude-code-desktop-theme/usage-summary`（`refreshSessionCost` 1629–1666 行） | 每次 render 调用，自身节流 5s（1634 行）；宿主导轨另有 `SESSION_COST_CACHE_MS = 5000`（`index.js` 417 行）与整表 `CACHE_TTL_MS = 30000`（`index.js` 33 行，但带 sessionId 时总会重算 cost 段） | 有效 **≥5s**，且只在 render 时顺带触发；宿主每次重放整段会话日志（`observeSession`，`index.js` 433 行） | 外接 provider 下 `priced:false` → 显示 `—`；币种符号硬编码 `USD→$` 否则 `¥`（1646 行）；无 `estimated/priceSource`，无法区分「实扣」和「按价目估算」 |
| **余额** | 隐藏底栏文本 `余额 …` + `localStorage`（1176–1182 行）；侧栏另有 `ctx.remote.account.getBalance()` 通路（独立 ticker 10s） | 独立 1s 定时器 + 整页 MutationObserver（1092–1093 行）；托盘 render 里又调一次 `syncSidebarBalance()`（1718 行） | 1s（但只在值变化时写 DOM） | 与 HUD 托盘重复刷新；低频本身符合余额语义，不是本次重点 |
| **Agents** | `useSessions().projectionsBySession[sessionId].values.subagentCatalog` + status 过滤（`updateBridge` 2205–2215 行） | 投影帧，即时 | 事件驱动，**这条是真的实时** | 无（可作为「即时性」对照基线） |

实测旁证（`docs/DESIGN.zh.md` 第 315 行）：`projectedTokens 229533 / 1048576 → 22%`，观察值 22–26%「随会话实时变化」——其实正是**请求边界跳变**，与本文推断一致。

---

## 四、根因分析

### A. tok/s = 整段会话 decode 平均（算法问题）

`client.js` 2186 行：

```js
bridge.tokensPerSecond = decodeMs > 0 ? Math.max(0, Math.round(decodeTokens / (decodeMs / 1000))) : 0
```

- 分子分母都是 `sessionStats` 的**累计**字段（`projection.js` 第 33–34、155–165 行），只增不减。
- 会话越长，累计平均越稳定：一个 30 step、平均 28 tok/s 的会话，第 10 步之后显示值几乎不再变化。
- 每步结算后只在下一帧更新一次，且 `step` 之间的 decode 时间不包含 TTFT、工具等待，混在平均值里。
- 底栏兜底值（`readLegacyStats`）来自宿主原生统计药丸，算法一模一样（`dsh-client-ui-chat` `decodeSpeed()`：`decodeTokens / (decodeMs / 1e3)`），所以换源也救不了。

**结论：tok/s 需要「当前窗口」的 token 增量，而不是任何累计平均。**

### B. 上下文 / 缓存命中只有请求粒度，且被量化放大

1. `contextPressure` 的分子是 provider 上报的 prompt 大小，**只在请求发出/结算时产生**（`usage-projection.js` 56–57、126–139 行）。正在生成的 token 还没进 prompt，所以 decode 期间它**理论上**就不该动。
2. `tokenUsage` 按步累加（90–117 行），wire view 只有 `totals`；命中率是全会话口径。
3. 客户端的显示又把粒度放大了两级：
   - 上下文：`Math.round(used/window*100)`（2171 行）→ 1M 窗口 = 10 486 token/百分点；
   - 缓存命中：`toFixed(1)` 后去掉 `.0`（1680 行）→ 0.1 个百分点分辨率。
4. 因此「长间隔」不是轮询造成的：**投影帧到达是即时的**（`bridgeListeners` 在 `updateBridge` 末尾同步调用，2259–2267 行），只是新样本本身稀疏。

### C. 刷新与 DOM：即时重绘是对的，但缺少「流式在场感」和过渡

- `mountComposerTray` 有三条刷新源：`bridgeListeners.add(render)`（1762 行，投影帧即时）、`setInterval(render, 1000)`（1763 行）、整页 `MutationObserver → rAF → ensure()+render()`（1773–1774 行）。第三条在流式输出期间被聊天 DOM 的每帧变化反复触发（rAF 合并，但每帧一次全量托盘重绘）。
- `render()` 内部对每个托盘做 8 次 `querySelector`（1705–1746 行），并调用 `syncSidebarBalance()`（1718 行）——后者自己还有 1s 定时器（1092 行），属于重复劳动。
- 数值直接 `textContent =` 覆盖，没有过渡；`font-variant-numeric: tabular-nums` 只保证数字等宽，**不保证字符串长度不变**（`0` → `262` 会推挤右侧 flex 行）。
- 环形进度有 `transition: stroke-dashoffset .3s`（657 行），这是全 HUD 唯一有动画的部分。

### D. 花费路径

- 优先 DOM 抓取：外接 provider / 没有底栏插件时 `costKnown=false`，进入 HTTP 路径；
- 客户端节流 5s（1634 行）+ 宿主 `buildSessionCost` 缓存 5s（`index.js` 417 行）+ 每次重放整段日志（433 行）；
- 外接 provider 未在 `PRICING` 表内（`index.js` 376–406 行）→ `priced:false`、`cost:null` → 客户端 1645 行直接 return，保持 `—` 或上一条 localStorage 值。
- 另一任务正在给该接口加 `estimated/currency/priceSource`，客户端需要按新契约显示 `≈`、币种与来源，同时兼容旧字段。

---

## 五、改造方案

设计原则：**宿主负责「真值」，客户端负责「在场感」**。真值一到就覆盖估算；估算只在两次真值之间做补间，绝不能伪造一个比真值更「真」的数字。

### 5.1 三层结构

| 层 | 职责 | 位置 |
|---|---|---|
| 数据层 | ① 从 `legacy.partial.blocks` 估计流式 token 增量（2–3s 环形缓冲）；② 从 `sessionStats`/`tokenUsage` 的**相邻帧差分**得到「上一步真实速度 / 上一步真实命中率」；③ 用真值校准估算系数 | `ThemeDataBridge` 旁新增无渲染探针 + `updateBridge` |
| 调度层 | 500ms 采样 ticker（活跃会话）/ 2s 空闲 ticker；`visibilitychange` 暂停；MutationObserver 只做 `ensure()` 不做 paint | `mountComposerTray` |
| 表现层 | 纯文本更新 + Web Animations `opacity/transform` 过渡；固定宽度数字槽；`contain` 隔离；上下文 1 位小数 | `createComposerTray` + CSS |

### 5.2 tok/s：2s 滚动窗口 + 真值校准

```js
// 数据层：探针每帧只写内存，不 setState、不碰 bridge、不碰 DOM
const live = {
  sessionId: null,
  tokens: 0,        // 当前 step 已流出的估计 token 数（含 reasoning / tool-call 参数）
  samples: [],      // [{t, tokens}]，保留 3s
  streaming: false,
  lastGrowthAt: 0,
  calib: 1,         // 真值 / 估算，clamp 到 [0.5, 2.5]
}

// 调度层：每 500ms 采样一次
function liveTps() {
  const now = performance.now()
  const cutoff = now - 2000
  const base = live.samples.findLast((s) => s.t <= cutoff) ?? live.samples[0]
  const newest = live.samples.at(-1)
  if (!base || !newest) return 0
  const dt = (newest.t - base.t) / 1000
  const dTokens = (newest.tokens - base.tokens) * live.calib
  if (dt < 0.5 || dTokens <= 0) return 0
  // 流停 1.2s 后自然衰减到 0，避免「假装还在跑」
  if (now - live.lastGrowthAt > 1200) return 0
  return Math.round(dTokens / dt)
}
```

- **估算函数**：复刻宿主的固定密度启发式（`@deepseek-ai/dsh-token-meter/lib/types/estimate.js`：`CHARS_PER_TOKEN = 4`），并对 CJK 修正：
  `tokens += cjkCount * 1 + Math.ceil((otherChars) / 4)`，块级 `+4` 开销只在块首次出现时计一次。
- **校准**：`updateBridge` 检测到 `sessionStats` 变化时（一次 step 结算），用差分 `ΔdecodeTokens / ΔdecodeMs` 得到真实速度，并用「这一步的估算总量」反推 `calib = 真值token / 估算token`，clamp 后给下一个 step 用。中文场景下未校准会把速度低估约 3–4 倍，校准后误差可控在 ±15%。
- **空闲语义保持不变**：`running !== true` 或 1.2s 无增长 → `0 tok/s`（保留现 1676–1678 行逻辑）。

### 5.3 上下文：真值锚点 + 估算爬升 + 1 位小数

- 主值：`projectedTokens / contextWindow`，显示 **1 位小数**（`12.4%`），不再四舍五入到整数 → 分辨率从 10 486 token 降到 ~1 049 token。
- 流式期间叠加「当前 step 的估计 token」：`liveUsed = usedTokens + live.tokens`（只在 `running` 且 `live.streaming` 时生效）。
- step 结算时投影会跳一下（估算换成真值），用 150ms `opacity/transform` 过渡 + 数字淡入吃掉跳变，不要做位移动画。
- tooltip 显示 `~used / window tokens`（`~` 表示含估算），并在估算态把数字颜色降低一档透明度。
- 100% 附近仍保留整数语义（`99%` 不显示 `99.4%`，避免误导「已满」）。

### 5.4 缓存命中：整段会话为主，最近一步进 tooltip

- **不做语义漂移**：主值仍是整段会话命中率（与宿主原生「用量」药丸一致，`docs/DESIGN.zh.md` 已有承诺）。
- 用差分补一个 `lastStepHit`：`tokenUsage.totals` 相邻帧相减 → 最近一步的 `cacheRead/(read+uncached+write)`，写进 tooltip：「整段 99.7% · 最近一步 92.3%」。
- 每次真值变化时做 150ms 数字过渡（这才有「在动」的观感）；running 且 40s 未变时，标签尾部淡化显示一个 `·` 呼吸点（可选，见 5.6）。
- 数值格式统一 1 位小数（`99.7%`），去掉 `.0` 的省略规则，避免宽度来回变。

### 5.5 花费：新契约 + 更快刷新

客户端读取 `payload.value.sessionCost` 时按以下顺序降级（兼容旧宿主）：

```js
// { sessionId, cost, currency, priced, estimated?, priceSource?, model }
if (cost.sessionId !== sessionId) return                 // 防串会话
if (typeof cost.cost !== 'number') return                // 无价：保持上一值/'—'
const cur = cost.currency === 'USD' ? '$' : cost.currency === 'CNY' ? '¥' : (cost.currency ?? '')
sessionCostText = (cost.estimated === true ? '≈' : '') + cur + fmt(cost.cost)
```

- tooltip：`priceSource` + `estimated` 说明（例：「按真实 token 与官方价目估算」/「账单实扣」）。
- 刷新：客户端节流 5000 → **2000ms**；是否需要同步下调 `index.js` 417 行的 `SESSION_COST_CACHE_MS`，见第九节。
- 会话切换时清 `sessionCostText/sessionCostId`（现在靠 `sessionCostId === currentSessionId` 判断，保留）。

### 5.6 DOM 与动画规范（不重排）

| 项 | 做法 |
|---|---|
| 结构 | `createComposerTray` 把「标签」和「数字」拆开：`上下文 <span class="dsh-hud-num">12.4%</span>`、`缓存命中 <span class="dsh-hud-num">99.7%</span>`、`<span class="dsh-hud-num">262</span> tok/s` |
| 宽度 | `.dsh-hud-num{display:inline-block;min-width:var(--w);text-align:right;font-variant-numeric:tabular-nums}`，`--w` 按槽位给（tps 3.5ch、percent 4.5ch、cache 5.5ch）→ 文本变化不改变行宽 |
| 隔离 | `.dsh-composer-tray{contain:layout style}`（不要 `paint`，避免裁掉 focus ring）；托盘本来就是 `overflow:hidden` |
| 过渡 | `el.animate([{opacity:.35, transform:'translateY(1px)'},{opacity:1, transform:'none'}], {duration:150, easing:'ease-out'})`；仅此一处动画，`transform/opacity` 走合成层，不触发布局 |
| 降级 | `matchMedia('(prefers-reduced-motion: reduce)')` 时跳过动画（现有代码已有此模式，1208 行） |
| 环 | 保留 300ms `stroke-dashoffset`（657 行）；流式期间可加一个 1.5s 的 opacity 呼吸，但必须 `reduced-motion` 关闭 |
| 更新顺序 | 先算完全部文本，再统一写 DOM；只有 `textContent` 真的变化才写（保留现有相等判断），再触发动画 |
| 观察器 | `MutationObserver` 只调 `ensure()`（补齐/清理托盘），**不再调 render**；render 只由 ticker + `bridgeListeners` 驱动 |

---

## 六、精确改动清单（实现阶段直接用）

### 6.1 `client.js`

| # | 位置（当前行号） | 现状 | 改成 |
|---|---|---|---|
| 1 | 2019–2028 `bridge` 对象 | `context / agents / tools / sessions / blank` | 增加 `lastStep: null`（`{tps, hit, at, sessionId}`）、`usageDelta: null`、`statsPrev: null`、`usagePrev: null`、`sessionIdChangedAt` |
| 2 | 2166–2176（context 折叠） | `percent: Math.round(...)` | 保留原始 `usedTokens/contextWindow`，新增 `percentExact: used/window*100`（浮点）；`percent` 保留给旧逻辑兜底 |
| 3 | 2180–2190（stats 折叠） | 直接算累计平均 | 增加差分：`ΔdecodeTokens/ΔdecodeMs` → `bridge.lastStep = {tps: real, at: Date.now()}`；`tokensPerSecond` 保留作为兜底（冻结时只用于空闲显示） |
| 4 | 2191–2204（usage 折叠） | 只算累计命中率 | 保存 `bridge.usagePrev/totals`，差分出最近一步 buckets → `bridge.lastStep.hit`；`cacheHitPercent` 保留 |
| 5 | 2163 起 `updateBridge` | 每次调用重建 `tools` Map 并做 LCS | 保持现状即可（只在 node 变化时触发）；**不要**让新探针调用 `updateBridge` |
| 6 | 2271–2291 `ThemeDataBridge` | 只选 `legacy.nodes` | 不动它（避免每帧重建 diff Map） |
| 7 | 2271 之后新函数 `ThemeLiveProbe` | — | 新增无渲染组件：`const partial = useChat((s) => s.legacy.partial)`；每次渲染调 `live.sample(partial, document.visibilityState)`；返回 `null`。**不 setState、不写 DOM、不调 updateBridge** |
| 8 | 5609–5618（slot 注册） | 只注册 `dsh-theme-data` | 追加注册 `{ name: 'conversation.composer.dock', id: 'dsh-theme-live', order: 101 }` → `ThemeLiveProbe`；dispose 时反注册并清空 `live` |
| 9 | 1117–1143 `createComposerTray` | 单段文本、无数字槽 | 拆分标签/数字 span，加 `data-role`（`cache/cost/tps/context/agents`），加 `--w` 固定槽；缓存/上下文/花费/tps 四处结构改动 |
| 10 | 1618–1782 `mountComposerTray` | 1s 定时器 + observer 里 render | 见 6.2 的拆分：`readModel()` / `paint()` / `ensure()` / `tick()`；ticker 500ms（running）/2000ms（idle），`visibilitychange` 时 `clearInterval` 并在恢复时重排 |
| 11 | 1629–1666 `refreshSessionCost` | 5s 节流；只认 `cost/priced/currency` | 2s 节流；接受 `estimated/priceSource`；`≈` 前缀；失败保留旧值（行为不变） |
| 12 | 1668–1695 `render` 前段 | `computedTps`/`cachedHit`/`percent` 全在本函数算 | 抽成 `readModel()`：tok/s 用 `liveTps()`（5.2），空窗回退 `lastStep.tps`；上下文 1 位小数 + `liveUsed`；缓存主值 + `lastStep.hit` 进 tooltip |
| 13 | 1696–1748 `render` 后段 | 8 次 `querySelector` + 直接写 text | 用 `WeakMap` 缓存每个托盘的节点引用；写文本 + `animateNumber(el)`；删除 1718 行 `syncSidebarBalance()`（侧栏自己 1s 刷新） |
| 14 | 1749–1759 `ensure` | 已只做挂载维护 | 保留，作为 observer 唯一动作 |
| 15 | 1760–1782 收尾 | `setInterval(render,1000)` + observer→render | 新调度；新增 `visibilitychange` 监听；dispose 时清理（含 `live.reset()`） |
| 16 | 642–659 CSS | 无数字槽/无动画/无 contain | 加 `.dsh-hud-num`、`--w` 变量、`contain:layout style`、`@keyframes dsh-hud-fade`（或直接 WAAPI，则只用 CSS 兜底）、`reduced-motion` 关闭 |
| 17 | 700–708 主题覆盖 | 仅颜色 | 补 `.dsh-hud-num` 的暗色/亮色与估算态透明度；不要新增会改变布局的属性 |

### 6.2 `mountComposerTray` 拆分（示意）

```js
const readModel = () => ({ tpsText, cacheText, cacheTitle, contextText, contextTitle, costText, costTitle, blank })
const paint = (model) => { for (const tray of trayNodes) { ...只写变化项 + animateNumber } }
const tick = () => { if (document.hidden) return; paint(readModel()) }
// 调度
let ticker = window.setInterval(tick, 500)
bridgeListeners.add(() => { resetTicker(); paint(readModel()) })   // 真值帧：立即画 + 重排节奏
document.addEventListener('visibilitychange', onVisibility)
onVisibility: hidden → clearInterval；visible → tick(); 重新 setInterval
running 变化 → 500ms / 2000ms 切换（不必重建 ticker，tick 内判断间隔即可）
observer: MutationObserver(ensure)  // 只看 childList/subtree，不 paint
```

### 6.3 `docs/DESIGN.zh.md` / `README.md`（实现完成后同步，非本阶段改动）

- `DESIGN.zh.md` 第 306 行「上下文/Agents 更新按 React store 变更即时渲染」→ 补充「上下文/缓存的真值只有请求粒度；tok/s 为流式估算 + 步末校准」。
- `DESIGN.zh.md` 第 248 行「tok/s 为实时值」措辞需要修正。
- `README.md` 第 118 行「实时 tok/s」→ 「流式估算 tok/s（步末校准）」。

---

## 七、验证方案（实现阶段）

1. **数值正确性**
   - 跑一个 30s+ 的长回答：tok/s 应在 500ms 粒度上变化，首 token 前为 0，流停 1.2s 内衰减为 0；
   - 与 `sessionStats` 差分出的真实速度对比，误差 ≤ 20%（中英混合场景校准后 ≤15%）。
2. **上下文**
   - 1M 窗口会话中，一轮普通回答至少出现 1 次小数变化；tool call 后跳到新真值；
   - tooltip 的 `~used / window` 与 `contextPressure.projectedTokens` 单调一致（估算段可以短暂高于真值，结算后回到真值）。
3. **缓存命中**
   - tooltip 的「最近一步」与手工用 `tokenUsage.totals` 差分计算结果一致（可在控制台加临时 debug）。
4. **无重排**
   - `Performance` 面板录制：HUD 更新期间没有 `Layout`/`Recalculate style` 长条（`transform/opacity` 只产生 `Composite`）；
   - `getBoundingClientRect()` 在更新前后托盘宽度/高度不变（16px 行高、卡片高度 99.3px、8px 间距，沿用 `DESIGN.zh.md` 的验收值）。
5. **资源**
   - 流式期间 React 提交次数不因探针增加；`document.hidden` 时 ticker 停止（performance monitor 主线程空闲率上升）。
6. **回归**
   - 空白会话（hero）托盘仍 `display:none`；切换会话不串值；离线/路由 404 时花费显示 `—` 且不报错；`reduced-motion` 下无动画。

建议实现时加一个只读诊断函数（与 `__dshClaudeThemeStatusDebug` 同风格）：`__dshClaudeThemeHudDebug()` 返回 `{ live, lastStep, bridge }` 快照，便于用户在 DevTools 里对照。

---

## 八、风险与回归点

| # | 风险 | 处理 |
|---|---|---|
| 1 | **与另一任务的 `index.js` 花费接口冲突** | 客户端按 5.5 的降级顺序读取，字段缺失时行为与现在完全一致；合并顺序上先合 `index.js` 再加客户端字段 |
| 2 | `legacy.partial.blocks` 属于宿主 Chat 兼容层内部结构（升级可能变） | 探针全程 try/catch；拿不到 `partial` 时 `live` 为空，tok/s 自动回退到现有累计值（仅少了平滑，不报错） |
| 3 | 每帧 React 渲染带来额外主线程开销 | 探针只做增量计数（按 block 引用缓存，文本没变就跳过），不 setState、不遍历全部节点；实测若 >1ms/帧，改为 `requestIdleCallback` 抽样 |
| 4 | 估算 ≠ 真值，用户可能质疑数字 | 数字保持「步末校准」，tooltip 明确标注估算；真值一到达立即覆盖 |
| 5 | 数字槽固定宽度可能截断大数字（`1234 tok/s`） | `min-width` 只保底不封顶；超过 3 位时允许自然加宽（极少见），或按 1 位有效小数缩写成 `1.2K` |
| 6 | 上下文出现小数后与原生环形/原生药丸整数不一致 | 托盘是自绘的，原生药丸不在托盘里；只有 tooltip 需要写清口径 |
| 7 | 删掉 render 里的 `syncSidebarBalance()` 后余额更新变慢 | 侧栏自己有 1s ticker（1092 行），行为不变；若担心，保留但改为只在该 ticker 里刷新 |
| 8 | 页面隐藏时暂停导致回来第一帧是旧值 | 恢复时立即 `tick()` 一次再重排定时器，禁用 2s 窗口的旧样本（`visibilitychange` 里 `live.samples = []`） |
| 9 | 与语音/状态点/模型标签的 ticker 抢主线程 | 本次只改托盘；若仍卡顿，下一步统一收敛（status 500ms、badge 700ms、label 700ms、hero 800ms/200ms），单独排期 |
| 10 | 会话切换瞬间显示上一条会话的速度 | `live.sessionId` 与 `bridge.currentSessionId` 不一致时 `live.reset()`；`updateBridge` 里检测 sessionId 变化 |
| 11 | 托盘结构改动破坏「永远单行/不折行」 | 保持 `white-space:nowrap` + `overflow:hidden`；新增 span 不引入块级元素 |
| 12 | `contain:layout` 影响宿主对 composer 的尺寸测量 | 托盘是卡片兄弟节点，不参与卡片布局；上线前用 `getBoundingClientRect` 复验 `DESIGN.zh.md` 的 99.3px/8px 两项 |

---

## 九、是否需要 Host 侧配合

**结论：非必需。** 客户端已同时具备：
- 真值通路：`contextPressure / sessionStats / tokenUsage` 投影（即时帧）；
- 流式通路：`assistant-stream` chunk 帧 → `legacy.partial.blocks`（每 animation frame）。

可选增强（收益/成本比低，建议暂不做）：

| 选项 | 收益 | 代价 |
|---|---|---|
| `tokenUsage` wire view 补 `last: {turn, step, buckets}` | 客户端不用差分，能直接显示「最近一步命中率」 | 要改宿主投影（本插件无权，需要上游）；差分已能等价实现 |
| Host 增加 `hud-live` 投影（按 chunk 折 token 计数） | tok/s 变成 provider 级精确 | 需要把 client-only 的 live chunk 引入 host 状态，违背现有分层；且要节流，否则每 token 一帧 |
| 下调 `SESSION_COST_CACHE_MS`（`index.js` 417 行）至 2s | 花费更快 | `buildSessionCost` 每次重放整段日志（433 行），长会话下会变成 O(log) 热点；建议维持 5s，或由花费任务改成增量 |

需要与 Lead 协调的一件事：**花费字段契约**（`estimated/currency/priceSource`）与本改造的客户端读取顺序必须同批合并，否则会短暂出现 `—` 或双币种显示。

---

## 十、实现顺序（给 Lead 排期）

1. **数据层**（无 UI 变化）：`ThemeLiveProbe` + 环形缓冲 + `updateBridge` 差分（清单 1–8）。可先用 `__dshClaudeThemeHudDebug()` 在控制台验证数值。
2. **表现层**：托盘结构拆分 + 1 位小数 + 固定数字槽 + WAAPI 过渡（清单 9、16、17）。
3. **调度层**：500ms/2s 自适应 ticker + 可见性暂停 + observer 只 `ensure`（清单 10–15）。
4. **花费契约**：与 `index.js` 改动合并（清单 11 + 5.5）。
5. **清理与文档**：移除重复 `syncSidebarBalance`、更新 `README.md`/`DESIGN.zh.md` 措辞。
6. **回归验证**：第七节 1–6，重点复验卡片高度/间距/单行。

预估改动量：`client.js` 约 250–320 行（新增 ~120，改写 ~150），CSS ~15 行；`index.js` 零改动（除非选做花费 TTL）。

---

## 附：一句话回答「为什么不像实时」

- **tok/s** 显示的是「这个会话平均每解码秒产出多少 token」，不是「现在多快」；而且解码期间宿主没有任何新数据可推。
- **上下文** 的分子是「上一次请求的 prompt 大小」，正在生成的输出还不算；百分比又被取整成 1%（1M 窗口 = 1 万 token 一档）。
- **缓存命中** 按请求累加、分母是全会话，长期收敛到 99.x%，每步只动 0.0x%。
- 真正实时的只有流式文本本身；HUD 缺的正是把「文本在长」翻译成「速度/占用在长」的这一层。