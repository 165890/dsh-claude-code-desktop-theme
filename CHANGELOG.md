# Changelog

## 未发布（3.0 开发中）

- 新增：**应用内自动更新（检查 + 提示 + 确认安装）**。插件页「当前版本」下方出现更新条：打开即检查 npm 最新版；发布未满 24 小时时明确写出 pnpm 观察期与普通安装可用时间；点「更新到 x.y.z」并确认后，按**精确版本**安装（跳过观察期），装完回读 `node_modules` 校验版本，再提示重启生效；失败/校验不一致/`link:` 模式都有原因说明与可复制的安装命令。不会静默安装，也不会自动重启。
- 修复：更新接口装完不校验结果——此前只返回 `restartRequired`，装到旧版也会显示成功；现在以磁盘上的 `package.json` 版本为准，不一致按失败处理。
- 移除：**开机动画已完全删除**（用户决定重做）。Host 不再注入任何启动幕布或 kill 脚本，Client 不再挂载动画模块；相关文档、预览图与字体许可证一并移除，重做时从零新增。
- 修复：**余额消失（DSH 新版改了 CSS-module 类名）**。宿主 3.x 客户端把侧栏账户行的哈希类名从 `wCInkW_triggerRow` 换成了新哈希，主题按旧类名找不到行，余额就不再出现。现在改用宿主稳定的语义属性定位账户按钮（`button[data-signed-out][aria-haspopup="menu"]`），余额作为 flex 项追加在账号名右侧（`margin-left:auto`，省略号截断，侧栏折叠时隐藏）；不再做胶囊探测/隐藏等额外逻辑。
- 修复：**官方桌面端更新后主题样式整体失效**。nightly 重建把 13 个包里的 CSS-module 哈希前缀全部重算（`RlGAzG_*`、`Dc7zOa_*`、`Gyyz9a_*`、`wq12jW_*`、`_oGoKq_*`、`Hqq-bq_*`、`hIlkoa_*` 一个都匹配不到），主题所有依赖哈希的选择器集体失效。现在统一改成**模块键后缀 + 语义锚点**：`.RlGAzG_card` → `[class*="_card"]:not([class*="_cardWorkspaceTrigger"]):has([data-lexical-editor="true"])`，语音 / 模型档位 / 会话行 / hero 等同理（`:has()` 定位 composer，属性锚点区分语音与模型触发器）。模块键（`_card` / `_dock` / `_add` / `_sessionRow`…）是源码里的 CSS Modules 键名，不随构建变，所以以后更新不再整体失效。
- 优化：**实时语音链路重做**。`createScriptProcessor` 改为 AudioWorklet（不可用时回退），采集后**显式重采样到 16kHz 单声道 PCM16**——宿主 `validateWave` 只接受这种规范 WAV，旧代码在 AudioContext 未给出 16k 时会被整段拒绝，是「识别不准」的主因；上传从「每 300ms 全量累计音频」改为「每 ~1.2s 只发新增音频 + 0.4s 重叠」，停止时整段重转写覆盖预览；按宿主 strict schema 只传 `audioBase64/providerId/language`，provider/language 按 `speech.catalog()` 校验；录音动画改为 `transform/opacity`、固定 30×30 不撑高输入框；补齐 `visibilitychange`/`pagehide`/会话切换/卸载/60s 的麦克风释放与失败回退官方麦克风。
- 优化：**HUD 实时性**。`tok/s` 从「整段会话平均」改为 2s 滚动窗口（500ms 采样、流停 1.2s 归零、步末用 provider 真值校准）；上下文保留 1 位小数并在流式期叠加当前 step 估算；缓存命中主值保持整段口径、最近一步进 tooltip；标签/数字拆分 + 固定数字槽 + `contain`，更新只动 `opacity/transform`；running 500ms / idle 2s 自适应 ticker，窗口隐藏暂停。
- 新增：**外接 provider 花费估算**。价格从 5 个官方模型扩展为「精确目录 → 模型族 → provider 前缀 → 兜底」四层匹配，未知模型也给估算并标注；支持 `~/.dsh/dsh-claude-code-desktop-theme/pricing.json` 覆盖（精确/前缀/通配/`provider:model`），不支持时静默忽略；返回 `estimated/currency/priceSource/matchedKey` 等字段，客户端按契约显示 `~¥0.12`、币种随模型、未知模型弱化；实扣仍由 bottom-info-bar 优先。新增 `scripts/check-pricing.mjs`（36 用例）接入 `npm run check`。
- 文档：新增 `docs/COST.zh.md`（字段语义、匹配优先级、覆盖格式、客户端显示规范）、`docs/HUD.zh.md`（根因与改动清单）、`docs/PET.zh.md`（桌宠设计规格）。
- 新增：**像素小鲸鱼桌宠 v1**。16×16 像素（2× 显示）DeepSeek 蓝小鲸鱼，4 帧（idle / 呼吸 / 眨眼 / happy）由 canvas 生成精灵表；贴在输入框卡片右上角外侧，祖先裁切时自动退化为 body 固定定位；呼吸换帧、随机眨眼、悬停上移、点击开心（带冷却）、发送消息冲刺（Enter + 发送按钮双信号去重）；指针按下不抢输入框焦点，碰撞守卫避开按钮/输入框，点「×」隐藏后可从 HUD 托盘「鲸」按钮恢复；`visibilitychange`/`IntersectionObserver` 暂停、`prefers-reduced-motion` 全降级、卸载清理全部定时器与监听。诊断 `__dshClaudeThemePetDebug()`。

## 2.5.2

- 修复：发布流程会在 npm 上死循环——`npm publish` 撞到 staging 记录直接返回 409，而 staged 版本永远不出现在 `npm view` 里，于是"发布失败"的判断永远成立。新增 `npm run release`：单次执行、自动复用暂存构建、自动校准 `latest`、只做一次结果核对，任何失败都直接打印下一步命令。
- 修复：`latest` 标签遗漏。此前 2.5.0 已发布成功，但 `latest` 仍停在 2.2.0，用户装到的还是旧版；本地脚本与 CI 现在都会在发布后强制对齐 `latest`。
- 优化：npm 包体从 4.8 MB 降到约 3.0 MB——8 张截图转为 WebP（2.0 MB → 480 KB），README 仍用包内相对路径，离线或不挂代理也能正常显示。
- 文档：新增 `docs/RELEASE.md`，写明 Automation token 配置、发版步骤与错误对照表。
- 修复：**发布成功但用户装到旧版**。2.5.0 发布后 `latest` 正确，可是在别人的电脑上全新安装仍解析到 2.1.5——原因是 pnpm 11 默认的 `minimumReleaseAge`（24 小时观察期）会跳过刚发布的版本并静默回退到更旧的一个。`npm view` 与 dist-tag 都看不出这个问题。现在发布脚本会在发布后跑一次「全新安装探测」，直接报告新用户此刻装到的版本、该版本何时可普通安装、以及给用户的精确安装命令；新增 `npm run check:install` 可随时查询。README 也写清了「装到旧版时请装精确版本 `pkg@版本`」。
- 修复：版本顺序事故——`2.2.1` 被发在 `2.5.0` 之后，把 `latest` 推回了旧版本，也让观察期回退选到 `2.2.0`。发布脚本现在拒绝发布低于 `latest` 的版本（确需发布用 `ALLOW_LOWER_VERSION=1`）。

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
