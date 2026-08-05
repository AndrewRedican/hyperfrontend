# 15 — Koi Pond ⭐

The visual-thesis flagship: a tranquil top-down zen pond where **seven koi, each rendered by an independently implemented app in a different framework**, swim in layered transparent full-viewport frames over a host-owned pond. Calm ambient motion, no controls; the only interaction is disturbing the water — a click/tap ripples the surface and nearby fish scatter. Hovering a fish reveals its framework and the URL of the app rendering it.

**Type** Execution · **Status**: Next up — built by hand (deliberately jumps the [06](06-demo-2-and-generator.md) generator gate, like the two demos before it).

Supersedes the earlier plugin-seam koi concept (host repositioning small feature containers); fish now own their motion inside full-viewport frames and the host owns the environment.

## What it proves

Multiple independently implemented apps running simultaneously, composited into **one continuous scene**: shared visual model (depth, light, water), host-mediated coordination (disturbances, proximity, depth transitions), framework isolation intact — and, via the pond's dual role below, the first live **gallery → host/hostee → fish** nesting chain.

## Locked decisions

| Topic          | Decision                                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout         | One slot, nine subprojects: `apps/demos/koi-pond/{host, fish-react, fish-vue, fish-svelte, fish-solid, fish-preact, fish-lit, fish-vanilla, lib}` — each fish a standalone npm project (own lockfile/vite config/`project.json`)                                 |
| The seven      | React, Vue, Svelte, SolidJS, Preact, Lit, vanilla TS/Web Components (all first-party Vite plugins; Angular stays deferred)                                                                                                                                       |
| Host           | Vanilla TS — pond floor, surface-water layer, pointer capture, shell orchestration; the host renders no fish                                                                                                                                                     |
| Shared package | `apps/demos/koi-pond/lib` — non-publishable koi model/contracts/geometry package, built + `npm pack`ed to a tarball each of the 8 consumers takes as a `file:` dep (refresh-flow mirroring the docs-site `refresh-shell` pattern)                                |
| Mounting       | **Embedded mode into host-owned fixed full-viewport transparent containers** — not dialog mode (dialog pins every instance to the same max z-index, arms backdrop-dismiss, applies dialog-box sizing to the root, and appends above the host's water layer)      |
| Depth          | Seven logical koi depth levels mapped to host-controlled container z-index (host owns the containers, so reordering is clean); passing above/below requires a configurable ≥2-level shift, with cooldown/hysteresis; surface-water layer always topmost, no fish |
| Pointer        | All fish iframes `pointer-events: none`; the host owns one normalized pointer stream; hover identity via host-side hit-testing against fish-reported outlines; host notifies the hovered fish, and the fish renders its own hover UI                             |
| Coordination   | Per-feature channels only (no SDK broadcast): fish report compact state snapshots at a low cadence; host aggregates, broad-phase filters, and relays only nearby-fish observations; fish interpolate locally between snapshots                                   |
| Randomness     | `@hyperfrontend/random-generator-utils` (published) — `randomGaussian` for trait/jitter spreads, `randomUniform`/`randomPseudo` elsewhere; no unseeded `Math.random()` where the package serves                                                                  |
| Deployment     | **One Railway service**: host at `/`, each fish at `/fish-<name>/` — distinct per-fish URLs for hover-info, boundary labeled same-origin (deliberate; the boundary is not this demo's point). Deploys ride the GitHub integration on merge to `main`             |
| Gallery        | **The pond host is also a hostee**: it declares a `feature.config.*` + minimal contract, packs a shell via `hf build`, and the docs-site mounts it like the other demos — embedded card by default (scene scaled down), **SDK dialog mode as the expand**        |
| Conclusion     | In expanded mode: click → disturbance → escape → the pond emits `sequence-complete` → docs-site closes the dialog back to the card. Standalone and in-card: after the escape unwinds, fish decelerate, re-enter, and resume ambient cruising — an endless loop   |
| Consumer lens  | All 8 apps consume the **published** `@hyperfrontend/features` (^0.5.x) — invariant #1; the shared lib likewise depends only on published packages                                                                                                               |

## Core simulation model (summary)

- **Virtual pond**: a coordinate system extending viewport-relative margins beyond every edge (sized in fish lengths, resize-aware); the viewport is a window onto it. Fish may leave the visible screen; only the virtual boundary triggers forward-aware, curving avoidance — never clamping or bouncing.
- **Procedural koi**: top-down spine-based SVG — curved centreline, width profile → body contours, head/segments/tail/fins; body flexes through turns (head leads, tail lags); four visibly distinct states (relaxed, turning, escape, depth transition).
- **Identity & behaviour**: per-fish palette derived from the framework's brand colours; normalised 0–1 behavioural traits (cruise speed, shyness, social affinity, awareness, directional caution, depth-change willingness, reaction intensity, turn responsiveness) + physical profile.
- **Collision**: compact reported outlines (capsules/spine samples, never full SVG paths); host broad-phase (grid/buckets) → pairwise narrow-phase predictive avoidance; turn / slow / accelerate / pass-above / pass-below.
- **Surface ripples**: only the highest-depth fish may request them; fish report compact ripple requests, the host validates/rate-limits, the surface-water layer renders. Click ripples are host-owned.
- **Accessibility**: mouse + touch; keyboard/AT-accessible fish roster equivalent for hover identity; `prefers-reduced-motion` damps oscillation, escape intensity, distortion, and depth-scale change without losing the functional demonstration.

The full behavioural/physical/rendering specification lives with the implementation effort; this plan records the architecture so the roadmap stays concise.

## Known constraints and risks (from API recon — resolve during implementation)

- **Transparency at depth**: `allowtransparency` + body reset is proven for one overlay, never seven stacked over an animated canvas — establish a perf budget early (each iframe is its own compositing layer); reduce off-screen fish rendering; pause when hidden.
- **F-008 interplay**: fish apps must paint nothing on `body`/root backgrounds — any paint blanks the pond behind that frame.
- **Reveal choreography**: frames stay hidden until each session opens (staggered handshakes) — hold a host-side curtain until all seven `open` events land.
- **Seven brokers**: each shell adds a page-level `message` listener plus 1 Hz heartbeats — keep cross-frame cadence low and payloads compact; schema-less contract actions skip validation cost where appropriate.
- **Tarball churn**: a koi-lib bump touches 8 `package.json`s + lockfiles (integrity-hashed tarballs) — make the refresh target regenerate all consumers in one pass; each consumer with dependency-checks needs the lib's exact name in `ignoredDependencies`.
- **Devcontainer**: 9 `npm install`s at `parallel: 1` — serialize; expect the demo family to dominate install time.

## Incremental order

1. Host pond floor + topmost water layer (host-only, no features).
2. Virtual pond coordinate system.
3. One procedurally animated reference koi (vanilla) + shared lib contracts/geometry.
4. Occupied-outline reporting + disturbance flow + host pointer ownership.
5. Multi-fish awareness/avoidance, depth model, passing, surface ripples.
6. Remaining six framework apps.
7. Pond-as-hostee: contract, `hf build` shell, docs-site card/expand wiring.
8. Polish, perf, reduced-motion, a11y roster; deploy; register in the gallery.

Do **not** start with seven disconnected fish implementations — the shared model, coordinate system, and one complete reference fish come first.
