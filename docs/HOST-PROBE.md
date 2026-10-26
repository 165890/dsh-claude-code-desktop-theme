# 宿主能力探针报告（M0-S2）

> 日期：2026-10-25 · 宿主：DSH Desktop **0.2.1-rc.3**（profile `desktop`，插件以 symlink 装入）
> 结论：10 项中 **7 项 ✅ / 3 项 ⚠️（有替代方案） / 1 项 ❌（`ctx.subprocess.run` 不存在，已给替代）**；另发现 6 个需回写计划的问题（§4）。
> 本报告只读：未改宿主、未新建插件/包/profile 行；临时诊断块已回滚（§0.3），插件工作树干净。

## 0. 环境与取证条件

### 0.1 版本与安装形态

| 事实 | 值 / 证据 |
|---|---|
| 宿主版本 | `0.2.1-rc.3` — `.tmp-dsh/dsh/package.json:2,4`（app.asar 解包副本，与运行进程一致） |
| 解包副本可信度 | `dsh-subprocess`、`dsh-client-connection`、`dsh-client-ui-sidebar`、`dsh-web-frontend` 的 `package.json` 均为 `0.2.1-rc.3` |
| 运行 profile | `desktop` — 进程命令行 `…/dsh-desktop-host/lib/index.js  …\.dsh\profiles\desktop`（Win32_Process 实测） |
| 插件安装 | `~/.dsh/profiles/desktop/node_modules/dsh-claude-code-desktop-theme` → symlink 到工作区同名目录 |
| 客户端 dynamic 包约束 | 单文件、无 import/export、无 JSX（沿用 01 审计；本步未改） |

### 0.2 没有 `.d.ts`（重要约束）

`package.json` 仍声明 `types`，但解包产物 `lib/types/**` 只剩编译后 `.js`（全 305 包 `.d.ts` 数 = **0**）。因此：

- 插件**不能** `import type` 宿主契约；
- 本报告的类型/签名证据来自三类：① README；② 生成的 API 目录 `catalog`（`dsh-tool-cordis/lib/types/api-catalog.js`，自述由同批源码 AST 生成）；③ 运行时源码 `lib/*.js` 里的 TS 注释/ zod schema（如 `lib/typert.host.js`）。

### 0.3 临时诊断块实验（已回滚，结论影响所有后续步骤）

为补 live DOM/ctx 证据，本步曾把只读诊断块注入插件 `client.js`（锚点：`return { inject, apply }`，见附录 A），尝试三路取数：页面 HMR、手动 `Ctrl+R` 重载、窗口截图/剪贴板回收。

**实测结果（M0-S2 当时的判断）：三路均未让新代码生效** —— 注入后等待 >2 min 无 overlay，强制重载后仍无。随后执行 `git checkout -- client.js` 回滚。

> **2026-10-25 M0-S2 之后（M0-S3）复测更正：HMR 实际可用，约 1–2s 生效。** 当时是误判：探针 overlay 设了 180s 自动移除，而有效截图发生在移除之后；另有一次抓图命中了前置视频窗口。证据：`4.0-plan/shots/M0-S3-reload-hmr.png`、`M0-S3-build-hmr.png`，流程见 `dsh-claude-code-desktop-theme/docs/RELOAD.md`。

**更正后的机制**：宿主 `client-hmr` 每 500ms stat 产物（mtime/ctime/size，`dsh-client-hmr/lib/index.js:9-14,44-50`），变化即 `clientModules.rebuilt(id)` → `/plugins/events` SSE `rebuilt` → 页面 `modules.entries.reload(id, rev)`（`dsh-client-hmr/lib/client.js:262-266`）→ 插件旧实例 dispose、新实例 apply。**链接式插件的 client.js 改动会触发该链路。**

⇒ **给后续步骤的硬提醒**：HMR 可用，但**验证前先确认 reload 真的发生**（看产物 mtime/临时可见标记/console），再用截图判断功能；不要用会自动消失的临时 overlay 作为唯一证据。Host 半部（`index.js`）改动不走 HMR，必须重启宿主。本步的 live DOM 自检仍留给 M0-S4 的 `__dshClaudeThemeAnchors()`。

### 0.4 live Inspect 证据（本步可复跑）

通过 `cordis_inspect_query`（只读）在**当前运行实例**上直接读取：

