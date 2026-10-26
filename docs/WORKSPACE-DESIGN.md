# 4.0 工作台视觉基线（D1=A）

> 2026-10-26 · 宿主 DSH Desktop 0.2.1-rc.3 · 决策 D1=A（暖米色 / 宋体）
> 本文是 **M1–M6 的视觉合同**：组件尺寸、状态、token 映射以本文为准；视觉稿在 `4.0-plan/design/`。
> Token 事实来源：`src/client/parts/13-theme-tokens.js`（别名层）、`03-tokens-and-fonts.js`（色阶 / SHELL 几何）、`04-shell-css.js`（外壳规则）。

## 0. 方向：冷白 + 蓝 → 暖米色 + 陶土橙

参考视频是「冷白底 + 蓝色强调」。D1=A 保留它的**结构、密度与节奏**，只换皮肤：

| 视频（冷白） | 4.0（暖米色，D1=A） | 理由 |
|---|---|---|
| 近白 `#fafafa` 底 | `--dsw-alias-bg-base` `#f5f3ee`（暗 `#24221f`） | 与现有 2.5.x 皮肤连续，不二次换肤 |
| 冷灰边框 | `--dsw-alias-border-l1…l4`（暖墨 `#1d1b16` 透明度阶梯） | 暖色不脏，层次靠透明度而非蓝灰 |
| 蓝色强调（链接/选中/进度） | `--dsw-alias-brand-primary` `#da7756`（hover `#c4633f`） | 陶土橙是插件既有 accent，视频的「强调」位全部换过来 |
| 蓝色选中底 | `--dsw-alias-interactive-bg-hover-accent`、`--dsw-specific-sidebar-nav-item-active` | 选中 = 暖沙 `#ece7dd` + 2px 陶土竖轨 |
| 绿/红 diff | **保留** `#00c853` / `#ff5f38`（`--dsw-alias-file-diff-*`） | 语义色不参与调色，diff 必须一眼可读 |
| Inter/系统无衬线 | 标题/数字：DSH Serif UI（内嵌宋体子集）；正文：UI_FONT 栈 | 宋体是 D1=A 的识别点，但**只在标题、KPI、pane 标题、hero** 使用，正文保持无衬线以保密度与可读性 |

其它硬规则：
- 只用 `--dsw-alias-*` / `--dsw-static-*` / `--dsw-specific-*` / 插件自有 `--dsh-*` 变量；**不写裸 hex 到组件 CSS**（截图为示意，代码必须引用变量）。
- 深浅两套成对；浅色是默认，深色只换 token（不改布局）。
- 字号/间距/圆角/阴影全部走本文 §2 的档位，不新增第 13 档。

## 1. 视觉原则（评审时按此判断）

1. **三栏安静**：侧栏（暖沙底）→ 会话列（暖白底）→ 右 Dock（图层 1 底 + 细边框）。任何时刻只有一个「强调橙」焦点。
2. **线不抢内容**：边框用 `border-l1/l2`（≈4–10% 墨），分隔优先留白 12/16px，其次 1px 线，绝不用粗色块。
3. **数字用宋体 + tabular**：KPI / token / 价格数字用 DSH Serif UI + `font-variant-numeric: tabular-nums`；正文与 UI 文案用无衬线。
4. **状态点三态**：idle 灰 `#cfc7b6`、busy 橙弧（accent 2px 旋转）、waiting 实心橙点（`--dsw-alias-state-warn-primary`），永远带 `data-dsh-status` 语义属性。
5. **动效只做位移/透明度**：120–240ms，`cubic-bezier(0.2,0,0,1)`；`prefers-reduced-motion` 全部降为 0ms。
6. **空态不是空白**：每个面板的空态 = 图标 + 一句解释 + 一个真实动作（或明确「宿主未提供」），不伪造数据。

## 2. Design tokens（映射表）

### 2.1 颜色 — 表面 / 文本 / 边框

