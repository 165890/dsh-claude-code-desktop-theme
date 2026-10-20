# 设计记录（内部实现笔记）

> 本文是 `dsh-claude-code-desktop-theme` 的开发过程记录，按阶段记录了布局、测量值与实现细节。
> 面向使用者的安装与功能说明请看根目录 [README.md](../README.md)。

# Claude Code 桌面端主题（dsh-claude-code-desktop-theme）

把 Harness Web 界面换成用户给定的 Claude Code 桌面端主题规格：

```json
{"codeThemeId":"absolutely","theme":{"accent":"#da7756","contrast":60,"fonts":{"code":"SF Mono","ui":"思源宋体 VF"},"ink":"#1d1b16","opaqueWindows":true,"semanticColors":{"diffAdded":"#00c853","diffRemoved":"#ff5f38","skill":"#cc7d5e"},"surface":"#f5f3ee"},"variant":"light"}
```

## 它做了什么

- **一个 token 覆盖层**：客户端半边调用 `ctx.theme.overrideTokens()`，把整套
  `--dsw-*`（别名 / 静态色阶 / 组件专用）、`--shiki-*`（代码高亮）、
  `--dsh-font-family-*`（字体）变量以「浅色 / 深色」成对写入。
  - 浅色：surface `#f5f3ee`、ink `#1d1b16`、accent `#da7756`；
  - 深色：同一套配色的暖色暗版（`#24221f` 表面等），系统跟随深色时也不会跳出风格；
  - 边框、正文次级色、状态色、diff、菜单、气泡、滚动条等由静态色阶整体暖化推导；
  - 代码高亮取自 Codex 的 **Absolutely** 代码主题（浅色 `#f9f9f7` / 深色 `#2d2d2b`，
    string `#00c853`、keyword `#ff5f38`、type `#bc7559` 等），与 `codeThemeId` 对应。
- **opaqueWindows**：菜单 / 弹层背景改为不透明，并关闭 `--dsw-menu-backdrop-filter`
  与 `--dsw-mask-blur`。
- **浅色优先**：首次加载时若外观为「跟随系统」，会写入一次「浅色」偏好（持久化到
  `~/.dsh/profiles/desktop/cordis.patch.yml`）。用户以后在 设置 → 通用 → 外观
  里手动选深色/浅色仍会生效，主题只为两种模式各提供一套配色。
- 字体：界面栈 `"思源宋体 VF", "Source Han Serif", "Noto Serif SC", serif`；
  代码/终端栈 `"SF Mono", "Consolas", monospace`。
- **首页标题内嵌衬线字体（兜底）**：本机 Electron 渲染器能按名命中 Georgia 等拉丁字体，
  但**按名命中不了已安装的 CJK 字族**（`Noto Serif SC` / `宋体` / `STSong` 均被
  静默替换成无衬线回退）。因此把 Noto Serif SC 的一个 3.9 KB 子集（覆盖
  「探索未至之境」，SIL OFL 1.1）以 data URL `@font-face` 嵌在主题里，注册为
  `"Noto Serif SC"`，仅作为 UI 字体栈的最后一层兜底；「思源宋体 VF」仍是第一优先级。
  原始子集与 OFL 许可文本放在 `assets/`。

## 用量卡片细节（阶段十六）

- 「常用模型」格子显示**真实检测到的完整模型名**：从宿主 `ctx.remote.session.modelCatalog()`
  拉取模型目录，把用量 Host 返回的原始 id（如 `deepseek-flash`）解析成展示名
  （`DeepSeek-V4.1-Flash`），并通过 MutationObserver 持续校正卡片与「模型」列表；
  该格单独用 12px/16px 小字号两行显示，实测 `DeepSeek-V4.1-Flash` 完整渲染
  （`scrollWidth === clientWidth === 74px`，内容高 32px，无省略号）。

## 用量概览已合并进主题插件（阶段十七）

- `dsh-usage-overview` 的 **Client 卡片**、**Host 汇总路由**与**模型目录解析**已整体并入
  `dsh-claude-code-desktop-theme`（版本 2.0.0），安装列表里只保留「Claude Code 桌面端主题」一个插件；
  独立的 `dsh-usage-overview` bundle 已从 profile 移除（源码目录作为备份保留）。
- 汇总路由改为 `POST /api/dsh-claude-code-desktop-theme/usage-summary`
  （客户端仍带旧路径兜底，便于迁移期）。
- 合并后的卡片实测：`[10, 2,640, 882.2M, 5, 4天, 4天, 12时, DeepSeek-V4.1-Flash]`，
  热力图 182 个格子（26×7），只渲染 1 张卡片。