- `client Slots.listSubTree`：确认 `main` = keyed/root（keyDomain 开放，已占用 `conversation`）、`sidebar.panellist` = list/root、`sidebar.workspaces.session.menu.item` / `sidebar.session.row.leading` / `sidebar.session.row.hover` = list/root（`replaceRisk: none`）、`shell.overlay` / `settings.section` 等拓扑；
- `client Service.listService`：`sessions` / `layout` / `uiWorkspace` / `workspaces` / `slots` / `theme` / `locale` / `timer` 的方法签名目录；
- `host Service.listService`：`subprocess`（4 个方法，**无 run**）、`connection`（`HostConnectionFetch.register`、`ConnectionFetchMethod = 'GET'|'HEAD'|'POST'`）。
- 注意：Client Service 目录**不含** `sidebarRight` / `sidebarRightTabs` / `shortcuts` / `connection` / `remote`（它们是插件间 seam 或内部 seam，见各项证据），不能据此判“不存在”。

### 0.5 证据简写

`B = .tmp-dsh/dsh/node_modules/@deepseek-ai`；`runner = B/dsh-cordis-client-runner/lib/client.js`（含 TS 原文与 Slot 目录）；`catalog = B/dsh-tool-cordis/lib/types/api-catalog.js`；
`R = B/dsh-client-ui-sidebar-right/lib/client.js`；`S = B/dsh-client-ui-sidebar/lib/client.js`；`W = B/dsh-client-ui-workspace/lib/client.js`；`C = B/dsh-client-ui-conversation/lib/client.js`；`L = B/dsh-client-ui-layout/lib/client.js`；`T = B/dsh-client-ui-tool/lib/client.js`；`F = B/dsh-web-frontend/dist/assets/index-BXV-oxvX.js`（shell 压缩包）。

## 1. 十项结论总表

| # | 项目 | 结论 | 一句话 |
|---|---|---|---|
| 1 | `openTab` 签名 / browser / terminal | **✅（含修正）** | 只有 1 个 `openTab(kind, options?)`；browser 仅 desktop profile 启用，terminal 两个 profile 都可用 |
| 2 | `sidebarRightTabs` 第三方注册 + body/title 槽 | **✅** | `ctx.reflect.provide("sidebarRightTabs")`，无权限门；body/title 是 keyed 槽 `sidebar.right.pane.tab` / `.tab.title` |
| 3 | `SessionProvider` + `sidebar.chat.conversation` 多实例 | **✅（有约束）** | SessionProvider 是渲染器注入 prop（非 import）；`single` 槽只允许 1 个占用者，但多个 Tab occurrence 可各自渲染 |
| 4 | sessions create/prompt/follow/清理 + `Cmd+;` | **✅ / ⚠️** | create/prompt/follow 齐全；**没有会话删除**（只能 archive+stopActivity）；`Mod+;` 空闲（Web 需加 Alt） |
| 5 | `ctx.subprocess.run` 字段/超时/错误 | **❌ `run` 不存在** | 只有 `resolveExecutable/terminalEnvironment/spawn/spawnTerminal`；替代 = spawn + done + readFrom（§2.5） |
| 6 | `connection.fetch.register` GET | **✅** | `ConnectionFetchMethod = 'GET'|'HEAD'|'POST'`，逐路由 `methods.has(...)`；**D8 前置解除** |
| 7 | main keyed 面板 + panellist + selectPanel | **✅（有陷阱）** | main 可扩展（keyDomain 开放）；panellist id 必须等于 main key；`retainMainPanels` 会重置未知 activePanelId |
| 8 | sidebar 扩展槽 | **✅** | 四个槽全开放（`list/root`，`replaceRisk:none`），真实槽名与 PLAN 略有出入（§2.8） |
| 9 | `data-conversation-region` / `data-sidebar-right-*` / `data-dockkit-*` | **✅ / ⚠️** | 均真实存在（11 + 36 个）；但 `data-conversation-region` 不是最佳锚点，`data-signed-out` 已死 |
| 10 | 5 条死哈希的真实类名 | **✅** | `_2H3hWW_*` 全灭；当前构建真实前缀 `wtg9ga_*`；**不要硬编码，走 token + 子串选择器** |

## 2. 逐项证据与替代方案

### 2.1 `openTab` 与实际可用性（#1）

