---
name: koi-pond-demo
description: Build, run, debug, test, and deploy the koi pond showcase — a host pond that composites eight independently-implemented framework koi apps (React/Vue/Svelte/Solid/Preact/Lit/Angular/vanilla) into one 3D scene over @hyperfrontend/features. Use when working in apps/demos/koi-pond, touching the shared koi lib or its three.js renderer, editing or debugging a fish app, changing the pond host/relay/depth/ripple logic, the pond↔fish or gallery↔pond contracts, the vendored lib/shell tarballs, the docs-site koi gallery entry, or the koi pond Railway deploy.
---

# Koi Pond Demo

Eleven Nx projects in `apps/demos/koi-pond/`. A **host** pond opens eight **fish** feature apps (one per framework), each rendering one 3D koi into its own transparent full-viewport iframe; the host composites them into one scene, owns the pointer, and relays neighbours. The pond is itself a **hostee** the docs-site gallery mounts. A shared **lib** (packed to a tarball) carries the model, contracts, geometry, the renderer-free 3D koi, and the three.js adapter. A **workbench** develops the koi model in isolation.

## Projects → dirs (Nx name = commit scope)

| Nx project           | Dir          | Role                                                                     |
| -------------------- | ------------ | ------------------------------------------------------------------------ |
| `demo-koi-lib`       | `lib/`       | model, contracts, geometry, `koi3d/` (renderer-free), `three/` adapter   |
| `demo-koi-pond`      | `host/`      | pond bed, water, pointer, depth, relay, curtain, roster; hostee shell    |
| `demo-koi-fish-<fw>` | `fish-<fw>/` | one koi per framework: vanilla react vue svelte solid preact lit angular |
| `demo-koi-workbench` | `workbench/` | koi-model dev env, port 4283, aliased to `lib/src` (HMR, no repack)      |
| —                    | `vendor/`    | one committed `demo-koi-lib` tarball; consumers `file:`-install it       |
| —                    | `tools/`     | `refresh-lib.mjs` — repack + reinstall lib into every consumer           |

## How it connects