## 稳定性加固（2026-10-18 · 阶段十五）

- **实例纪元保护**：每次插件实例启动都会递增全局 `__DSH_CLAUDE_THEME_EPOCH__`；
  旧实例每 800ms 检查一次，一旦发现不是最新纪元就自行 `disposeAll()`（清掉定时器、
  MutationObserver、注入的 DOM 与内联样式）。即使某个旧版本没有登记 dispose，
  也不会再和新实例互相覆盖样式（曾导致菜单/输入框左右来回跳动）。
- **不再使用页面重载**：修复了此前误加的 `location.reload()` 导致的自动重启循环；
  现在只做插件级自愈，页面保持稳定。
- **对齐复核**：菜单行盒子 `[521,733,945,26]`，菜单内容 `x=537` = 输入框卡片左缘
  `x=537`，右缘同为 `1450`；连续采样 7s 位置无变化。

## 主题 Token 回填：v1 温润版强制层（2026-10-18 · 阶段十一）

后来新增的组件（HUD 托盘、状态点、右侧 Diff 抽屉）曾使用偏冷的灰与更亮的橘色，
与最初的神仙配置有出入。现在按以下 JSON 做**全量 !important 覆盖**，并同步改写了
所有自绘组件的字面量：

```json
{
  "accent": "#da7756",
  "contrast": 60,
  "fonts": { "ui": "思源宋体 VF", "code": "SF Mono" },
  "ink": "#1d1b16",
  "surface": "#f5f3ee",
  "semanticColors": { "diffAdded": "#00c853", "diffRemoved": "#ff5f38" }
}
```

强制层落在 `SHELL_CSS` 末尾（`!important`，最后声明）：

| 规则 | 值 |
|---|---|
| 全局 UI 字体 | `"思源宋体 VF", "Source Han Serif", "Noto Serif SC", serif !important`，覆盖 `html/body/body *` |
| 全局等宽字体 | `"SF Mono", "Consolas", monospace !important`，覆盖 `code/pre/kbd/samp` 及其子元素、`.dsh-composer-tray*`、`.dsh-diff-badge*`、`.dsh-review-drawer*` |
| 主背景 surface | `body`、侧边栏 `._2H3hWW_root`、Composer 卡片、右侧抽屉一律 `#f5f3ee` |
| 文字 ink | 行标题、HUD 数值、抽屉标题/正文一律 `#1d1b16`；次级标签用暖灰 `#7f7869` |
| accent | 状态点（busy/waiting）、HUD 环形进度、Agents 橙点、发送按钮 token 一律 `#da7756` |
| diff 新增 | 徽标 `+N` 文字、抽屉新增行背景 = `#00c853` |
| diff 删除 | 徽标 `-M` 文字、抽屉删除行背景 = `#ff5f38` |
| 其他 | 徽标/抽屉 Header 底 `#ece7dd`，边框 `#e3ddd1`，预览占位边框 `#b4ab99` |

实测（窗口标题回传 computed style，验证后已移除）：

| 检查项 | computed |
|---|---|
| body / 侧边栏 / 行标题 字体 | `"思源宋体 VF", "Source Han Serif", "Noto Serif SC", serif` |
| body / 侧边栏 / Composer / 抽屉背景 | `rgb(245,243,238)` = `#f5f3ee` |
| 行标题 / HUD 数值颜色 | `rgb(29,27,22)` = `#1d1b16` |
| HUD 托盘 / 徽标 / 抽屉 / 代码行 字体 | `"SF Mono", Consolas, monospace` |
| 状态点 / 环形进度 | `rgb(218,119,86)` = `#da7756` |
| 徽标 `+` / `-` | `rgb(0,200,83)` = `#00c853` / `rgb(255,95,56)` = `#ff5f38` |
| 抽屉新增 / 删除行背景 | `rgb(0,200,83)` / `rgb(255,95,56)` |

## 首页仪表盘最终版（2026-10-18 · 阶段十三/十四）

首页重构成干净的手绘对齐仪表盘，不再有任何大标题：

