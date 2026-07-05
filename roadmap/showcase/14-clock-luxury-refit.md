# 14 — Clock luxury refit, showcase surfaces, Railway publish pattern

**Depends on** [04](04-demo-1-clock.md) · **Type** E · **Status**: Phases 1–2 **delivered** (2026-07-05); Phase 3 is the provider-side execution of [04](04-demo-1-clock.md) Phase 6 and stays open until the Railway service exists.

## Context

Demo 1 shipped with a serviceable minted-coin look, a 157 KB raster fallback poster that matched nothing, and a landing hero that had lost the demo-showcase frame (auto-advance border-timer + skip control) when the cover-flow gallery landed. This plan upgrades the clock into a haute-horlogerie timepiece, restores the showcase surfaces coherently, and records the repeatable Railway publish pattern every demo follows from here.

## The design (locked)

A luxury dive/dress hybrid in the coin's existing CSS-3D body. Palette chosen against the docs-site system (slate pages, blue-600 light lattice / cyan-400 dark lattice): deep navy pops on white/slate-50 light theme; on near-black dark theme the **bright steel case ring carries the silhouette** (plus the retained ground shadow), so the navy dial never melts into `#0f172a`.

- **Dial** — deep navy sunburst (`#12315f → #081a3c` radial + 72 sunray spokes whose opacity peaks along a 135° light axis + a directional light wash), printed silvery minute track.
- **Bezel** — bi-directional rotating ceramic insert (`#1c2c4c → #060d1c`) with platinum-tone graduations: per-minute marks through the first quarter, numerals every ten (flipped through the lower arc to stay readable), lume-pearl triangle at zero. **It actually rotates**: drag the knurled ring (3° ratchet detents, both directions), click it to step one detent, or use the arrow keys while the coin has focus; the dial-side drag still spins the coin.
- **Indices** — applied white-gold markers (gold-gradient stroke over lume fill, drop-shadowed to sit proud of the dial): triangle at 12, batons at 6/9, rounds elsewhere. Printed numerals are gone; BenchNine survives in the date, bezel numerals, brand lines, and the digital face.
- **Lume** — Chromalight-style blue. Day: soft `#cfe9ff`. Night (driven by the existing day/night computation): `#8fd8ff` plus a blue glow — the low-light story is functional, not painted on.
- **Hands** — polished-steel Mercedes hour hand (lume-filled three-spoke circle), sword minute hand with lume strip, and the sweep second hand in heritage orange `#fd7014` with lume lollipop — no ticking stutter (the existing rAF smooth-sweep; 1 Hz steps under reduced motion).
- **Date + cyclops** — date window relocated to 3 o'clock: white disc, black BenchNine numeral, white-gold surround, subtle cyclops lens over it.
- **Complication** — the day/night indicator became a small gold-ringed aperture above 6: gold sun by day, silver moon with stars by night.
- **Case** — brushed/polished 904L-look steel: outer polished ring with a dark hairline (light-theme separation), knurled bezel edge, fluted crown with twin crown guards at 3 o'clock (drawn inside the circular clip), steel coin edge, engraved rehaut (`HYPERFRONTEND ·` repeated).
- **Crystal** — domed sapphire read: dome highlight, concentric edge reflection, faint blue AR flash.
- **Case back (digital face)** — brushed-steel exhibition back with engraved ring text; the LCD is a navy sapphire window with ice-blue digits; alarm accents stay orange.
- **Heritage carried** — orange `#fd7014` (second hand, center dot, alarm surfaces) and BenchNine continue the lineage; the coin's focus ring moved from orange to Chromalight blue.

## Phase 1 — Luxury refit of the coin (delivered)

Files: `apps/demos/clock/src/components/{AnalogFace.vue, DigitalFace.vue, ClockCoin.vue}`.

- `AnalogFace.vue` — full redesign per the locked design; geometry (rays, track, bezel marks/numerals, knurl, indices) precomputed as constants; bezel rotation is pointer-captured on the bezel group with `@pointerdown.stop` so it never fights the coin grab.
- `DigitalFace.vue` — steel case back + navy LCD window restyle; markup shape and contract-facing behavior unchanged.
- `ClockCoin.vue` — steel edge discs, hairline face silhouette, cooler specular sweep, wider/cooler ground shadow, blue focus glow. Physics, a11y, and messaging untouched.

**Verify** (all green 2026-07-05):

```bash
npx nx test demo-clock
npx nx lint demo-clock --fix
npx nx typecheck demo-clock
npx nx build demo-clock
```

## Phase 2 — Docs-site showcase surfaces (delivered)

Files: `apps/docs-site/public/demos/clock-poster.svg` (new), `clock-poster.png` (deleted), `src/lib/demo-manifest.ts`, `src/components/demos/demo-showcase.tsx` (new), `src/components/demos/clock-hero.tsx` (deleted), `src/app/page.tsx`, `src/styles/globals.css`.

