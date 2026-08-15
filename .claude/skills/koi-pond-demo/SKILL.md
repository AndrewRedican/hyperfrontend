---
name: koi-pond-demo
description: Build, run, debug, test, and deploy the koi pond showcase — a host pond that composites seven independently-implemented framework koi apps (React/Vue/Svelte/Solid/Preact/Lit/vanilla) into one 3D scene over @hyperfrontend/features. Use when working in apps/demos/koi-pond, touching the shared koi lib or its three.js renderer, editing or debugging a fish app, changing the pond host/relay/depth/ripple logic, the pond↔fish or gallery↔pond contracts, the vendored lib/shell tarballs, the docs-site koi gallery entry, or the koi pond Railway deploy.
---

# Koi Pond Demo

Ten Nx projects in `apps/demos/koi-pond/`. A **host** pond opens seven **fish** feature apps (one per framework), each rendering one 3D koi into its own transparent full-viewport iframe; the host composites them into one scene, owns the pointer, and relays neighbours. The pond is itself a **hostee** the docs-site gallery mounts. A shared **lib** (packed to a tarball) carries the model, contracts, geometry, the renderer-free 3D koi, and the three.js adapter. A **workbench** develops the koi model in isolation.

## Projects → dirs (Nx name = commit scope)

| Nx project           | Dir          | Role                                                                   |
| -------------------- | ------------ | ---------------------------------------------------------------------- |
| `demo-koi-lib`       | `lib/`       | model, contracts, geometry, `koi3d/` (renderer-free), `three/` adapter |
| `demo-koi-pond`      | `host/`      | pond bed, water, pointer, depth, relay, curtain, roster; hostee shell  |
| `demo-koi-fish-<fw>` | `fish-<fw>/` | one koi per framework: vanilla react vue svelte solid preact lit       |
| `demo-koi-workbench` | `workbench/` | koi-model dev env, port 4283, aliased to `lib/src` (HMR, no repack)    |
| —                    | `vendor/`    | one committed `demo-koi-lib` tarball; consumers `file:`-install it     |
| —                    | `tools/`     | `refresh-lib.mjs` — repack + reinstall lib into every consumer         |

## How it connects

