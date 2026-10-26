# 运行时调度与去轮询化（M0-S4）

> 2026-10-26 · 宿主 DSH Desktop 0.2.1-rc.3
> 源码：`src/client/parts/01b-runtime-scheduler.js`（调度器）+ 各功能 part 的任务注册。

## 1. 设计

一个实例只创建 **1 个 body MutationObserver + 1 个 ticker**，所有功能通过命名任务接入：

```js
runtimeOnMutation('status-dots', apply)      // DOM 变化后经 rAF 合并执行
runtimeEvery('hud-ticker', tick, 500)        // 合并进唯一 ticker（200ms 基频）
```

- 观测配置：`childList + subtree + characterData + attributes`，但 `attributeFilter` 只收宿主状态属性（class / aria / data-content-phase / data-row-key / data-sidebar-right-* / data-dockkit-*active / 深色主题），**排除插件自己写的 `data-dsh-*`、`style`**，避免任务写 DOM 再触发自己形成回路。
- 合并：所有 mutation 汇总为一个 rAF 回调，任务再多也只有每帧一次分发；周期任务共用一个 ticker，按各自 cadence（≥200ms）到期执行。
- 暂停：`visibilitychange` 隐藏时断开 ticker 与待执行 rAF，恢复时补跑一次 mutation 任务；所有实例内任务随 `dispose()` 清空。
- 诊断：`__dshClaudeThemeRuntime()` → `{ tickMs, mutationTasks, intervalTasks, hidden }`。

## 2. 转换清单

| 功能 | 旧机制 | 新任务 |
|---|---|---|
| 侧栏状态点（05） | body observer + 500ms interval | `status-dots`（mutation）+ `status-dots`（500ms） |
| 首页 hero 几何（06） | body observer + 800ms interval + resize | `hero-layout`（mutation）+ resize + composer `ResizeObserver`（去 800ms 轮询） |
| 首页菜单上弹（07） | body observer + 200ms interval | `hero-menu-upward`（mutation）+ 现有 scroll/resize |
| 用量卡模型名（08） | body observer + 700ms interval | `usage-model-labels`（mutation）+ 700ms |
| 侧栏余额（09） | body observer + 1000ms interval | `sidebar-balance`（mutation）+ 1000ms |
| 更新面板行（10） | body observer(schedule) | `hud-update-rows`（mutation） |
| Composer tray（10） | body observer(scheduleEnsure) | `hud-tray`（mutation） |
| HUD ticker（10） | 递归 setTimeout（running 500 / idle 2s） | `hud-ticker`（runtimeEvery，动态 cadence） |
| Diff 微标（11） | body observer + 700ms interval | `diff-badges`（mutation；去 700ms 全量扫） |
| 推理滑条（14，vendored） | body observer + 400ms interval | `effort-slider`（mutation + 400ms） |
| 桌宠挂载/主题（15） | 2 个 body observer | `pet-mount` / `pet-theme`（mutation） |
| 桌宠呼吸（15） | 呼吸帧 interval | `pet-breath`（runtimeEvery，≥200ms） |
| epoch 守卫（17） | 800ms interval | `epoch-guard`（runtimeEvery 800ms，隐藏暂停） |
| 更新检查（17） | 10s interval | `update-status`（runtimeEvery 10s） |

**有意保留**：语音录音期间的 `tickTimer`（用户主动录音的会话内计时，不是后台轮询）；`ResizeObserver` / `IntersectionObserver`（元素几何/可见性 API，不观察 body）。

## 3. 三处 O(n) 全量扫描

| # | 位置 | 旧 | 新 |
|---|---|---|---|
| 1 | 更新面板探测 | `document.body.textContent` 整页文本（原 client.js:1621） | 只在 `dt/dd/dl` 候选上做局部文本匹配（有界集合），去掉整页读取 |
| 2 | hero 800ms | 每 800ms 4 次 `querySelector` + `getBoundingClientRect` | mutation + resize + composer `ResizeObserver` 事件驱动（无轮询） |
| 3 | Diff 微标 700ms | 每 700ms 全量扫 badge + `closest` | mutation 驱动、badge 集合幂等更新（无定时器） |