| 语义 | Light | Dark | 变量（唯一来源） |
|---|---|---|---|
| 应用底 | `#f5f3ee` | `#24221f` | `--dsw-alias-bg-base` |
| 卡片/面板 | `#fbf9f4` | `#2b2825` | `--dsw-alias-bg-layer-1` |
| 次级块（menu group / tray） | `#efebe2` | `#322f2b` | `--dsw-alias-bg-layer-2` |
| 三级块（hover 行 / chip 底） | `#e7e2d7` | `#393530` | `--dsw-alias-bg-layer-3` |
| 浮层（menu/tooltip/toast） | `#fbf9f4` | `#302d29` | `--dsw-alias-bg-overlay` |
| 侧栏底 | `#f5f3ee` | `#1e1d1a` | `--dsw-specific-sidebar-fill` |
| 侧栏选中 | `#ece7dd` | `#2f2c28` | `--dsw-specific-sidebar-nav-item-active` |
| 正文 | `#1d1b16` | `#f0ede4` | `--dsw-alias-label-primary` |
| 次级文字 | `#635f56` | `#bdb6a9` | `--dsw-alias-label-secondary` |
| 辅助/图标 | `#7f7869` | `#9a9285` | `--dsw-alias-label-tertiary` |
| caption/时间戳 | `#948d7e` | `#857e71` | `--dsw-alias-label-caption` |
| 描边 1（分隔） | `#1d1b160d` | `#f5f3ee0f` | `--dsw-alias-border-l1` |
| 描边 2（卡片） | `#1d1b161a` | `#f5f3ee1f` | `--dsw-alias-border-l2` |
| 描边 3（输入框/需要看见） | `#1d1b1621` | `#f5f3ee29` | `--dsw-alias-border-l3` |
| 描边 4（强调边界） | `#1d1b1629` | `#f5f3ee33` | `--dsw-alias-border-l4` |

### 2.2 品牌 / 状态 / Diff / 代码

| 语义 | Light | Dark | 变量 |
|---|---|---|---|
| 品牌主色 | `#da7756` | `#da7756` | `--dsw-alias-brand-primary` |
| 品牌 hover | `#c4633f` | `#c4633f` | `--dsw-alias-button-primary-hover` |
| 焦点环 | `#da7756` 2px | `#e8a184` 2px | `--dsw-focus-ring-color` / `--dsw-focus-ring-width` |
| 链接 | `#ad5738` | `#e39170` | `--dsw-alias-link` |
| success | `#009c3f` | `#37d06c` | `--dsw-alias-state-success-primary` |
| error | `#e14a24` | `#ff7a58` | `--dsw-alias-state-error-primary` |
| warn | `#d99a2b` | `#e0a43a` | `--dsw-alias-state-warn-primary` |
| idle | `#cfc7b6` | `#4d4640` | `--dsw-alias-state-idle-primary` |
| diff added 行底 | `#00c8531f` | `#00c85326` | `--dsw-alias-code-diff-added` |
| diff deleted 行底 | `#e14a2414` | `#ff5f3826` | `--dsw-alias-code-diff-deleted` |
| diff added marker | `#00a344` | `#37d06c` | `--dsw-alias-file-diff-added-marker` |
| diff deleted marker | `#d94a26` | `#ff7a58` | `--dsw-alias-file-diff-deleted-marker` |
| 代码块底 | `#f7f5f0` | `#2d2d2b` | `--dsw-alias-markdown-code-block` |
| 代码前景/语法 | `#2d2d2b` / absolute 配色 | `#f9f9f7` | `--shiki-foreground` / `--shiki-token-*` |

### 2.3 字体角色

| 角色 | 字体 | 字号/行高/字重 | 变量/用法 |
|---|---|---|---|
| Display（hero 问候） | DSH Serif UI | 34/1.2/400，`letter-spacing:-0.01em` | `--dsh-font-family-text` |
| Pane 标题 | DSH Serif UI | 14/1.35/600 | 会话头项目/标题 |
| Section label | UI_FONT | 11/1.3/600 + 大写 `0.08em` | 侧栏分组、面板分组 |
| Body | UI_FONT | 14/1.55/400 | 会话正文、面板文本 |
| Caption | UI_FONT | 11.5/1.4/400 | 时间、+N/−M、快捷键 |
| KPI 数字 | DSH Serif UI | 20/1.2/600 + tabular-nums | Dashboard |
| Code / 终端 | CODE_FONT（SF Mono 栈） | 12.5/1.5 | diff、终端、行内代码 |
| Chip | UI_FONT | 11.5/1/500 | Local/项目/分支 chips |