- **Two contracts.** Inner `lib/src/contract/koi-fish.contract.ts` v0.7.0 (pond host ↔ each koi): host sends `pond`/`identity`/`neighbors`/`disturbance`/`depth`/`hover`/`sleep`/`pause` (press-to-hold) /`place` (drag a held koi to a pond point); koi emits `outline`/`depth-request`/`ripple-request`/`settled`. `outline`+`neighbors` are **schema-less** (hot path); the outline ordinarily carries `intent: KoiIntent {kind travel|avoid|depth-change, target, direction?, reachPx}` — the brain's current decision, recorded from the desire() ladder + the depth-pass resolution, suppressed while held — which the host's interaction overlay draws; while HELD the outline instead carries `card: KoiCardPanel {frame, app, site, source}` — the card's whole rect plus its three link rects — and the host floats three real `<a target=_blank>` anchors (`.koi-card-link`: app URL + `FRAMEWORK_SITES` official site + `koiSourceUrl` app source on GitHub; a panel without `source` from an older shell just hides that anchor) and an inert `.koi-card-shield` over the frame (all three stopPropagation on pointerdown so card presses never strike the pond; fish frames are pointer-transparent, so fish-side links can never be clicked). Outer `host/koi-pond.contract.ts` v0.2.0 (gallery ↔ pond): gallery sends `set-scene` (`card` = opaque paint w/ rounded-corner edge fade to ~50%, `full` = ~70% translucent overlay) /`disturb`; pond emits `shoal`/`sequence-complete`/`close-request {source: button|escape}`. Escape inside the pond releases a held koi first, else emits `close-request` (dialog AND embedded modes — the host page can never hear keydown once focus is in the pond's document; `escape-close.ts` + `featureUi.requestClose(source)`, latch re-armed by `set-scene`); both docs-site surfaces collapse on it. The pond re-emits `shoal` every 10s as a liveness roll call — the docs-site embed declares a demo offline after 30 quiet seconds, and a calm pond is otherwise silent. The gallery never learns there are eight apps.
- **World vs view.** `PondEnvironment.width/height` is the **virtual pond**, snapshotted once from `window.screen` (clamped 800×600..3840×2400) — stable for the instance's life; `pond.view {x,y,width,height}` is the visible window, centred on the pond, recomputed from the frame on every resize. Simulation/spawn/steering read the world; camera/canvas/culling/pointer read the view. Card, expanded overlay, and debug panel are different views onto ONE pond — resize must NEVER rebuild the world. Gallery expand = the docs-site restyles the SAME embed container into a fixed overlay (same session, same iframe — never a second scene).
- **Mounting = embedded.** Host makes one `position:absolute;inset:0` layer per koi, mounts each feature **embedded** into it. z-index **is** the depth model (`depthZIndex`): floor 0, fish z1..7, water z100, `#interactions` diagnostics canvas z120 (above the water so traces stay crisp), roster + `.pond-interactions` toggle z150, selection chrome z158/160, curtain z200. Owning the layers is also what lets the host stand one down: `present` (a Set in `pond.ts`, driven by `open`/`close`/`error`/watchdog `status`) is the single source for `setLayerPresent` + the roster + the shoal count, because a frame the browser has killed keeps painting an **opaque crash placeholder** — that white box with a sad face over the water was a dead koi frame, not a bug in the scene.
- **Interaction overlay.** The "View interactions" toggle (`components/interactions-toggle.ts`, iconed pill on the bottom edge, centred; stood down by `#pond[data-scene='card']` rather than by a width rule, so a phone presenting the pond full still gets it) flips `scene.setInteractions(on)`; the frame loop then feeds `relay.latest` outlines to `scene/interactions.ts`, which draws each koi's sensing cone (radius = reported `reachPx` = speed×`ENCOUNTER_HORIZON_S` + clearance — stretches with speed; the ±0.5 rad half-angle is presentational, the brain's perception is a time horizon not a view angle) and a dashed trace: green to the real itinerary waypoint, red along the decided escape heading (flee/boundary/evasion), yellow heading-stub + chevrons for a decided pass above/below (persists `DEPTH_INTENT_HOLD_S` 3s). Traces redraw from dead-reckoned noses each frame; a held koi reports no intent and draws nothing. The roster also carries the `Source on GitHub` link, and the roster nav contains its presses (stopPropagation) so panel clicks never strike the water.
- **Pointer.** Every layer + iframe is `pointer-events:none`; host runs one normalized stream, hit-tests against fish-reported outlines, notifies the winner. HOVER ≠ SELECTION: hover only says selectable (fish traces a SOFT silhouette via `koi.setOutline(0.35)`, cursor pointer/grab — no card); press = hold (pause; fish traces the FULL silhouette `setOutline(1)` and opens its card, which stays open until release however the pointer moves; picking a DIFFERENT koi releases the held one first — one inspection at a time); drag past slop (6px/12px touch) = carry (`place` streamed once per painted frame, grab-offset preserved, hover pick + strikes gated, card chrome hidden while carrying); drop = release + resume; tap a held fish = release in place. The silhouette is renderer-native: inverted-hull meshes `koi-outline-skin`/`koi-outline-fins` in `lib/src/three/koi.ts` sharing the live spine uniforms (2 extra draws, only when highlighted) — NEVER reintroduce a host-drawn rectangle. Mobile: `touch-action: manipulation` stays on `#pond`; a non-passive `touchmove` listener preventDefaults ONLY while a fish press is active (otherwise the browser takes the pan and pointercancels the drag mid-carry). `selection.ts` owns the card shield + two anchors.
- **Rendering.** Each fish owns its own transparent `WebGLRenderer` (eight GL contexts) but renders ONLY its own frame box: `koiFrameBox` (lib) → square canvas ~1.7 body lengths, slid by CSS transform, camera narrowed via `PondView.frame()` (`setViewOffset`), buffer sized by `fitPondRenderer` (DPR≤2, 1280px cap), hidden + skipped entirely when outside the view. NEVER go back to viewport-sized fish canvases — a shoal of full-viewport MSAA buffers was the Chromebook killer, and for the same reason `createPondRenderer` asks for `antialias` only below DPR 2 (eight multisampled buffers is what gets a frame killed on a phone; at 3× the stair-steps are invisible anyway). The koi is anchored by `PondView.placeKoi` (nose → pond point), never by `place`: the model's origin is its pivot at `PIVOT_STATION`, so anchoring the origin swims the fish a third of a body length ahead of the outline it reports and crowds its snout against its own frame box. Host paints the bed canvas-2D (resize-only) and the moving surface on ONE WebGL context (`host/src/scene/water-gl.ts`, caustics + ripple crests + a slow brighter low-alpha surface veil + card edge fade, ~0.72× resolution; the veil is GPU-only by design) with the 2D painter (`surface-canvas.ts`) as automatic fallback. All fish build the same camera from `POND_VIEW` (`lib/src/model/pond-view.ts`, tilt 10°/fov 26°/exposure 1.15) via `createPondView` (`lib/src/three/pond-view.ts`) so eight renders composite as one scene. The 2D steering brain (`fish-*/src/koi/koi-motion.ts`) stays authoritative for _where_ the fish is; the renderer only expresses it.
- **Behaviour.** Scheduled, not noisy: lib verbs `createPaceSchedule` (loaf/brisk/burst, exclusive events), `createItinerary` (seeded waypoints, ~10% forced through the visible view), `slipsAway`/`wrapAcross`/`SHORE_ABSENT_S` (one boundary approach in five slips out, 5s absence, toroidal re-entry opposite side), upgraded `createEncounterMemory` (latches the manoeuvre KIND ≥0.9s + turn tail-off — the anti-oscillation core). Brains keep their own accumulated clock (`advance(dt)`, no elapsed arg), decide at 10Hz, anchor evasions as absolute headings (a target re-derived against the koi's own moving heading is what used to circle the shoal), and bound ordinary turns with seeded cooldowns. Turn dynamics: the heading's rate is a wound `turnVelocity` state under `TURN_ACCEL` 2.2 rad/s² (never a step — this is what killed the neck-snap), ceilings from `TURN_RATE {0.35,0.8}`×gain taxed by speed over cruise (`TURN_SPEED_TAX` — a bolting fish physically cannot turn tight), `TURN_APPROACH` ramps every turn out; speed hard-capped at `MAX_SPEED_BL_S 3.4` with `ACCEL_LIMIT_BL_S2 2.6`. 3D side: `turnBend` saturates at 1.4 rad centred 0.4 (torso, NOT the 0.32 shoulder that read as a broken neck), `bodyFlexibility` keeps the skull near-rigid, the amplitude surge term is clamped (an unclamped per-frame accel spike convulses the body — also why every renderer refreshes `lastSpeed` in its offscreen-skip branch).
- **Packaging.** Every fish is a real packaged feature: `fish-<fw>/feature.config.ts` (version tracks the contract, 0.7.0) + root `koi-fish.contract.ts` re-exporting the lib contract + `pack-shell` target (`hf build --ci --allow-open`) → eight shell tarballs vendored in `host/vendor/`, installed as `file:` deps. A contract bump = lib:refresh FIRST (shells bake the contract from the installed tarball), then refresh-fish-shells, then **manually delete the stale old-version .tgz from host/vendor** (the refresh target never prunes) and re-run `node host/scripts/install-vendored-shells.mjs`. `koi-sessions.ts` opens each koi via its generated `createFeatureShell`; `COMPOSED_DEPLOYMENT: true` overrides each baked URL with the `/fish-<fw>/` sub-path — flip it (and provision the `metadata.deploy` Railway services) to go multi-origin. Fish configs declare `modes: ['embedded']` — their only real presentation (needs the `hf` CLI >=0.7.0; older generators failed to compile subset-mode shells).
- **Embedding.** Each service ships `public/hf-serve.config.json` (pond + all eight fish) carrying `frame-ancestors` header rules for `hf serve`. `frame-ancestors` is checked against EVERY ancestor, so the koi value must name the pond AND the docs site (chain is docs-site -> pond -> koi); naming only the pond blanks the shoal. In the pond's file the koi override is a later `"prefix": "/fish-"` rule — rules apply in order, later wins per header. All nine configs also send `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Resource-Policy: cross-origin` — the standalone pond origin is therefore crossOriginIsolated (the card's memory line measures there; embedded under the non-isolated docs-site it honestly stays unavailable). The prefix rule only overrides CSP, so COOP/COEP reach the fish paths too — every document in the chain needs COEP or isolation collapses. `hf dev` applies no header rules; to see isolation locally, `hf serve --root` the built site (hf serve also falls back to the `PORT` env var since the fallback shipped in lib-features).
- **Protocol.** Eight inner channels run as explicitly **open shells** (`protocol: 'none'` in each fish feature.config, packed with `--allow-open`) — v1's per-message PBKDF2 is the F-011 collapse; transport stays origin-pinned. Outer gallery↔pond channel keeps `protocol: 'v1'`.

