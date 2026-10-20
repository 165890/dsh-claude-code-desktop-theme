# Changelog

## 2.5.2

- 修复：发布流程会在 npm 上死循环——`npm publish` 撞到 staging 记录直接返回 409，而 staged 版本永远不出现在 `npm view` 里，于是"发布失败"的判断永远成立。新增 `npm run release`：单次执行、自动复用暂存构建、自动校准 `latest`、只做一次结果核对，任何失败都直接打印下一步命令。
- 修复：`latest` 标签遗漏。此前 2.5.0 已发布成功，但 `latest` 仍停在 2.2.0，用户装到的还是旧版；本地脚本与 CI 现在都会在发布后强制对齐 `latest`。
- 优化：npm 包体从 4.8 MB 降到约 3.0 MB——8 张截图转为 WebP（2.0 MB → 480 KB），README 仍用包内相对路径，离线或不挂代理也能正常显示。
- 文档：新增 `docs/RELEASE.md`，写明 Automation token 配置、发版步骤与错误对照表。

## 2.5.1

- 重做开机主题动画：暖米色幕布 + `Hello,` / `can I do for you?` 手写逐字动画。Host 在 `index.html` body 首帧注入并隐藏 Harness 自带 boot card，Client 保留兜底；点击 / Esc / Enter / 空格可跳过。
- 修复：启动动画文字原先会被主题全局 `body *` 字体规则强制覆盖，播放中途换字体；现在动画字体单独锁定。
- 修复：UI 字体统一为内嵌 `DSH Serif UI`，移除 `思源宋体 VF` / `Source Han Serif` / `Noto Serif SC` 本机字体依赖；代码字体统一 `SF Mono` / `Consolas`。
- 修复：实时语音取消改为点击麦克风停止，移除独立 × 按钮，录音时不再改变工具栏宽度。

## 2.2.0

- 新增：对话框语音输入恢复并主题化——官方实验语音 Bundle 的麦克风重新可见，录音条、波形、圆按钮、脉冲全部换成奶油/陶土橙；未启用语音 Bundle 时优雅隐藏。
- 新增：合并 `dsh-codex-effort-slider`（MIT）——模型菜单的「推理等级」行出现橙色能量滑条、暖色星尘与扫光，支持拖动、设置面板与减少动效；模型行描边也从紫色改为陶土橙；检测到独立插件时自动跳过，避免双滑条。
- 修复：其他机器字体发糊——覆盖宿主 `-webkit-font-smoothing:antialiased` 为 `auto`，并内嵌 Noto Serif SC 的 GB2312 子集（OFL）作为 UI 衬线字体，不再回退到 Windows 宋体位图或不可控系统字体。
- 新增：实时语音输入——主题自带麦克风（发送键左侧），录音中约每 0.3s 增量转写并写入输入框，约 6s 无人声自动停止，停止后整段重转写；点 × 放弃；官方麦克风在可用时隐藏，失败/未启用时回退。
- 修复：语音回写草稿时 Lexical 多余换行导致聊天框逐次撑大；录音中手动编辑草稿会自动停止，避免覆盖用户输入；最长录音 60s 自动停止；实时文本改为轻量去重写入，并加逐字显示动画（每 ~22ms 追加 1–2 字）。
- 新增：首版开机主题动画——暖米色幕布、陶土橙 logo、字标与进度线，1.7s 淡出，可点击/Enter/Esc 跳过，reduced-motion 静止；每窗口只播一次，可关闭。
- 新增：`window.__dshClaudeThemeFontDebug()` 诊断入口，便于反馈平台、DPI、字体加载状态。
- 修复：深色模式——去掉无条件强制浅色的 v1 硬覆盖，body/侧栏/composer/HUD/Diff 抽屉都随深浅色切换；语音与滑条的焦点/减少动效细节同步校正。

## 2.1.5

- 修复：未安装 `dsh-bottom-info-bar` 时，HUD 的 `本次花费` 一直显示 `—`。现在按真实 token 用量与官方价目表估算本次会话花费；已安装底部信息栏时仍优先显示实扣金额。
- 修复：`tok/s` 与缓存命中率改读宿主 `sessionStats` / `tokenUsage` 投影，会话开始后立即有值，不再等待底部信息栏 DOM 更新。
- 修复：余额启动时先显示 localStorage 中上次成功读取的值，账户服务返回后实时刷新，消除首屏 `余额 —` 的空窗。
- 新增：HUD 花费悬停提示区分「实扣」与「按 token 用量估算」。

## 2.1.0

- 开源发布准备：MIT License、公开 README、CI、`.gitignore`、npm 发布元数据。
- 用量概览（`dsh-usage-overview`）的客户端卡片、Host 汇总路由、模型目录解析全部合并进本插件，
  独立的用量插件已从 profile 移除。
- 清理内部命名空间（effect/标签/注释统一为 `dsh-claude-code-desktop-theme`）。

## 2.0.0

- 首个合并版本：主题 + 用量概览卡片、HUD、状态点、Diff 审查抽屉。

## 1.x

- 迭代完成 Claude Code 桌面端 Token 层、外壳布局、首页仪表盘、状态语义层、
  Composer HUD、数据绑定与 Diff 审查抽屉。
