# 外接模型的「推理强度」滑条

> 主题的强度滑条不是独立控件：它增强的是**官方模型菜单里的「推理等级」行**。
> 官方行是否出现，取决于模型在 DSH 的模型目录里有没有声明推理档位。
> 外接（手写）模型默认没有声明，所以看起来像「主题没做强度条」。

## 一、为什么外接模型没有强度条

DSH 的模型目录由 `llm-pi-ai` 按 provider 配置生成。一个模型要出现「推理等级」行，目录里的条目必须带：

```json
"reasoning": { "efforts": [{ "id": "high", "name": "High" }], "defaultEffort": "high" }
```

这份数据来自模型配置里的 `reasoningEfforts`：

```yaml
models:
  - id: your-model
    reasoningEfforts:
      off:            # 关掉思考：不发参数
      low: low        # 值 = 真正发给 API 的 wire 值
      high: high
```

没有 `reasoningEfforts` 时，目录会回退到「安装目录里同名模型」的能力；如果这个 id 在目录里根本不存在，就判定为**不支持推理**，于是：

- 官方菜单不渲染「推理等级」行；
- 主题滑条找不到锚点，因此不出现；
- 即使强行画一个滑条，请求里也不会带强度参数——**是假的**。

所以强度条必须建在「模型声明」上，而不只是 UI 上。

## 二、给外接模型开启（完整模板）

以 DashScope `compatible-mode` 网关为例（`llm-pi-ai` 的 provider 配置）：

```yaml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      qwen-token-plan-cn:
        apiKeyEnv: QWEN_TOKEN_PLAN_CN_API_KEY
        baseURL: https://maas.qianwenaiapi.com/compatible-mode/v1
        compat:
          thinkingFormat: qwen          # 思考开关按 qwen 格式发：enable_thinking + reasoning_effort
          supportsDeveloperRole: false  # 关键！见第三节
          supportsStore: false          # 兼容网关通常不接受 store 参数
        models:
          - id: deepseek-v4.1-flash-1017
            name: deepseek-v4.1-flash-1017
            contextWindow: 1000000
            maxTokens: 393000
            input: [text, image]
            compat:
              supportsReasoningEffort: true   # 只给这个模型，不要写路由级
            reasoningEfforts:                 # 逐字照抄官方目录同族模型
              low: low
              high: high
              max: max
```

`compat` 是**路由级**的：写一次，之后在这条路由上新增的、目录未收录的模型都继承（模型级 `compat` 优先，安装目录里已有的模型仍用目录值）。

> **档位不要自己发明。** 优先查官方目录里同族模型的 `thinkingLevelMap`，逐字照抄。
> 例如 `deepseek-v4.1-flash` 的官方表是 `{low:"low", high:"high", max:"max"}`，`off` 为 `null`（不支持关闭思考）——所以上面**故意不写 `off`**。
> 在 `reasoningEfforts` 里写 `off:` 反而会把它标成"支持"（pi-ai 把 `null` 读成"支持、不发参数"），那就成了我们自己加的档。

### 档位是「每个模型各自」的，不是全局一套

滑条显示哪几档，完全由**当前模型**的声明决定：

- 目录里已有的模型 → 用目录自带的 `thinkingLevelMap`（每个模型都不同，官方定义）；
- 手写模型 → 用你写的 `reasoningEfforts`（且应照抄官方同族表）；
- 没声明 → 不显示（DSH 不会给你一个做不到的控制）。

所以同一条路由上，几个模型的档位可以完全不同：

| 模型 | 官方菜单项 | 依据 |
|---|---|---|
| `deepseek-v4.1-flash-1017` | Default / Low / High / Max | 目录没有该 id，手写声明，逐字照抄同族 `deepseek-v4.1-flash` |
| `glm-5.3` | Default / Low / High / Max | 官方目录自带 |
| `qwen3.8-max` | Default / Low / Medium / Xhigh | 官方目录自带 |
| `MiniMax-M2.5` | Default + 目录默认档 | 官方能力只有"开/关"，见下 |

