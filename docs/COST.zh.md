# 本次花费估算（Host 半）

> 适用版本：主题 3.0 开发线。Host 实现：`index.js` 的 `PRICING` / `MODEL_FAMILY_RULES` /
> `resolvePricing` / `buildSessionCost`。Client 展示由另一处改动负责，本文只约定数据与显示规则。

## 1. 这个数字是什么

「本次花费」是 **Host 根据会话里记录的真实 token 用量、乘以价格表算出来的估算值**，不是
provider 账单。Host 永远不会产生「实扣」金额。显示优先级保持为：

| 优先级 | 来源 | 客户端行为 |
| --- | --- | --- |
| 1（最高） | 已安装 `bottom-info-bar` 时其隐藏 dock 中的实扣金额 | 原样显示，**不加估算标记**（现有 `readLegacyStats()` 路径，不改） |
| 2 | Host 估算（本文档描述的接口） | 显示金额，但必须标「估算」（`estimated: true`）与币种 |
| 3 | 无法定价（`priced: false`） | 显示 `—` |

超过 5 秒的估算结果会重新折叠会话；`pricing.json` 改动在 10 秒内生效，均不需要重启 DSH。

## 2. 接口与字段

`POST /api/dsh-claude-code-desktop-theme/usage-summary`，请求体 `{ "sessionId": "<id>" }`，
响应 `{ ok: true, value: { ..., sessionCost } }`。`value.sessionCost` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sessionId` | string | 会话 id |
| `cost` | number \| null | 估算金额；`priced:false` 时为 `null` |
| `currency` | `'CNY'` \| `'USD'` \| … | `cost` 的币种（混币时取最大小计的币种，见 §6） |
| `priced` | boolean | 所有带用量的样本都成功定价时才是 `true` |
| `estimated` | boolean | **本接口返回的金额一律是本地估算**：`priced:true` 时为 `true`，无法定价为 `false` |
| `priceSource` | `'catalog'` \| `'override'` \| `'family'` \| `'none'` | 价格来源（见 §3） |
| `matchedKey` | string \| null | 命中的规则标识；`none` 时为 `null` |
| `unit` | `'per-1m-tokens'` | 价格单位：每 100 万 tokens 的金额 |
| `model` / `provider` | string \| null | 会话最近一次 `request/header` 的模型与 provider |
| `costByCurrency` | object | `{ "CNY": 0.12, "USD": 0.03 }`，分币种小计 |
| `mixedCurrencies` | boolean | 本次会话是否出现多种币种 |
| `unpricedSamples` | number | 无法定价的 usage 样本数（没有模型信息才会发生） |

### priceSource 语义

| 值 | 含义 | 客户端建议 |
| --- | --- | --- |
| `catalog` | 命中内置精确模型价（官方 DeepSeek 行等） | 估算标记 + 币种；tooltip 显示 `matchedKey` |
| `override` | 命中用户在 `pricing.json` 里写的价格 | 同上，可注明「自定义价」 |
| `family` | 同族默认价（未知变体、外接网关的别名模型） | 估算标记，可弱化显示（如 `~¥0.12`） |
| `none` | 没有任何规则命中，使用保守兜底价 | 估算标记 + 建议 tooltip「未知模型，按中档价估算」 |

一个会话用了多个模型时，`priceSource` / `matchedKey` 取**可信度最低**的那次匹配
（`none` < `family` < `catalog`/`override`），以免把一个混了兜底价的金额说成精确价。

## 3. 匹配优先级（从高到低）

1. **用户覆盖精确匹配**：`pricing.json` 中 `provider:model` → 裸 `model`（大小写不敏感）；
2. **用户覆盖前缀 / `*` 通配**：同一 provider 域内优先生效，同样命中时长模式优先；
3. **内置精确目录**：`provider:model` 对应行 → 裸模型 id（忽略大小写与 `vendor/` 前缀）；
4. **内置族规则**：先按模型名族（`deepseek` / `qwen` / `glm` / `kimi` / `minimax` /
   `gpt` / `claude` / `gemini` / `grok`），再按 provider 名前缀兜底；
5. **兜底估算**：`priceSource: 'none'`，按 CNY ¥2 输入 / ¥0.2 缓存读 / ¥8 输出
   （每百万 tokens）给出保守估算。

未知模型不会再返回 `—`，而是 `priced:true` + `priceSource:'none'`。只有「会话里没有模型信息」
（没有 `request/header`）才会 `priced:false`。

## 4. 内置价格表

单位：**元（CNY）或美元（USD）/ 每百万 tokens**。`缓存读` 指 cache-hit 输入价。
DeepSeek 的两档是官方峰谷价；其它为公开列表价的**快照**，可能落后于 provider 调价，
可用 §5 覆盖。

| 族 / 档位 | 命中示例 | 币种 | 输入(未命中) | 缓存读 | 输出 |
| --- | --- | --- | --- | --- | --- |
| `deepseek-flash`（峰/谷） | `deepseek-flash`、`deepseek-v4-flash`、`deepseek-v4.1-flash-1017` | CNY | 2.0 / 1.0 | 0.04 / 0.02 | 8.0 / 4.0 |
| `deepseek-v4-pro`（峰/谷） | `deepseek-v4-pro`、`…-pro` 变体 | CNY | 9.0 / 4.5 | 0.30 / 0.15 | 27.0 / 13.5 |
| `deepseek-chat`（平） | `deepseek-chat` | CNY | 2.0 | 0.5 | 8.0 |
| `deepseek-reasoner`（平） | `deepseek-reasoner`、`deepseek-r1` | CNY | 4.0 | 1.0 | 16.0 |
| `qwen-max` | `qwen3.8-max`、`qwen-max-*` | CNY | 2.4 | 0.24 | 9.6 |
| `qwen-coder` | `qwen3-coder-plus` | CNY | 4.0 | 0.4 | 16.0 |
| `qwen-plus` | `qwen-plus-*`、`qwen-long` | CNY | 0.8 | 0.08 | 2.0 |
| `qwen-turbo` | `qwen-turbo`、`qwen-flash` | CNY | 0.3 | 0.03 | 0.6 |
| `glm` | `glm-5.3`、`glm-4.6` | CNY | 4.0 | 0.4 | 16.0 |
| `glm-air` | `glm-4.5-air`、`glm-4-flash` | CNY | 0.8 | 0.08 | 2.0 |
| `kimi-k2` | `kimi-k2.5`、`kimi-k3` | CNY | 4.0 | 1.0 | 16.0 |
| `kimi-8k/32k/128k` | `moonshot-v1-8k` 等 | CNY | 12 / 24 / 60 | 10% | 12 / 24 / 60 |
| `minimax-m2` | `MiniMax-M2.5` | CNY | 2.1 | 0.21 | 8.4 |
| `gpt-5` / `gpt-5-mini` | `gpt-5.4`、`gpt-5-mini` | USD | 1.25 / 0.25 | 0.125 / 0.025 | 10 / 2 |
| `gpt-4` / `gpt-4o-mini` | `gpt-4.1`、`gpt-4o` | USD | 2.5 | 1.25 | 10 |
| `o-series` / `o-mini` | `o3`、`o4-mini` | USD | 2.0 / 1.1 | 0.5 / 0.275 | 8.0 / 4.4 |
| `claude-opus/sonnet/haiku` | `claude-opus-4.1`、`claude-sonnet-4.6` | USD | 15 / 3 / 1 | 1.5 / 0.3 / 0.1 | 75 / 15 / 5 |
| `gemini` / `gemini-flash` | `gemini-2.5-pro`、`gemini-2.5-flash` | USD | 1.25 / 0.3 | 0.31 / 0.075 | 10 / 2.5 |
| `grok` | `grok-4` | USD | 3.0 | 1.5 | 15.0 |
| 兜底（`none`） | 任何无法识别的模型 id | CNY | 2.0 | 0.2 | 8.0 |

> `deepseek-flash` 行同时覆盖 `pi-ai` 路由下的 `deepseek-v4.1-flash-1017` 这类未收录变体；
> 峰/谷两列分别是峰时价与谷时价。

## 5. 用户覆盖文件

### 5.1 路径

```
~/.dsh/dsh-claude-code-desktop-theme/pricing.json
```

- 文件**可选**：不存在、无权限或 JSON 损坏时静默忽略（损坏会记录在 `loadPricingState().errors`）。
- 环境变量 `DSH_THEME_PRICING_FILE=<绝对路径>` 可指向另一份文件（自检脚本用它隔离用户配置）。
- 修改后 10 秒内生效（文件 mtime 变化立即失效缓存），无需重启。

### 5.2 格式

```json
{
  "models": {
    "qwen3.8-max": { "input": 0.5, "output": 2, "cacheRead": 0.05, "currency": "CNY" },
    "glm-*":       { "input": 1, "output": 3, "cacheRead": 0.1, "currency": "CNY" },
    "pi-ai:my-gateway-model": { "input": 1, "output": 4, "currency": "USD" }
  },
  "peakValley": {
    "enabled": true,
    "utcOffsetMinutes": 480,
    "weekdays": [1, 2, 3, 4, 5],
    "windows": ["09:00-12:00", "14:00-18:00"]
  }
}
```

字段说明：

- `input`：输入未命中缓存价（必填，≥0）；`output`：输出价（必填，≥0），单位都是
  **每百万 tokens**；
- `cacheRead`：输入命中缓存价（可选，缺省 = `input` 的 10%）；
- `currency`：可选，缺省 `CNY`，会统一转大写；
- `mode: "peak-valley"` 时改用 `peak` / `offpeak` 两个对象（字段同上），否则按 `flat` 处理；
- `models` 的键可以是：精确模型 id、前缀（如 `glm-`）、`*` 通配（如 `glm-*`、`*`）、
  或 `provider:模型串`。同一层级下更长的匹配串优先；用户配置整体优先于内置目录；
- 非法条目（缺 `input`/`output`、类型不对）会被跳过，不影响其它条目。

### 5.3 只想改一个模型的价格

```json
{ "models": { "deepseek-v4-pro": { "input": 4.5, "output": 13.5, "cacheRead": 0.15 } } }
```

### 5.4 给某个外接网关整体定价

```json
{ "models": { "my-gateway-*": { "input": 2, "output": 8, "cacheRead": 0.2, "currency": "CNY" } } }
```

## 6. 峰谷计价

- 默认：北京时间（UTC+8）**周一至周五 09:00–12:00、14:00–18:00** 为峰时，其余为谷时；
- 官方 DeepSeek 峰谷行按每次 `assistant/message` 的事件时间取价，与原来的逻辑一致；
- `pricing.json` 的顶层 `peakValley` 可改时区偏移、星期集合与窗口；
  `"enabled": false` 表示关闭峰谷——所有调用按谷时价计；
- `windows` 支持 `"09:00-12:00"`、`[540, 720]`（分钟）、`[9, 12]`（小时）三种写法。

## 7. 多币种会话

一个会话里同时出现 CNY 与 USD 模型时，**不做汇率换算**（不编造汇率）：

- `currency` = 金额最大的那个币种的小计；
- `cost` = 该币种的小计；
- `costByCurrency` 给出全部小计，`mixedCurrencies: true`；
- 客户端显示 `cost` + 对应币种符号即可；若 `mixedCurrencies`，建议 tooltip 说明
  「另含 USD ¥x，未换算」。

## 8. Client 显示建议（给展示层）

1. 读取 `payload.value.sessionCost`；
2. 实扣优先：`readLegacyStats().costKnown === true` 时直接显示实扣，不请求/不覆盖估算
   （保持现有逻辑，不要破坏）；
3. 否则当 `priced === true && typeof cost === 'number'` 时显示：
   - 符号：`currency === 'USD' ? '$' : '¥'`（未知币种回退 `¥`）；
   - 小数：沿用现有规则（`0 < cost < 0.01` 用 4 位，否则 2 位）；
   - **估算标记**：本接口的 `estimated` 为 `true`，建议显示为 `~¥0.12` 或在金额旁加
     「估算」角标；tooltip 可写 `priceSource`/`matchedKey`（例：
     `family:qwen-max`、`override`、`未知模型兜底`）；
   - 弱化建议：`priceSource === 'none'` 时降低对比度或加「?」，避免用户误以为是实扣；
4. 估算值不要写入实扣缓存；若沿用现有 localStorage 缓存（当前只存展示文本），
   建议未来带 `estimated` 字段再渲染，避免把估算当实扣复活；
5. `priced === false` 或 `cost === null` 时显示 `—`。

## 9. 自检

离线脚本：`scripts/check-pricing.mjs`（不依赖宿主、网络或用户 profile，使用临时覆盖文件）：

```bash
node scripts/check-pricing.mjs
```

覆盖 36 个用例：官方精确目录、外接模型族（deepseek / qwen / glm / kimi / minimax /
gpt / claude）、provider 前缀兜底、未知模型兜底、空模型、峰/谷时钟与自定义窗口、
覆盖文件的精确/前缀/`*` 通配/`provider:model`/非法条目/损坏 JSON/缺失文件、
以及 `buildSessionCost` 的端到端金额、多币种、无模型信息与空会话。

`npm run check` 目前是 `node --check index.js && node --check client.js`；
把脚本接入（由发布负责人修改 `package.json`，本任务范围外）：

```json
"check": "node --check index.js && node --check client.js && node scripts/check-pricing.mjs"
```

## 10. 免责声明

- 本估算**不是账单**，以 provider 实际扣费为准；
- 内置价格是公开列表价的快照，可能过期；对金额敏感时请用 `pricing.json` 覆盖；
- `estimated: false` 永不表示「实扣」；实扣只来自 `bottom-info-bar`。