# 04 — Demo 1: Clock (the weed-clearer) ⭐

The special, prominent, takes-longest first demo. Its job is not the clock — it is **clearing the consumer path** end-to-end with the lowest possible feature-risk, so every bit of friction is cleanly attributable, and **extracting the blank prototype** as a by-product.

**Depends on** [01](../../.claude/skills/demo-findings/SKILL.md), [deployment](00-strategy.md#deployment-and-the-origin-boundary-layer) · **Type** D+E · **Status**: **Implemented** (2026-07-01) — Phases 1–5 and 7 delivered; Phase 6 needs the Railway service created (deploy metadata + registration are in place). Produced fourteen findings on top of the planning grill's two — including six **blockers** in `@hyperfrontend/features@0.1.0` (dev server, debug-UI packaging, host crash without cross-origin isolation, message delivery, connector build) that make live host↔feature contract traffic impossible on the published SDK; the feature side is fully implemented and wire-verified, hosts embed visually, and the messaging thesis waits on the v2 fixes. **Update (2026-07-03)**: all 17 findings are fixed in the workspace ([13-v2-release.md](13-v2-release.md)); once published, the demo re-consumes 0.2.0 and drops its workarounds per that plan's post-publish checklist. Blank prototype extracted to [blank-prototype.md](blank-prototype.md). **Subsumes** the Clock portion of [../feature/08-demos.md](../feature/08-demos.md).

See [00-strategy.md](00-strategy.md) (journey J1, "Special handling") and the [index](README.md).

## Before writing any code (gate)

- Consume the **published** `@hyperfrontend/features` exactly as an external consumer (invariant #1) — no `libs/features/src` imports.
- Invoke the **`demo-findings`** skill the instant friction appears, before any workaround (invariant #2).
- Read the `coding` skill + skim `tools/eslint-rules/docs/`.

## The concept (locked)

A **clock coin**: a minted-metal coin floating on a transparent background, an analog clock face on one side and a digital face on the other. Visitors press, drag, or swipe to spin it with physics-like momentum; it decelerates and snaps onto a face. **The resting face _is_ the clock's format** — every flip a visitor makes is contract traffic (`format-changed`), and every `set-format` the host sends is a physics flip they can watch. The demo's hero interaction and its messaging thesis are the same gesture.

Visual heritage: the analog dial, orange accent (`#fd7014`), and BenchNine numerals continue the legacy analog clock from this codebase's lineage; the implementation shares nothing with it.

## Composition model (locked — this is the blank prototype's shape)

- **The docs-site is the host.** No standalone demo host app. The clock feature is embedded in two docs-site locations: the **landing page** (hero coin) and the **demos page** (inside the cover-flow carousel, below). The gallery-as-host story (strategy: "the gallery is itself a hyperfrontend host") arrives with demo 1.
- **The feature is one self-contained consumer app** at `apps/demos/clock/` (project `demo-clock`, replacing the sourceless placeholder in place): its own `package.json` + committed lockfile + `node_modules` + scaffold-native tsconfig that **never extends the workspace base** — the workspace `tsconfig.base.json` maps `@hyperfrontend/features` to `libs/features/src`, which would silently violate invariant #1. (Verified: the repo has no npm-workspaces linking, so registry installs are genuinely registry bits.) This matches the docs-site's existing house pattern (`@hyperfrontend/app:install` / `@hyperfrontend/app:build` executors + Nx `run-commands` wrappers).
- **The shell crosses as a tarball.** `hf build` generates the shell; `npm pack` produces `@hyperfrontend/demo-clock-shell-<v>.tgz`; the docs-site **vendors** the tarball (committed under `apps/docs-site/vendor/`) and installs it as a `file:` dependency — a real install step simulating "the feature team shipped us a connector", without registry publishing. A `refresh-shell` target re-packs and re-vendors.
- **Dev-loop host is `hf dev`** (the debug UI: message log, security inspector, display-mode switcher). Inner loop: `create-vue` scaffold → `hf init` → `hf dev`. Docs-site embedding is verified at integration time against a local feature URL.
- **Explicitly out of scope for demo 1:** the `@hyperfrontend/features/nx/*` generator/executor surface (a self-contained Vite app is not an Nx-workspace consumer — that surface needs its own demo), and the security protocols (`protocol: 'none'` for the clock; the envelope is the Security bounty hunter's job).
- **Blank prototype v1 is therefore feature-only**: a self-contained feature app + gallery registration + deploy metadata. Demo-owned hosts (stock dashboard, views, chess…) are a second prototype variant, extracted when the first demo needs one.

## Frameworks (locked)

**Vue 3 feature** (create-vue scaffold; physics as a small framework-agnostic TS module, faces/state in idiomatic Composition API) → **React host** = the docs-site (Next.js 15 / React 19). The catalog's "Vue feature → React host" row holds, with the gallery as the React host.

## Contract (locked)

The feature owns all state; the host commands, the feature confirms with echo events. Declared code-first in `feature.config.ts` (name `@hyperfrontend/demo-clock` → shell `@hyperfrontend/demo-clock-shell`; scoped-name handling in `hf` is expected finding fodder).

| accepted (host → feature)           | emitted (feature → host)                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `get-time`                          | `tick` `{epochMs, iso, timezone, locale, format, formatted}` @ 1 Hz                                |
| `set-format` `{format}`             | `time` — same snapshot, answers `get-time`                                                         |
| `set-timezone` `{timezone}`         | `format-changed` `{format, cause: 'user'\|'host'\|'alarm'}`                                        |
| `set-locale` `{locale}`             | `timezone-changed` `{timezone}`                                                                    |
| `set-alarm` `{at: 'HH:mm', label?}` | `locale-changed` `{locale}`                                                                        |
| `clear-alarm` `{id}`                | `alarm-set` `{id, at, firesAtEpochMs}` · `alarm-fired` `{id, at, label?}` · `alarm-cleared` `{id}` |

Semantics: timezone = IANA id, locale = BCP-47, both applied via `Intl` (no hand-rolled i18n). Alarms: multiple, one-shot at the next occurrence of `HH:mm` in the feature's current timezone, in-memory only. `get-time` is single-in-flight (no correlation ids — the 1 Hz `tick` makes pulls rare; the gap is a filed finding). The raw generated shell is consumed as-is — stringly `send`/`on` is the current ergonomic ceiling, likewise filed as a finding.

## The coin (locked)

- **Rendering**: CSS 3D transforms — `perspective` wrapper, `preserve-3d` coin, two DOM faces with `backface-visibility: hidden` (back pre-rotated 180°), edge faked with stacked discs, physics writes one `rotateY` per frame. SVG dial + CSS-rotated hands; real text everywhere.
- **Motion**: Y-axis spin with a few degrees of springy pointer-driven X-tilt. Hand-rolled physics (~150 lines, zero deps): drag = 1:1 manipulation (grabbing mid-spin catches it), release = momentum with exponential friction, spring-snap to the momentum-biased nearest face, tap = impulse flip. Landing on a face emits `format-changed {cause:'user'}`.
- **Identity**: minted dark-bronze/steel body, engraved rim, specular highlight sweeping with rotation (the notional light source), soft ground-shadow ellipse that squashes/shifts with the angle. Orange (`#fd7014`) hands/markers/digits; digital side is a dark inset LCD panel.
- **Faces (maximal)**: analog — 12 BenchNine numerals, minute ring, three hands, date window, day/night indicator; digital — large tabular `HH:MM:SS` (12/24 h per locale), locale date line, short tz label, armed-alarm list. Smooth-sweep seconds while visible — the rAF loop is gated by `visibilitychange` + IntersectionObserver (no offscreen/hidden spinning); reduced-motion drops to 1 Hz steps.
- **Alarm firing**: wobble + radiating pulses, then the coin physics-flips itself to digital (`format-changed {cause:'alarm'}`) and flashes the firing alarm until dismissed. No audio in the feature (autoplay-hostile in iframes) — hosts may chime on `alarm-fired`.
- **A11y**: reduced-motion crossfade instead of flips; coin is a focusable button (Enter/Space flips, visible focus glow); `aria-label` with time + face updated per minute; alarm firing announced `aria-live`; `touch-action` containment; axe smoke test in CI.

## Demos-page carousel (locked, in scope)

Docs-site-native React + CSS 3D cover-flow (same transform/spring toolkit as the coin). Manifest-driven — a static typed manifest in the docs-site (`{slug, title, poster, featureUrl, boundary, description}`); runtime registry deferred to [12](12-gallery-docs-integration.md). **Only the centered card mounts its live feature** via the vendored shell; neighbors show committed poster art (every demo ships a poster). Orientation-adaptive: horizontal cover-flow on landscape/laptop, vertical stack-flow on portrait mobile; drag/wheel/keys/touch with momentum + snap; reduced-motion flattens to a pager. Ships as demo 1's final PR with the clock as the first album.

## Deploy (locked)

Feature → its own **Railway static service** on `*.up.railway.app` (custom domains attach later per [strategy](00-strategy.md#deployment-and-the-origin-boundary-layer)); docs-site stays on its existing Vercel pipeline. The boundary is genuinely **cross-site** (strongest cell of the origin matrix), labeled in the demo README and manifest. Deploy metadata rides `project.json`.

---

## Phases

Every phase files findings as it goes (invariant #2). Devcontainer note: per-app `npm ci` runs are serialized, never parallel (memory ceiling).

### Phase 1 — Feature app scaffold (foundation)

Replace the placeholder: `create-vue` scaffold at `apps/demos/clock/`, self-contained per the composition model; `npm i @hyperfrontend/features@0.1.0`; `hf init`; `feature.config.ts` with the locked contract; `project.json` targets (`install`, `dev`, `build`, `test`, `pack-shell`) wrapping npm scripts via the `@hyperfrontend/app` executors; tags `type:demo`, `role:feature`. Files: `apps/demos/clock/{package.json, package-lock.json, project.json, feature.config.ts, tsconfig*.json, src/**}`.

**Verify**: `npx nx run demo-clock:install` → `hf dev` serves the app; debug UI connects and the contract handshake + heartbeat appear in the message log. `npx nx typecheck demo-clock` (app-local tsc) resolves `@hyperfrontend/features` to `node_modules`, not `libs/`.

### Phase 2 — The coin (isolated visual core)

Physics module (framework-agnostic TS, unit-tested: friction decay, snap selection, tap impulse, spring settle), CSS 3D coin, both faces (maximal), identity, a11y bundle, alarm engine (schedule/fire/clear, unit-tested with fake timers).

**Verify**: `npx nx test demo-clock` · `npx nx lint demo-clock --fix` · `npx nx typecheck demo-clock` · manual: spin/catch/tap/flick in `hf dev`; reduced-motion and keyboard paths.

### Phase 3 — Contract wiring (core messaging)

`createFeature` + all accepted/emitted actions; 1 Hz tick; echo events; `format-changed` causes from physics (`user`), commands (`host`), and alarms (`alarm`).

**Verify**: in the `hf dev` debug UI, drive every accepted action and observe every emitted action; `npx nx test demo-clock` for the action handlers.

### Phase 4 — Shell artifact (integration boundary)

`hf build` → generated shell → `npm pack` → tarball. Prove the artifact in isolation: install the tarball in a scratch project, typecheck an import of `createFeatureShell`.

**Verify**: scratch-project install + `tsc --noEmit` pass; tarball contents (`npm pack --dry-run`) contain no stray files.

### Phase 5 — Docs-site integration (landing + carousel)

Vendor the tarball (`apps/docs-site/vendor/`), `file:` dependency, `refresh-shell` target; landing-page hero embed; demos-page manifest + cover-flow carousel (own PR). Files: `apps/docs-site/{package.json, vendor/, src/app/page.*, src/app/demos/**, src/components/carousel/**, src/lib/demo-manifest.*}`.

**Verify**: `npx nx build docs-site`; manual: transparent coin over both themes, landing + demos page, carousel on landscape/portrait, focused-card-only mounting, reduced-motion pager.

### Phase 6 — Deploy + registration

Railway static service for the feature; deploy metadata in `project.json`; manifest gains the live URL + `boundary: cross-site`; demo README documents topology, contract, and origins.

**Verify**: live docs-site embeds the live feature cross-site; message log clean (no origin errors); `protocol: 'none'` labeled deliberately.

### Phase 7 — Blank-prototype extraction + findings sweep

Document the prototype (feature-only variant): vital components, the right level of emptiness, pre-built content — the seed for the generator ([06](06-demo-2-and-generator.md)). Sweep accumulated findings into the registry via the `demo-findings` skill; sync [catalog.md](catalog.md) if reality diverged.

**Verify**: registry table current; prototype doc reviewed against what was actually built, not what was planned.

## Carried decisions

- First demo = Clock, boundary-respecting (locked).
- Frameworks React/Vue land in demo 1: Vue feature, React (docs-site) host.
- Registry strategy resolved: real npm for `@hyperfrontend/features`; tarball for the demo shell.

## Remaining open questions

- Poster-art format/dimensions for carousel cards (settle in Phase 5).
- Whether the landing-page hero and demos-page card share one shell instance model or mount independently (independent expected; confirm during Phase 5).
- Host-side theming of embedded features ("how do I match the host theme?") — expected to become a finding during Phase 5.
