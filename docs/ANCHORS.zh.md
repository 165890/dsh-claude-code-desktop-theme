# 锚点注册表与自检（M0-S4）

> 2026-10-26 · 宿主 DSH Desktop 0.2.1-rc.3 · 源码 `src/client/parts/16a-anchor-registry.js`
> 目标：把插件依赖的所有宿主锚点集中登记，任何宿主升级导致的改类名/删属性都变成自检里的**可见数字**，而不是静默失效的功能（01 审计：5 条裸哈希选择器已死）。

## 1. 用法

- 启动时自动跑一次（`apply` 后 1.5s），`console.table` 全表 + 一行摘要；required 缺失时 `console.warn`。
- 手动：`__dshClaudeThemeAnchors()` → 返回 `report` 对象（同时写入 `window.__dshClaudeThemeAnchorsReport` 并打印）。
- 运行时状态：`__dshClaudeThemeRuntime()` → 当前实例的调度器报告（1 observer / N interval 任务 / tick 基频 / 是否暂停）。
- 报告字段：`required / requiredHit / requiredMiss / optionalHit / optionalMiss / fallback / slots / missesRequired / fallbacks / rows / runtime`。

## 2. 注册表结构

| kind | 含义 | 自检方式 |
|---|---|---|
| `slot` | 本插件注册的宿主槽（`ctx.slots.register`） | 记为 `declared`（槽是否被渲染取决于宿主视图，DOM 由下方 dom 项验证） |
| `dom` | 宿主真实渲染的 `data-*` / role / aria / CSS-module 键 | `querySelectorAll` 计数；0 命中时尝试 `fallback` |
| `family` | 同一前缀的属性族（如 35 个 `data-dockkit-*`） | 族内命中个数，例如 `12/35` |

级别：**required**（在任何正常会话页都必须命中，DoD = 100%）、**optional**（只在特定状态出现，如右栏打开、折叠、深色）、**fallback**（主选择器失效时的降级路径）。

## 3. 覆盖范围（摘要）

- **slots（4，declared）**：`conversation.input.dock`（用量卡）、`conversation.composer.dock`（数据桥）、`conversation.input.right`×2（滑条/语音）。
- **会话骨架 required**：`[data-conversation-region="chat"]`、`="composer"`、`[data-conversation-scroll]`、`[data-content-phase]`、`[data-composer-seat]`、`[data-lexical-editor="true"]`、composer 卡片（`[class*="_card"]:not(…):has([data-lexical-editor])`）。
- **侧栏 required**：`[data-row-key^="session:"]`、`[role="treeitem"][data-row-key^="session:"]`、`[data-slot="settings.launcher"] button`（账户行；**M0-S4 修复点**）。
- **框架 required**：`[data-rightbar-col]`、`[data-shell-bottom]`、`[data-shell-overlay]`。
- **optional**：hero（`_composerHero`）、右栏 11 个 `data-sidebar-right-*`、35 个 `data-dockkit-*`（family）、工具/Diff（`data-chat-call-id`、`data-disclosure-row`）、深色 `body[data-ds-dark-theme]`、折叠态 `[data-sidebar-collapsed="true"]`（false 时属性缺省）、`data-shell-leading`（无 leading 内容时不渲染）。
- **跨哈希 CSS 键**：`_card`、`_sessionRow`、`_newSession`（required）与 `_composerHero`、`_heroWorkspaceRow` 等（optional）——只用模块键子串，**不依赖构建哈希**。

## 4. 实测（2026-10-26，当前 profile）

| 时间点 | required | optional | fallback | slots |
|---|---|---|---|---|
| 修复前基线 | **16/18**（miss：`[data-sidebar-collapsed]`、`[data-shell-leading]`） | 12 hit / 14 miss | 0 | 4 declared |
| 修复后 | **16/16 · all required ok** | 13 hit / 16 miss | 0 | 4 declared |

> 修复前两条 miss 经 live DOM 复核是**条目定级问题**而非插件 bug：`data-sidebar-collapsed` 只在折叠时渲染（false 时属性缺省）、`data-shell-leading` 在当前 profile 无 leading 内容时不渲染 → 已降为 optional 并注明。

## 5. 6 类死选择器修复（M0-S4）

| 旧 | 问题 | 新 |
|---|---|---|
| `._2H3hWW_root` ×3（侧栏底色/新会话尺寸） | 哈希早已失效（01 审计） | 删除底色规则（`--dsw-specific-sidebar-fill` token 已生效）；New Session 改用 `button[class*="_newSession"]`（模块键跨哈希），实测高度 38→32px 恢复设计值 |
| `._2H3hWW_collapsed` / `._2H3hWW_newSession` | 同上 | 不再依赖；折叠态用宿主状态属性/语义 |
| `button[data-signed-out][aria-haspopup="menu"]`（余额行） | 静态宿主源码无此属性（HOST-PROBE §2.9），live DOM 仅由其他插件注入，非契约 | 主选择器 `[data-slot="settings.launcher"] button`（宿主 slot 契约）；后备 `button[data-signed-out]`、`[role="button"]`、`aria-label*=账户` |

证据：`4.0-plan/shots/M0-S4-anchor-baseline.png`（修复前 16/18）、`M0-S4-anchor-fixed.png`（修复后 16/16）。

## 6. 宿主事实更正（相对 HOST-PROBE §2.9）

- `data-signed-out` 在**当前 live DOM 存在 1 个**（`data-signed-out="false"`），但静态宿主包 0 命中 → 属其他插件/壳层注入，不可作为契约。
- 账户按钮**没有** `aria-haspopup`（PLAN M0-S4 原文假设 dialog），真实语义锚点是 `settings.launcher` slot（`data-slot="settings.launcher"`，宿主槽位清单内）。
- `data-sidebar-collapsed` / `data-shell-leading` 是按需渲染，不是常驻锚点。
- 其余 `data-*` 与 HOST-PROBE §2.9 一致（11 个 sidebar-right、35 个 dockkit、conversation-region/scroll/phase、row-key 等）。