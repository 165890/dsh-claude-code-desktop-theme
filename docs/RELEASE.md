# 发布流程

> 一页说清：一次性配置做什么、以后每次发版怎么发、出错怎么查。

## 一、一次性配置（只做一次）

### 为什么需要 Automation token

`npm publish` 和 `npm stage approve` 都是写操作。如果账号开了 2FA，npm 会要求一次性验证码：

```
npm error code EOTP
npm error This operation requires a one-time password.
```

在脚本、CI、AI 助手这类非交互环境里没有人能输入验证码，npm 11 还会把认证链接脱敏成 `***`，导致**永远卡住**。

2026-10-20 那次事故就是这么来的：`publish` 要验证码 → 改用 `stage publish` → `npm view` 看不到 staged 版本 → 判定失败 → 反复重试，一晚上跑了 60 次 `npm view`、38 次 `publish`、7 次同一个 `approve`。

**Automation token 不需要验证码**，配好之后所有发布都不再被拦。

### 操作步骤

1. 打开 <https://www.npmjs.com/settings/~/tokens>
2. **Generate New Token** → 选择 **Automation**
3. 权限保持默认（Read and write），生成后复制
4. 替换 `C:\Users\10366\.npmrc` 里的这一行：

```ini
//registry.npmjs.org/:_authToken=<粘贴 Automation token>
```

改完后验证身份：

```bash
npm whoami
```

> 注意：`.npmrc` 里只有这一行，不要加 `registry=`、`proxy=` 之类，避免影响其他项目。

### 可选：确认 token 类型

旧 token 以 `npm_` 开头，无法从前缀判断类型。判断方法只有两种：

- 去 npm 网站看该 token 的创建类型（页面上会标 Automation / Publish / Read-only）
- 或者直接跑一次 `npm run release`，如果报 `EOTP` 就是 Publish token

## 二、日常发版

```bash
cd C:\Users\10366\Documents\deepseek-harness\default-workspace\dsh-claude-code-desktop-theme

# 1. 改版本号（选一种）
npm version patch   # 2.5.1 -> 2.5.2
npm version minor   # 2.5.1 -> 2.6.0

# 2. 提交并打 tag
git add -A && git commit -m "release: v2.6.0"
git tag v2.6.0
git push && git push --tags

# 3. 发布
npm run release
```

`npm run release` 按顺序做这些事，**每一步最多执行一次，不会循环重试**：

| 步骤 | 作用 |
|---|---|
| 工作区检查 | 有未提交改动就中止，保证包内容对应某个 commit |
| 语法检查 | `node --check index.js client.js` |
| 打包预览 | `npm pack --dry-run`，打印真实包体积 |
| 版本顺序 | 拒绝发布低于 `latest` 的版本（否则 `latest` 会被推着往回走，2.2.1 就是这样插在 2.5.0 后面的） |
| 已发布检查 | 版本已存在则跳过 publish，只校准 latest |
| staging 检查 | 发现同版本暂存记录就 approve，绕开 409 |
| 发布 | `npm publish --access public`，失败时翻译成具体下一步 |
| 校准 latest | **自动把 `latest` 指向本次版本** |
| 核对 | `npm view` 只查一次；查不到会提示“CDN 缓存，不要重复发布” |
| 全新安装探测 | 在空目录 + 独立 cache/store 里真跑一次解析，报告新用户此刻会装到哪个版本 |

只检查不发布：

```bash
npm run release -- --dry
```

单独查看“此刻一个全新环境会装到哪个版本”（不改任何东西）：

```bash
npm run check:install   # 退出码 0=装到的正是 package.json 版本，1=被观察期挡住
```

## 三、上一次事故的三个坑（已修复）

### 坑 1：`npm view` 看不到 staged 版本

`npm stage publish` 之后，版本存在于 staging，但 **`npm view` 完全看不到**（不进 `versions`，也不进 `dist-tags`）。

用它判断“发布成功”必然得到假阴性，于是无限重试。

**现在的做法**：判断是否发布成功只看两条——`npm view <pkg>@<version> version` 是否命中，或 `npm stage list` 的 `status` 字段。且**只查一次**。

### 坑 2：staging 记录会堵死后续发布

已 staged 的版本再执行 `npm publish` 会直接 409：

```
409 Conflict - Cannot publish over previously staged version "2.5.1"
```

**现在的做法**：本地脚本和 CI 都会先查 staging，有同版本就 `stage approve`，而不是硬撞。

### 坑 3：approve 不会自动更新 `latest`

2.5.0 发布成功，但 `latest` 一直停在 2.2.0，所有用户装到的还是旧版。

**现在的做法**：脚本发布后强制 `npm dist-tag add <pkg>@<version> latest` 并校验。

## 四、发布成功 ≠ 用户能装到（pnpm 观察期）

