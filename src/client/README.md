# src/client — single-file Client half, split into ordered parts

`client.js` is one Harness **dynamic-package** module: a single file evaluated
by `window.__ModuleLoader__.load({ id, factory(require) { … } })`. It is not an
ES module graph, and it must never gain `import` / `export` / JSX.

The files under `parts/` are therefore **not modules** — they are contiguous
slices of the same factory body whose concatenation is `client.js` byte for
byte. `scripts/build.mjs` joins them in `manifest.json` order:

```
client.js == parts/01 + parts/02 + … + parts/17
```

Rules:

- **Order is behavior.** Do not reorder parts or insert separators/banners.
- Edit a part, then `npm run build` (or `npm run check`). `client.js` is a
  build artifact now — do not hand-edit it.
- `npm run build --check` fails when `client.js` is stale. CI runs it, and
  `npm run check` runs the full build + syntax + pricing + smoke chain.
- `manifest.json` also records the M0-S3 mechanical-split baseline
  (`lines`, `bytes`, `sha256`). Before and after the split the artifact was
  identical; see `docs/BUILD.zh.md`.

Naming and ownership follow the 01 architecture audit's 17 blocks
(usage card, fonts/tokens, shell CSS, status dots, hero layout, hero menus,
model labels, balance, HUD + update panel, diff drawer, data bridge, theme
tokens, effort slider, desktop pet, realtime voice, assembly).

Editing loop and reload behavior: `docs/RELOAD.md`.