> 字体加载（M0-S6/D8）：GB2312 宋体经 Host `GET|HEAD /api/dsh-claude-code-desktop-theme/font` 外置，client 用 `FontFace` 异步加载（`display:swap`）；失败回退 `Noto Serif SC / Songti SC / SimSun` 系统宋体栈，正文仍保持无衬线（§8 决策 1）。

### 2.4 间距 / 圆角 / 阴影 / 层级 / 动效

| 类别 | 档位（px） | 用法 |
|---|---|---|
| Spacing | 2 · 4 · 6 · 8 · 10 · 12 · 16 · 20 · 24 · 32 · 40 | 行内 6/8；块内 10/12；面板 padding 16/20；模块间 24/32 |
| Radius | 4（tag）· 6（chip/按钮）· 8（菜单项）· 10（面板/卡片）· 12（composer）· 999（pill） | — |
| Elevation | e0 none · e1 `0 1px 2px rgba(29,27,22,.06)` · e2 `0 10px 30px rgba(29,27,22,.10), 0 2px 8px rgba(29,27,22,.04)` · e3 `0 24px 64px rgba(29,27,22,.18)` | e2 = composer；e3 = 抽屉/浮窗 |
| Scrim | `rgba(29,27,22,.28)`（dark `.45`） | 抽屉/浮窗遮罩 |
| Z-index | base 0 · sticky 5 · tray 20 · dock 30 · drawer 40 · overlay 60 · toast 80 · menu 100 | 插件自有诊断保留 9999 |
| Motion | 120（hover）· 180（展开）· 240（面板）· 320（抽屉）ms，`cubic-bezier(.2,0,0,1)` | reduced-motion → 0ms |
| 尺寸 | 侧栏 240 / 折叠 56；右 Dock 默认 360（min 280 / max 560，最多 2 水平窗格 + 浮窗）；composer 最大 945；hero 卡 427×auto；状态点 8px；图标 16px（stroke 1.5） | — |

## 3. F01–F14 组件规格

> 每项：anatomy → 尺寸 → 状态（default/hover/active/empty/loading/error）→ token → 锚点。
> 视频时间码见 `02-video-feature-inventory.md`。

### F01 会话侧栏（24–36s）
- Anatomy：品牌行（logo 28 + 名称）→ 新建会话（32px 扁平行）→ 导航（插件/自动化任务/更多）→ 工作区分组（标题 + 折叠箭头 + 搜索/新建图标）→ 会话行（状态点 8 + 标题 + 时间 + hover 动作）→ Pinned 区 → 底部账户行（头像 20 + 名称 + 余额）。
- 尺寸：宽 240；行高 28（导航）/ 30（会话）；分组标题 24；水平 padding 12。
- 状态：hover `interactive-bg-hover` + 行尾 3 个 20px 图标；active 暖沙底 + 左侧 2px 陶土轨；empty 工作区显示「暂无会话 + 新建」；loading 骨架条 `--dsw-alias-bg-skeleton`；error 分组行内一行「加载失败 · 重试」。
- Token：`--dsw-specific-sidebar-fill`、`--dsw-specific-sidebar-nav-item-active`、`--dsw-alias-label-primary/secondary`、状态点三色。
- 锚点：`sidebar.workspaces.session.menu.item`、`sidebar.session.row.leading/hover`、`sidebar.workspaces.session.row.action`、`[role=treeitem][data-row-key^="session:"]`、`[data-sidebar-collapsed]`。

### F02 多会话（D2=A+B，15–18s/31–36s）
- 会话标签条（主列顶部，28px）：当前会话 + 其他打开会话；切换、关闭（× hover 才显示）；超宽滚动。
- 右栏聊天标签（D2=B）：右 Dock 里的 `sidechat` 类型 Tab，内含另一会话聊天。
- 状态：active 底 `bg-layer-2` + 下边框 accent 2px；hover `interactive-bg-hover`；空态「还没有打开的会话」；loading 标签骨架；error Tab 内显示「会话不可用 · 重新打开」。
- 明确不做：主列左右并排（宿主 main 是单 keyed 槽，F02 视频效果用 A+B 降级交付）。

