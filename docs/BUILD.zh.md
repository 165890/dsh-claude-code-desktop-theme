# 构建链与机械拆分（M0-S3）

> 日期：2026-10-25 · 版本 2.5.2 · 宿主 DSH Desktop 0.2.1-rc.3
> 目标（PLAN M0-S3 / D6=A）：零依赖构建、`src/` 机械拆分、产物仍是**单个** `client.js`、行为零变化、行为可通过 `npm run check` 回归。

## 1. 结论

| 项 | 值 |
|---|---|
| 构建工具 | **自研零依赖 Node 拼接**（`scripts/build.mjs`）；本机未安装 esbuild，且不新增任何依赖 |
| 产物 | `client.js`（路径/文件名不变，仍是单个动态包文件） |
| 拆分前 | 7,784 行 / **3,877,413 B** / sha256 `2d389f0cae5844a395e702189bcd420872bcf8fb0fb1e7e45ead9852c57fd39d` |
| 拆分后（build 产物） | 7,784 行 / 3,877,413 B / **同一 sha256** —— 字节级完全一致 |
| 区块数 | 17 个 `src/client/parts/*.js`（01 架构审计的 17 区块） |
| 新增 npm 依赖 | **0**（无 dependencies / devDependencies 变化） |
| `npm run check` | build --check → `node --check index.js` → `node --check client.js` → 36 条价目用例 → `scripts/smoke.mjs` |
| 包体 | 3.70 MiB（≤ 4.5 MB 预算，未变） |
| 运行验证 | 改 src part → `npm run build` → HMR **~1.5s** 生效（badge 时间戳 22:13:26.559Z；build 22:13:25）；删除临时 part 重建后 sha 回到基线，主题/HUD/状态点/宠物正常 |

**为什么是“拼接”而不是 bundler**：`client.js` 是 Harness 动态包，
`window.__ModuleLoader__.load({ id, factory(require) { … } })`，单文件、无 `import`/`export`/JSX；整个插件是一个闭包，所有区块共享作用域。拆分只能在同一 factory 体内做**连续切片**，拼接是唯一能证明“行为零变化”的形式：`parts[01] + … + parts[17]` 必须逐字节等于基线（已用 sha256 验证）。

## 2. 工具检查（记录）

```text
$ npx --no-install esbuild --version
npm error npx canceled due to missing packages and no YES option: ["esbuild@0.28.2"]

$ node -v && npm -v
v24.12.0 / 11.15.0
```

⇒ 不引入 esbuild（会新增构建期依赖，且当前单文件产物不需要模块解析）；按 D6=A 落最小 Node 拼接。

## 3. 目录

```text
src/client/
├── README.md            # 约定：parts 是切片不是模块，顺序即执行顺序
├── manifest.json        # 有序 parts + M0-S3 基线（lines/bytes/sha256）
└── parts/
    ├── 01-module-head.js
    ├── 02-usage-overview.js
    ├── 03-tokens-and-fonts.js        # 含 3.49MB base64 字体（D8/M0-S6 再外置）
    ├── 04-shell-css.js
    ├── 05-sidebar-status-dots.js
    ├── 06-hero-dashboard.js
    ├── 07-hero-menu-upward.js
    ├── 08-usage-model-labels.js
    ├── 09-sidebar-balance.js
    ├── 10-composer-hud-update.js
    ├── 11-diff-badge-review.js
    ├── 12-data-bridge.js
    ├── 13-theme-tokens.js
    ├── 14-effort-slider.js
    ├── 15-desktop-pet.js
    ├── 16-realtime-voice.js
    └── 17-assembly.js
```

## 4. 区块表（拆分后实测；行号为拆分前 client.js 行号）

| # | part | 行号 | 字节 | sha256 前 12 |
|---|---|---|---|---|
| 1 | 01-module-head | 1–25 | 972 | `70a8dd04fbd3` |
| 2 | 02-usage-overview | 26–490 | 21,212 | `a9f16f6d6bb3` |
| 3 | 03-tokens-and-fonts | 491–548 | 3,502,323 | `e212f58df228` |
| 4 | 04-shell-css | 549–749 | 24,201 | `fd5d2e200f9d` |
| 5 | 05-sidebar-status-dots | 750–818 | 3,612 | `4a36626086cb` |
| 6 | 06-hero-dashboard | 819–975 | 7,823 | `43c2c8535244` |
| 7 | 07-hero-menu-upward | 976–1034 | 2,923 | `556497ce4627` |
| 8 | 08-usage-model-labels | 1035–1092 | 2,688 | `6e4fc827f5e9` |
| 9 | 09-sidebar-balance | 1093–1143 | 2,302 | `5496a34367b4` |
| 10 | 10-composer-hud-update | 1144–1980 | 38,952 | `e5158fbdd086` |
| 11 | 11-diff-badge-review | 1981–2204 | 11,143 | `9c5290151c7e` |
| 12 | 12-data-bridge | 2205–2777 | 25,530 | `b27a04c8add6` |
| 13 | 13-theme-tokens | 2778–3041 | 13,096 | `1c85344babdf` |
| 14 | 14-effort-slider | 3042–5580 | 129,224 | `d86fbddc43a1` |
| 15 | 15-desktop-pet | 5581–6392 | 30,319 | `da483b34933a` |
| 16 | 16-realtime-voice | 6393–7355 | 42,088 | `a1efb7360225` |
| 17 | 17-assembly | 7356–7784 | 19,005 | `e8efc010e99c` |

## 5. 命令

```bash
npm run build            # 由 src/ 生成 client.js（内容未变则显示 unchanged）
npm run build -- --check # 只校验 client.js 是否与 src/ 一致（CI 用）
npm run check            # build --check + node --check + 价目用例 + smoke
node scripts/smoke.mjs   # 静态冒烟（产物形状/能力清单/路由/无调试探针）
```

## 6. 门禁设计

- **逐区块门禁 = 字节等价**：每加入一个 part 后，`concat(parts) + 原文件剩余切片` 的 sha256 必须等于基线（比“截图一致”更强，能证明零变化）。
- **全部拆完后**：`node scripts/build.mjs --check` 通过 + 一次真实运行时冒烟（主题/HUD/语音/滑条/Diff/状态点/宠物 + 截图，见 `4.0-plan/shots/M0-S3-*.png`）。
- **CI 防手改**：`npm run build` 后 `git diff --exit-code -- client.js`，保证产物只能由 `src/` 生成。
- 人工清单仍在 `docs/SMOKE.zh.md`（本步新增了自动 smoke，不替代人工清单）。

## 7. 未做 / 后续

- **字体外置**：`03-tokens-and-fonts.js` 仍内联 3.49 MB base64（占包体 92%）→ 留给 D8 / M0-S6（`connection.fetch` GET 已在 M0-S2 验证可用）。
- 不引入 bundler / minify：当前产物是单文件闭包，压缩收益小且会破坏“字节可追溯”。
- `index.js`（Host 半部，1,353 行）本步不拆。
- 拆分没有改变任何区块内部代码；后续功能步骤按区块定位修改。