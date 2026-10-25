# 桌面宠物：DeepSeek 小鲸鱼（像素风）设计规格

> 状态：**规格定稿 v1（只调研 + 设计，不含实现）**
> 目标宿主：`dsh-claude-code-desktop-theme` 的 Client 半边（Electron 渲染进程，DOM/CSS/SVG/Canvas）
> 落点：输入框（Composer）右上角
> 日期：2026-10-20
> 结论先行：**16×16 像素、2× 显示为 32×32；4 帧精灵（idle / idle_lo / blink / happy）+ CSS 整数位移；M 级成本（约 1.5 人日）**。

---

## 1. 摘要（TL;DR）

| 项 | 结论 |
|---|---|
| 参考对象 | Claude Code 桌面端「输入框右上角小螃蟹」→ **存在性未验证**（见 §2）。只借鉴「位置 + 低干扰 + 可互动」的交互范式，不复刻未知美术。 |
| 形象 | DeepSeek 官方蓝鲸（蓝鲸剪影），像素化为「朝左、圆身、单叶尾鳍、顶部喷水」。 |
| 网格 | **16×16** 逻辑像素，显示 **32×32 CSS px**（整数 2×），`image-rendering: pixelated`。 |
| 动画帧 | 4 帧：`idle` / `idle_lo`（呼吸）/ `blink` / `happy`。发送反应复用帧 + 位移，不新增美术。 |
| 位置 | Composer 卡片**右上角外侧**（`top:-36px; right:8px`），不覆盖正文、发送键、语音键。 |
| 动效原则 | 位移只用**整数 px 的 transform**；换帧只改 `background-position`（只 paint，不布局）；不使用 scale/rotate（会糊像素）。 |
| 性能 | DOM ≤ 5 节点、零 rAF、1 个换帧 interval + 2 个 timeout、闲置 CPU < 0.2%。 |
| 无障碍 | 装饰性精灵 `aria-hidden="true"`；唯一可操作控件是真实的「隐藏 / 显示」按钮（有 `aria-label`）。 |
| 存储 | `dsh-theme-pet-hidden`（`'1'` = 隐藏）。 |
| 成本 | **M**：约 12 小时（含真机验证），详见 §11。 |

---

## 2. 调研一：Claude Code 桌面端的「小螃蟹」

### 2.1 已核实的事实

