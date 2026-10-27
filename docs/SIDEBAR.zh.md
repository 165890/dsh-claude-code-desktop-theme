# 会话侧栏（M1-S1）

> 2026-10-27 · 宿主 DSH Desktop 0.2.1-rc.3 · 源码 `src/client/parts/18-shell-sidebar.js`
> 原则：只做皮肤。不改宿主列宽（264–420，默认 280）、不改排序/分组、不替换 `sidebar.workspaces`、不新增 body observer、不伪造数据。

## 1. 宿主侧栏实测盘点（探针，2026-10-27，展开 280px）

| 区块 | 真实 DOM（模块键）/ 槽 | 实测尺寸 | 结论 |
|---|---|---|---|
| 根 | `div._root._quietBars` | 280×782 | 底色 `--dsw-specific-sidebar-fill`（#f5f3ee），未改宽度 |
| 品牌行 | `div._logoRow` → `button._brand._wide`（`span._brandMark` / `span._brandName`） | 40 高（brand 24） | 已样式化；brand 按钮 aria-label 为「新建会话」 |
| 收起/展开 | `button[aria-label=收起侧边栏]`（`svg._panelIcon`）；折叠后 `button[aria-label=打开侧边栏]` | 24 | 已样式化；折叠态宿主**隐藏整列**（无 56px rail），见 §3 |
| 新会话 | `button._newSession` → `span._newSessionLabelMask/_Content/_Label/_Shortcut` | 32 高 | 32px 扁平行（含 `ctrl+N` 快捷键 caption） |
| 导航 | `nav._panelList` → `button._panelRow[aria-label=插件/自动化任务/更多]`（`span._panelGlyph/_panelTitle`） | 行 36 → 28 | 3 个宿主真实入口；未新增 Routines/Customize |
| 工作区分组头 | `div._sectionHeader`（`span._sectionLabel`、`button._searchButton`、`div._searchSlot/_search/_searchInput`、`div._headerActions`、添加工作区按钮） | 36 高 | 搜索/添加均为宿主原生；已样式化 |
| 工作区行 | `div._projectRow[role=treeitem][data-row-key=workspace:…]` → `svg._arrow` + `span._title` + `span._rowActions` | 34 → 26 | 折叠箭头与行操作宿主自带 |
| 会话行 | `div._sessionRow[role=treeitem][data-row-key=session:…][aria-selected]` → 原生 busy `svg.spinner` 或 `[data-slot=sidebar.session.row.leading]` + `span._title` + `span._rowActions` + `[data-slot=sidebar.workspaces.session.row.action]` + 归档/置顶按钮 | 32 → 30 | 状态点/徽标沿用 M0（8px + 原有 busy 弧） |
| 列表 | `div._listArea` → `div._list[role=tree][aria-label=会话]` → `div._groupSection` | 464 高 | 未改结构 |
| 底部 | `div._footerActions`（0 高）+ `div._settingsArea`（52）→ `[data-slot=sidebar.settings]`；账户按钮 `[data-slot="settings.launcher"] button` + `.dsh-sidebar-footer-balance` | 52 → 44 | 余额仍由 M0-S4 的余额模块维护 |
| Pinned | 宿主原生：置顶会话在两种视图里**排在同组最前**；行操作里有 `button[aria-label=置顶会话]`；**无独立 Pinned 标题、无 `data-pinned` 标记** | — | 只样式化行与按钮，不自建分区/不克隆/不加伪标记 |
| 折叠属性 | `div._frame[data-sidebar-collapsed="true"]`（不在侧栏根上） | — | 选择器已按 frame 处理 |

已用槽（未新增、未重复注册动作）：`[data-slot=sidebar.workspaces]`、`[data-slot=sidebar.settings]`、`[data-slot=sidebar.session.row.leading]`、`[data-slot=sidebar.workspaces.session.row.action]`、`[data-slot=sidebar.panellist]`。

## 2. 皮肤实现

- 新增 `18-shell-sidebar.js`：`SIDEBAR_CSS`（独立 `<style data-plugin-css="…/sidebar.css">`，在 SHELL_CSS 之后注入、随实例 dispose 移除）+ `sidebarDebugState()`（`__dshClaudeThemeSidebarDebug()`：列宽/折叠/行数/选中/行高/置顶标记数）。
- 改用 token：`--dsw-alias-bg-layer-1/2/3`、`--dsw-alias-interactive-bg-*`、`--dsw-alias-border-l1/l2`、`--dsw-alias-label-primary/secondary/tertiary/caption`、`--dsw-specific-sidebar-nav-item-active`、`--dsh-font-family-text`。
- 尺寸：品牌行 36 / brand 24 / 新会话 32 / 导航行 28 / 分组头 28 / 工作区行 26 / 会话行 30 / 状态点 8px / 账户区 44；圆角 6–8；hover 120ms；`prefers-reduced-motion` 关闭过渡。
- 不改的内容：列宽、排序、分组、拖拽、宿主行菜单、Pin/归档/重命名动作、搜索逻辑。

## 3. 与设计稿的差异（如实记录）

1. **折叠态不是 56px rail**：宿主折叠时整列隐藏，只留左上角「打开侧边栏」按钮（实测截图 `shots/M1-S1-collapsed.png`）。插件未造 rail，只样式化该按钮；设计稿的 56px rail 在宿主上不存在。
2. **Pinned 无独立标题**：宿主用「置顶行排最前」表达，没有 Pinned 分区标题与 `data-pinned`；插件只样式化行与原生「置顶会话」按钮。要做置顶态截图需要一个真实置顶会话（本步环境未置顶任何会话）。
3. **深色验证是部分验证**：`__dshClaudeThemeSidebarDebug`/截图使用 `body[data-ds-dark-theme]` 模拟；宿主 alias token 会切换（截图里卡片/composer 已变暗），但侧栏底色是宿主 `--dsw-specific-sidebar-fill`（只随宿主主题服务切换），模拟下仍为浅色。真实深色一轮需在设置里切主题，留待 G1 视觉核对。
4. 宿主空态/加载/错误样式由宿主渲染；本步只做通用占位/骨架/错误色的兜底选择器，未构造假数据验证。

## 4. 验证

- `npm run check`：全绿（build --check 20 parts / 429,465 B / sha256 `e9c6c4f2…`、pricing 36、smoke 50）。
- HMR：新增可见标记 part → build → **≤2s 自动重载**（截图 `shots/M1-S1-hmr.png`，标记出现）；移除标记后重建，`client.js` 回到 `e9c6c4f2…`。
- 截图：`M1-S1-expanded.png`（展开：品牌/新会话/导航/分组/会话行/状态点/账户行）、`M1-S1-hover.png`（hover 行 + 宿主 hover 卡 + 行尾动作）、`M1-S1-collapsed.png`（折叠=隐藏列 + 重开按钮）、`M1-S1-dark.png`（部分深色，见 §3.3）。
- 回归：状态点/HUD/语音/滑条/diff 仍由 M0 的调度器与模块维护，本步无改动；截图未见回归。