- **Fallback poster** — the raster replica is gone; `clock-poster.svg` joins the planned-demo poster family exactly (400×400, `#2d2a26 → #14120f` radial, BenchNine stack, `#fd7014` glyph) with a minimal clock glyph, "Two faces, one coin", and a `LIVE DEMO` tag where planned demos say `IN PLANNING`. The manifest points at it; cover-flow inherits it automatically.
- **Demo showcase reinstated** — the landing hero frame is back as `demo-showcase.tsx`, now manifest-driven: auto-advance across all `DEMO_MANIFEST` entries (20 s cycle), conic-gradient border-timer, fast-forward skip button, and a pause/resume toggle that freezes the ring and holds the current demo (WCAG 2.2.2). Layering contract: content `z-10`, border-timer `z-20 pointer-events-none`, controls `z-30` half-outside the frame — **no embed or poster can ever occlude the controls**. Live entries mount `ClockEmbed` + the status caption; planned entries show poster + description; reduced motion disables auto-advance, the timer, and pause, keeping a plain next button.

**Verify** (all green 2026-07-05):

```bash
npx nx typecheck docs-site
npx nx build docs-site
# lint targeted files only — full docs-site lint exceeds the devcontainer memory ceiling
cd apps/docs-site && npx eslint src/components/demos/demo-showcase.tsx src/app/page.tsx src/lib/demo-manifest.ts
```

## Phase 3 — Railway publish (open; provider-side)

All repo-side prep already exists: `apps/demos/clock/project.json` carries `metadata.deploy` (service `hyperfrontend-demo-clock`, origin `https://hyperfrontend-demo-clock.up.railway.app`, `kind: static`, `publishDir: dist/apps/demos/clock/app`), and the docs-site manifest already defaults `featureUrl` to that origin with a `NEXT_PUBLIC_CLOCK_FEATURE_URL` override. Until the service exists, the embed degrades to the poster after its 6 s liveness timeout — by design.

Execution checklist:

1. `npx nx run demo-clock:build` → confirm `dist/apps/demos/clock/app/` holds `index.html` + assets.
2. Create the Railway project/service named **exactly** `hyperfrontend-demo-clock`; claim that subdomain under Settings → Networking if Railway suffixes the default domain (the manifest default depends on it).
3. Serve the prebuilt `publishDir` as static files — `railway up` of the built dir with a one-line static server (Caddy `file_server` with SPA `try_files`, or `npx serve -s . -l $PORT`). Never let Railway rebuild the workspace: build-then-upload respects the registry-consumption invariant and the devcontainer's memory lesson, and matches a prior Railway setup in this codebase's lineage (per-project deploys off affected detection + a project→service map).
4. No special headers needed for the clock (`protocol: 'none'`, plain iframe embed); COOP/COEP only becomes relevant if a future feature needs cross-origin isolation.
5. Verify the origin standalone (coin spins, ticks in console), then the Vercel docs-site embed goes live with no docs-site change.
6. Full cross-site message-log verification stays gated on the `@hyperfrontend/features@0.2.0` publish ([13](13-v2-release.md)); re-deploy the rebuilt bundle after the demo re-consumes 0.2.0.
7. Custom domains attach later per [00-strategy.md](00-strategy.md#deployment-and-the-origin-boundary-layer); update `metadata.deploy.origin`, the manifest default, and the demo README together.

**The repeatable pattern (every future demo adheres):**

- Each deployable demo project carries the clock's `metadata.deploy` block shape in `project.json`: `provider` / `service` / `origin` / `boundary` / `kind` / `publishDir`, with `boundary` matching the `DemoBoundary` union in `demo-manifest.ts` so metadata and gallery labels cannot diverge.
- Service naming: `hyperfrontend-demo-<slug>` (single artifact) or `hyperfrontend-demo-<slug>-<role>` (multi-origin compositions); one Railway service per origin — cross-origin is never faked by co-hosting.
- Build via the Nx target, deploy the prebuilt `publishDir`; `kind: backend` demos get a minimal `PORT`-reading service with a `/health` 200 instead.
- Gallery registration: manifest entry with env-overridable `featureUrl` defaulting to the deployed origin (the `clockFeatureUrl()` pattern), poster in the SVG family, boundary labeled.
- When CI automation arrives, the project→service map is generated from the per-project `metadata.deploy` blocks; affected demos deploy per-service with `RAILWAY_API_TOKEN` + per-service IDs as secrets.

## Carried decisions

- The coin's identity spec in [04](04-demo-1-clock.md) ("The coin") is superseded by **The design (locked)** above; the composition model, contract, and physics remain exactly as locked there.
- The bezel is a feature-internal flourish — it deliberately emits no contract traffic (the contract stays the locked table in [04](04-demo-1-clock.md)).

## Remaining open questions

- Whether the poster's `LIVE DEMO` tag should switch to a status-aware variant once more demos go live (revisit with [12](12-gallery-docs-integration.md)).
- Whether the /demos cover-flow warrants its own always-visible previous/next affordances beyond drag/wheel/keys (the landing showcase now covers the visible-controls story).