1. **删除顶部装饰**：整个 `.Hqq-bq_root`（fish +「探索未至之境」+ 预览版）`display:none`。
2. **卡片 = 左上角方块（随窗口缩放）**：`mountHeroDashboardCard` 把 `.duo-card` 以
   `position:fixed` 钉在内容区左上角，并**每次布局都按当前视口重新计算**：
   `top ≈ 12.3% 视口高`；卡片以全屏基准尺寸 **427×318（比例 0.745）** 为唯一布局，
   窗口变化时用 `transform: scale(availableWidth / 1427)` **等比缩放**（最小 0.85，
   并按可用宽度兜底防溢出），字体随卡片一起缩小，长宽比在任何窗口尺寸下都不变；侧边栏隐藏（宽度 < 100px）时
   卡片在整窗水平居中（实测全屏居中 `[640,112,427,318]`，有侧边栏 `[362,112,427,318]`）。
   `0 14px 40px rgba(29,27,22,.12), 0 2px 8px rgba(29,27,22,.05)`。
   卡片内部保持：8 个 KPI 4 列 × 2 行 → 26 周热力图（7×7px 色块）→ 底部文案，全部左上对齐。
3. **底部区块下移并预留下方空间**：菜单行与 Composer 也改为固定定位，宽度同样由视口推导
   （`composerWidth = clamp(480, 内容宽 × 0.662, 945)`，水平居中；菜单行与输入框卡片左右边缘严格对齐）：
   - 菜单行 `[521,733,945,26]`，菜单内容起点 `x=537` = Composer 卡片左缘 `x=537`，右缘 `1450` 也一致；
   - Composer `[502,769,977,115]`（内部卡片 `[518,769,945,115]`，与菜单内容、卡片左缘对齐）；
   - Composer 以**底边**锚定：下方固定预留 28px（8px 间距 + 16px HUD 托盘 + 4px 底距），
     空白无文字；当输入框内容变高（例如附上图片预览）时，Composer 会**向上延伸**，
     底部 28px 始终保留，菜单行随 Composer 顶部一起上移（实测加 120px 附件后：
     Composer 从 `[502,769,977,115]` → `[502,649,977,235]`，reservedBelow 仍为 28px）；
   - 菜单保持透明文字胶囊：`#87867F`，hover 变深 `#1d1b16`。
4. **下拉菜单向上展开**：工作区 / 标准模式两个下拉的宿主 portal 原本向下盖住输入框；
   `mountHeroMenusUpward` 在检测到 `aria-expanded=true` 的 hero 触发器后，把打开的
   `[role="menu"]` 面板重新定位到触发器上方（`top = 触发器 top − 面板高 − 4px`），
   每 200ms + style 变更观察保持，菜单关闭/插件卸载时移除覆盖。工作区菜单（高 83px）
   从 763px 上移到 **646px**；标准模式菜单（高 272px）从 628px 上移到 **457px**
   （触发器 `[643,733,106,26]`，面板 `[643,457,324,272]`），两者都向上展开。
5. **新会话 HUD**：Hero 检测为 blank，托盘保持 `display:none`。
   离开 Hero（开始对话）后所有固定定位自动解除，恢复普通流式布局。

实测（首页 DOM rects，临时遥测后已移除）：

| 检查项 | 结果 |
|---|---|
| 卡片 | `[362,112,427,306]`，`position:fixed`、高度 auto，带阴影 |
| 菜单行 | `[521,733,945,26]`（内容左缘 537 = 输入框左缘） |
| Composer 根/卡片 | `[502,769,977,115]` / `[518,769,945,115]` |
| Composer 下方预留 | **28px**（空白，无文字） |
| 对齐 | 菜单内容与 Composer 卡片左缘同为 518 |
| 首页 HUD | `display:none` |

## 骨架层：1:1 对齐 Claude 桌面端（2026-10-18）

除 token 之外，插件再注入一层只作用于**外壳骨架**的 CSS（浅色外观下生效），
中间的对话内容和下方卡片（用量概览、底部信息条）不受影响：

| 区域 | 规格 |
|---|---|
| 侧边栏 | 背景 `#f5f3ee` |
| 新会话按钮 | 去描边、背景 `#e3ddd1`、高 32px、圆角 6px、悬停 `#e0dbcf` |
| 选中会话 | 背景 `#ece7dd` + **选中行自身左缘** 2px `#da7756` 垂直指示条（`::before` 强制注入，`!important`） |
| 首页标题 | `Georgia, "Noto Serif SC", serif !important` / 22px / 400 / `#1d1b16`（内嵌衬线子集兜底；深色下保留同一字体度量、颜色跟随墨色） |
| 「预览版」标签 | 背景 `#e3ddd1`，文字 `#7f7869` |
| 输入框 | 背景 `#f5f3ee`、1px `#e3ddd1` 描边、阴影 `0 4px 20px rgba(0,0,0,.04)` |
| 输入框内按钮 | 加号 / 语音 / 模型选择去背景，图标与文字 `#7f7869`（悬停 4% 黑） |