- **签名（修正 00 审计的“三种重载”）**：只有 `openTab(kind, options = {})`（`R:2234,2243`）。三种“形态”是同一签名的 options 变体：`openTab('terminal')`、`openTab('browser', { params: { url } })`（`B/dsh-client-ui-sidebar-browser/README.md:40`）、`openTab(kind, { paneId })`。
  options 全集：`paneId / replaceTab / preferNewPane / revealIfOpened / params`（`R:2243-2300`；仅 `openResource` 多一个 `kind`，`R:2294`）。
  其他：`split(paneId?) → newPaneId|undefined`（`R:2507`）、`float(tabId, rect?)`（`R:2529`）、`dock(paneId)`（`R:2540`）；`openRightbar(track, fullscreen)` 只上报呈现、不改变展开态（`L:432-439`），第三方不建议直调（会绕过 `rightbarShown` store）。
- **browser 可用性**：唯一禁用点是 `B/dsh-web-app/cordis.patch.yml:295-298` —— `disabled: !!js "ctx.get('profileContext')?.name !== 'desktop'"`（注释 “Web profiles opt in”）。当前 profile = `desktop` ⇒ **✅ 可用**；Web profile 默认 ❌，需显式 opt-in。
- **terminal 可用性**：同一 patch `:300-301` 无禁用条件 ⇒ 两个 profile 都 ✅（Host 侧 `terminalController` 也在 live 服务目录中）。
- **平台字段陷阱**：`dsh.client.platform` 恒为 `"web"`（浏览器侧，与“Desktop/网页”无关；`B/dsh-client-modules/lib/index.js:733` 只接受 `"web"`），不要用它判断桌面端。
- **loopback**：浏览器 tab 允许 loopback（`B/dsh-client-ui-sidebar-browser/lib/client.js:361-406` 只拒 `file:`/`script:`/凭据/DSH 自身 origin），真正的 loopback 限制在 Host 网络层。
- **对 F07 的替代**：Desktop 主路径继续用 `openTab('browser', {params:{url}})`；Web profile 降级为自注册 preview Tab 或显示“需在桌面端使用”的明确空态（PLAN §8.3 已声明差异）。

### 2.2 `sidebarRightTabs` 与 body/title 槽（#2）

- **第三方可注册 ✅**：`ctx.reflect.provide("sidebarRightTabs", tabs)`（`R:4965`），同法 `provide("sidebarRight")`（`R:4966`），无访问控制；跨包活证据：browser `R-vendor:1537-1541`、terminal `:350-358`、documentpreview `:7191-7197`、files `:934-937` 各自 `inject(['sidebarRightTabs'])` 后注册 —— 这些包**不注入 `sidebarRight` 也能注册类型**。
- **register 定义字段**（`R/README.md:83` + `R:2301,2424,4583-4585`）：`{ id, kind, patterns?, priority?, canOpen?, title, guide?, keepMounted?, multiple? }`。**无顶层 icon**（icon 只在 `guide[].icon`）、**无 per-type 持久化开关**（整张 layout 存 `dsh.sidebar-right.v1.<sessionId>`，`R:761,2047`）。
- **kind 冲突规则**：每 kind 最多 1 builtin + 1 extension；缺省 `priority = extension`（外部插件最高，`R:4517-4522`）。重复 id 直接 throw（`R:4585`）。
- **两阶段注册（body/title）**：先 `ctx.sidebarRightTabs.register(definition)`；再按 definition id 把正文/chip 注册进 **keyed** 槽 `sidebar.right.pane.tab` 与 `sidebar.right.pane.tab.title`（父级已声明，插件无需重复声明子槽；照抄 `documentpreview:7209,7220-7253` + `useTabInfo()` 形状 `R:4865-4890`）。
- **与 PLAN 的差异**：00 审计写的 `sidebar.right.pane.title` **不存在**，真名是 `sidebar.right.pane.tab.title`。

### 2.3 `SessionProvider` + `sidebar.chat.conversation`（#3）

