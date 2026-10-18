# Changelog

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