实现说明：

- **选中指示条**改为纯 CSS：`.hIlkoa_sessionRow.hIlkoa_selected::before`，绝对定位在
  行左缘（`left:0`、垂直居中、2px × 18px），随行一起滚动缩放，不再依赖 JS 浮层；
- **标题衬线**用 `!important` 覆盖宿主字体表，并用内嵌子集解决「本地 CJK 字族不可
  命中」的问题（见上文字体说明）；
- 内嵌字体的 data URL 在 `client.js` 的 `HERO_SERIF_BASE64` 常量里，`assets/` 保留
  原始子集（`hero-serif-subset.ttf`，由 Google Fonts 的 `text=探索未至之境` 子集接口生成）
  与 `OFL.txt`，重新生成后可替换常量。

## 状态语义层（真实数据，2026-10-18 · 阶段九）

给左侧会话列表注入「活的工作台」语汇：每个会话标题前一个 6px 状态圆点。数据**不再是
Mock**：`mountSessionStatus` 每 500ms 从无渲染桥的 `bridge.sessions` 读取宿主的真实状态，
映射成 `data-dsh-status` 写到会话行上，圆点纯 CSS 渲染。

宿主的 session 状态对象（`useSessionStatus` 的 Map 值）没有单一的 `status` 字符串，可用字段是：

| 字段 | 含义 | 我们的映射 |
|---|---|---|
| `running` | 会话正在跑（也回退读 `useSessions().byId[id].running`） | `busy` |
| `pendingInteraction.kind` | `approval` / `plan-review` / `question`（等待确认或授权） | `waiting`（优先级最高） |
| `completionUnread` | 任务完成但用户还没看 | 归入 `idle`（半透明灰） |
| `subagentCatalog` + 子会话 `running` | 有子代理在跑（按宿主 `runningChildCount` 同法统计） | `busy` |
| 其余 | 空闲 | `idle` |

| 状态 | 圆点 | 动效 |
|---|---|---|
| `waiting`（等你确认/授权） | `#da7756` | **常亮**（无动画） |
| `busy`（运行中，含子代理运行） | `#da7756` | 直接复用宿主原生 **14px 旋转圆弧 spinner**（旋转 + 弧长收放），轨道 `rgba(218,119,86,.25)`、圆弧 `#da7756`；伪元素圆点在此状态下 `display:none`；`prefers-reduced-motion` 下停用 |
| `idle`（空闲/完成未读） | `#7f7869`，`opacity: .5` | 无动画 |

稳定性：圆点不再是注入的 DOM 节点，而是宿主行上的 **CSS 伪元素**
`.hIlkoa_sessionRow[data-dsh-status] .hIlkoa_slot::before`。伪元素属于计算样式，
不是 React 子节点，**任何重渲染都无法把它删掉**，因此不会再出现「圆点突然消失」；
JS 只负责把真实状态写进 `data-dsh-status`，并用 500ms 轮询 + MutationObserver +
bridge 回调维护，另带 last-known 状态缓存（bridge 短暂不可用时仍保留上次状态）。
`busy` 行直接显示宿主 spinner；`idle` 灰点 50%、`waiting` 橙点。

实现方式（不触碰宿主 React 结构，也不替换 SessionRow 组件）：

- 圆点是**真实 `<span class="dsh-status-dot">`**（不是伪元素！），注入到宿主行已有的
  16px 前导 slot 里：`display:inline-block`、6×6、`border-radius:50%`，并用 `!important`
  锁死尺寸/颜色/动画，任何宿主样式表都覆盖不掉；宿主自带的状态小图标被
  `.hIlkoa_slot > *:not(.dsh-status-dot)` 隐藏。**行高（32px）与左右内边距不变**。
- `mountSessionStatus` 每 500ms、MutationObserver（class 变化）**以及 bridge 的
  `bridgeListeners` 变化回调**都会立刻同步属性与 span；状态从 `busy` 变为 `idle` 时
  `data-status` 被改写，**呼吸灯立即停止**，圆点回到半透明灰。
- 旧 Mock 与草稿铅笔已删除。
- **深层排障结论（卡死/静态根因）**：之前 client HMR 留下过「僵尸插件实例」——它的
  composer.dock occupant 占着同一个 slot id，导致新实例的 `ThemeDataBridge` 从不渲染
  （`bridgeRenders=0`），自然没有任何 `data-dsh-status`。现在 `apply` 开头用
  `window.__DSH_CLAUDE_THEME_DISPOSE__` 主动销毁上一个实例，再注册新 occupant；
  若宿主仍残留同名 cell，新注册会替换它。修复后实测 `bridgeRenders=26`、
  `statusesMap=37`、`withAttr=3/3`。
