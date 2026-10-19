# dsh-claude-code-desktop-theme

把 **Claude Code 桌面端**的视觉语言搬到 DeepSeek Harness Web GUI 上：暖米色表面、陶土橙强调色、思源宋体界面、Absolutely 代码配色，附带真实的会话状态点、HUD、Diff 审查抽屉与用量概览卡片。

A Claude Code desktop-style theme for the **DeepSeek Harness** Web GUI, plus the merged usage-overview card, real session status dots, composer HUD and a diff review drawer.

[![CI](https://github.com/165890/dsh-claude-code-desktop-theme/actions/workflows/ci.yml/badge.svg)](https://github.com/165890/dsh-claude-code-desktop-theme/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/dsh-claude-code-desktop-theme)](https://www.npmjs.com/package/dsh-claude-code-desktop-theme) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![Hero](preview-skeleton-hero.png)

## 功能

- **Claude Code 桌面端配色**：`#f5f3ee` 暖米色表面、`#1d1b16` 墨色文字、`#da7756` 陶土橙强调色；代码高亮使用 Absolutely 配色（diff 绿 `#00c853` / 红 `#ff5f38`）。
- **内嵌宋体界面（不再依赖本机字体）**：内嵌 Noto Serif SC 的 GB2312 + ASCII 子集（woff2，SIL OFL 1.1），常见中文全部由插件自带字体渲染，不会因为没装思源宋体而回退到 Windows 宋体位图；同时把宿主的 `-webkit-font-smoothing:antialiased` 恢复为 `auto`，Windows 100% 缩放下小字也保持清晰。
- **首页仪表盘**：用量概览卡片固定在左上角，以全屏布局为基准等比缩放（窗口变小时整体缩放、比例不变；侧边栏隐藏时自动居中）。
- **真实状态点**：侧栏会话状态来自宿主真实数据——运行中显示 14px 橙色旋转圆弧，等待确认显示橙点，空闲显示灰色圆点；圆点是 CSS 伪元素，React 重渲染不会让它消失。
- **Composer HUD**：输入框下方显示真实的上下文占用、缓存命中率、本次花费与实时 tok/s（空闲自动显示 0 tok/s）；余额显示在侧栏底部账户行。
- **Diff 微标 + 审查抽屉**：编辑/写入工具卡片右上角显示真实 `+N −M`，点击打开右侧审查抽屉查看真实 diff；无数据时显示空状态，不伪造内容。
- **工作区 / 模式菜单向上展开**：首页的两个下拉菜单从触发器上方弹出，不会遮挡输入框。
- **对话框语音输入**：恢复官方实验语音 Bundle 的麦克风入口，并主题化为陶土橙——录音条、波形、圆按钮、录音脉冲与深色模式一致；未启用语音 Bundle 或没有麦克风权限时自动隐藏、不留破 UI。
- **推理等级滑条（已合并）**：官方模型菜单里的「推理等级」行变成一条可拖动的连续滑条，最高档亮起奶油/陶土橙能量层、暖色星尘与扫光；原 `dsh-codex-effort-slider` 的算法、设置面板与 fail-open 行为完整保留，只换配色。已安装独立滑条插件时会自动跳过，避免双滑条。
- **用量概览（已合并）**：会话/消息/token 统计、连续天数、高峰时段、常用模型（通过宿主模型目录解析真实展示名）与 26 周热力图；Host 汇总路由随主题插件一起提供。

![Chat](preview-skeleton-chat.png)

## 安装

### 方式一：DSH 插件管理（推荐）

1. 打开 DeepSeek Harness → **设置 → 插件**；
2. 搜索并安装 `dsh-claude-code-desktop-theme`；
3. 启用后立即生效（主题插件会写入 Claude Code 桌面端配色）。

> **语音输入**需要先在插件管理里启用官方「语音输入」实验 Bundle（`@deepseek-ai/dsh-experimental-voice-input-bundle`），并按系统提示授予麦克风权限；识别模型未准备时按钮会打开官方准备引导。
>
> 如果之前装过独立的 `dsh-codex-effort-slider`，请先禁用/卸载它再使用本主题，避免两个滑条同时出现。

### 方式二：手动加入 profile

在你的 DSH profile 目录（桌面端通常是 `~/.dsh/profiles/desktop`）执行：

```bash
pnpm add dsh-claude-code-desktop-theme
```

然后在 `package.json` 的 `dsh.profile.bundles` 中加入：

```json
"dsh-claude-code-desktop-theme"
```

重启 DSH（或重新加载插件）即可。

### 方式三：从本仓库安装

```bash
git clone https://github.com/165890/dsh-claude-code-desktop-theme.git
cd dsh-claude-code-desktop-theme
# 在 profile 中 link 本地目录
cd ~/.dsh/profiles/desktop
pnpm add link:/path/to/dsh-claude-code-desktop-theme
```

并把 `dsh-claude-code-desktop-theme` 加入 `dsh.profile.bundles`。

## 兼容性

- 开发与验证版本：**DeepSeek Harness `0.2.1-rc.2`**（Desktop profile，Electron 渲染进程，Web GUI）。
- 插件通过宿主公开的 `ctx.theme` / `ctx.slots` / `ctx.remote` 服务工作，不修改宿主源码。
- 视觉层依赖 Harness Web GUI 的 CSS Module 选择器（如 `._2H3hWW_root`、`.Dc7zOa_composerHero`）。这些选择器由 Harness 构建产物生成，**升级 Harness 后可能变化**；不匹配时主题 Token 与组件（HUD/用量卡片/Diff 抽屉）仍会正常工作，只是个别外壳几何样式可能不生效。
- 需要 DSH Web GUI 的 Desktop 或 Web profile；插件同时注册 Host 路由（`POST /api/dsh-claude-code-desktop-theme/usage-summary`）与 Client 卡片。

## 使用说明

- 主题自动跟随 Claude Code 桌面端的浅色外观；系统偏好为 `system` 时插件会切到浅色。
- 首页左上角的用量卡片按全屏比例缩放，窗口大小变化时保持长宽比；侧边栏收起时居中显示。
- 侧栏状态点、HUD、余额、用量卡片全部读取宿主真实数据，不包含 mock/占位值。
- **数据来源**：上下文占用、缓存命中率与实时 `tok/s` 直接来自宿主 `contextPressure` / `tokenUsage` / `sessionStats` 投影，会话开始后立即显示，不依赖任何第三方信息栏插件。
- **本次花费**：若已安装 [dsh-bottom-info-bar](https://github.com/songoao25/dsh-bottom-info-bar) 并启用其账本，优先显示实扣金额；未安装时按真实 token 用量 × 内置 DeepSeek 官方价目表估算（悬停可见提示），未收录的模型显示 `—`，不伪造数字。
- **余额**：先立即显示上次成功读取的余额缓存，再在账户服务返回后刷新为实时值；未登录 DeepSeek 账户时显示 `—`。
- **字体诊断**：在 DevTools 执行 `__dshClaudeThemeFontDebug()`，会打印平台、DPI、实际 `-webkit-font-smoothing`、实际字体栈，以及内嵌宋体是否加载成功（反馈字体问题请附上这段输出）。
- **语音输入**：录音/转写由 DSH 官方语音子系统完成，主题只负责入口与视觉；切换会话、隐藏窗口、取消录音都会释放麦克风，权限被拒绝时显示官方错误提示。
- **推理等级滑条**：拖动时即时写回官方档位，松手立即落地；找不到官方菜单锚点或会话作用域未就绪时 fail-open，不影响官方菜单。
- 卸载/禁用插件会自动撤销 Token 覆盖层、注入的 DOM、字体样式、滑条样式与所有监听器。

## 开发

仓库结构：

```
.
├── index.js            # Host half：用量汇总路由（POST /api/...）
├── client.js           # Client half：主题 Token、外壳样式、HUD、状态点、用量卡片、Diff 抽屉
├── cordis.patch.yml    # DSH bundle 入口
├── locale/             # 插件市场展示用名称/描述
├── assets/             # 内嵌宋体子集（GB2312 woff2 + 标题子集）与 OFL 许可证
├── preview*.png        # 截图
├── docs/DESIGN.zh.md   # 设计记录（内部实现笔记）
└── .github/workflows   # CI：语法检查 + 打包检查
```

本地检查：

```bash
npm run check      # node --check index.js client.js
npm pack --dry-run # 查看发布内容
```

### 发版

```bash
npm version patch   # 或 minor / major，会创建提交与 tag
git push --follow-tags
```

推送 `v*` tag 后，GitHub Actions 的 **Release** 工作流会：

1. 校验 tag 与 `package.json` 版本一致；
2. 运行 `npm run check` 与 `npm pack --dry-run`；
3. 优先尝试 **npm OIDC Trusted Publishing**；若该包尚未识别到 OIDC 信任配置，
   自动回退到仓库 secret `NPM_TOKEN` 执行 `npm publish --access public --provenance`。

> npm 新包/部分发布可能先进入 **staged publishing** 队列，需要维护者在 npm 网站（Staged Packages）用 2FA 批准后才会正式上线。

## 许可证

[MIT](LICENSE)。

- 内嵌字体子集来自 **Noto Serif SC**（SIL Open Font License 1.1），许可证见 `assets/OFL.txt`。
- 推理等级滑条改编自 [**dsh-codex-effort-slider**](https://github.com/Microqian2th/dsh-codex-effort-slider) v1.1.1（MIT，© 2026 dsh-codex-effort-slider contributors），算法与交互保留，配色重映射到本主题的奶油/陶土橙色阶。原项目许可证文本见 [THIRD_PARTY.md](docs/THIRD_PARTY.md)。

## 致谢

- DeepSeek Harness 提供的插件与主题扩展点；
- Claude Code 桌面端的视觉参考；
- Noto Serif SC / Source Han Serif 字体项目；
- dsh-codex-effort-slider 的滑条实现与测试。