- **SessionProvider 不是导出**：`B/dsh-client-ui-subagent/lib/index.js:11` 只有 `export { apply }`；它是渲染器**注入的标准 prop**：只有当注册声明了**非 root 子槽**时，kit 才给 `SessionProvider`（`B/dsh-client-ui-renderer/lib/client.js:753-760`）。官方先例：`subagent:800-808`。
- props：`SessionAreaProps { session?: SessionReference; empty?: () => ReactNode; children }`（`runner:2126`）；实参是 **SessionReference**（不是裸 id），省略 `session` 继承外层（renderer:715）。
- `sidebar.chat.conversation` = **`kind:"single", scope:"session"`**（`runner:5662-5665`），`replaceRisk:"shadows-shipped-ui"`；注册方式 = 父 entry 在 `children` 里声明 + `ctx.slots.inject(key, () => ctx.slots.register({name}, C))`（`subagent:830-838`）。
- **多实例裁决**：`single` 槽**不允许并列占用者**——第二份注册是“遮蔽”（`runner:4912`；`ui-renderer:1173-1177` 只取 `[0]`，priority 越小越强）；但**同一类型可在多个 Tab occurrence 里各渲染一次**（每个 occurrence 独立），所以“多会话聊天标签/浮动窗”可行。
- **Side Chat / 多会话降级方案**：自定义 Tab **声明私有子槽**，用 `SessionProvider(SessionReference)` + `conversation.content({variant:"embedded"})` 渲染（`conversation.content` 本身不寻址会话，`B/dsh-client-ui-conversation/README.md:185`）；**不要去抢注 `sidebar.chat.conversation`**（会遮蔽官方 subagent 侧聊）。

### 2.4 sessions 创建/发送/流式/清理 + `Cmd+;`（#4）

- **创建 ✅**：`ctx.sessions.create({ workspaceId?, cwd?, sessionId?, agentPreset? }) → Promise<SessionId>`（`runner:1922`）。
- **retain 语义（修正）**：`SessionTarget = SessionId | SubagentAddress`（`runner:2217-2218`）⇒ **没有“新会话”形态**；必须先 `create()` 再 `retain(id, { source })`，未知 id 抛 `sessions.retain: unknown session`（`B/dsh-client-api-session-controller/lib/client.js:3010`）。`source` 运行时是开放字符串，官方用 `"sidebarChat"`（`:4063-4066`）。
- **`uiWorkspace.startSession` 不是“新建”**：它是打开/复用空白会话（返回 `void`，`runner:1553-1560`；`ui-workspace:1500-1540`）。新建并打开 = `sessions.create()` + `uiWorkspace.openSession(id)`。
- **发送/流式**：`remote.session.prompt({requestId,sessionId,mode:"queue"|"steer",content[],clientTimeZone?}) → {accepted:true}`（`B/dsh-api-session-controller/lib/typert.host.js:1126-1147`）；`follow({address,assistantStream,maxMessages?,turnWindow?})` → snapshot/event 流（`:240-258`）。⚠️ `remote` 不在 Client Service 目录（`runner:1125-1734` 仅 8 个服务）→ 属内部 seam；**Side Chat 建议让 composer 代发**，避免依赖未目录化的 remote。
- **清理 ⚠️**：只有 `archiveSession(id, { stopActivity })`（`runner:1570-1575`），**没有 session 删除 RPC**（`workspace/delete` 删的是 workspace）。⇒ PLAN §5.8「关闭即删除」必须降级为「取消请求 + 归档 + 停止活动」；「隔离上下文成立、隔离权限不成立」（`create` 只有 4 个字段，无权限/模型），PLAN 已如实写了上下文隔离。
- **`Cmd+;` 冲突 ✅ 空闲**：`Semicolon` 只出现在键帽表（`B/dsh-client-shortcuts/lib/protocol.js:14`），未被任何命令占用。但 Web 侧默认必须写 `["primary","alt"]`（单 primary 的 `;` 不在 Web 白名单，`protocol.js:110-137`）⇒ 桌面 `Mod+;`、Web `Mod+Alt+;`。
  已占用（避免撞车）：`Mod+B`=sidebar.left.toggle、`Mod+Alt+B`=sidebar.right.toggle、`Mod+K`=session.search、`Mod+Alt+G`=session.rename、`Mod+Comma`/web`Mod+Alt+Comma`=settings.open、`Mod+Slash`、`Mod+N/O/T/P`、`Mod+Alt+F`=fork、`Mod+Shift+A`=archive、`Mod+W`=page.close、`Mod+R`=page.refresh、`pane.split`=Mod+Backslash、`pane.fullscreen`=Mod+Alt+Enter、`fontSize.*`(fixed)=Mod+=/Mod+-。
  冲突检测 API：`describeBinding()` → `{binding, keys, issue, conflicts[]}`（`shortcuts client.js:2572`）；注册期即全平台预检，冲突/保留/Web 不支持会 **throw**。

### 2.5 `ctx.subprocess`（#5）—— `run()` ❌，替代方案 ✅