这是最容易被误判成“没上传成功”的一条，**2026-10-20 就是它**。

pnpm 11 默认启用供应链保护 `minimumReleaseAge`，默认等待期 **24 小时**：

- 发布未满 24 小时的版本，即使 `latest` 指向它，`pnpm add <pkg>` 也**不会**选它；
- 解析器会静默回退到「已过观察期的最新版本」，不报错、不提示；
- `npm view` 和 `npm dist-tag ls` 都显示正确，所以从 registry 侧完全看不出问题。

实测（2026-10-20，pnpm 11.28.5，全新 cache/store）：

| 命令 | 解析结果 |
|---|---|
| `pnpm add dsh-claude-code-desktop-theme` | `2.1.5` |
| `pnpm add dsh-claude-code-desktop-theme@latest` | `2.1.5` |
| `pnpm add dsh-claude-code-desktop-theme@2.5.0` | `2.5.0` ✅ |
| `pnpm add dsh-claude-code-desktop-theme --config.minimumReleaseAge=0` | `2.5.0` |

当时 registry 上 `latest` 已经是 `2.5.0`。原因：`2.1.5`（10-18 10:59 UTC）已过 24h，而 `2.2.0` / `2.2.1` / `2.5.0`（10-19 15:21 / 16:45 / 16:43 UTC）都还没过。

### 结论

- **发布动作本身没有失败**，`latest` 也对；挡住用户的是本地 pnpm 的安全策略，发一个更新的版本同样会被挡（新版本也在观察期内）。
- 想让用户立刻用上：**装精确版本** `dsh-claude-code-desktop-theme@2.5.0`，精确版本跳过观察期。
- 或者等发布满 24 小时：`npm view <pkg> time.<version>` 的时间 + 24h 之后，普通安装就会拿到它。
- 用户可以自行在 profile 的 `pnpm-workspace.yaml` 加白名单跳过等待：
  ```yaml
  minimumReleaseAgeExclude:
    - dsh-claude-code-desktop-theme@2.5.0
  ```

### 现在的护栏

1. `npm run release` 发布后自动跑「全新安装探测」，直接打印新用户此刻会装到哪个版本、该版本何时可普通安装、以及要给用户的精确安装命令；
2. `npm run check:install` 可随时单独查询，退出码 `1` 表示此刻装不到 `package.json` 里的版本；
3. 探测使用 DSH 自带的那份 pnpm（用户插件管理实际运行的那个），PATH 上的 pnpm 只是兜底。

> 注意：探测在发布后立刻运行，若 registry 尚未传播，可能读到一个更旧的结果。提示里会说明——等一分钟重跑，不要因此重发版本。

## 五、出错对照表

| 现象 | 原因 | 处理 |
|---|---|---|
| `EOTP` / `one-time password` | token 不是 Automation 类型 | 按第一节换 token |
| `409 ... previously staged version` | 该版本已在 staging | `npm stage list <pkg>` 拿 id，`npm stage approve <id>` |
| `tag/version mismatch` | tag 和 package.json 版本不一致 | 改 package.json 或重打 tag |
| 发布成功但 `latest` 没变 | 漏了 dist-tag | `npm run release` 会自动补，也可手动 `npm dist-tag add <pkg>@<ver> latest` |
| `npm view` 查不到刚发的版本 | CDN 缓存 | 等 1–2 分钟，**不要重发** |
| `403 Forbidden` | token 无 publish 权限 | 换 Read and write 权限的 Automation token |
| 发布成功、`latest` 也对，但全新安装装到旧版 | pnpm `minimumReleaseAge` 24h 观察期 | 第四节：让用户装 `pkg@版本`，或等满 24h |
| `X is lower than the version latest points at` | 要发的版本低于 `latest` | `npm version patch` 抬版本；确需发布才用 `ALLOW_LOWER_VERSION=1` |

## 六、遗留事项

- **staging 里的 2.5.1**：id `7040262d-dd7e-4b7a-b0f7-20d263875744`，与 2.5.0 功能完全相同（只有版本号和文档差异）。留着不影响新版本，想清理就 `npm stage delete 7040262d-dd7e-4b7a-b0f7-20d263875744`（需要 2FA）。
- **版本顺序事故（2.2.1 发在 2.5.0 之后）**：`2.2.1` 的发布时间晚于 `2.5.0`，导致 `latest` 一度被推回 `2.2.1`，也曾让观察期回退选到 `2.2.0`。现在的发布脚本会拒绝低于 `latest` 的版本，不会再复现。
- **包体积**：8 张截图从 PNG 转为 WebP（2.0 MB → 480 KB），仍随包发布，README 使用包内相对路径。压缩包从 4.8 MB 降到约 3.1 MB。注意：不要把截图换成 GitHub raw 链接——`raw.githubusercontent.com` 与 jsDelivr 在国内会直接超时，README 图片会全部裂开。