### F03 右栏 Dock / 布局（10–11s/82–94s）
- Anatomy：tab strip（30px，tab 最小 96、最大 180，含图标 + 标题 + ×）→ pane body → 分屏（2 窗格）→ 浮动窗（可拖动/缩放）→ 全屏按钮。
- 尺寸：默认 360；拖拽把手 6px；tab 圆角 8；pane 间距 6；浮窗最小 320×240。
- 状态：拖拽命中 `drop-active` 时 `interactive-bg-hover-accent` 2px 虚线；无 tab 时空态 = 图标 + 「从会话头 ⊞+ 打开面板」；窗口过窄（< 280）退化为图标 rail。
- 锚点：`data-sidebar-right-*` 11 个、`data-dockkit-*`、`sidebar.right.pane.tab(.title)`。

### F04 面板菜单（36–44s）
- 会话头右侧「⊞+」按钮 28×28，圆角 8；菜单宽 220、项高 32、图标 16 + 名称 + 右侧快捷键 caption；分隔线 `border-l1`。
- 5 项：Preview（⌘⇧B）/ Diff（⌘⇧G）/ Terminal（宿主 `terminal.new`）/ Tasks / Plan。
- 状态：hover `interactive-bg-hover`；disabled（如无 git 仓库的 Diff）40% 透明 + tooltip 说明；空态/失败 = 打开面板后由面板自身显示。
- 锚点：`conversation.session.header.actions` 槽、`ctx.sidebarRight.openTab`、`ctx.sidebarRightTabs.register`。

### F05 终端（37–44s）
- 宿主原生终端 Tab 复用；Dock 只做外框皮肤（tab strip / 边框 / 圆角 / 焦点环）。尺寸/状态沿用宿主；空态「新建终端」按钮。**不自绘终端**。

### F06 Diff / git-review（45–65s）
- Anatomy：scope 选择器（Working tree / 分支 / 提交）→ 文件列表（行高 28，+/− 数字右对齐，选中暖沙底 + 2px 陶土轨）→ diff 主体（行号 gutter 40/44，hunk 头 `bg-layer-2`，新增/删除行底 + marker 3px）→ 工具栏（unified / side-by-side、换行、打开整文件、丢弃、复制路径）。
- 尺寸：文件列表 220 宽；行高 22；等宽 12.5；hunk 间距 8。
- 状态：hover 文件行 `interactive-bg-hover`；丢弃需二次确认（危险按钮 `state-error-primary`）；empty「工作树干净」；loading 首屏 8 行骨架；error 「git 不可用」+ 原因 + 重试（不静默）。
- 锚点：`data-disclosure-row`、`data-chat-call-id`、宿主 changes-review 范式；Host 路由 `ctx.subprocess.spawn`（M3）。

### F07 Preview + 元素选择（65–82s）
- Anatomy：URL 栏（36px，含刷新/外部打开/选择元素开关）→ iframe 区 → 元素选择：hover 高亮框（accent 2px + 4px 遮罩）、点击弹卡（选择器 / 尺寸 / display·position·flex / 文本片段）→「让 Claude 修改」。
- 状态：加载中细进度条 2px；加载失败 = 页面卡片「无法加载 + 原因 + 重试」；跨源 = 「仅预览，不支持元素选择」明确说明；开关默认关。
- 降级：仅同源自渲染 + postMessage 桥接；坐标级 P3 只做悬停提示，不宣称元素级。

### F08 Side Chat（96–115s）
- 右 Dock Tab（默认 360 宽）：标题「Side Chat」+ 说明「独立上下文，不打断主对话」；消息区 + composer；顶栏含「结束」按钮 + 模型/成本提示。
- 快捷键：`Mod+;`（Web `Mod+Alt+;`），注册前用 `ctx.shortcuts.describeBinding` 检测。
- 状态：流式中「停止」按钮；空态一句提示 + 3 个示例问题（非伪造，是提示）；错误可重试；关闭二次确认「将结束本次 Side Chat（归档，不删除）」；成本开关关闭时不显示入口。
- 锚点：`sessions.create` + `retain` + `remote.session.prompt`/composer 代发、`archiveSession(id,{stopActivity})`、私有子槽 + SessionProvider + `conversation.content` embedded。