- **Two contracts.** Inner `lib/src/contract/koi-fish.contract.ts` v0.2.0 (pond host ↔ each koi): host sends `pond`/`identity`/`neighbors`/`disturbance`/`depth`/`hover`/`sleep`/`pause` (click-to-inspect hold) /`tune` (playground scales); koi emits `outline`/`depth-request`/`ripple-request`/`settled`. `outline`+`neighbors` are **schema-less** (hot path). Outer `host/koi-pond.contract.ts` (gallery ↔ pond): gallery sends `set-scene` (`card` = opaque paint, `full` = ~70% translucent overlay) /`disturb`; pond emits `shoal`/`sequence-complete`/`close-request`. The gallery never learns there are seven apps.
- **World vs view.** `PondEnvironment.width/height` is the **virtual pond**, snapshotted once from `window.screen` (clamped 800×600..3840×2400) — stable for the instance's life; `pond.view {x,y,width,height}` is the visible window, centred on the pond, recomputed from the frame on every resize. Simulation/spawn/steering read the world; camera/canvas/culling/pointer read the view. Card, expanded overlay, and debug panel are different views onto ONE pond — resize must NEVER rebuild the world. Gallery expand = the docs-site restyles the SAME embed container into a fixed overlay (same session, same iframe — never a second scene).
- **Mounting = embedded.** Host makes one `position:absolute;inset:0` layer per koi, mounts each feature **embedded** into it. z-index **is** the depth model (`depthZIndex`), water layer always topmost.
- **Pointer.** Every layer + iframe is `pointer-events:none`; host runs one normalized stream, hit-tests against fish-reported outlines, notifies the winner, which draws its own card.
- **Rendering.** Each fish owns its own transparent `WebGLRenderer` (seven GL contexts); **host stays GL-free** (canvas-2D water/floor). All fish build the same camera from `POND_VIEW` (`lib/src/model/pond-view.ts`, tilt 10°/fov 26°/exposure 1.15) via `createPondView` (`lib/src/three/pond-view.ts`) so seven renders composite as one scene. The 2D steering brain (`fish-*/src/koi/koi-motion.ts`) stays authoritative for _where_ the fish is; the renderer only expresses it.
- **Packaging.** Every fish is a real packaged feature: `fish-<fw>/feature.config.ts` (version tracks the contract, 0.2.0) + root `koi-fish.contract.ts` re-exporting the lib contract + `pack-shell` target (`hf build --ci --allow-open`) → seven shell tarballs vendored in `host/vendor/`, installed as `file:` deps. `koi-sessions.ts` opens each koi via its generated `createFeatureShell`; `COMPOSED_DEPLOYMENT: true` overrides each baked URL with the `/fish-<fw>/` sub-path — flip it (and provision the `metadata.deploy` Railway services) to go multi-origin. Fish configs declare `modes: ['embedded']` — their only real presentation (needs the `hf` CLI >=0.7.0; older generators failed to compile subset-mode shells).
- **Embedding.** Each service ships `public/hf-serve.config.json` (pond + all seven fish) carrying `frame-ancestors` header rules for `hf serve`. `frame-ancestors` is checked against EVERY ancestor, so the koi value must name the pond AND the docs site (chain is docs-site -> pond -> koi); naming only the pond blanks the shoal. In the pond's file the koi override is a later `"prefix": "/fish-"` rule — rules apply in order, later wins per header.
- **Protocol.** Seven inner channels run as explicitly **open shells** (`protocol: 'none'` in each fish feature.config, packed with `--allow-open`) — v1's per-message PBKDF2 is the F-011 collapse; transport stays origin-pinned. Outer gallery↔pond channel keeps `protocol: 'v1'`.

## Commands (from repo root)

```bash
# lib: build + pack + reinstall into ALL consumers (ALWAYS run after editing lib/src)
npx nx run demo-koi-lib:refresh
npx nx run demo-koi-lib:verify          # fail loudly when tarball/consumer lock drifted
npx nx run demo-koi-lib:build           # tsc only; refresh does build+pack+install

# fish shells: repack all seven + reinstall into host (run after inner-contract or fish feature.config changes)
npx nx run demo-koi-pond:refresh-fish-shells

# the whole family
npx nx run-many -t test build lint type-check -p demo-koi-lib demo-koi-pond demo-koi-fish-*
npx nx run-many -t build -p demo-koi-*  # composed site → dist/apps/demos/koi-pond/site

# per project (test target is `test`; script is test:unit)
npx nx test demo-koi-fish-vanilla
npx nx run demo-koi-fish-vanilla:build
npx nx run demo-koi-fish-vanilla:lint

# develop the koi model alone (HMR onto lib/src, no repack)
npx nx run demo-koi-workbench:dev       # :4283
```

**Editing `lib/src` without `:refresh` ships stale code.** A bare `npm install` no-ops on a same-version repack (warm cache reports "up to date"); `refresh` installs by explicit path, the only invocation that re-reads the tarball. After `:refresh`, run `npm install` inside a fish only if adding a _new_ dep (e.g. `three`).

## Run & debug

```bash
# composed pond on one origin (host + 7 fish sub-paths), SDK dev server
npx nx run demo-koi-pond:dev-hosted     # app :4282, debug UI :4290
npx nx run demo-koi-pond:dev            # vite, host alone (fish frames 404 — use dev-hosted)

# serve the BUILT composed site (plain static server — NEVER serve -s)
npx nx run-many -t build -p demo-koi-*
npx http-server dist/apps/demos/koi-pond/site -p 4288
```

**Never `serve -s` / any SPA rewrite** — each missing `/fish-*/` becomes a nested copy of the pond host (each layer loads a whole pond instead of a fish).

**Browser-verify the 3D shoal** (headless, software WebGL — the docs-site has no dev server, so the composed site is the only live check):

