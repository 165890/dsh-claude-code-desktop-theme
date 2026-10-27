# 面板菜单 + 会话头（M1-S2）

> 2026-10-27 · 源码 `src/client/parts/19-pane-header-menu.js` · 计划 F04（面板菜单）/ F10（Pane header）
> 原则：只改本插件；会话头结构不动，按钮只通过官方 `conversation.session.header.actions` 槽挂载；不新增 body observer；不伪造可用项。

## 1. 会话头实测结构（宿主 `dsh-client-ui-conversation`）

- `div._titleRow` > `div._titleCluster`（`nav._crumbs` > `span._crumbSeg` > `span._crumb._crumbCurrent` 当前标题；`div._headerActions` ← **官方槽**）> `div._headerUtilities`（`conversation.session.header.utilities`）> `div._headerCorner[data-conversation-header-corner]`
- 下方 `div._tabs` > `div._viewTabs[data-conversation-tabs]` > `button._tab/_tabActive`
- 槽 `conversation.session.header.actions`：`kind=list`、`scope=session`；宿主已占 4 席（agent-team -20、agent-preset -10、subagent-catalog 10、job-list 20）

## 2. 已实现

- **注册**：`paneHeaderMenuPlugin`（装配层用 `paneHeaderMenuPlugin.apply(ctx)` 应用，与已知可用的 usage-card 同路径），在 `ctx.slots.inject('conversation.session.header.actions', ...)` 回调里 `ctx.slots.register({ name, id:'dsh-theme-panel-menu', order:30, label }, PanelMenuSeat)`。
- **按钮**：28×28「⊞+」`aria-label="面板菜单"`、`aria-haspopup="menu"`、`aria-expanded`，F10 规格，hover/active/focus-visible 完整。
- **Popover**：220px 宽、项高 32、图标 16 + 名称 + 快捷键 caption、`role="menu"`、`role="menuitem"`，Terminal 前有分隔线；深浅 token 成对；disabled 40% 透明 + 自定义 tooltip（`:focus-visible` 也显示，可截图）。
- **键盘/焦点**：ArrowUp/Down 循环、Home/End、Enter/Space 执行、Esc 关闭并把焦点还给触发按钮；点击外部关闭；Tab 关闭。快捷键仅 caption 占位（⌘⇧B / ⌘⇧G / ⌘J），**未绑定**（避免与宿主冲突）。
- **会话头皮肤（F10）**：`_titleRow` 40 高、标题 14/600 等宽省略（`_crumbCurrent` max-width 380 + ellipsis）、动作区 28/24、tab 行 28；长标题由 `runtimeOnMutation('pane-header-title')` 同步 `title=` 属性（不新增 observer）。

## 3. 宿主能力接线（以实测/源码为准）

| 项 | 状态 | 行为 |
|---|---|---|
| Preview | 可用（desktop profile） | `sidebarRight.openTab('browser')` → 宿主浏览器面板（无 URL 时宿主自己显示 guide/空态） |
| Terminal | 可用 | `sidebarRight.openTab('terminal')` → 宿主真实终端 tab（宿主注册 `kind:"terminal"`，无 guide 依赖） |
| Tasks | 可用 | `layout.selectPanel('schedules')` → 宿主「自动化任务」原生页面（`sidebar.panellist` id=`schedules`） |
| Diff | **disabled** | tooltip「M3 接入 Git Diff」；不打开任何假面板 |
| Plan | **disabled** | 宿主 `kind:"plan"` tab 只在计划资源地址（`dsh-resource://plan/**`）下可开，本菜单无法凭空构造 → tooltip「Plan 需在宿主计划卡片上下文打开」 |

- 可用性按 `sidebarRightTabs.get(kind) !== undefined`、`layout.selectPanel` 存在性、宿主「自动化任务」入口存在性判定；服务在渲染/点击时惰性读取，不 import 宿主内部实现。
- 禁用项不 console 报错、不写假数据；点击禁用项无动作。

## 4. 验证状态（重要，如实记录）

- `npm run check`：全绿（build --check 21 parts / 449,730 B / sha256 `6866769a…`、pricing 36、smoke 50）；`node --check client.js` 通过。
- **live 交互验证未完成**：本次执行中 renderer 的 HMR 在多次构建后失效（一次临时探针语法错误导致 bundle 无法解析，之后热重载不再应用）；修复后通过杀 renderer 恢复了页面，但**已挂载的会话头不会接收热注册的槽条目**——`conversation.session.header.actions` 里能看到我们的注册（Inspect：`dsh-theme-panel-menu`，order 30），DOM 中却未渲染（`active:false`）。宿主自己的槽条目在启动时注册、正常渲染；本插件是启动后热注册，属“热注册晚于 header 挂载”的边界。结论：需要**完整重启 DSH** 后按 F04 重新验证（菜单开合/键盘/Preview/Terminal/disabled tooltip 截图）。
- 已保存：`shots/M1-S2-header-skin.png`（会话头皮肤+槽容器现状）。
- 根因候选（待重启复核）：① 启动时注册即正常（最可能） ② 若重启后仍不渲染，则需改为 `ctx.inject([...])` 内注册或补 `store` 绑定。

## 5. 与计划的差异

- Plan 保持 disabled（宿主无独立 Plan 面板，tab 需 plan resource）；Diff 保持 disabled 到 M3。
- Tasks 映射到宿主「自动化任务」页面（宿主没有通用 jobs tab；`scheduleTask` tab 需具体任务 id）。
- 快捷键只显示 caption、不绑定，等待后续统一快捷键层。