- **不存在 `run()`**：`super(ctx, "subprocess")`（`B/dsh-subprocess/lib/index.js:86-90`），导出 5 符号无 run（`:103`）；`catalog:3052-3082` 只有 4 个方法；全宿主 grep `subprocess.run` = 0 命中。
  ⇒ `4.0-plan/00-host-capabilities.md:305,483,515`、`PLAN.md:287,406`、`01-plugin-architecture.md:163` 的 `ctx.subprocess.run(...)` **写不出来**。
- **替代（推荐，M3 直接用）**：
  ```js
  const signal = AbortSignal.any([ctxSignal, AbortSignal.timeout(10_000)])
  const exe = await ctx.subprocess.resolveExecutable('git')       // 失败 → SubprocessExecutableNotFoundError
  const h = ctx.subprocess.spawn({
    argv: [exe, '-C', cwd, 'status', '--porcelain=v2'],
    cwd,
    stdio: { stdin: 'ignore', stdout: { maxBytes: 4 * 1024 * 1024 }, stderr: { maxBytes: 256 * 1024 } },
    graceMs: 2_000,
    signal,
  })
  const out = await h.done            // { exitCode, signal }
  const text = h.collected.stdout?.readFrom(0).text ?? ''   // 非消费式，可重复读
  ```
  依据：`catalog:7860-7880`（spec 仅 `argv/cwd/stdio/graceMs/signal?/env?`）；`maxBytes` 是**尾部窗口**、`spill.maxBytes` 可落盘完整流（`B/dsh-subprocess/README.md:59-66`）；`graceMs` 是 TERM→KILL 宽限、**不是执行超时**（`B/dsh-subprocess-local/lib/runner-launch-B2zsQ1Dz.js:765`）；超时由调用方合成 `AbortSignal`（宿主示例 `B/dsh-workspace-changes/lib/index.js:169-171`）。
- **错误语义**：git 不存在 → `resolveExecutable` 抛 `SubprocessExecutableNotFoundError`（`dsh-subprocess-local/lib/index.js:1540`）；spawn 失败 → `done` reject 原始 Node error（`ENOENT`）；**非 git 仓库不是异常**，是 exit 128 + stderr `fatal: not a git repository`（`dsh-workspace-changes/lib/index.js:244`）；超时 → `done` 以 `signal` 结算、`exitCode` 可能 `null`（`:185`）。
- **错误码映射建议**：`git-missing` ← resolve 失败；`not-a-repo` ← exitCode 128 + stderr 匹配；`timeout` ← signal !== null && 调用方自己的 deadline 标记；`too-large` ← `readFrom().lossy === true`。

### 2.6 `connection.fetch.register` 与 GET（#6）—— ✅ D8 前置解除

- `register(route): () => Promise<void>`（`catalog:5584`）；route = `{ path, methods, requestBody: 'buffered'|'streaming', fetch(request) }`（`catalog:5043-5044`）。
- **GET/HEAD 支持**：`ConnectionFetchMethod = 'GET' | 'HEAD' | 'POST'`（`catalog:5039-5040`）；唯一方法校验点是 `route?.methods.has(request.method)`（`B/dsh-client-connection/lib/index.js:829,831`），无 POST 白名单；README 原文 “exact `GET`/`HEAD`/`POST` route registries”（`B/dsh-client-connection/README.md:34`）。
- **约束**：路径必须 `/api/…`、每段 `^[A-Za-z0-9_$.-]+$`、精确匹配无通配/param、查询串不参与路由（`client-connection:689-701,823-930`）；同 path 重复注册加载期抛错；`request.url` 的 origin 是合成值 `http://dsh.internal`（`:46`），不能拼绝对 URL；响应二进制安全。
- **HEAD 不从 GET 派生**，需要就显式写 `['GET','HEAD']`（对照 `B/dsh-session-log-export/lib/index.js:522-530`）。
- **D8 结论**：✅ 字体外置可用 `GET /api/theme.font?file=…` 实现（单路由多文件 + 显式 HEAD + 自设 content-type/cache-control）；`DECISIONS.md` 的 D8 前置条件已满足。

### 2.7 main keyed 面板 + panellist + selectPanel（#7）