```js
// node script; full chromium (SwiftShader), not the headless_shell
import pkg from '/home/vscode/.npm/_npx/06476e4372e0b5ee/node_modules/playwright-core/index.js'
const { chromium } = pkg
const browser = await chromium.launch({
  executablePath: '/home/vscode/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
})
// goto http://localhost:4288/, wait ~9s (curtain lifts after 7 opens), screenshot;
// mouse.click(640,400) → ripple + scatter; sweep mouse until [data-hovered="true"] → identity card.
```

Roster rows carry `data-connected`/`data-hovered`; `.koi-layer` z-indexes prove the depth spread; curtain is `[data-open]`.

## Build & deploy

- **Composed site**: host builds to `dist/apps/demos/koi-pond/site/` (`emptyOutDir:false`, base `/`); each fish to `.../site/fish-<fw>/` (`emptyOutDir:true`, base `/fish-<fw>/`). Dev origin (`dev-hosted`) matches prod exactly.
- **Deploy**: one Railway service, GitHub-integration auto-deploy on merge to `main` (dashboard-owned — never propose in-repo deploy CI). `host/project.json` `metadata.deploy`: service `hyperfrontend-demo-koi-pond`, origin `https://demo-koi-pond-production.up.railway.app`, `publishDir: dist/apps/demos/koi-pond/site`. Build root must be at/above `apps/demos/koi-pond` so `../vendor` is in context; host must **not** SPA-rewrite. Origin also in `host/feature.config.ts` `url` and docs-site `demo-manifest.ts` fallback — all three move together.
- **Gallery shell** (only needed if the _outer contract_ or `feature.config.ts` changes — not for host scene edits):

```bash
npx nx run demo-koi-pond:pack-shell     # hf build → dist/apps/demos/koi-pond/shell/*.tgz
npx nx run docs-site:refresh-shell      # packs all demo shells + copies to docs-site/vendor + explicit-path install
```

Vendored shell + touched `package.json` + `package-lock.json` land **together** (a tarball without its locks fails `npm ci` EINTEGRITY on a cold cache). The koi shell name must stay in docs-site `eslint.config.cjs` `ignoredDependencies` or lint `--fix` deletes the dep.

## Key files

| Concern             | File                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera contract     | `lib/src/model/pond-view.ts` (numbers), `lib/src/three/pond-view.ts` (builder)                                                                                                            |
| 3D koi surface      | `lib/src/three/koi.ts` (`createKoi`), `lib/src/koi3d/` (anatomy/mesh/spine)                                                                                                               |
| Depth model         | `lib/src/model/depth.ts` (`depthZIndex`/`swimDepth`/`mayRipple`)                                                                                                                          |
| Host assembly       | `host/src/scene/pond.ts` (loop, pointer, fan-out)                                                                                                                                         |
| Relay + dead-reckon | `host/src/scene/relay.ts` (`record`/`neighborsFor`/`pick` take `now`)                                                                                                                     |
| Shell sessions      | `host/src/scene/koi-sessions.ts` (one vendored `createFeatureShell` per fish; `COMPOSED_DEPLOYMENT` URL seam)                                                                             |
| Fish renderer seam  | `fish-<fw>/src/koi/koi-render*` + `runtime/koi-runtime.ts` (injectable `KoiRendererFactory`)                                                                                              |
| Fish brain (2D)     | `fish-<fw>/src/koi/koi-motion.ts` (framework-free, survives renderer swap)                                                                                                                |
| Docs-site gallery   | `apps/docs-site/src/lib/demo-manifest.ts`, `apps/docs-site/src/components/demos/demo-wiring.ts` + `demo-console-actions.tsx` (`KoiPondConsoleActions`) + `cover-flow.tsx` (card ↔ expand) |

