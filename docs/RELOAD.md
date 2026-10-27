# 重载与验证流程（M0-S3 实测）

> 结论先行：**HMR 可用**。改 `src/client/parts/*.js` → `npm run build` → **≤10s** 页面自动重载并重新挂载插件，无需重启 DSH。
> M0-S2 曾记录「client.js 不热更新」——那是**误判**（探针 overlay 180s 自动移除 + 截图时机 + 窗口被前置视频遮挡），本步用可见 badge 复测并纠正（见 `4.0-plan/shots/M0-S3-reload-hmr.png`、`4.0-plan/PROGRESS.md`）。

## 1. 主流程（60s 内可验证）

1. 改 `src/client/parts/*.js`（不要手改 `client.js`，它是构建产物）。
2. `npm run build`（或直接 `npm run check`）。
3. 等待 1–8 秒。机制：宿主 `client-hmr` 每 **500ms** stat 一次产物（mtime/ctime/size），变化即 `clientModules.rebuilt(id)` → `/plugins/events` SSE 推 `rebuilt` → 页面 `modules.entries.reload(id, rev)` → 插件旧实例 dispose、新实例 `apply`（epoch guard 保证不双挂）。
4. 验证：
   - 视觉：截图对比（Windows 可用本仓库 `scripts/capture-window.ps1`，`PrintWindow + PW_RENDERFULLCONTENT`，能截被遮挡的 Electron 窗口）；
   - 行为：DevTools console（Ctrl+Shift+I / Ctrl+Shift+J）——Electron 桌面端可用；
   - 自检函数：`__dshClaudeThemeFontDebug()` 等（禁用插件后应消失）。
5. 记录：改了哪个 part、build 输出、截图、观察到的差异。

## 2. 实测记录

| 时间 | 方式 | 结果 | 证据 |
|---|---|---|---|
| 2026-10-25 22:07:04.906Z | 直接给 `client.js` 插入临时 badge（未 build） | ✅ HMR 生效，badge 在保存后 <10s 出现 | `4.0-plan/shots/M0-S3-reload-hmr.png` |
| 2026-10-25 22:13:25（build）→ 22:13:26.559Z（badge） | **源码 → build → HMR**（临时 part 注入 badge，`npm run build` 后观察） | ✅ build 后 ~1.5s 新实例生效；删除临时 part 重建后 client.js sha 回到基线 | `4.0-plan/shots/M0-S3-build-hmr.png`、`M0-S3-restored.png` |

> 60s 预算：HMR 轮询 500ms + 模块 eval，实测远小于 60s；超时再走备用路径。

## 3. 备用路径（按代价从低到高）

| 路径 | 做法 | 适用 |
|---|---|---|
| A. HMR（首选） | 保存 + `npm run build`，等自动重载 | 日常开发，实测通过 |
| B. 渲染器重载 | 聚焦窗口后 `Ctrl+R` | 只在宿主 graph rev 已更新时有用；单独用不会重建 bundle |
| C. 禁用/启用插件 | 插件页关闭再打开（或管理 API `plugin_manager set_plugin`） | HMR 不可用/需要干净重挂载时 |
| D. 重启 DSH Desktop | 退出并重开应用 | 最终手段；**会结束当前会话**（会话日志持久化，重启后可继续），不要在有未保存工作的会话里随手用 |

## 4. 排错

- **完全没变化**：先确认 `npm run build` 真的改了 `client.js`（`npm run build -- --check`、看 mtime/size）；确认改的是 `src/client/parts/*`，不是旧的手写 `client.js`。
- **只变一半/双份 UI**：旧实例未 dispose。检查 `window.__DSH_CLAUDE_THEME_DISPOSE__`、`__DSH_CLAUDE_THEME_EPOCH__`；必要时走路径 C 干净重挂载。
- **HMR 一直不触发**：该 profile 可能没装 `client-hmr`（检查宿主 profile 组合）；改用 C/D。
- **截图黑屏或拍到别的窗口**：`CopyFromScreen` 受窗口遮挡影响；用 `scripts/capture-window.ps1`（PrintWindow）而不是屏幕抓图。
- **改了 Host 半部**（`index.js`）：**不**走 HMR，必须重启 DSH（Host 进程）。

## 5. 与验收的关系

本步的“行为零变化”由**字节等价**保证（拆分前后 sha256 相同，见 `docs/BUILD.zh.md`），HMR 只用于把新产物挂到运行时做一次真实冒烟；后续功能步骤再依赖 HMR 的 60s 迭代环。
## 字体路由与重启（M0-S6）