- **控制台诊断**：DevTools 里执行 `__dshClaudeThemeStatusDebug()`，会 `console.table`
  打印每一行的 `dataStatus / running / pendingInteraction / subagentsRunning` 以及真实
  span 的 `width/height/backgroundColor/opacity/animationName`。
- **手动模拟 running**：在任意会话里发送一条消息（例如让它执行一个耗时命令
  `运行 sleep 20 后打印 done`）；该会话在 Agent 工作期间 `running=true`，左侧出现橙色
  呼吸灯，本轮结束（回复完成）后立刻变半透明灰。也可以直接切到正在生成的会话观察。

实测（窗口标题临时回传真实状态与 computed style，验证后已移除）：

| 会话 | 真实状态 | `data-dsh-status` | 真实 span computed |
|---|---|---|---|
| 当前会话（正在生成） | `running=true`, pending=none | `busy` | `block/6px/6px/50%`，`rgb(217,119,87)`，`opacity=1`，`animationName=dsh-session-pulse` |
| 其他会话 ×2 | `running=false`, pending=none | `idle` | `block/6px/6px/50%`，`rgb(135,134,127)`，`opacity=0.5`，`animationName=none` |
| 模拟挂 `waiting` | — | `waiting` | `rgb(217,119,87)`，`opacity=1`，`animationName=none`（常亮） |

## Composer 重排 + HUD 底部托盘（2026-10-18 · 阶段五/六）

输入框与 HUD 彻底解耦，同时把「花费 / 余额」找回来：

- **Composer 内部恢复清爽的两端对齐**（不再塞 HUD）：左端只剩 `+` 与 `📁 工作区内修改`，
  右端只剩 `DeepSeek-V4.1-Flash`（含思考强度 `Max`）与发送按钮。为消除插件叠加的重复信息，
  用 CSS 隐藏了 1017 型号徽标（model-label 插件）、语音按钮（`.RlGAzG_activity`）。
- **HUD 整体移到输入框正下方**：作为 `.RlGAzG_card` 的兄弟节点注入（`card.after(tray)`），
  与卡片间距 **8px**、宽度与卡片一致；`justify-content: space-between` 两端对齐：
  - 左：12px 环形进度（底环 `#e3ddd1` / 进度环 `#da7756`）+「上下文 N%」+「缓存命中 99.7%」
    （缓存改为宿主真实命中率，不再使用本地倒计时）
  - 右：`本次花费 ¥13.10` · `262 tok/s` · 发光橙点 + `N Agents`（小圆点 `·` 分隔）；
    `tok/s` 为实时值：仅当会话 `running=true` 时显示真实解码速度，空闲时立即显示 **0 tok/s**
  - **余额不再显示在输入框下方**；改到左侧栏底部账户行右侧（`余额 ¥8.47`，
    `.dsh-sidebar-footer-balance`，暖灰、思源宋体），**软件一打开就显示**：
    插件启动时直接调用宿主 `ctx.remote.account.getBalance()`（`inject` 里声明
    `remote` / `remote.account` / `locale`），并订阅 `account.watch` 流 + 10s 轮询保持实时；
    不再依赖是否打开任务/底栏 DOM，打开会话后仍以底栏实时值兜底。
- **上下文与 Agents 是真实数据**（见下一节「数据绑定」）：环形进度、百分比、Agents 数量
  全部来自宿主会话投影；拿不到时回退到 24% / 隐藏 Agents。
- **旧数据复用（不重新实现）**：旧的底部统计条 `.RlGAzG_dock` 仍由原插件保持挂载与实时计算，
  只是被 CSS 隐藏；托盘每秒从它的文本里抓取「本会话 …」与「余额 …」两段数字，去掉旧颜色/
  粗体/低额角标，按 12px 等宽、`#7f7869`（数值加深为 `#1d1b16`）重新排版，金额统一保留
  两位小数。**注意：被隐藏的「1017」是 model-label 插件的模型版本徽标，不是余额/额度**；
  真正余额来自旧统计条（当前为 `余额 ¥8.59`），已放入托盘。旧统计条上也仍显示「低」等状态，
  托盘里统一降噪不再强调。