Cadence/budget constants: `OUTLINE_INTERVAL_MS=100` (fish runtime), `RELAY_INTERVAL_MS=120`, `RELAY_REACH=3.4`, `HOVER_SLACK=0.14`, `DEAD_RECKON_MAX_S=0.6`, `OPEN_TIMEOUT_MS=20_000` (7 handshakes queue past the 10s default), `CURTAIN_DEADLINE_MS=5000`, `SEQUENCE_DEADLINE_MS=14_000`.

## Edit a fish (mirror `fish-vanilla`)

Renderer is injectable so specs run headless: `createKoiRenderer(root, profile, url, pond, createGl?)` returns `{ koi, draw(state,dt), setPond, setHovered, placeCard, applyTune, dispose }`; runtime takes `KoiRendererFactory`. Units shim: pond-px speed → body-lengths (`/pxPerUnit`), turn `+wrapAngle(Δheading)/dt` (positive `turnRate` = clockwise on screen = the fish's right flank — NEVER negate, or heads bend against their turns), `escapeIntensity` from `phase==='escape'`, depth via `swimDepth(level)`. Scene = koi group (`koi-shadow`/`koi-skin`/`koi-fins`/`koi-eyes`) + `createLighting(POND_VIEW.lighting)`. Each fish declares `three ^0.185.1` + `@types/three ^0.185.4` (the lib peer is optional, not installed transitively).

## Gotchas

- **Framing**: a koi is mounted ONLY from its directory URL `fish-<fw>/` — its assets are relative, so a host that rewrites `…/index.html` to an extensionless path drops the document a directory up and every asset 404s (this blanked the shoal in production once). Needs features >=0.6.0, which serves directory URLs. **F-010**: debug UI port not configurable → `--port 4290` in `hf:dev`. **F-011**: v1 message collapse across 7 channels (root-caused; inner channels drop v1). All in `roadmap/showcase/findings/`.
- **Per-fish three.js** (~180 kB gzip × 7 ≈ 5 MB): inherent to seven independent apps; a shared chunk breaks the isolation the demo proves. Curtain covers the load. Not a bug.
- **Vacuous-spec traps** (fixed, keep fixed): boundary specs mutation-proven (disable avoidance → they fail) across all seeds; hover/sleep wiring specs exercise both flag values; `?.foo()).not.toBe(null)` is banned (passes on absent nodes); every fish has a real 3D view spec + a `koi-runtime` emit-contract spec (hand-driven rAF, injected fake GL). Svelte `type-check` chains `tsconfig.vitest.json` (tests) + `tsconfig.node.json` (configs, `allowJs`) — do not revert to app-only.
- **Devcontainer**: ten `npm install`s at `parallel:1`; full `nx lint docs-site` can SIGKILL — lint targeted file lists (`npx eslint <files>`).

## Presentation & tuning

Card expand is **unmask**: `CoverFlowCard` restyles into `fixed inset-0` around the same live embed (the deck container drops its `perspective` while expanded — perspective is a fixed-position containing block), with ✕/Escape/next-demo chrome; `cover-flow.tsx` sends `set-scene` on live/expand changes. Fish sizing: `FISH_LENGTH_RATIO 0.36` of the world's shorter axis (clamp 130..560), margin `1.05` fishLengths. Phenotypes: `koiPhenotype`/`koiTrim`/heft table in `lib/src/model/traits.ts`; varieties (pattern+ground+secondary per framework) in `palette.ts`. Host `controls.ts` = the playground broadcasting `tune`. Click a fish = pause/inspect (host routes via `relay.pick`), open water = strike. The generic console "Open as dialog" opens a second session — dev tool only, never the product expand path.

## Checklist

- [ ] Edited `lib/src`? → `demo-koi-lib:refresh` then `:verify`
- [ ] Changed the inner contract or a fish `feature.config.ts`? → `demo-koi-pond:refresh-fish-shells` (host vendor tarballs + package.json + lock land together)
- [ ] Scope = Nx project name; one project per commit; no version/changelog/tag files
- [ ] Comments never cite finding IDs / roadmap docs
- [ ] `npx nx run-many -t test build lint type-check -p demo-koi-*` green
- [ ] Serving built site by hand → `http-server`, never `serve -s`