- `main`：`{ kind:"keyed", scope:"root" }`（`L:629-643`），`entryKey = activePanelId ?? "conversation"`（`L:117-119`）；`MainPanelId = Branded<...>`（`runner:1989-1990`），live Inspect 的 keyDomain 显示 **“open: any string … already taken: conversation”** ⇒ 插件可自造 key ✅。
- `ctx.layout.selectPanel(panelId: MainPanelId | null)`（`L:1132-1138`；live Service 目录同签名）；`sidebar.panellist` 是 `list/root`（`S:627-630`），点击直接 `selectPanel(id)`（`S:592-594`）⇒ **panellist id 必须等于 main key**。
- 官方范例：`B/dsh-client-ui-plugin-manager` 的 `PANEL_ID="plugins"`（`:4355`）、inject（`:4357-4366`）、main 注册（`:4411-4449`）、panellist（`:4484-4491`）。
- **⚠️ 陷阱**：`retainMainPanels` 会在 main 槽变动时把**未注册**的 `activePanelId` 重置为 `null`（`L:614-616,689`）⇒ 插件卸载/热重载会把用户弹回会话页；做全局面板时要自己处理。

### 2.8 sidebar 扩展槽（#8）—— 四个全开放

真实槽名（live Inspect + `runner` 目录一致）：

| PLAN 写法 | 真实槽名 | 证据 | options / props |
|---|---|---|---|
| `session.menu.item` | `sidebar.workspaces.session.menu.item` | `runner:6661`；`W/README.md:161-171` | `{id 必填, order, label}`；ownerProps `{sessionId, displayTitle}` + 注入 `{hooks:{menuOpenState, shortcuts}}` |
| 行悬停 | `sidebar.session.row.hover` | `runner:6449`；`W/README.md:94` | `{id, order, label}`；ownerProps `{sessionId}` |
| 行首 | `sidebar.session.row.leading` | `runner:6497`；`W/README.md:56` | `{id, order, label}`；ownerProps `{sessionId}` |
| （PLAN 未列）行尾动作 | `sidebar.workspaces.session.row.action` | `runner:6715`；`W/README.md:104` | 同 hover；位于 “…” 触发器之后 |

全部 `kind: list`、`scope: root`、`replaceRisk: none`。注意 row 槽故意用 root 作用域（避免 retain 每个列出的会话）；想挂行内动作优先 `session.menu.item` / `row.action`。

### 2.9 data-* 锚点真实存在情况（#9）

| 锚点 | 结论 | 证据 / 取值 |
|---|---|---|
| `data-conversation-region` | **✅ 存在** | 渲染 `C:17926`（`"composer"`）、`C:17934`（`"chat"`）；消费 `C:19569`（Escape 作用域）；新会话态仍渲染 `chat` |
| `data-conversation-scroll` | ✅（更该用） | `C:17938`；宿主 CSS 14 处依赖（如 `C:17386`） |
| `data-content-phase` | ✅（空态判断） | `settling|hero|active`，`C:17613`；CSS 直接使用（`C:17386`） |
| `data-sidebar-right-*` | ✅ 11 个 | `R:523,597,685,1406-1412,1431,1492,1506,1529-1531,1704`：`-session`、`-panel`（`push`/`fullscreen`，不是 tab id）、`-open`、`-tab`、`-occurrence`、`-mode`、`-toggle`、`-guide`、`-guide-entry`、`-expand`、`-unavailable` |
| `data-dockkit-*` | ✅ 36 个 | 全部产出在 shell 压缩包 `F:188`（**没有**独立 dockkit 包）；核心四件套：`data-dockkit-pane(-active)`、`data-dockkit-float(-active)`；消费方 `R:49,54,77,105,133` |
| `data-shell-*` | ✅ 3 个 | `L:346/351/356`：`shell-bottom`/`shell-overlay`/`shell-leading` |
| `data-rightbar-*` | ✅ 4 个 | `L:129,324-326`：`data-rightbar-col`（列标记）、`-collapsed`、`-fullscreen`、`-instant` |
| `data-sidebar-collapsed` | ✅ | `L:323`；`S:115` 的 CSS 依赖 |
| `data-row-key` | ✅ | `W:1968,2276,3011,3313`；会话行 `session:<id>`（+`role=treeitem`，`W:2278`） |
| `data-lexical-editor` | ✅（Lexical 约定） | 设置 `C:10539`、查询 `C:11109` |
| `data-disclosure-row` / `data-chat-call-id` | ✅ | `F:129` / `workflow-run:155`；`T:1963` |
| `data-signed-out` | **❌ 不存在** | 全 `B` 0 命中；账户按钮实为 `aria-haspopup="dialog"`（`B/dsh-client-ui-settings-general/lib/client.js:456`） |
| `data-sidebar-browser-frame` | ⚠️ 只有读方 | 仅 `shortcuts client.js:1526,1547,1558` 查询，设置方在 Electron 壳层，静态不可证 |