### F09 Dashboard（116–131s）
- Anatomy：问候（Display 34 宋体，真实用户名，失败用「你好」）→ 副标题「开始一个新会话」→ Overview/Models Tab（32px seg control）→ 范围切换 All/30d/7d（右侧，pill 28）→ KPI 网格（4×2，卡高 72）→ 热力图（26 周 × 7 行，格 10×10，间距 3）→ Models 视图（每日堆叠柱 + 图例 in/out/占比）→ 页脚一句「你比《动物庄园》多用了 ~N 倍 token」。
- 尺寸：面板最大 960；KPI 卡片圆角 10、padding 12/14；数字 20 宋体 tabular；标签 11 caption。
- 状态：loading 骨架（KPI 8 块 + 热力图整块 skeleton）；empty「还没有用量数据」+ 开始会话按钮；error 卡片内错误 + 重试；数据口径必须有 tooltip（消息数=user+assistant 等）。
- Token：`bg-layer-1` 卡底、`border-l1`、热力图 5 档绿（`--dsw-static-green-*`），不伪造数字。

### F10 Pane Header（会话头）
- 高 40；左：项目/会话标题（宋体 14/600，长标题省略号 + tooltip）；中：状态（running 点/耗时 caption）；右动作：⊞+（28×28）、更多 ⋯（24×24）、折叠右栏（24）。hover 图标底 `interactive-bg-hover`。

### F11 Composer（45s/74s 等）
- Anatomy：卡片（圆角 12，e2 阴影，1px `border-l2`）→ chips 行（Local · 项目 · 分支，高 22，圆角 6）→ 输入区（14/1.55）→ 底行：+ 附件（28）、Accept edits（chip）、模型 chip、语音、发送（32 圆形 accent）。
- 状态：聚焦 `border-l3` + focus ring；拖入文件时虚线 accent；超长输入滚动；发送中按钮变停止（20px square 2.5 圆角）。保留现有 HUD / 语音 / 滑条不动。
- Token：`--dsw-specific-input-major`、`--dsw-alias-border-l2`、SHELL.composerShadow。

### F12 状态点（侧栏行）
- 8px 圆点；idle `state-idle-primary`；busy：accent 2px 圆环 800ms 线性旋转（reduced-motion → 静态半环）；waiting：`state-warn-primary` 实心 + 1.4s 呼吸（opacity 1→.55）。不误报：只读 bridge 真实状态。

### F13 视觉（全站）
- 遵循 §1/§2；深浅两套；无硬编码颜色（见 §2 表）；圆角/阴影/间距只用档位；图标 16px 1.5 描边；焦点环必须可见（键盘用户）。

### F14 仅入口项（Routines / Customize / More / Tasks / Plan / Create PR / Accept edits）
- 统一「入口 + 最小真实行为 + 空态说明」。宿主有原生能力就跳宿主（Tasks/Plan/插件页/设置）；没有则菜单项 + 说明 + 禁用原因；Create PR 只复制 `git push` 命令或打开 GitHub compare，不代替用户提交。

## 4. 与视频的刻意偏差（需在 README/设置页声明）

1. **暖色皮肤**：视频冷白+蓝 → D1=A 暖米色+陶土橙（结构/密度不变）。
2. **多会话不做主列同屏**：宿主 main 单 keyed；用 D2-A 会话标签 + D2-B 右栏聊天标签交付。
3. **整页拖拽不实现**：只在右 Dock 内拖拽/分屏/浮动；右栏最多 2 水平窗格 + 浮窗。
4. **Tasks / Plan / Routines / Customize**：用宿主原生页面，不自绘内容（不伪造）。
5. **Preview 元素选择**：默认仅同源 + 桥接；跨源明确「不支持」，不宣称元素级。
6. **无 URL 深链**：工作台布局状态存 localStorage，刷新回默认布局。

## 5. M1 实现映射（组件 → part/新文件 → 锚点 → token）

