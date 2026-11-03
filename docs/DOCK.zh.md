# 右栏 Dock 皮肤（M1-S3）

> 源码 `src/client/parts/20-dock-skin.js` · 计划 F03
> 原则：只做皮肤。不调用 `split` / `float` / `dock`，不改列宽，不替换 `sidebar.right.pane.tab` 正文，不伪造空态文案，不新增 body observer。

## 1. 宿主锚点（不依赖 CSS Module 哈希）

右栏由 `ui-sidebar-right` 把 `DockLayout` 画进会话列。稳定钩子：

| 区块 | 属性 | 皮肤做什么 |
|---|---|---|
| 面板根 | `[data-sidebar-right-session]`、`data-sidebar-right-panel=push\|fullscreen`、`data-sidebar-right-open` | 暖底 + 宋体。不写 `width` / `transform`（滑入动画在宿主上） |
| 表面 | `[data-dockkit-surface]` | 底色 `--dsw-alias-bg-base` |
| 窗格 | `[data-dockkit-host="dock"] > [data-dockkit-pane]`、`[data-dockkit-pane-active]` | 层底 + 当前窗格左侧 2px 陶土轨 |
| 标签条 | `[data-dockkit-strip]`、`[data-dockkit-tab]`、`[aria-selected]`、`[data-dockkit-tab-quiet]` | 芯片 96–180×28、圆角 8、选中暖沙底 + 底边 2px accent。宿主 10px+28px 点击行不改 |
| 控件 | `[data-dockkit-add-tab]`、`[data-dockkit-split-button]`、`[data-dockkit-strip-chrome]`、`[data-sidebar-right-mode]`、`[data-sidebar-right-toggle]` | 圆角 6、hover、focus-visible |
| 分隔 | `[data-dockkit-divider]` | 只改发丝线与 hover 握把颜色。分隔条仍是 0px 宽、8px 热区 |
| 拖放 | `[data-dockkit-dock-zone][data-dockkit-drop-active]`、`[data-dockkit-dock-scrim]`、`[data-dockkit-caret]` | 命中区 2px 陶土虚线；未命中保持浅虚线 |
| 空窗格 | `[data-dockkit-empty] p` | 只改字色/字族。文案仍是宿主 `emptyPane` |
| 浮窗 | `[data-dockkit-float]`、`[data-dockkit-float-grip]`、`[data-dockkit-float-resize]` | 圆角 10、e3 阴影。不改 `left/top/width/height/overflow` |
| 标签菜单 | `[data-dockkit-tab-menu]` | 与会话头菜单同一套 overlay |

拖拽、分屏、浮动、缩放仍由 ui-dockkit 的 pointer 手势完成。

## 2. 与设计稿的差异

1. **列宽不改成 360。** 右栏宽度是宿主 frame 的 inline 宽度（可拖），插件不覆盖。
2. **窗格间距不改成 6px。** 宿主分隔条占 0 布局宽度，发丝线骑在缝上；加 gap 会打断这条缝。
3. **窄宽不造图标 rail。** 视口 &lt; 768 时宿主自己切 fullscreen，没有 &lt;280 的图标轨。
4. **空态不改写成「从会话头 ⊞+ 打开面板」。** 那句文案宿主没有；只样式化宿主自己的空段落。
5. **标签条总高保持宿主的 38px（上 10 + 芯片 28）。** 压成 30 会让分屏/全屏按钮离开同一中线。

## 3. 在 DSH 里验证

本仓库没有宿主窗口，下面需要在已 link 本插件的 Desktop profile 里做。

1. `npm run build`（或 `npm run check`）。client 半边 HMR 约 1–8 秒；若右栏是启动后才热挂上的样式，禁用再启用插件，或重启 DSH。
2. 打开一个会话。用会话头「面板菜单」开 Preview / Terminal，或点宿主的右栏展开按钮，确认右栏出现。
3. 看标签芯片、选中底边、分屏/全屏/收起按钮、面板底色是否与侧栏同一套暖色和宋体。
4. 拖标签到窗格边缘：出现虚线落区；松手后宿主完成分屏或浮动。再拖浮窗标题与右下角，确认仍能移动和缩放。
5. 右栏收起再展开，滑入动画还在（插件没有改 `transform`）。
6. DevTools 执行 `__dshClaudeThemeDockDebug()`。右栏打开时应看到 `open: true`、`tabs >= 1`；关掉右栏后 `open: false` 也正常。该函数只读。
7. 浅色 / 深色各看一轮；系统「减少动态效果」打开时，插件自己的过渡关掉，宿主滑入也应静止。
8. **PTC + 创造模式双窗口**（若本机就是这样开的）：两个渲染进程各自加载这份 client。在 PTC 窗口和创造模式窗口里都打开一次右栏，确认皮肤都在，且拖拽/分屏没有串到另一个窗口。插件不共享布局状态。

回归：侧栏（M1-S1）、会话头菜单（M1-S2）、HUD、语音、滑条、Diff 抽屉不经过这条样式表。composer 底部的 `[class*="_dock"]` 不是 `data-dockkit-*`，不会被这条规则命中。