## Commands (from repo root)

```bash
# lib: build + pack + reinstall into ALL consumers (ALWAYS run after editing lib/src)
npx nx run demo-koi-lib:refresh
npx nx run demo-koi-lib:verify          # fail loudly when tarball/consumer lock drifted
npx nx run demo-koi-lib:build           # tsc only; refresh does build+pack+install

# fish shells: repack all eight + reinstall into host (run after inner-contract or fish feature.config changes)
npx nx run demo-koi-pond:refresh-fish-shells

# the whole family
npx nx run-many -t build lint typecheck -p demo-koi-lib demo-koi-pond demo-koi-fish-*
npx nx run-many -t build -p demo-koi-*  # composed site → dist/apps/demos/koi-pond/site

# per project (only demo-koi-lib and demo-koi-pond carry a `test` target)
npx nx test demo-koi-lib
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
// goto http://localhost:4288/, wait ~9s (curtain lifts after 8 opens), screenshot;
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

| Concern             | File                                                                                                                                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camera contract     | `lib/src/model/pond-view.ts` (numbers), `lib/src/three/pond-view.ts` (builder)                                                                                                                                                                                                           |
| 3D koi surface      | `lib/src/three/koi.ts` (`createKoi`), `lib/src/koi3d/` (anatomy/mesh/spine)                                                                                                                                                                                                              |
| Depth model         | `lib/src/model/depth.ts` (`depthZIndex`/`swimDepth`/`mayRipple`)                                                                                                                                                                                                                         |
| Host assembly       | `host/src/scene/pond.ts` (loop, pointer, fan-out)                                                                                                                                                                                                                                        |
| Relay + dead-reckon | `host/src/scene/relay.ts` (`record`/`neighborsFor`/`pick` take `now`)                                                                                                                                                                                                                    |
| Shell sessions      | `host/src/scene/koi-sessions.ts` (one vendored `createFeatureShell` per fish; `COMPOSED_DEPLOYMENT` URL seam)                                                                                                                                                                            |
| Fish renderer seam  | `fish-<fw>/src/koi/koi-render*` + `runtime/koi-runtime.ts` (injectable `KoiRendererFactory`)                                                                                                                                                                                             |
| Fish brain (2D)     | `fish-<fw>/src/koi/koi-motion.ts` (framework-free, survives renderer swap)                                                                                                                                                                                                               |
| Docs-site gallery   | `apps/docs-site/src/lib/demo-manifest.ts`, `apps/docs-site/src/components/demos/demo-wiring.ts` + `demo-console-actions.tsx` (`KoiPondConsoleActions`) + `cover-flow.tsx` (card ↔ expand) + `demo-showcase.tsx` (landing expand) + `expanded-chrome.tsx` (shared ✕/esc/neighbour chrome) |

Cadence/budget constants: `OUTLINE_INTERVAL_MS=100` + `MAX_FRAME_S=0.1` (fish runtime), `RELAY_INTERVAL_MS=120`, `RELAY_REACH=3.4`, `HOVER_SLACK=0.14` (`TOUCH_SLACK_SCALE=2.6` for taps), `DEAD_RECKON_MAX_S=0.6`, `STALE_REPORT_S=3` (ghost eviction), `SHOAL_PULSE_MS=10_000`, `OPEN_TIMEOUT_MS=20_000` (8 handshakes queue past the 10s default), `CURTAIN_DEADLINE_MS=5000`, `SEQUENCE_DEADLINE_MS=14_000`.

## Edit a fish (mirror `fish-vanilla`)

Renderer is injectable so specs run headless: `createKoiRenderer(root, profile, url, pond, createGl?)` returns `{ koi, draw(state,dt), setPond, setHovered, placeCard, dispose }`; runtime takes `KoiRendererFactory`. Sleep cancels the rAF outright; `dispose` runs on pagehide. Units shim: pond-px speed → body-lengths (`/pxPerUnit`), turn `+wrapAngle(Δheading)/dt` (positive `turnRate` = clockwise on screen = the fish's right flank — NEVER negate, or heads bend against their turns), `escapeIntensity` from `phase==='escape'`, depth via `swimDepth(level)`. Scene = koi group (`koi-shadow`/`koi-skin`/`koi-fins`/`koi-eyes`) + `createLighting(POND_VIEW.lighting)`. Each fish declares `three ^0.185.1` + `@types/three ^0.185.4` (the lib peer is optional, not installed transitively).

**Adding a whole framework** (angular precedent): `KoiFramework` union + `KOI_FRAMEWORKS` are **append-only** — list position is the koi's seed, reordering re-rolls every fish. Touch: palette (LABELS/BRAND/VARIETIES), HEFT, FRAMEWORK_SITES, `tools/refresh-lib.mjs` CONSUMERS, host `koi-sessions.ts` (shell import + factory map), host `project.json` refresh-fish-shells (dependsOn + cp line), count prose everywhere, docs-site copy. Trait/body draw offsets are append-only too (body band next free slot: 14 — 13 took `caudalSpread`).

**Angular specifics** (fish-angular): AOT via `@analogjs/vite-plugin-angular` pointed at `tsconfig.angular.json` (extends the app config with `noEmit: false` — the default no-emit config makes every module compile to NOTHING with no error, yielding a polyfill-only bundle). Never set `resolve.mainFields` (breaks the lib's ESM-in-CJS dep). Zoneless (`provideZonelessChangeDetection`), no TestBed, no zone.js. Seam: `createApplication` → `createComponent(KoiFish, { hostElement: root })` → `setInput` ×3 → `attachView` → `tick()`; `dispose()` must `root.replaceChildren()` after `app.destroy()` (Angular never clears a caller-provided host). Lint: `@angular-eslint/eslint-plugin` alone (the meta package peers on `@angular/cli`).

## Gotchas

- **Framing**: a koi is mounted ONLY from its directory URL `fish-<fw>/` — its assets are relative, so a host that rewrites `…/index.html` to an extensionless path drops the document a directory up and every asset 404s (this blanked the shoal in production once). Needs features >=0.6.0, which serves directory URLs. **F-011**: v1 message collapse across concurrent channels (root-caused; inner channels drop v1) — still open in `roadmap/showcase/findings/`. F-010/F-015/F-016 shipped in features 0.7.1 and are cleared from the registry; the koi host pins the debug UI with `debug.port: 4290` in `hf-dev.config.ts`.
- **Per-fish three.js** (~180 kB gzip × 8 ≈ 5.7 MB): inherent to eight independent apps; a shared chunk breaks the isolation the demo proves. Curtain covers the load. Not a bug.
- **Unit tests live in `demo-koi-lib` and `demo-koi-pond` only.** The eight `fish-*` apps carry no vitest, no `test` target, and no test devDeps by design: the demos themselves are the evidence they work, and eight parallel suites proving framework glue cost more dependency and maintenance surface than they return. Do not add unit tests back to a fish app; browser/integration coverage is the intended future lane. Keep the lib's specs mutation-proven (disable avoidance → boundary specs fail) across all seeds, and never write `?.foo()).not.toBe(null)` (passes on absent nodes).
- **Devcontainer**: ten `npm install`s at `parallel:1`; full `nx lint docs-site` can SIGKILL — lint targeted file lists (`npx eslint <files>`).

## Presentation & tuning

Card expand is **unmask**: `CoverFlowCard` restyles into `fixed inset-0` around the same live embed (the deck container drops its `perspective` while expanded — perspective is a fixed-position containing block), with shared `ExpandedChrome` ✕/Escape/next-demo controls (the ← → neighbour pair is `hidden sm:flex` — on a phone they sit where a finger reaches into the scene); `cover-flow.tsx` sends `set-scene` on live/expand changes and hands `expanded` up so `DemosGallery` switches the host console to its `overlaid` widget (`fixed left-2 top-2 z-[210]`, labelled, opposite the ✕ — anything below the overlay's z-index is unusable, and the inline panel is unreachable while the page's scroll is locked). The landing `DemoShowcase` expands the same way (its frame container drops `backdrop-blur-sm` **and its `z-10`** while expanded — a z-index makes it a stacking context, which trapped the overlay under the site header and left the ✕ unclickable on a phone; its ring and pause/skip controls stand down while expanded for the same reason: they are siblings that would paint over the scene, and rotation is frozen anyway). Both surfaces subscribe `shell.on('close-request', collapse)` in their `holdShell` — window keydown alone can never hear Escape once focus is inside the pond's document. While the deck caption sits under the expanded translucent scene it restyles into a dark plaque (`bg-slate-950/60`, light text) so it stays legible beneath the waves with the fish free to swim over it. Fish sizing: `FISH_LENGTH_RATIO 0.36` of the world's shorter axis (clamp 130..560), margin `1.05` fishLengths. The caudal blade carries a lateral dihedral (`caudal.spread`, default 0.2, trait band 0.20–0.28) so the fork reads from straight above — a flat vertical blade vanishes edge-on on narrow portrait viewports (the S24-Ultra stub-tail bug); never zero it, and the band has to clear the bank (`bank = turn*0.28`, up to 0.36 rad) as well as the level view. The blade also refuses the body's own curvature: `finFlexibility` in `spine-pose.ts` fades curvature to `CAUDAL_FLEX` past `CAUDAL_ROOT` (a rayed membrane is carried and lags, it does not coil), which is what stopped the fork rolling onto its edge every beat and reading as a fish with no tail; `BLADE_DRIVE` in `swim-state.ts` pays the lost tip reach back into the body wave so the calibrated tail sweep still holds (`pose.spec.ts` guards it). Phenotypes: `koiPhenotype`/`koiTrim`/heft table in `lib/src/model/traits.ts`; varieties (pattern+ground+secondary per framework) in `palette.ts`. Press a fish = hold/inspect with silhouette + persistent card (host routes via `relay.pick`; taps widen the slack); drag while held = reposition, drop auto-releases; tap a held fish = release; open water = strike (a held fish stays held through strikes). The card is a small live inspector rendered by the FISH (name+variety, behaviour line, app URL link, runtime/origin/uptime/fps line, memory line, last-event line, framework-site link, app-source link to the fish's own directory on GitHub) from shared `describeKoiCard` strings; memory uses `performance.measureUserAgentSpecificMemory` filtered to the fish's own attribution and honestly shows `unavailable` without cross-origin isolation — the standalone pond origin IS isolated (COOP/COEP serve headers) so it measures there; the embedded gallery is never isolated, expected; samplers run ONLY while held (card rows 500ms, memory 10s) and tear down on release. The generic console "Open as dialog" opens a second session — dev tool only, never the product expand path.

## Checklist

- [ ] Edited `lib/src`? → `demo-koi-lib:refresh` then `:verify`
- [ ] Changed the inner contract or a fish `feature.config.ts`? → `demo-koi-pond:refresh-fish-shells` (host vendor tarballs + package.json + lock land together)
- [ ] Scope = Nx project name; one project per commit; no version/changelog/tag files
- [ ] Comments never cite finding IDs / roadmap docs
- [ ] `npx nx run-many -t test build lint typecheck -p demo-koi-*` green
- [ ] Serving built site by hand → `http-server`, never `serve -s`