**结论**：`data-conversation-region` 是真实锚点，但它是宿主内部 JS 钩子（无 README/类型、无 CSS 依赖），稳定性弱于 `data-conversation-scroll` + `data-content-phase`；M1-S5 应以后者为准（§3.1）。

> **M0-S4 live 复核更正（2026-10-26）**：`data-signed-out` 在当前 live DOM 存在 1 个（`data-signed-out="false"`，账户按钮，`aria-haspopup="menu"`），但静态宿主包 0 命中 ⇒ 由其他插件/壳层注入，**不是宿主契约**，不可依赖；真实语义锚点是 `settings.launcher` slot（`[data-slot="settings.launcher"] button`）。`data-sidebar-collapsed` 与 `data-shell-leading` 是**按需渲染**（折叠 / 有 leading 内容时才出现），非常驻锚点，自检里降为 optional。其余锚点与本节一致。详见 `docs/ANCHORS.zh.md`。

### 2.10 5 条死哈希的真实类名（#10）

`_2H3hWW_` 全 `B` **0 命中**（确认死亡）。当前构建的侧栏模块 `SidebarRoot.module.css` 前缀是 **`wtg9ga_`**（`S:114-164`）：

| 插件旧选择器 | 当前真实类名 | 证据 |
|---|---|---|
| `._2H3hWW_root` | `wtg9ga_root` | 映射 `S:158`；规则 `S:115` |
| `._2H3hWW_collapsed` | `wtg9ga_collapsed` | `S:130`；`S:115` |
| `._2H3hWW_newSession` | `wtg9ga_newSession` | `S:141`；`S:115` |

引用位置：`client.js:553,555,556,718,719`（5 处）。**替代方案（按稳定性排序）**：

1. **token 层**：侧栏底色宿主就是 `background: var(--dsw-specific-sidebar-fill)`（`S:115`），直接 `ctx.theme.overrideTokens`，不需要任何选择器；
2. 几何微调（如 newSession 38→32px）用 `[class*="_newSession"]` 限定在 `[data-sidebar-collapsed]` 祖先下（子串跨哈希存活）；
3. **禁止**硬编码 `wtg9ga_*`——下个 rc 会再变。

其他同类发现：`data-signed-out`（§2.9）是更隐蔽的死选择器；`client.js:620 span[class*="_tag_"]` 全 `B` 无匹配（低风险）；README:108 的 `.Dc7zOa_*`/`.RlGAzG_*` 已是文档残留。

## 3. PROGRESS 四条待验证冲突 —— 裁决

| # | 冲突 | 裁决 | 后续动作 |
|---|---|---|---|
| 1 | `data-conversation-region` 不在 00 权威清单，但 M1-S5 依赖 | **存在 ✅**（`C:17926/17934`），00 清单漏记；且它不是最佳锚点 | M1-S5 改为 `[data-conversation-scroll]`（滚动容器）+ `[data-content-phase=hero|active]`（空态/吸底）+ ResizeObserver，替代 800ms 轮询 |
| 2 | F07 主路径 `openTab('browser')` vs Web profile 禁用 | **Desktop ✅ / Web ❌ 默认禁用**（`dsh-web-app/cordis.patch.yml:295-298`） | Desktop 走 browser tab；Web 降级为自注册 preview tab 或明确空态（README 声明） |
| 3 | `sidebar.chat.conversation` 多实例 | **single 槽单占用者**（`runner:5662`；第二份注册是遮蔽），但**多 Tab occurrence 可各渲染一次** | Side Chat/多会话标签用**私有子槽** + SessionProvider + embedded conversation，不抢注官方槽 |
| 4 | `openTab` 3 种签名 / SessionProvider 是否 import | **单签名 + options 变体**（`R:2234,2243`）；SessionProvider 是**渲染器注入 prop**，非 import（`renderer:753-760`） | M1-S2 按 options 写；M5 按注入 prop 用，别尝试 import `@deepseek-ai/*` |

## 4. 新发现（需回写 PLAN / DECISIONS / 后续步骤）