## 4. 观测计数（old / new）

| 指标 | M0-S3 基线（HEAD `1c7396a`） | M0-S4 收敛后 |
|---|---|---|
| `new MutationObserver` | 10 | **1**（调度器自身） |
| `setInterval(` | 12 | **3**（1 个 200ms ticker + 2 个语音录音期计时） |
| `body.textContent` 全量读 | 1 | **0**（仅注释提及；真实读取已删除） |
| body observer 实例 | 10 | 1（调度器） |
| 调度器 ticker | — | 1（200ms 基频） |

## 5. 验证

- `npm run check`（build + syntax + pricing + smoke）通过；smoke 新增 `__dshClaudeThemeAnchors` / `__dshClaudeThemeRuntime` 能力检查与 `TEMP-M0S4` 探针泄漏检查。
- 无残留：连续 HMR 重载 3 次后，插件自有节点计数保持稳定（见 `4.0-plan/shots/M0-S4-runtime.png` 与 PROGRESS 记录）；HMR/dispose 路径与禁用时使用同一套 disposer。
- 长会话滚动：去掉 700ms/800ms 全量扫描与 10 个独立 observer 后，mutation 分发为每帧一次、任务均幂等；人工长会话复核按 docs/SMOKE.zh.md 执行（本步给截图与计数证据）。
- 截图：`M0-S4-anchor-baseline.png`（修复前 16/18）、`M0-S4-anchor-fixed.png`（16/16）、`M0-S4-runtime.png`（收敛后运行时报告/残留计数）。

## 6. 维护规则（后续步骤必须遵守）

1. 新功能**不得**再 `new MutationObserver(document.body)` 或自建 `setInterval`；用 `runtimeOnMutation` / `runtimeEvery` 注册命名任务。
2. 周期任务 >200ms 的 cadence 自己声明；低于 200ms 的动画需求走 rAF，不进 ticker。
3. 注册即返回 disposer，必须并入实例的 `disposers`（或 `ctx.effect` 返回），保证禁用/HMR 零残留。
4. 加新锚点时先登记到 `16a-anchor-registry.js` 并跑一次自检，不允许在功能代码里散落裸哈希选择器。

## 7. 已知取舍（本步接受，后续可再收紧）

- **Diff 微标**：去掉 700ms 定时器后，纯 bridge 数据变化若长时间没有任何 DOM 变化，要等下一次 mutation 才刷新；会话流式输出本身持续产生 mutation，实测可接受。
- **更新面板行**：需要宿主存在 `dt` 标签或 `.facts` / `[data-slot="settings.plugins"]` / `[role="dialog"]` 容器；宿主若把「当前版本」搬进无这些特征的普通容器，则不再挂载（有界降级，不再整页扫描）。
- **07 首页菜单**：共享 observer 的 `attributeFilter` 不含 `style`，宿主若仅用内联 style 改已打开面板的位置/尺寸，依赖 childList / aria-expanded / scroll / resize 触发重定位。
- **语音**：录音期 tick 保留为会话内计时（非后台轮询），页面隐藏时仍会暂停（runtime 的 visibility 处理不影响它，因为它在录音会话内）。
## 8. 字体加载（M0-S6 / D8）

- 字体是**一次性** `fetch`（8s 超时）→ `FontFace`，不属于调度器任务；页面隐藏/切换不影响已加载字体。
- 失败时只 `console.warn` 一次并回退系统宋体栈，不重试、不轮询（避免新增定时器）。
- 状态：`<html data-dsh-font="external|fallback">` + `__dshClaudeThemeFontDebug().external`（source / route / faceStatus / error）。