- 首页（无 Session 时旧底栏不渲染）托盘显示内置回退值：`本次花费 $0.12` / `余额 $1,017.00`。
- 字号 12px、`Consolas, "Cascadia Mono", "SF Mono", monospace`；倒计时每秒更新、
  剩余 < 60s 时变 `#ff5f38`；托盘固定 16px 行高、`overflow:hidden`，余额过长时
  单行省略号截断，绝不折行，更新不引起页面重排。
- 实现仍是 `client.js` 内的纯前端运行时（`mountComposerTray` + `readLegacyMoney`）：
  MutationObserver 在 composer 重渲染后补齐托盘；插件卸载时连同定时器一起移除。

验证（实机 `getBoundingClientRect` + 隐藏底栏文本对照）：

| 指标 | 数值 |
|---|---|
| Composer 卡片高度 | **99.3px**（与改造前一致，HUD 不占卡片空间） |
| 卡片底部 → 托盘顶部 | **8.0px** |
| 托盘高度 / scrollHeight | 16.0px / 16px（恒为单行，无溢出） |
| 旧底栏文本（隐藏） | `余额¥8.59 低 本会话¥5.39668 …` |
| 托盘右侧（解析后） | `本次花费 ¥13.10 · 262 tok/s`（均为宿主实时数据；余额已移到侧边栏底部） |
| 托盘左侧缓存 | `缓存命中 99.7%`（真实命中率；无数据时显示 `缓存 —`） |
| 倒计时两帧（间隔 1.3s） | 倒计时区域 151 个像素变化，确认每秒递减 |
| 常态缓存文字颜色 | `rgb(135, 134, 127)` = `#7f7869` |

> 旧的统计条本体（轮次 / token / 缓存命中 / 上下文%）仍被隐藏；需要恢复时删除
> `.RlGAzG_dock` 的 `display:none` 规则即可，语音按钮同理。花费与余额已经抽到新托盘里，
> 不需要旧条也能看到。

## 数据绑定（2026-10-18 · 阶段八）

宿主没有公开一个单独的 `conversation.usage` 接口，但 **`conversation.composer.dock` 槽位的
standardProps 已经暴露了全部所需 hooks**。插件在托盘里注册了一个**无渲染** React 桥
（`ThemeDataBridge`，返回 `null`），把真实状态折叠进模块内 `bridge` 快照，DOM 运行时每 tick
读取；所有读写都包在 try/catch 里，任何一项拿不到都保持上一次快照或回退默认值。

| 目标 | 真实数据源（实测可用） | 降级 |
|---|---|---|
| 上下文占用 | `useProjection('contextPressure')` → `projectedTokens ?? pressureTokens` / `contextWindow`，百分比 = 四舍五入，环形 `stroke-dashoffset` 同步 | 无投影时 24% |
| Agents 数量 | `useSessions(s => s.projectionsBySession)[sessionId].values.subagentCatalog` 的条目，用 `useSessionStatus` / `byId[id].running` 过滤出 running；0 个时整段隐藏（含前面的 `·`） | 未知时隐藏 |
| 工具 diff 行数 | `useChat(s => s.legacy.nodes)` 里 `kind === 'tool-result'`、`name ∈ {edit, write}` 的节点：优先 `meta.diffs`（`{path, oldText, newText}` 真实应用结果），否则用 `call.argsRaw` 解析出 `content` / `old_string,new_string`；本地 LCS 行 diff 统计 `+added/-removed` | 无数据时卡片不显示徽标 |
| 抽屉代码 | 同一条节点的 `meta.diffs`/args 经 LCS 生成 context/add/del 行，渲染到 `<pre>`，标题显示相对工作区路径 | 无数据时回退内置 MOCK_DIFF |

实现要点：

- **主路径不是 DOM 猜测**：`legacy.nodes` 的 tool-result 节点含 `callId`、`call.name`、
  `call.argsRaw`、`meta.diffs`；这比解析卡片文本可靠，也和宿主卡片自己的 `+N -M` 完全一致。
- 徽标只给 **edit / write**：bash 没有文件 diff，不再伪造 `+12 -1`；MutationObserver 注入 +
  每 700ms 同步一次数据。
- 上下文/Agents 更新按 React store 变更即时渲染，DOM 侧在托盘每秒 tick 时刷新；环形有
  300ms `stroke-dashoffset` 过渡，不触发布局重排。
- 金额/余额仍来自旧底栏文本（保留原有实现）；Agents 真实为 0 时右侧变成
  `本次花费 … · 余额 …`，不再出现假的 `2 Agents`。

实测（截屏 + 宿主卡片右侧自带的真实 `+N -M` 对照）：