1. **Claude Code 有桌面端，且在 2026-04-14 做过一次大改版**（侧边栏多会话、拖拽面板、集成终端、文件编辑器、预览、diff 查看器）。
   - 官方公告：[Redesigning Claude Code on desktop for parallel agents](https://claude.com/resources/articles/claude-code-desktop-redesign)
   - 二手报道：[MacRumors · Anthropic Rebuilds Claude Code Desktop App Around Parallel Sessions](https://www.macrumors.com/2026/04/15/anthropic-rebuilds-claude-code-desktop-app/)
2. **官方桌面端文档里没有「宠物 / 吉祥物 / 螃蟹」相关条目**：
   - [Desktop application](https://code.claude.com/docs/en/desktop.md)
   - [Get started with the desktop app](https://code.claude.com/docs/en/desktop-quickstart.md)
   - [What's New（周更索引）](https://code.claude.com/docs/en/whats-new/index.md)
   - 对上述三份文档全文检索 `crab` / `mascot` / `pet` / `companion` / `whale` / `pixel`：**0 命中**（2026-10-20 取样）。
3. 社区侧的「Clawd / Clawd 螃蟹」是**另一个东西**：`Clawd` 是开源个人助手 ClawdBot → Moltbot → OpenClaw 的项目名，与 Anthropic 的桌面端吉祥物无关，容易因名字相近被误记。
   - [Clawdbot 仓库](https://github.com/clawdbot/clawdbot)
   - HN 上关于 ClawdBot / OpenClaw 的讨论：[Ask HN: Any real OpenClaw (Clawd Bot/Molt Bot) users?](https://news.ycombinator.com/item?id=46838946)

### 2.2 未验证项（明确标注）

以下用户描述中的细节，**本次调研未能找到任何官方或可信第三方来源**，全部标记为「未验证」：

| 细节 | 状态 |
|---|---|
| Claude Code 桌面端输入框右上角确实有一只「小螃蟹」 | **未验证** |
| 它的官方出处 / 设计文档 / 发布说明 | **未验证**（官方公告与文档均未提及） |
| 外观（颜色、钳子、眼睛）、像素尺寸 | **未验证** |
| 出现位置（composer 内/外、左上/右上） | **未验证** |
| 点击 / 悬停 / 空闲反应 | **未验证** |
| 是否能关闭 | **未验证** |

已尝试的检索路径（供复核）：Anthropic 官方 blog / newsroom、Claude Code 官方文档全文、Bing 网页与图片检索（含 `cn.bing.com`）、HN Algolia 全站（`claude code crab`、`claude crab mascot`、`clawd`）、DuckDuckGo / Google / Reddit（本机网络对上述域名解析被污染，无法访问）。由于本次环境**没有可用的浏览器 CDP 调试端口**（`check-deps` 报告「没有任何浏览器打开远程调试开关」），也无法做登录态页面截图核实。

### 2.3 对实现的含义

既然参考对象的美术和交互**不可核实**，本规格**不宣称复刻**它，只借鉴三点已被用户明确表达的交互范式：

1. **位置**：贴着输入框右上角，作为「输入区的小邻居」，而不是全屏悬浮物；
2. **低干扰**：小尺寸、静态为主、不抢焦点、不挡任何按钮；
3. **可互动**：hover、点击、发送时有反馈，且能一键关掉。

若后续拿到真实截图，只需要替换 §4 的帧矩阵与 §5 的时长参数，DOM/CSS/状态机结构**不需要改**。

---

## 3. 调研二：DeepSeek 鲸鱼形象与配色

### 3.1 形象来源

- DeepSeek 官方标识是一只**蓝色鲸鱼剪影**：<https://www.deepseek.com/>（页头 wordmark 与 favicon 均为该鲸鱼标识）。
- 官方聊天端：<https://chat.deepseek.com/>。

### 3.2 官方页面取样的颜色（一手证据）

从官方站点资源里直接取到的色值（2026-10-20 取样）：

| 来源 | 色值 |
|---|---|
| `www.deepseek.com` 主 CSS `/_next/static/css/b39dbc256e52a1dc.css` | `#4D6BFE`、`#3964FE`、`#5686FE`、`#6799FE`、`#3A65C2`、`#152443`、`#1E232C`、`#3451B2`、`#1F3B8F`、`#F7AD31`、`#FEF5E7` |
| `www.deepseek.com` 首页内联样式 | `#9CC1E7` |
| `chat.deepseek.com` 首页内联样式 | `#3964FE`、`#5686FE` |

> 说明：以上是从公开页面资源中提取到的**实际使用值**，不是官方品牌规范文档；`#4D6BFE` 是站点与社区最常出现的 DeepSeek 蓝，本规格以它为身体主色。

### 3.3 与主题协调的调色板

主题既有色：暖米色 `#f5f3ee` / 墨色 `#1d1b16` / 陶土橙 `#da7756`、`#a94c2b`。
小鲸鱼取「DeepSeek 蓝为主、主题墨色勾边、陶土橙只做 1px 腮红」的策略，避免整只宠物变成高饱和蓝块。

**浅色（默认）**

| 字符 | hex | 用途 | 来源 |
|---|---|---|---|
| `K` | `#152443` | 轮廓、深影 | DeepSeek 深海军蓝（官方 CSS） |
| `B` | `#4D6BFE` | 身体主色 | DeepSeek 品牌蓝（官方 CSS） |
| `D` | `#3A65C2` | 尾鳍 / 暗部 | 官方蓝阶 |
| `L` | `#7C93FF` | 背部高光 | `#6799FE` 提亮 |
| `W` | `#EAF3FF` | 腹部 | 官方浅蓝阶 |
| `E` | `#1D1B16` | 眼睛 | 主题墨色 |
| `S` | `#FFFFFF` | 眼神光 | — |
| `C` | `#9CC1E7` | 喷水 | 官方首页取样 |
| `P` | `#DA7756` | 腮红（仅 happy 帧 1px） | 主题陶土橙 |
| `A` | `#F7AD31` | 可选：稀有闪光（本期不用） | 官方暖黄 |

**深色（`body[data-ds-dark-theme]`）**

| 字符 | hex | 说明 |
|---|---|---|
| `K` | `#0C1326` | 轮廓更深，避免在 `#24221f` 上发灰 |
| `B` | `#5C79FF` | 主色略提亮 |
| `D` | `#3F5BC9` | 暗部 |
| `L` | `#8AA0FF` | 高光 |
| `W` | `#C9D8F2` | 腹部（别用纯白，夜里刺眼） |
| `E` | `#141210` | 眼睛 |
| `S` | `#FFFFFF` | 眼神光 |
| `C` | `#7FB2DE` | 喷水 |
| `P` | `#E08A6A` | 腮红（深色下提亮） |

对比度备注：`B #4D6BFE` 在 `#f5f3ee` 上约 **3.9:1**，作为装饰图形足够；`K` 轮廓在两种背景下均 > 8:1，保证小尺寸下轮廓清晰。

### 3.4 像素化时的取舍

- 16×16 下**做不出明显的分叉尾鳍**（分叉会与 1px 轮廓粘连成黑块），因此采用「单叶尾鳍 + 中间一道深色凹口」的侧视简化；远看仍读作鲸尾。
- 喷水做成 4 个水滴的「小喷泉」，而不是长水柱——长水柱在 32px 内会像天线。
- 眼睛用 `S+E` 三点（1 白 2 黑），比单像素更有神，又不至于糊成黑洞。
- 腹部保留 2~3 行浅色，让轮廓内的体积感成立。

---

## 4. 像素规格

### 4.1 网格与显示尺寸

| 项 | 值 |
|---|---|
| 逻辑网格 | **16 × 16**（字符矩阵，1 字符 = 1 像素） |
| 显示尺寸 | **32 × 32 CSS px**（2×，整数缩放） |
| 命中区 | 40 × 40 px（精灵外扩 4px 的透明热区） |
| 渲染方式 | `background-image` + `image-rendering: pixelated` |
| 精灵表 | 4 帧横向拼合：逻辑 **64×16**，CSS 尺寸 **128×32** |
| 帧定位 | `background-position-x`：`0` / `-32px` / `-64px` / `-96px` |

为什么不用 24×24：24 逻辑像素在 32px 显示时是 1.33×，最近邻缩放会出现 1px/2px 混排的锯齿；24×24 只有做成 48px 显示才是整数倍，但 48px 在 945px 宽的 composer 里过于抢眼。**16×16 @2× 是清晰度与尺寸的最优解**。

### 4.2 字符表

`.` 透明，其余字符见 §3.3。矩阵中每一行必须**恰好 16 个字符**。

### 4.3 帧矩阵

#### 帧 0 · `idle`（静止，默认帧）

```text
................
................
................
.....C......KKK.
....C.C....KKDK.
.....C....KKDDK.
...KKKKKKKKDDDK.
.KKKLLLLKKDDDDK.
KKLLLLLLLLDDDDK.
KBBSBBBBBBBKKKK.
KBBEEBBBBBBKKDK.
BBBBBWWWWBBDDDK.
BBBBWWWWWWDDDDK.
KBBWWWWWKKKKDDK.
KKBBWKKKK..KKDK.
.KKKKK......KKK.
```

#### 帧 1 · `idle_lo`（呼吸帧：整只上移 1px）

```text
................
................
.....C......KKK.
....C.C....KKDK.
.....C....KKDDK.
...KKKKKKKKDDDK.
.KKKLLLLKKDDDDK.
KKLLLLLLLLDDDDK.
KBBSBBBBBBBKKKK.
KBBEEBBBBBBKKDK.
BBBBBWWWWBBDDDK.
BBBBWWWWWWDDDDK.
KBBWWWWWKKKKDDK.
KKBBWKKKK..KKDK.
.KKKKK......KKK.
................
```

#### 帧 2 · `blink`（眨眼：眼睛压成一条线）

```text
................
................
................
.....C......KKK.
....C.C....KKDK.
.....C....KKDDK.
...KKKKKKKKDDDK.
.KKKLLLLKKDDDDK.
KKLLLLLLLLDDDDK.
KBBBBBBBBBBKKKK.
KBBEEBBBBBBKKDK.
BBBBBWWWWBBDDDK.
BBBBWWWWWWDDDDK.
KBBWWWWWKKKKDDK.
KKBBWKKKK..KKDK.
.KKKKK......KKK.
```

#### 帧 3 · `happy`（点击/发送反应：亮眼 + 腮红 + 喷水炸开）

```text
................
................
....C.C.........
...C.C.C....KKK.
....C.C....KKDK.
.....C....KKDDK.
...KKKKKKKKDDDK.
.KKKLLLLKKDDDDK.
KKLLLLLLLLDDDDK.
KBBSSBBBBBBKKKK.
KBBEEBBBBBBKKDK.
BPBBBWWWWBBDDDK.
BBBBWWWWWWDDDDK.
KBBWWWWWKKKKDDK.
KKBBWKKKK..KKDK.
.KKKKK......KKK.
```

### 4.4 帧元数据

| 帧索引 | 名称 | 用途 | 默认停留 | 备注 |
|---|---|---|---|---|
| 0 | `idle` | 默认/静息 | 1600ms | 呼吸循环的另一半 |
| 1 | `idle_lo` | 呼吸 | 1600ms | 与 idle 交替，3.2s 一周期 |
| 2 | `blink` | 眨眼 | 120ms | 随机间隔 3.5–7.5s |
| 3 | `happy` | 点击 / 发送 | 480ms | 带腮红与喷水，冷却 600ms |

### 4.5 生成配方（给实现者，不是本阶段代码）

不要手写 SVG / 不逐像素建 DOM。推荐实现：

1. 把上述矩阵存成 `string[16]`（每帧 16 行）。
2. 建一张离屏 `canvas`，逻辑尺寸 `64×16`：
   - 遍历 4 帧 × 16 行 × 16 列，`ctx.fillRect(frame*16 + x, y, 1, 1)` 填色（透明字符跳过）。
   - 依据当前主题（浅/深）选择调色板；两张表各生成一次，缓存为字符串。
3. `canvas.toDataURL('image/png')` → 写入 CSS 变量 `--dsh-pet-sheet`。
   - 主题里已有 `@font-face` 用 data URL 的先例（见 [DESIGN.zh.md](./DESIGN.zh.md)），说明当前 CSP 允许 `data:`。
   - 兜底：若 `toDataURL` 抛错，退化为「单元素 box-shadow 像素画」（每个非透明像素一条 box-shadow，仍只有 1 个 DOM 节点）。
4. CSS 里 `background-size: 128px 32px`（即 4 帧 × 32px），`background-position` 由 `data-frame` 映射。

> 已验证：本规格的 4 张矩阵已用 Pillow 按上述规则渲染，并在 16×（美术检视）与 32px（真实尺寸）两种尺寸、暖米/深色两种背景上核对过可读性；本章矩阵与渲染结果一致。

---

## 5. 状态机

### 5.1 状态图

```text
                 ┌──────────── reduced-motion ────────────┐
                 │                                        │
 [hidden] ──显示──> [idle] ──hover──> [hover] ──leave──> [idle]
                 │      │                                  │
                 │      ├── 3.5~7.5s ──> [blink] ──120ms──>│
                 │      │                                  │
                 │      ├── pointerup(本体) ──> [happy] ──>│
                 │      │                                  │
                 │      └── 发送信号 ──> [dash] ──600ms──>│
                 │                                        │
                 └── document.hidden / 离开视口 ──> [paused] ──> 恢复 [idle]
```

### 5.2 状态 / 触发 / 时长

| 状态 | 进入条件 | 表现 | 退出 / 超时 | 中断规则 |
|---|---|---|---|---|
| `idle` | 挂载完成 / 反应结束 | 帧 0↔1 每 1600ms 交替（呼吸）；随机眨眼 | 被其他状态抢占 | — |
| `blink` | idle 下 3.5–7.5s 随机 | 帧 2，120ms | 120ms 后回 idle | 期间收到 click/send 立即切 happy/dash |
| `hover` | `pointerenter` 本体 | 光晕 `opacity 0→1`（120ms）；整只**整数**上移 2px | `pointerleave` 回落 | 不打断眨眼；不改变呼吸帧 |
| `happy` | 本体 `pointerup`（按下与抬起 < 250ms、位移 < 6px） | 帧 3，480ms；上抛 0→+2→−2→0（每段 120ms，整数） | 480ms 后回 idle | 600ms 冷却，冷却内点击忽略 |
| `dash` | 发送消息信号（§6.6） | 帧 3 + 下沉 0→+3px→0（共 600ms）；气泡「噗通」可选 | 600ms 后回 idle | 与 happy 共用冷却 |
| `hidden` | 用户点「隐藏」 | `display:none`；写存储 | 用户点托盘「鲸」按钮 | 隐藏时清理定时器 |
| `paused` | `document.hidden === true` 或 IntersectionObserver 判定不可见 | `animation-play-state: paused`；清空换帧定时器 | 恢复可见 | 恢复时重置为 idle，不补播漏掉的眨眼 |
| `reduced` | `prefers-reduced-motion: reduce` | 静止帧 0；无呼吸/无眨眼/无位移；hover 只改光晕透明度；click 仅 480ms 帧 3 | — | 发送不开启动画，只换帧 |

### 5.3 各反应细则

**呼吸**：帧 0 ↔ 帧 1（整只上移 1px）每 1600ms 切换。用 JS interval 驱动 `data-frame`，**不要**用 CSS 对 `transform` 做子像素补间（会产生半像素模糊）。CPU 代价：每次仅 1 次属性写 + 32×32 重绘。

**眨眼**：`setTimeout(3500 + Math.random()*4000)`；切到帧 2 后 120ms 回到当前呼吸帧；`document.hidden` 时清空并在恢复时重排。眨眼不与发送反应叠加（发送优先）。

**hover**：`pointerenter/leave` 只切 `data-state` 与一个 class；视觉为光晕（`::before` 的 `opacity`，走合成器）+ 整只上移 2px（`transform: translateY(-2px)`，配 `steps(2, jump-none)` 过渡，避免中间帧落在 0.5px）。**不做缩放**。

**点击**：`pointerdown` 上 `preventDefault()`（防止焦点从输入框被抢走）；`pointerup` 时判定「<250ms 且位移 <6px」才算点击。反应 = 帧 3 + 上抛位移，480ms 后复原；600ms 冷却。

**发送**：见 §6.6 的信号契约。视觉 = 帧 3 + 下沉；若气泡开启，显示 1.2s「噗通」。

**空闲超时（P2，可选）**：>5 分钟无任何交互，呼吸周期放慢到 4.8s、喷水帧保持不动（不新增美术），不进入睡眠静态——避免看起来「死了」。

### 5.4 是否做拖拽：v1 不做，v2 做「拎起」而不是自由拖拽

**不建议 v1 做自由拖拽**，原因：

1. composer 的位置由主题自己算（固定定位、宽度按视口推导、内容变高时向上生长），自由拖拽需要每次布局重算并持久化坐标，复杂度不成比例；
2. 拖拽的 pointer 序列会与输入框的文本选择、侧边栏滚动冲突；
3. 用户对「宠物挡东西」的容忍度极低，自由拖拽会放大这个风险。

**建议 v2 做「拎起放下」微交互**（不影响布局、不持久化）：`pointerdown` 后移动 >6px 进入「被拎起」：整只 `translateY(-6px)` + 悬空帧（复用 happy），松开回原位并播放 320ms 下落。它满足「能摸一下」的期待，但位置永远固定在右上角。

### 5.5 暂停与降级

| 场景 | 做法 |
|---|---|
| 窗口隐藏（最小化/切 tab） | `visibilitychange` → 清 interval/timeout，`data-state="paused"` |
| 宠物不在视口（滚动到别处/切路由） | `IntersectionObserver`（threshold 0）→ 同上 |
| React 重渲染把节点移除 | 复用主题现有的 `MutationObserver` 重新挂载（与 `.dsh-composer-tray` 相同的自愈模式） |
| CPU 紧张 | 反应动画统一 ≤ 600ms，且同时最多 1 个进行中 |
| 存储不可用 | 全 `try/catch`，隐藏功能降级为「本次会话内隐藏」 |

---

## 6. 交互边界

### 6.1 位置与安全区（关键数字）

**默认采用「卡片右上角外侧」**（Mode B），因为它不覆盖任何正文与按钮：

```
        ┌─ 宠物 32×32（top: -36px; right: 8px，相对 .RlGAzG_card）─┐
        │                                                          │
   ┌────┴──────────────────────────────────────────────────────────┴────┐
   │  .RlGAzG_card（composer 卡片）                                       │
   │  正文区（contenteditable/textarea）……                                │
   │                                              [附件][语音][发送] ← 底部 44px 禁入区
   └────────────────────────────────────────────────────────────────────┘
```

| 规则 | 数值 |
|---|---|
| 精灵尺寸 | 32 × 32 |
| 到卡片右缘距离 | 8px |
| 精灵底边到卡片顶边 | 4px（即 `top: -36px`） |
| **禁止进入区** | 卡片底部 **44px** × 右侧 **96px**（发送键 / 语音键 / 附件键所在区域） |
| 命中区 | 40×40（精灵四周各外扩 4px），仅此处 `pointer-events: auto` |
| 与小屏 | 窗口宽度 < 720px 时隐藏宠物（空间不足，避免压住菜单行） |

**可选 Mode A（卡片内右上角）**：只有当实测「首行文字不会延伸到右上角 40×40」时才用：`top:8px; right:10px`。启用前必须做 §12 的第 4 条验收。

### 6.2 不抢焦点

- 宠物本体 **不加 `tabindex`**，不进入 Tab 顺序；`pointerdown` 一律 `preventDefault()`，保证输入框焦点和光标不丢。
- 不用 `mousedown` 里的 `focus()`；不调用 `stopPropagation`（宿主需要正常收到事件）。
- 唯一可聚焦元素是「隐藏/显示」按钮（真实 `<button>`），且它不出现在默认 Tab 顺序的视觉主体上（`tabindex` 保持默认，但只在 hover/聚焦时可见，见 §10.3）。

### 6.3 `pointer-events` 只作用于本体

```css
.dsh-pet            { pointer-events: none; }   /* 外壳不接收任何事件 */
.dsh-pet__sprite    { pointer-events: auto; }   /* 只有精灵本体接收 */
.dsh-pet__hide      { pointer-events: auto; }   /* 隐藏按钮 */
.dsh-pet__bubble    { pointer-events: none; }   /* 气泡永不拦截 */
```

外壳 40×40 的透明热区用 `::before` 扩大**点击**面积（`pointer-events: auto` 只挂在 `::before` 上会拦截下层；因此热区实际由精灵的 padding 实现，避免遮住卡片边缘的拖拽/选择）。

### 6.4 一键隐藏 / 恢复

- **隐藏**：hover 精灵时右上角淡入（120ms）一个 12×12 的 `×` 小按钮（真实 `<button aria-label="隐藏小鲸鱼">`），点击即隐藏并写 `localStorage['dsh-theme-pet-hidden']='1'`。
- **恢复**：隐藏后，在既有 `.dsh-composer-tray` 右侧追加一个 12px 的「鲸」小按钮（`aria-label="显示小鲸鱼"`，mono 字体、`#87867F`、hover 变 `#1d1b16`）；只在隐藏态渲染。
- 两个按钮都**不消耗全局快捷键**（避免和宿主/输入法冲突）。
- 可选增强（P2）：在设置面板（若将来有）加「桌面宠物」开关；当前没有稳定设置入口，不做。

### 6.5 z-index 与宿主控件冲突

- 宠物在 composer 卡片内部/紧贴卡片，`z-index: 3`，位于卡片的堆叠上下文内；**永远不要**用 `position:fixed` + 超高 `z-index` 盖住下拉菜单、diff 抽屉、对话框（宿主菜单是 portal，层级更高）。
- 与 `.dsh-composer-tray` 的 z-index（2）保持 > 1 即可。
- 若宿主未来在卡片右上角新增按钮：挂载时做一次碰撞检测（见 §6.7），命中即让位。

### 6.6 发送信号检测契约（不改宿主代码）

优先顺序：

1. **主信号**：在 `.RlGAzG_root` 内的可编辑元素上监听 `keydown`：`Enter` 且 `!shiftKey && !altKey && !ctrlKey && !metaKey && !isComposing` → 判定为「发送」。这是乐观信号（宿主可能拦截去发给别的东西），但只用于动画，无副作用。
2. **辅信号**：在 `.RlGAzG_card` 内找发送按钮 —— `button` 中 `aria-label` 命中 `/发送|send/i` 的那个；找不到就退化为「卡片内最后一个可见 `button`」。监听其 `pointerup`。
3. **去重**：两个信号 400ms 内只触发一次 `dash`。
4. **失败即静默**：任何选择器找不到都只是「不播发送动画」，不报错、不重试风暴。

### 6.7 碰撞守卫（防挡键）

挂载后、以及每次布局变化（resize / composer 高度变化）后各做一次：

1. 取宠物中心的 `document.elementFromPoint(cx, cy)`；
2. 若返回元素是 `BUTTON`、`[role="button"]`、`[contenteditable]` 或 `textarea`，且不在宠物自身子树内 → `data-collision="1"`；
3. 先尝试上移 8px 再测；仍碰撞则**自动隐藏**并显示恢复按钮（宁可少一个玩具，不能挡操作）。

---

## 7. 稳定性与性能

### 7.1 硬性约束

1. 只改 `transform`（整数 px）与 `opacity`；换帧只改 `background-position`（只 paint，不触发布局/合成层重建）。
2. **禁止** `scale` / `rotate` / 小数 `translate`（像素画会糊）；禁止对 `width/height/top/left/margin` 做动画。
3. 不做 rAF 常驻循环；换帧用 1 个 `setInterval`（1600ms）+ 眨眼 `setTimeout`；页面隐藏/不可见时全部清空。
4. 所有宿主查询与 DOM 操作包 `try/catch`；任何异常只记录一次 `console.debug`，不抛出到宿主。
5. 不新增全局键盘监听；不覆盖宿主事件；不读写除 `localStorage` 外的任何存储。
6. 卸载（`dispose`）时：移除节点、清定时器、断开 observer、移除 visibility 监听、删除注入的 CSS 变量。

### 7.2 性能预算

| 指标 | 预算 | 说明 |
|---|---|---|
| DOM 节点 | **≤ 5** | 外壳 + 精灵 + 隐藏按钮 + 气泡 +（隐藏态）恢复按钮 |
| 伪元素 | 1（光晕） | 不额外加节点 |
| CSS 体积 | ≤ 2 KB（minified） | 并入主题现有 `SHELL_CSS`，不新增 `<style>` |
| JS 体积 | ≤ 3 KB | 含矩阵与 canvas 生成 |
| 精灵数据 | ≤ 8 KB / 调色板 | 64×16 PNG data URL，实测同级素材 ~1–2 KB |
| 定时器 | ≤ 3 | 1 interval + 1 blink timeout + 1 reaction timeout |
| 每帧工作量 | 1 次属性写 + 32×32 重绘 | 无布局、无样式重算级联（`contain: layout paint` 可选） |
| 帧率 | 动画期间 ≥ 60fps | 位移走合成器，换帧 0.6~1.25Hz |
| 闲置 CPU | < 0.2% | 只有 1600ms 的换帧 + 偶发眨眼 |
| 启动耗时 | < 1ms | canvas 生成一次，≤ 1024 次 `fillRect` |

### 7.3 故障隔离与自愈

- 采用与主题现有 `.dsh-composer-tray` 相同的模式：`MutationObserver`（合并到已有 observer，不新增）在 composer 重渲染后重新挂载。
- 挂载幂等：`document.querySelector('.dsh-pet')` 已存在则只更新状态，不重复插入。
- 主题实例纪元（`__DSH_CLAUDE_THEME_EPOCH__`）变化时，随既有 `disposeAll()` 一并清理。

---

## 8. 无障碍

| 项 | 规格 |
|---|---|
| 精灵语义 | `aria-hidden="true"`（纯装饰）；外壳 `role="presentation"`，不加 `tabindex` |
| 唯一可操作控件 | 「隐藏/显示」是真实 `<button type="button">`，带 `aria-label` 与 `title`，可用键盘 Tab + Enter 触发 |
| 键盘可达性 | 宠物本体无需键盘操作；隐藏按钮在获得焦点时保持可见（`focus-visible` 时 `opacity:1`） |
| 减动效 | `prefers-reduced-motion: reduce`：无呼吸、无眨眼、无位移；hover 只改光晕；点击/发送仅换帧 480ms |
| 闪烁 | 无闪烁动画；换帧频率 ≤ 1.25Hz（远低于 3Hz 阈值） |
| 颜色 | 不承载信息；轮廓对比度 > 8:1；蓝色身体在暖米背景 ~3.9:1（装饰图形，达标） |
| 屏幕阅读器 | 宠物不被朗读；隐藏状态会通过恢复按钮的 `aria-label` 暴露，可用键盘恢复 |
| 触控 | 命中区 ≥ 40×40（WCAG 2.5.8 目标 24×24，超出） |

---

## 9. 存储与开关

沿用主题既有前缀 `dsh-theme-`（现有：`dsh-theme-last-balance`、`dsh-theme-last-session-cost`）。

| key | 值 | 语义 |
|---|---|---|
| `dsh-theme-pet-hidden` | `'1'` / 删除 | 隐藏开关（默认显示时删除该 key） |
| `dsh-theme-pet-since` | ISO 时间串 | 首次出现时间（P2 打招呼用，可延后） |

规则：

- 启动时读一次（`try/catch`，`localStorage` 不可用则视为显示）；
- 只写变化，不写心跳（不制造磁盘噪音）；
- 不记录点击次数等行为数据（无遥测、无网络请求）。

---

## 10. DOM / CSS 结构草案

> 本节只是**规格**，不写进 `client.js`；后续实现时按此落地。

### 10.1 节点树（5 节点）

```html
<!-- 挂在 .RlGAzG_card 内（Mode A）或作为 .RlGAzG_card 的兄弟并绝对定位（Mode B） -->
<div class="dsh-pet" data-state="idle" data-frame="idle">
  <span class="dsh-pet__sprite" aria-hidden="true"></span>
  <button class="dsh-pet__hide" type="button" aria-label="隐藏小鲸鱼" title="隐藏小鲸鱼">×</button>
  <span class="dsh-pet__bubble" aria-hidden="true"></span>
</div>

<!-- 仅在隐藏态追加到既有 .dsh-composer-tray 的右组 -->
<button class="dsh-pet-restore" type="button" aria-label="显示小鲸鱼" title="显示小鲸鱼">鲸</button>
```

### 10.2 注入锚点与两种模式

| 模式 | 锚点 | 定位 | 优点 | 风险 |
|---|---|---|---|---|
| **B（推荐）** | `.RlGAzG_card` | `position:absolute; top:-36px; right:8px`（相对卡片定位，需卡片 `position:relative`） | 不挡正文与按钮 | 若菜单行在右上角有控件会打架（当前右侧为空） |
| A（备选） | `.RlGAzG_card` 内 | `top:8px; right:10px` | 更像「住在输入框里」 | 长文本可能钻到宠物下面 |

**挂载前必须做一次 `overflow` 检查**：若 `getComputedStyle(card).overflow` 不是 `visible`（圆角卡片常见 `overflow:hidden`），Mode B 的宠物会被裁掉。此时按顺序退化：

1. 挂到 `.RlGAzG_root`（composer 根）上，用 `position:absolute` + `card.offsetTop - 36px` 计算位置；
2. 若根节点同样裁剪，挂到 `document.body`，`position:fixed`，在 `ResizeObserver(card)` + `window.resize` 时用 `card.getBoundingClientRect()` 重算位置（**不要**开 rAF 循环；composer 在页面里是固定位置，不随滚动移动）。

实现建议：优先 B；若 `@media (max-width: 720px)`、`overflow` 裁剪且两级退化都失败、或碰撞守卫失败，则隐藏。

宿主选择器沿用主题里已经在用的：`.RlGAzG_root`（composer 根）、`.RlGAzG_card`（卡片）、`.dsh-composer-tray`（HUD 托盘）。这些是主题**既有依赖**，不是本规格新增的耦合。

### 10.3 CSS 草案

```css
/* 外壳：不接收事件、建立层叠上下文 */
.dsh-pet {
  position: absolute;
  top: -36px;
  right: 8px;
  width: 32px;
  height: 32px;
  z-index: 3;
  pointer-events: none;
  contain: layout paint;
  isolation: isolate;
}
.dsh-pet[hidden] { display: none; }

/* 光晕：唯一用 opacity 过渡的装饰 */
.dsh-pet::before {
  content: "";
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(77, 107, 254, .22), rgba(77, 107, 254, 0) 70%);
  opacity: 0;
  transition: opacity 120ms linear;
  pointer-events: none;
}
.dsh-pet[data-state="hover"]::before,
.dsh-pet:focus-within::before { opacity: 1; }

/* 精灵：只有它接收指针；帧由 data-frame 决定 */
.dsh-pet__sprite {
  position: absolute;
  inset: 0;
  pointer-events: auto;
  cursor: pointer;
  background-image: var(--dsh-pet-sheet);
  background-repeat: no-repeat;
  background-size: 128px 32px;      /* 4 帧 × 32px */
  background-position: 0 0;
  image-rendering: pixelated;
  transform: translateZ(0);
  transition: transform 120ms steps(2, jump-none);
  user-select: none;
  -webkit-user-drag: none;
}
.dsh-pet[data-frame="idle_lo"] .dsh-pet__sprite { background-position: -32px 0; }
.dsh-pet[data-frame="blink"]   .dsh-pet__sprite { background-position: -64px 0; }
.dsh-pet[data-frame="happy"]   .dsh-pet__sprite { background-position: -96px 0; }

/* hover：整数上移 2px，不缩放 */
.dsh-pet[data-state="hover"] .dsh-pet__sprite { transform: translate3d(0, -2px, 0); }

/* 点击/发送位移：全部整数 px */
.dsh-pet[data-state="happy"] .dsh-pet__sprite { animation: dsh-pet-bounce 480ms steps(1, end) 1; }
@keyframes dsh-pet-bounce {
  0%   { transform: translate3d(0, 0, 0); }
  25%  { transform: translate3d(0, 2px, 0); }
  60%  { transform: translate3d(0, -2px, 0); }
  100% { transform: translate3d(0, 0, 0); }
}
.dsh-pet[data-state="dash"] .dsh-pet__sprite { animation: dsh-pet-dive 600ms steps(3, end) 1; }
@keyframes dsh-pet-dive {
  0%   { transform: translate3d(0, 0, 0); }
  35%  { transform: translate3d(0, 3px, 0); }
  100% { transform: translate3d(0, 0, 0); }
}

/* 隐藏按钮：hover / 键盘聚焦时才出现 */
.dsh-pet__hide {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 14px;
  height: 14px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #ece7dd;
  color: #7f7869;
  font: 10px/14px "SF Mono", Consolas, monospace;
  text-align: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 120ms linear;
  pointer-events: none;
}
.dsh-pet:hover .dsh-pet__hide,
.dsh-pet:focus-within .dsh-pet__hide,
.dsh-pet__hide:focus-visible { opacity: 1; pointer-events: auto; }
.dsh-pet__hide:hover { background: #e3ddd1; color: #1d1b16; }
.dsh-pet__hide:focus-visible { outline: 2px solid #da7756; outline-offset: 1px; }

/* 气泡（可选）：绝不拦截指针 */
.dsh-pet__bubble {
  position: absolute;
  right: 0;
  bottom: 36px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #ece7dd;
  color: #1d1b16;
  font: 11px/16px "SF Mono", Consolas, monospace;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 120ms linear;
  pointer-events: none;
}
.dsh-pet[data-bubble="1"] .dsh-pet__bubble { opacity: 1; }

/* 恢复按钮（隐藏态） */
.dsh-pet-restore {
  border: 0;
  padding: 0 2px;
  background: transparent;
  color: #87867f;
  font: 12px/16px "SF Mono", Consolas, monospace;
  cursor: pointer;
}
.dsh-pet-restore:hover { color: #1d1b16; }
.dsh-pet-restore:focus-visible { outline: 2px solid #da7756; outline-offset: 1px; }

/* 深色主题 */
body[data-ds-dark-theme] .dsh-pet::before {
  background: radial-gradient(circle, rgba(92, 121, 255, .28), rgba(92, 121, 255, 0) 70%);
}
body[data-ds-dark-theme] .dsh-pet__hide { background: #322f2b; color: #b9b0a2; }
body[data-ds-dark-theme] .dsh-pet__bubble { background: #322f2b; color: #f0ede4; }

/* 页面隐藏 / 不可见：暂停所有动画 */
.dsh-pet[data-state="paused"] .dsh-pet__sprite { animation-play-state: paused; }

/* 减动效：去掉一切位移与呼吸/眨眼，只保留换帧反馈 */
@media (prefers-reduced-motion: reduce) {
  .dsh-pet__sprite { transition: none; animation: none !important; }
  .dsh-pet::before { transition: none; }
  .dsh-pet__hide, .dsh-pet__bubble { transition: none; }
  .dsh-pet[data-state="hover"] .dsh-pet__sprite { transform: none; }
}

/* 小窗不显示，避免压住菜单行 */
@media (max-width: 720px) { .dsh-pet { display: none !important; } }
```

### 10.4 JS 行为契约（伪代码，仅供实现参考）

```text
mountPet(ctx):
  if (media(max-width:720px).matches) return
  if (localStorage['dsh-theme-pet-hidden'] === '1') { mountRestoreButton(); return }
  if (document.querySelector('.dsh-pet')) { refresh(); return }
  card = document.querySelector('.RlGAzG_card'); if (!card) return
  ensure card position:relative（CSS 里做，不内联）
  build sprite data URL（canvas 64×16，按当前主题调色板）
  create shell + sprite + hide + bubble
  card.appendChild(shell)
  bind: pointerenter/leave/down/up（仅 sprite）
  startBreathing(); scheduleBlink()
  document.addEventListener('visibilitychange', onVisibility)
  mountRestoreButton() 只在隐藏时

scheduleBlink():
  timeout = setTimeout(() => { setFrame('blink'); setTimeout(() => setFrame(breathFrame()), 120); scheduleBlink() }, 3500 + rand*4000)

react(kind):        // 'happy' | 'dash'
  if (cooldown) return
  cooldown = true; setState(kind); setFrame('happy')
  reactionTimeout = setTimeout(() => { setState('idle'); setFrame(breathFrame()); }, kind === 'dash' ? 600 : 480)
  setTimeout(() => cooldown = false, 600)

dispose():
  clearInterval / clearTimeout ×3
  remove visibilitychange
  remove nodes; remove CSS var; clear restore button
```

关键点：

- **不要**在 `pointerdown` 里做任何布局读取（避免强制同步布局）；
- 帧切换只写 `dataset.frame`，不写 `style.backgroundPosition`（让 CSS 统一管，便于减动效覆盖）；
- 发送信号监听用 `{ passive: true }`，且不 `preventDefault`。

---

## 11. 实现成本与风险

### 11.1 成本：**M**（约 12 小时 / 1.5 人日）

| 工作项 | 估时 | 说明 |
|---|---|---|
| 美术接入 | 0.5h | 矩阵已经在本规格定稿，只需转成 `string[16]` |
| sprite 生成 + CSS 骨架 | 2h | canvas → data URL、4 帧定位、深浅两套调色板 |
| 状态机 / 定时器 / 暂停 | 2h | 呼吸、眨眼、hover、click、visibility |
| 发送检测 + 宿主适配 | 2h | 两条信号 + 去重 + 选择器兜底 |
| 隐藏 / 恢复 / 持久化 | 1h | 含托盘按钮 |
| 深色 / 减动效 / 无障碍打磨 | 1.5h | 两套调色板与 `prefers-reduced-motion` |
| 真机验证 | 3h | 见 §12；含 composer 长高、语音录制中、窗口隐藏、缩放 |
| 合计 | **≈12h** | M |

只做「静态 idle + hover」的 S 版约 4–6h；做「拎起拖拽 + 打招呼 + 空闲动画」的 L 版约 2.5–3 人日。

### 11.2 风险

| # | 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|---|
| 1 | 宿主 composer 结构/散列类名再次改版（`.RlGAzG_card` 失效） | 中 | 宠物不出现 | 选择器兜底（`textarea`/`contenteditable` 向上找容器）+ 失败静默；随主题版本一起跟进 |
| 2 | 宿主在卡片右上角新增控件（与宠物重叠） | 中 | 挡按钮 | §6.7 碰撞守卫，命中即上移/自动隐藏 |
| 3 | 输入框长高/附件预览时位置漂移 | 中 | 宠物悬空/压菜单 | 相对卡片定位（自动跟随）+ 监听 resize 重新校验 |
| 4 | 长文本第一行钻到宠物下方（Mode A） | 高（仅 A） | 可读性 | 默认 Mode B（卡片外）；A 需先过验收第 4 条 |
| 5 | 像素画糊掉（小数 transform / 非整数缩放） | 中 | 廉价感 | 只用整数 px，`image-rendering: pixelated`，`steps()` 过渡 |
| 6 | CSP 拦截 `data:` / `toDataURL` | 低 | 精灵不显示 | 主题已有 data URI 字体先例；兜底 box-shadow 像素画 |
| 7 | 深色模式配色突兀 | 中 | 视觉不协调 | 两套调色板；深色腹部不用纯白 |
| 8 | 定时器泄漏 / 页面隐藏后仍跑 | 中 | 耗电 | visibility + IntersectionObserver 双重暂停；dispose 清理 |
| 9 | 抢焦点导致草稿光标丢失 | 低 | 用户可感知 | `pointerdown preventDefault`；不在宠物上做 `focus()` |
| 10 | 与语音录制 UI 抢右下角 | 低 | 挡录音按钮 | 宠物固定在右上，禁止进入区（底部 44px × 右侧 96px） |
| 11 | 用户嫌吵/嫌烦 | 中 | 差评 | 默认动效克制（1.6s 呼吸 + 低频眨眼）+ 一键隐藏 + 减动效 |
| 12 | 卡片 `overflow:hidden` 裁掉卡片外的宠物 | 中 | 宠物被裁/消失 | 挂载前检查 `overflow`；两级退化到 `.RlGAzG_root` → `body` fixed（§10.2） |
| 13 | 参考对象不可核实导致「不像」 | 高 | 预期偏差 | 本规格已明确「未验证」；交付时说明这是 DeepSeek 风格原创，不是复刻 |

### 11.3 建议里程碑

1. **M1（半天）**：静态帧 + 定位 + 隐藏/恢复 + 深浅色；可见即可用。
2. **M2（半天）**：呼吸/眨眼/hover/click + 暂停 + 减动效。
3. **M3（半天）**：发送检测 + 碰撞守卫 + 真机验证与打磨。

---

## 12. 验收清单

| # | 验收项 | 通过标准 |
|---|---|---|
| 1 | 出现位置 | 32×32 精灵完整可见、无被卡片裁切；右缘距卡片右缘 8px，底边距卡片顶边 4px（±1px） |
| 2 | 不挡操作 | 发送/语音/附件键可正常点击；`elementFromPoint` 在按钮中心不返回宠物子树 |
| 3 | 不抢焦点 | 点击宠物后，输入框仍有焦点、光标位置不变、草稿不丢 |
| 4 | 不压正文 | 输入 3 行中文 + 长英文单词后，宠物矩形与正文可见文本矩形无交集（Mode B 必然通过；Mode A 必须实测） |
| 5 | 呼吸/眨眼 | 3.2s 周期内可见 1px 起伏；10s 内至少眨眼 1 次 |
| 6 | 点击反应 | 点击后 480ms 内播放 happy 帧与位移，600ms 冷却内重复点击不叠加 |
| 7 | 发送反应 | 按 Enter 发送后 400ms 内触发 dash；连续发送不叠加 |
| 8 | 隐藏/恢复 | 隐藏后刷新页面仍隐藏；托盘「鲸」按钮可恢复；键盘 Tab 可到达两个按钮 |
| 9 | 暂停 | 窗口最小化 30s 再恢复：无异常位移、无定时器堆积（Performance 面板确认） |
| 10 | 减动效 | 系统开启「减少动态效果」后：无位移、无呼吸、无眨眼；点击仍有帧反馈 |
| 11 | 深色 | 深色主题下轮廓与腹部清晰，无「白肚子发光」 |
| 12 | 像素清晰度 | 100% / 125% / 150% 缩放下均为整数像素放大，无半透明边缘 |
| 13 | 性能 | 闲置 1 分钟：CPU < 0.2%，DOM 节点数 ≤ 5，无 rAF 常驻 |
| 14 | 卸载干净 | 停用插件后：无 `.dsh-pet*` 残留节点、无定时器、无 `--dsh-pet-sheet` 变量 |

---

## 13. 非目标（本次明确不做）

- 不做系统级桌面窗口 / 托盘图标（只能用 Web 技术，运行在 Electron 渲染进程内）。
- 不做声音、语音、震动反馈。
- 不做网络请求、不做行为埋点。
- 不做自由拖拽与位置持久化。
- 不做「根据 AI 状态随机说话」的智能反应（v1 只有固定文案与动画）。
- 不改宿主源码、不依赖未公开 API；只通过 DOM/CSS 追加。

---

## 14. 附：调研方法与检索记录（2026-10-20）

| 目标 | 手段 | 结果 |
|---|---|---|
| Claude Code 桌面端改版事实 | 直接抓官方 blog | 命中（2026-04-14 改版公告） |
| 官方文档是否有宠物/吉祥物 | 抓 `desktop.md` / `desktop-quickstart.md` / `whats-new/index.md` 全文 | 0 命中 |
| 社区是否有「螃蟹」讨论 | HN Algolia API（`claude code crab`、`claude crab mascot`、`clawd`） | 无相关结果；`Clawd` 指向 OpenClaw 项目 |
| 网页检索 | Bing（`cn.bing.com`）、DuckDuckGo、Google | 均为泛化结果或网络不可达；无有效一手信息 |
| 浏览器截图核实 | web-access 的 CDP 模式 | 不可用（无浏览器开启远程调试端口） |
| DeepSeek 品牌色 | 抓 `www.deepseek.com` / `chat.deepseek.com` 的 HTML 与 CSS 并提取 hex | 命中（见 §3.2） |
| 像素美术可读性 | Pillow 按矩阵渲染 16× 与 32px，在暖米/深色背景上检视 | 通过（矩阵与渲染一致） |

---

## 15. 变更记录

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-10-20 | v1 | 首版：调研结论（含「未验证」声明）、16×16 四帧矩阵、调色板、状态机、交互边界、性能预算、DOM/CSS 草案、成本与风险、验收清单 |