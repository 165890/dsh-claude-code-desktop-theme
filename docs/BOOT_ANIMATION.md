# 开机主题动画 — 首版已实现（待用户微调）

> 用户表示会补充具体规格；本文先固定技术边界与待定项，避免实现后返工。

## 目标

在 DSH 启动/首次渲染时，用一段短动画展示主题品牌（Claude Code 桌面端 × DeepSeek Harness），
结束后自然过渡到正常界面；不阻塞会话恢复、不干扰恢复错误页。

## 已确定的技术约束

- 纯客户端实现（`client.js` 内），不新增 host 依赖。
- 在首次绘制前覆盖：首帧即铺满暖米色背景，避免白屏/FOUC。
- 默认只在 **应用启动后的第一次** 播放；刷新页面是否重播由规格决定。
- 可跳过：点击/按键/超时（建议 ≤ 2.5s）立即结束。
- `prefers-reduced-motion: reduce` 时退化为淡入/直接显示，不做大幅运动。
- 提供关闭开关（localStorage 或设置项），不修改宿主配置。
- 动画结束/被跳过时移除 DOM 与定时器；插件禁用时清理。
- 不覆盖恢复错误、崩溃恢复、首次安装引导等关键状态（或在检测到这些状态时跳过）。

## 待用户确认

1. 时长：约 1.2s / 1.8s / 2.5s？
2. 触发：每次启动 DSH / 仅首次安装后 / 每次刷新页面？
3. 画面：只放 logo + 字标 / 加粒子 / 加“正在恢复会话”进度 / 全屏渐变？
4. 是否要声音（若需要，提供音频或允许内置短音效）？
5. 浅色/深色：跟随当前主题，还是固定暖米色？
6. 跳过方式：任意点击、Esc、右下角“跳过”？
7. 结束过渡：淡出到界面 / logo 缩小飞入侧栏 / 直接切换？
8. 是否需要可配置（设置面板开关）？

## 实现草案（规格确认后填充）

- `mountBootAnimation(ctx)`：在 shell effect 中尽早注入 `#dsh-boot-overlay`，使用 CSS keyframes 驱动；
  `sessionStorage` 标记本次启动已播放；点击/超时/Escape 触发退出；
  结束后 `requestAnimationFrame` 淡出并移除节点；`ctx.effect` 清理所有 timer/listener。
- 视觉元素复用主题 Token：surface `#f5f3ee`、ink `#1d1b16`、accent `#da7756`、宋体内嵌字体；
  深色时用 `#24221f`/`#ece7dd`。
- 若需要视频/GIF，优先用 Remotion 预渲染后以 `<video>` 播放并设置 `muted/playsinline`；
  但首帧仍需 CSS 背景兜底。
- 回归项：冷启动、热刷新、禁用再启用、reduced-motion、深色、低端机（动画帧率）、
  恢复错误页不遮挡。


## 首版实现（2026-10-19）

- 位置：`client.js` 的 `mountBootAnimation()`；常量 `BOOT_DURATION_MS = 1700`。
- 视觉：暖米色全屏（深色 `#24221f`）、陶土橙 logo 方块、`Claude Code 桌面端主题`、
  `DEEPSEEK HARNESS`、橙色进度线、底部「点击任意处跳过」。
- 触发：每个 renderer 窗口第一次加载（`sessionStorage` 键 `dsh-theme-boot-played`）。
- 退出：点击 / Enter / Esc / 1.7s 超时；280ms 淡出；`prefers-reduced-motion` 时 0.9s 并静止。
- 关闭：`localStorage.setItem("dsh-theme-boot-disabled","1")`。
- 已验证：截图 `preview-boot-animation.png`；`TEMP-` 探针已移除。
- 待用户确认后再改：时长、每次启动/仅首次、画面元素、声音、是否要设置开关。