| 指标 | 结果 |
|---|---|
| 上下文 | `projectedTokens 229533 / contextWindow 1048576` → 22%，托盘显示 22–26%（随会话实时变化） |
| 徽标数字 | 与宿主卡片 `+7 -7`、`+35 -0`、`+27 -19`、`+35 -4` 等真实值逐条一致 |
| Agents | 当前会话 `subagentCatalog` 有 0 个 running → 托盘隐藏 Agents 段 |
| 抽屉 | 标题 `dsh-claude-code-desktop-theme\client.js`，`Diff · live`，真实新增/删除行带绿/红底 |

## Diff 微标 + 右侧审查抽屉（2026-10-18 · 阶段七/八）

对话流里的文件修改卡片不再展开大段代码，只留一个极小的 Diff 微标；点击后从右侧滑出审查抽屉：

- **微标注入**：`tool.call.toolview` 是 keyed 槽位，注册 `edit`/`write` 会**整体覆盖**宿主已发货
  的工具卡视图（`replaceRisk: shadows-shipped-ui`），因此改为 JS 注入到卡片头部：
  `[data-tool]` 限定 `edit`/`write`，把徽标 append 到 `[data-disclosure-row]` 行内并用
  `margin-left:auto` 右对齐；按钮为 `+N`（绿 `#00c853`）/ `-M`（红 `#ff5f38`），数字来自
  上一节的真实 diff 桥。
  - 样式：背景 `#ece7dd`、圆角 4px、11px 等宽字体、`padding:1px 7px`；
  - MutationObserver 在 React 重渲染后自动补回；点击时捕获阶段 `preventDefault +
    stopPropagation`，不会误触卡片的展开/折叠；
  - 数据未就绪或没有 diff 的卡片不显示徽标（不伪造数字）。
- **抽屉**：`aside` 挂载在 `document.body` 末尾（避免聊天滚动容器 `overflow` 裁切），
  `position:fixed` 贴右侧。
  - 尺寸/材质：宽 400px、高 100vh、背景 `#f5f3ee`、`box-shadow:-4px 0 24px rgba(0,0,0,.08)`；
  - 动画：`transform:translateX(100%) → 0`，`transition:transform 200ms ease`，无弹跳；
  - **关闭方式（三条冗余路径）**：
    1. 顶栏右侧 28px X 按钮（`#1d1b16`，hover `#1d1b16` + `#e3ddd1` 底）；
    2. `Esc` 键（document keydown，打开态才响应）；
    3. 左侧半透明遮罩（`rgba(0,0,0,.1)`，`z-index:1199`，200ms 淡入；关闭态
       `pointer-events:none`，点击遮罩即关闭）。
  - 顶栏：固定 52px Header，背景 `#ece7dd`（与 `#f5f3ee` 的正文区分），左侧相对路径
    （`title` 保留绝对路径），右侧 X；内容区独立滚动，Header 不随 diff 滚动；
  - 内容：真实 diff（`<pre>` 语义，新增行底色 `#00c853`、删除行底色 `#ff5f38`，
    `@@ path @@` 分隔多个 hunk），下方「浏览器预览」占位框（灰色边框 + 刷新图标 +
    `localhost:3000` 占位文案）。
- Mock 仅作为回退：数据源不可用时抽屉退回内置 MOCK_DIFF，绝不因缺数据报错。

> **卡死 Bug 修复**：抽屉原先只由「打开它的那个插件实例」持有监听器。client HMR / 禁用插件
> 若没有执行到旧实例的 cleanup（或 cleanup 中途失败），屏幕上会留下一只**没有监听器的孤儿抽屉**，
> 点 X / 按 Esc 当然无反应。现在 `mountDiffReview` 采用 **adopt-and-replace**：挂载前先删除
> 所有已有的 `.dsh-review-drawer` / `.dsh-review-overlay`，cleanup 时也清空所有同类节点，
> 保证任意时刻全局只有一只带监听器的抽屉；遮罩与 Header 背景同时补上。

实测（窗口标题临时遥测，验证后已移除；数值为 CSS px）：