1. **`ctx.subprocess.run` 不存在** → M3 的 git 路由改用 `spawn + done + readFrom`（含错误码映射，§2.5）。PLAN §5.3/M0-S2 #8、00 §305/§483 需改。
2. **没有会话删除 RPC** → Side Chat「关闭即删除」降级为「取消 + 归档 + stopActivity」；会话会进侧栏归档区，需在 UI 明说或关闭时自动归档。PLAN §5.8 需改。
3. **`data-signed-out` 已死**（`client.js:665,1102` 仍用）→ 余额行逻辑在当前版本不生效；M0-S4 锚点注册表必须收录并给出替代（`aria-haspopup="dialog"` 账户按钮 / `settings-general` 的 `AnXs9G_triggerRow`）。
4. **client.js 改动会热更新**（M0-S3 复测更正 §0.3：~1–2s 生效）→ PLAN §7.5 的 HMR 流程有效；Host 半部（`index.js`）改动仍需重启。

5. **`.d.ts` 缺失** → 后续步骤不要写 `import type`；以 README + `catalog` + `runner` 目录为契约来源。
6. **D8 前置解除**（GET ✅）→ 字体外置可在 M0-S3 直接排期。
7. **`data-sidebar-browser-frame` 只读不可写**；`data-dockkit-*` 只在 shell 压缩包内产出（无独立包）——锚点注册表按“可用但弱契约”标注。

## 5. 对后续步骤的直接输入

- **M0-S3（构建）**：可做字体外置 GET 路由（`/api/theme.font`）；注意 `.d.ts` 缺失与单 client.js 约束不变。
- **M0-S4（锚点）**：注册表至少收录 §2.9 的 11+36+… 与 §2.10 的真实类名；5 条死哈希迁移到 token/子串；新增 `data-signed-out` 死项告警。
- **M1-S2（面板菜单）**：`openTab(kind,{params})` + 两阶段 tab 注册（`sidebar.right.pane.tab(.title)`）。
- **M1-S3（右栏）**：`data-sidebar-right-*` 11 个 + dockkit 四件套；分屏/浮动用 `split/float/dock`。
- **M1-S5（sticky）**：`[data-conversation-scroll]` + `[data-content-phase]`，不要用 `region="composer"` 做几何锚点（它自身在移动）。
- **M3（git）**：§2.5 spawn 范式；错误码映射见 §2.5。
- **M5（Side Chat）**：`sessions.create` → `retain` → composer 代发/`remote.session.prompt`；关闭 = cancel + archive；`Mod+;`（Web 加 Alt）。
- **M6（多会话）**：私有子槽 + SessionProvider + embedded conversation；`single` 槽不并列。

## 6. 复现方式

1. **live**：`cordis_inspect_query` → client `Slots.listSubTree`（无 root 看全树；带 root 看单槽）、client/host `Service.listService`（带 service 看精确契约）。
2. **静态**：在 `.tmp-dsh/dsh/node_modules/@deepseek-ai/<pkg>/` 读 `README.md` + `lib/*.js` + `lib/typert.host.js`；`catalog` 是生成的签名目录。
3. **实机截图**：`PrintWindow` + `PW_RENDERFULLCONTENT`（截取被遮挡的 Electron 窗口）；截图见 `4.0-plan/shots/M0-S2-desktop-app.png`。
4. **临时诊断块**：见附录 A（已从 client.js 移除；`git status` 干净）。

## 附录 A 临时诊断块（已回滚，仅存档）

- 作用：在插件 `apply(ctx)` 后 3s 采集「live ctx 可达服务 / DOM data-* / 真实类名 / 模块表」，输出到 overlay + 剪贴板。
- 注入点：`client.js` 中 `return { inject: ['theme','slots','locale','remote'], apply(ctx) {` 之前插入 186 行 `const __m0s2Probe = (ctx) => {...}`，并在 `apply` 首行加 3s 定时器。
- 结果：HMR/手动重载均未生效（§0.3），未产出 live 数据；已 `git checkout -- client.js` 回滚并 `node --check` 校验。
- 后续如需 live DOM 自检，应在 M0-S4 把采集逻辑并入常驻的锚点自检（`__dshClaudeThemeAnchors()`），随正常构建/重启生效，不再走临时注入。

---
> 证据门槛：本报告每条 ✅/⚠️/❌ 均带 `文件:行号` 或可复跑的 Inspect 查询；未执行任何写宿主/安装/发布操作。