### 「Default」也是一个位置

官方模型菜单在模型**没有 `defaultEffort`** 时会多出一项 **Default**：它表示"不指定档位"，请求里不带 `reasoningEffort`，由 provider 决定。对 `thinkingFormat: qwen` 的网关，这等价于 `enable_thinking=false`（关思考）。

所以官方菜单项数 = **显式档位数 + 1**。主题滑条必须把 Default 也画成一个位置，否则就会出现「菜单 4 项、滑条 3 点」的不一致。滑条拖到最左（Default）时会清空 `reasoningEffort`，与官方下拉选 Default 完全等价。

#### `supportsReasoningEffort: false` 的模型（MiniMax 等）

有的模型只支持「开/关思考」、不支持细档位（官方目录标 `supportsReasoningEffort: false`，例如 MiniMax、部分 Kimi / Qwen3.6–3.7）。这类模型：

- 请求只发 `enable_thinking: true/false`，**不发** `reasoning_effort`；
- 官方目录没给档位表时，DSH 会按 pi-ai 默认列出若干档 —— 这些档发出去**完全一样**，属于"看起来能调、其实只是开关"；
- 想要严格按官方能力呈现，可以显式收敛成两档（如 `off` + `high`）。**这是可选项**，取决于你要"忠实官方元数据"还是"只显示真实可分的档"。

## 三、最容易踩的坑：`developer` 角色 400

模型一旦被声明为「可推理」，pi-ai 会把系统提示改用 OpenAI 的 `developer` 角色发送。很多兼容网关（DashScope compatible-mode、vLLM、Ollama、SGLang 等）只认旧的 `system` 角色，于是每个请求都 400：

```
400: {"code":"invalid_parameter_error","param":null,
 "message":"developer is not one of ['system','assistant','user','tool','function']",
 "type":"invalid_request_error"}
```

**这不是强度配置错了，而是少了 `supportsDeveloperRole: false`。** 加上它，系统提示回到 `system`，请求即恢复；强度条与 `reasoning_effort` 不受影响。

同理，这类网关通常还要 `supportsStore: false`（不接受 `store` 参数）。

## 四、不同网关的 `thinkingFormat`

`compat.thinkingFormat` 决定强度参数怎么落到请求体：

| thinkingFormat | 实际发送 | 典型后端 |
|---|---|---|
| `qwen` | `enable_thinking` + `reasoning_effort` | DashScope / 通义兼容模式 |
| `deepseek` | `thinking: {type: enabled}` + `reasoning_effort` | DeepSeek 系 |
| `zai` | `thinking: {type: enabled}` + `reasoning_effort` | 智谱 |
| `openrouter` | `reasoning: {effort}` | OpenRouter |
| `together` | `reasoning: {enabled}` + `reasoning_effort` | Together |
| （不写） | 只发 `reasoning_effort` | 标准 OpenAI 兼容 |

拿不准时，先看 DSH 安装目录里同族模型用的值（`@earendil-works/pi-ai` 的 provider 目录），照抄最稳。

## 五、接了新模型之后怎么确认

1. 重启 DSH，打开模型菜单：应出现「推理等级」行；
2. 主题会自动把它换成橙色滑条（档位数量、名称都取自模型声明，几档都适配，动画随档位变化）；
3. 拖动/点击档位后发一条消息：`reasoning_effort` 会随请求发出，档位变化应影响思考长度；
4. 若模型菜单有行但请求 400，优先查第三节的两个 compat 开关。

## 六、主题侧是怎么适配的

滑条不写死档位，而是每次从模型目录快照里读取：

```js
const efforts = model?.reasoning?.efforts ?? []   // 任意数量、任意 id/名称
```

所以：模型声明几档，滑条就是几档；模型没声明，滑条就不出现（也不会伪造）。新增模型只要按第二节声明，主题无需改代码。