| 指标 | 结果 |
|---|---|
| 徽标数量 | 与有 diff 的 edit/write 节点数一致（当前会话约 30+，bash 无徽标） |
| 徽标尺寸/位置 | 高 18px，右缘 = 卡片头部行右缘（1442 = 1442） |
| 徽标样式 | 背景 `rgb(240,238,230)` = `#ece7dd`，字号 11px |
| 抽屉关闭态 | `matrix(1,0,0,1,400,0)`（完全移出右侧），200ms transition，z-index 1200 |
| 抽屉打开态 | `matrix(1,0,0,1,0,0)`，x=1307（右缘 1707），`aria-hidden=false` |
| X 按钮 | 28×28，打开时 x=1663 可见，颜色 `rgb(94,93,89)` = `#1d1b16` |
| 顶栏背景 | `rgb(240,238,230)` = `#ece7dd`（与正文 `#f5f3ee` 区分） |
| 遮罩 | 打开 `data-open=true` / `pointer-events:auto`；关闭 `pointer-events:none` |
| 关闭路径 | X / Esc / 点击遮罩三条路径实测均能把 `data-open` 置回 `false` |
| 单实例 | 修复前可能残留孤儿抽屉；现在 `drawers=1, overlays=1` |
| 动画/滚动 | fixed 定位不参与聊天布局，不产生重排与裁切 |

预览：`preview-skeleton-chat.webp`（真实徽标在对话流右侧）、`preview-diff-drawer.webp`
（抽屉打开态，`Diff · live` + 真实代码）。

## 安装状态

- 已通过 `plugin_manager` 的 `install_bundle` 安装进 **desktop** profile（本地目录 link 安装）：
  - `~/.dsh/profiles/desktop/package.json` 增加 `dsh-claude-code-desktop-theme: link:...`
  - `~/.dsh/profiles/desktop/cordis.yml` 增加 `claude-code-desktop-theme` 行
  - `~/.dsh/profiles/desktop/cordis.patch.yml` 已写入 `ui-theme.config.preference: light`
- 源码 / 文档就放在本目录；运行中的 Web/桌面端由 client HMR 监听该包入口
  （约 0.5s 轮询），保存 `client.js` 后自动热替换，无需手动刷新；若 HMR 被关闭，
  则禁用→启用插件或重启 DSH 生效。

## 开关与回滚

- 关闭主题：设置 → 插件 → 找到「Claude Code 桌面端主题」禁用即可（或移除 bundle），
  覆盖层随插件卸载自动撤销，界面回到内置浅/深色。
- 卸载：插件管理里移除 `dsh-claude-code-desktop-theme`；本目录可保留作文档。
- 想换回系统深色：设置 → 通用 → 外观 选择「深色」或「跟随系统」即可。

## 验证

- 安装返回 `application: applied`，配置行 `claude-code-desktop-theme` 已在 Loader 中激活。
- 客户端 `Theme` Inspect Provider 已把本插件注册的 token 全部列为
  「Theme token registered by the current Client composition」（说明覆盖层在页面里生效）。
- 骨架层已在运行中的桌面端窗口逐项截图核对（`preview-skeleton-hero.webp` /
  `preview-skeleton-chat.webp`），并对截图像素/字形取样确认：
  - 侧边栏 `#f5f3ee`、新会话按钮 `#e3ddd1`（无描边 / 32px / 6px 圆角）；
  - 选中行背景 `#ece7dd`，行左缘 `::before` 取样为 `rgb(217,119,87)` = `#da7756`、
    宽 2px（选中时会话行左侧即出现竖条）；
  - 首页标题用 `getComputedStyle` 确认 `font-family: Georgia, "Noto Serif SC", serif`、
    20/22px、`font-weight: 400`、颜色 `rgb(26,25,24)`；并用字形位图与候选字体比对，
    与 Noto Serif SC 的匹配度（0.117）明显优于 Noto Sans SC（0.196），确认实际渲染为衬线；
  - 内嵌 webfont `document.fonts.check('20px "Noto Serif SC"') === true`、状态 loaded；
  - 「预览版」标签背景 `#e3ddd1`；Composer 背景 `#f5f3ee`、1px `#e3ddd1` 描边与轻阴影，
    三个内部按钮无背景、图标/文字 `#7f7869`；
  - 中间的用量概览卡与底部信息条未改动。
- 保存 `client.js` 后约 0.5–1s 内热替换生效（HMR 实测）。
- 深色外观下浅色骨架层不注入；标题的字体/字号/字重在深色下同样生效（颜色跟随深色墨色）。
- 状态语义层实测：三行分别取样 `#DB8365`（waiting 实心，取样含抗锯齿）、
  busy 圆点两帧间颜色由 `#E09A80` → `#EAC5B5`（呼吸灯生效）、idle `#C5C4BD`
  （= `#7f7869` 以 0.5 透明度叠在 `#f5f3ee` 上），行高与内边距未变；
  草稿铅笔在标题省略号之后、时间戳之前可见。预览见上方两张截图。