- `index.js` 新增字体资产路由 `GET|HEAD /api/dsh-claude-code-desktop-theme/font`：**Host 半部不走 HMR，必须重启 DSH 一次**后才可用。
- 重启前：client 的 `fetch` 收到 404 → 自动回退系统宋体栈，`<html data-dsh-font="fallback">`，页面正常渲染（实机截图 `shots/M0-S6-fallback.png`）。
- 重启后验证：`__dshClaudeThemeFontDebug()` 应显示 `source: 'external'`、`faceStatus: 'loaded'`；`document.documentElement.dataset.dshFont === 'external'`；首屏视觉与 `shots/M0-S5-final-ui.png` 一致（宋体为用户已确认的 display 字体）。
- **本步实测异常（需重启后复核）**：`client.js` 从 3.90 MB 缩到 0.39 MB 后，本机 HMR 没有自动重载（Ctrl+R 渲染器重载可加载新产物，已借此完成 fallback 验证）；M0-S3 的「HMR ≤2s」结论需重启后再确认一次，暂不修改其结论。

### 重启后复测：HMR 恢复正常（2026-10-27 12:5x）

- 第 3 次重启（进程 12:51:48，加载修复后的 `index.js`）后，HMR 恢复正常：
  - 改动 part（探针标记 v3 → v4）→ `npm run build` → **2s 内自动重载**，页面 `epoch` 从 2 变 3，无需 Ctrl+R。
  - 结论：`build → HMR ≤2s` 在整机重启后的干净状态下成立（与 M0-S3 一致）。
- 之前「HMR 不自动」的现象只出现在两类操作之后：① `client.js` 从 3.9MB 缩到 0.39MB 的瞬间；② `plugin_manager` disable→enable。两者都会让页面/网桥持有旧修订；整机重启是可靠恢复方式。
- 补充：本机 Electron 主窗口上 SendKeys `Ctrl+R` 不一定会触发重绘（本次两次未生效）；排查时以 HMR / 整机重启为准。探针留下的 orphan DOM 需 cleanup part 或整机重启清除（HMR 只重挂插件，不重置 DOM）。
- 回退路径仍有效：Host 路由不可用时 `data-dsh-font=fallback`，系统宋体栈正常渲染（`shots/M0-S6-fallback.png`）。

### Host 半部热加载边界（2026-10-27 实测）

- `dsh-hmr` / `client-hmr` 只覆盖浏览器产物：**改 `index.js` 必须整机重启 DSH**，HMR 不会重载 Host 模块。
- `plugin_manager set_plugin(include:claude-code-desktop-theme, enabled:false→true)` 会立即应用（返回 `application: applied`），但 Node 的 ESM 模块缓存按 URL 命中旧模块：**Host 代码改动不会被这项操作带进来**。实测重新启用后 `GET /font` 仍是旧行为（HTTP 400），证明缓存未失效。
- 结论：Host 修复的验证路径 = 重启 DSH（退出并重开）；不要在「disable/enable」后宣称 Host 改动已生效。

### 浏览器 bundle 缓存（2026-10-27 实测）

- 用 `plugin_manager` 对插件做 disable→enable 后，即使 Ctrl+R 重载渲染器，页面仍加载**旧的 client bundle**（磁盘上的新产物未被使用）；HMR 也未自动重载。
- 因此 Host 改动验证不要依赖「禁用启用 + Ctrl+R」；可靠路径 = 整机重启 DSH（同时刷新 Host 模块与浏览器模块）。
- 排除方法：重启后确认 `client.js` 的 sha256 与磁盘一致（可用 `__dshClaudeThemeRuntime()` / `__dshClaudeThemeAnchors()` 是否存在临时探针判断）。

### Connection exact route 契约（2026-10-27 发现）

- `connection.fetch.register({ path, methods, fetch })` 必须同时声明 `requestBody: 'buffered' | 'streaming'`。
- 缺省时 Connection 网桥按 `"streaming"` 处理并构造带 web-stream body 的 `Request`；**GET/HEAD 不允许带 body**，于是网桥在进入 handler 前抛错 → 客户端看到 **HTTP 400**（无 content-type / content-length），与「路由不存在」的 404 不同，容易误判。
- 正确写法：GET/HEAD 路由也声明 `requestBody: 'buffered'`（空 body），例如字体路由。