| 组件 | M1 步骤 | 目标 part / 新文件 | 依赖锚点（docs/ANCHORS.zh.md） | 主要 token |
|---|---|---|---|---|
| F01 侧栏皮肤 | M1-S1 | `04-shell-css.js` 扩展 + 新 `18-shell-sidebar.js` | `[data-row-key^="session:"]`、`[role=treeitem]`、`[data-sidebar-collapsed]`、sidebar 4 槽 | sidebar-fill / nav-item-active / label-* |
| F10 Pane Header + F04 菜单 | M1-S2 | 新 `19-pane-header-menu.js` | `conversation.session.header.actions`、`ctx.sidebarRight.openTab`、`ctx.sidebarRightTabs.register` | bg-layer-1/2、border-l1、brand-primary |
| F03 右栏 Dock 皮肤 | M1-S3 | 新 `20-dock-skin.js` | `data-sidebar-right-*`、`data-dockkit-*`、`sidebar.right.pane.tab(.title)` | bg-layer-1、border-l2、radius 10 |
| F11 Composer + F12 状态点 | M1-S4 | 新 `21-composer-shell.js`（HUD/语音/滑条保持） | `[data-lexical-editor]`、composer 卡片、`[data-slot="settings.launcher"]` | input-major、composerShadow、state-* |
| F09 首页骨架 + F02 标签条 | M1-S5 / M6-S1 | 新 `22-home-shell.js`、`23-session-tabs.js` | `[data-conversation-scroll]`、`[data-content-phase]`、`[data-conversation-region]` | bg-base、serif display、focus-ring |
| F06 Diff 面板 | M3-S2 | 新 `24-git-review.js` + Host 路由 | `data-disclosure-row`、`data-chat-call-id`、`ctx.subprocess.spawn` | file-diff-added/deleted、shiki-* |
| F07 Preview | M4-S1..S4 | 新 `25-preview.js` | `sidebarRightTabs`、`openTab('browser',{params})` | bg-layer-1、focus-ring |
| F08 Side Chat | M5-S1..S3 | 新 `26-sidechat.js` | 私有子槽 + SessionProvider、`sessions.*`、`Mod+;` | bg-overlay、border-l1、brand-primary |
| F09 Dashboard 组件 | M2-S2 | 新 `27-dashboard.js` | hero 槽 / main keyed（plugin-manager 范式） | 绿阶、bg-layer-1、serif KPI |

## 6. 验收（视觉基线）

- 与 `refs/` 并排：`4.0-plan/design/compare-refs.png`（F01/F04/F06/F09 四组）。
- 6 张标注稿：`4.0-plan/design/{workspace-sidebar,panel-menu-dock,diff,preview,sidechat,dashboard}.png`。
- M1 起逐组件按本文 §3 的状态矩阵截图对照；`prefers-reduced-motion` 与深色各一轮。
- 本文不含实现代码；`client.js` / `index.js` 本步未改动（`npm run check` 仍绿）。

## 7. 待用户拍板的视觉问题（≤5）

1. **正文衬线范围**：目前只把宋体用于标题/KPI/pane 标题，正文保持无衬线（保密度）。是否要正文也切宋体（更“书房感”，但长文阅读密度下降）？
2. **Diff 默认布局**：默认 unified 还是 side-by-side？（视频接近 side-by-side；窄面板 side-by-side 会比较挤）
3. **右侧 Dock 默认宽度与开合**：360px、默认关闭（推荐）还是 400px、默认保留上次 Tab？
4. **状态色橙/绿边界**：waiting 用 warn 琥珀、busy 用 accent 橙；两者同屏可能难分。是否把 busy 改中性灰环、只让 waiting 用橙？
5. **Dashboard 数据口径文案**：KPI「Messages」= user+assistant 合计（推荐），token 统计含 cache miss+hit 分开显示还是合并？需要你定口径（决定 tooltip 与图例）。

## 8. 拍板结论（2026-10-26，Lead）

1. **正文衬线**：保持现方案——正文无衬线；宋体只用于 Display / Pane 标题 / KPI 数字 / hero。
2. **Diff 默认**：unified；右栏宽度 ≥900px 或全屏时自动 side-by-side，允许每 tab 手动切换并记住。
3. **右栏 Dock**：默认 360px、默认关闭；布局持久化交给宿主（`dsh.sidebar-right.v1.<sessionId>`），插件不覆盖；不额外造「记住上次 Tab」状态。
4. **状态色**：不改——busy 陶土橙旋转弧、waiting 琥珀实心点、idle 灰点；靠形状/动效区分，带 `aria-label`/tooltip。
5. **Dashboard**：Messages = user+assistant；Total tokens = input+output；cache hit/miss 放 tooltip/次级明细，不并入主 KPI；Models 图例用 in/out。
