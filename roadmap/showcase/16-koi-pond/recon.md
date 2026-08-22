# Recon: the evidence under the plan

Measured 2026-08-22 against inner contract 0.7.0, outer contract 0.2.0, and
`@hyperfrontend/features` 0.7.1. Paths are relative to `apps/demos/koi-pond/` unless they
start with `libs/` or `apps/`. Line references drift as files are edited; re-anchor by
symbol name when in doubt.

## 1. Duplication across the eight fish apps

Method: md5 and `wc -l` per file, then pairwise diffs of comment-stripped sources.

- Total src per fish: vanilla 1,656 up to lit 2,076 loc (about 14.9k total). Of each fish's
  roughly 1,900 loc, **1,350 to 1,500 loc is shared logic duplicated eight times**; only 300
  to 450 loc per app is genuinely framework-idiomatic (the component and mount layer). That
  is about 78 percent duplication by volume.
- `koi/koi-motion.ts` (664 to 672 loc): **byte-identical modulo comments in 7 of 8**.
  `fish-react` and `fish-angular` share an md5; svelte equals vanilla at zero stripped
  diff; vue/solid/preact are within 3 stripped lines; lit is the same algorithm and the
  same 30+ tuning constants restyled as a class. No fish composes the steering verbs
  differently, contradicting each file's own header comment.
- `runtime/koi-runtime.ts` (367 loc; lit 579): 7 of 8 identical within 2 to 7 stripped
  lines; the one real per-app datum is the `FRAMEWORK` string. Lit is a `ReactiveController`
  restyle, the one genuinely idiomatic runtime.
- `feature/wire-contract.ts` (131 to 143 loc): 7 of 8 within 0 to 4 stripped lines; lit adds
  a pure `readShoal` extraction. Deliberately SDK-free (structural `FeatureLink`).
- `koi/koi-stage.ts` (174 loc in react/solid/preact/angular, **zero stripped diff**) with
  the same loop open-coded in vanilla, vue, svelte, and lit renderers. Pure three.js; its
  own header says "nothing here is a component".
- `koi/card-anchor.ts`: react and angular byte-identical; preact's signature drifted
  (`PondWindow` vs `PondEnvironment`), a live API divergence in the same function.
- `styles/fish.css` (92 loc): byte-identical across seven; lit keeps shadow styles.
- `main.*` byte-identical across all eight. `state/koi.ts` zero stripped diff across seven.
- Genuinely idiomatic and staying per-app: the component/render layer (react
  `createRoot` + refs, preact `render`, solid signals, vue SFC, svelte runes + `flushSync`,
  lit shadow DOM + `ReactiveController`, angular zoneless `createComponent`, vanilla DOM).

Drift already caught (the cost of the status quo): `DEPTH_ROLL_S` hoisted in five apps but
inline `1.4` in vanilla/svelte; `ENTRY_DEPTH` vs `OPENING_DEPTH` vs a bare `3` for the same
value; the preact `cardAnchor` signature divergence; every `koi-motion.ts` header still says
"the other six koi" after angular made it seven.

Git evidence: 19 waves of 6+ same-subject parallel commits across `fish-*`; `koi-motion.ts`
has been rewritten five times per fish, `koi-runtime.ts` nine times per fish; commit
`39463d2c` touched all eight fish at once for the nose-anchor change.

Mechanics common to any move: the lib is consumed as a committed `file:` tarball, so every
change requires `npx nx run demo-koi-lib:refresh` then `:verify`; moved code inherits the
lib's vitest and mutation-proven-spec obligations (fish apps deliberately have none).

## 2. Scene signals: when a pond can know card vs full

- Eight fish shells open synchronously during pond module eval (`openShoal` at
  `host/src/scene/pond.ts:160`, `shell.open()` at `:470`, called from
  `host/src/hyperfrontend.feature.ts:56`), before any host signal can arrive; all wire
  signals are async message events.
- `Present` is queued before connect and is guaranteed to be the first message after channel
  open (`libs/features/src/host/lifecycle.ts:306-309`); the hostee emits `presentation`
  `{mode}` then `resize` (`libs/features/src/hostee/lifecycle.ts:112-122`). Mode is
  `'embedded'` for both the card and the expanded overlay; only `set-scene` distinguishes
  them.
- `set-scene {scene:'card'|'full'}` is sent only by the gallery's `useExpandedEmbed`
  (`apps/docs-site/src/components/demos/use-expanded-embed.tsx:60-90`): re-told on every
  fresh proof of life and imperatively on expand/collapse. `live` flips on the first proof
  event or on the watchdog `healthy` snapshot, which fires at handshake open; so the first
  `set-scene 'card'` arrives about one React render after the handshake, well before the
  first fish lands, but after the shells were opened.
- Standalone tab: `resolveHostWindow` returns null (`libs/features/src/hostee/lifecycle.ts:31-39`),
  no channel is created, `send` no-ops, `ready()` never settles, `displayMode` stays null
  forever. The SDK knows "unhosted" synchronously but does not expose it on the handle.
- Doctrine (`host/src/runtime/feature-ui.ts:1-8`): the app never guesses its runtime from
  URLs, query params, or `window.parent`; presentation chrome keys exclusively off host
  announcements.
- Expand and collapse never re-present: same session, same iframe today; expand sends
  `set-scene 'full'` plus a `Viewport` control resize; a pond `close-request` (Escape) is
  answered with `set-scene 'card'`, which also re-arms the close latch
  (`host/src/hyperfrontend.feature.ts:72-74`).
- Options weighed for deciding one-vs-many before opening shells: (A) defer `openShoal`
  until the first `presentation` or `set-scene` with a short standalone fallback; (B) a
  `?scene=card` URL param (zero latency but contravenes the URL-sniffing doctrine); (C) a
  host boot hint on `PresentPayload` (cleanest contract, largest change). **Decision: A,
  strengthened by exposing `hosted` on the SDK handle so standalone skips the fallback wait
  entirely.**

## 3. Eight-fish assumptions in the host

Hard eight-fish sites: `host/src/scene/stage.ts:52-58` (one layer per `KOI_FRAMEWORKS`
entry; this is the actual gate, `openShoal` follows the layer map),
`host/src/scene/koi-sessions.ts:73-82` (exhaustive per-framework shell `Record`; all eight
vendored shells stay in the bundle), `host/src/scene/depth-director.ts:71`
(`spreadDepths(KOI_FRAMEWORKS.length)`), `host/src/scene/roster.ts:78`,
`host/src/components/vitals.ts:264`.

Count-agnostic and safe at any roster size: the relay (map keyed by reporter), the sequence
tracker (rides its 14s deadline), the curtain (`present.size === sessions.length`), the
shoal report (`{connected, expected}` pure numbers), resurrection, selection/hold/drag, the
interactions painter, and `entryStation` (computes all eight phantom entries
deterministically; only the own slot is read).

Solo-depth bug: a lone koi keeps its canonical `spreadDepths(8)` slot instead of
`spreadDepths(1) = [SURFACE_DEPTH]`; a solo vanilla koi is pinned at the deepest level
(0.72 scale, 0.58 opacity, 1.5px blur, `mayRipple` never true;
`lib/src/model/depth.ts:25-31,132-134,246-252`). Any sub-shoal roster must derive the depth
spread from the live roster.

## 4. A container-derived card world

- `describePond` call sites: the host (`host/src/scene/pond.ts:133`, from `window.screen`)
  plus each fish's standalone fallback. Hosted fish adopt the announced pond wholesale, so
  only the host call changes for a card world.
- Clamps: `MIN_POND` 800x600 (`lib/src/geometry/virtual-pond.ts:38,124-125`) silently turns
  a 288px container into an 800x600 world seen through a 288px window (fish length 216,
  about 17 percent of the pond visible; the card is empty water most of the time). With
  `MIN_POND` bypassed, `MIN_FISH_LENGTH` 130 becomes the governing floor (288 x 0.36 =
  103.7, floored to 130): the koi spans 38 to 53 percent of the card edge, legible and
  deliberately oversized.
- Buffers at dpr 2.8125 (S24U class): `fitPondRenderer`'s hard cap of 2 always wins
  (`lib/src/three/pond-view.ts:245-249`). Container-derived frame boxes run 142 to 274 CSS
  px, or 0.6 to 2.4MB GPU per koi including depth; with `MIN_POND` intact the box reaches
  455 CSS px (about 6.6MB) and overflows the card. The floor canvas paints at uncapped
  `devicePixelRatio` (`host/src/scene/pond.ts:318-325`): about 2.6MB for a 288px card at
  dpr 2.8125, worth capping.
- Small-world behavior with the stock verbs: itinerary `ARRIVE` (1.5 fish lengths = 195px)
  exceeds half the pond, so waypoints churn; boundary awareness (2.2 FL = 286px) covers
  nearly the whole pond; `slipsAway` rolls 20 percent per approach, so the koi leaves the
  world for 5+ seconds roughly every fifth approach. A card wants a stationary-but-alive
  fish, not the roaming verbs.
- `pause` as stationary-but-alive needs no wire change to hold position: the host sends
  `pause {paused:true}`, the fish skips `motion.advance` and sculls in place
  (`runtime/koi-runtime.ts:209-214` in each fish). Side effects a card must suppress: the
  held silhouette, the identity card, and the inspector timers; `sleep` is not a substitute
  (it cancels the rAF loop and freezes the mesh mid-beat).

## 5. Footprint

Today, full pond on a phone (dpr capped at 2): 9 WebGL contexts (eight fish + water), a
floor 2D canvas at raw dpr, an interactions 2D canvas, eight iframe documents, eight
three.js copies (about 650KB minified each). Order 150 to 250MB JS heap plus 30 to 60MB GPU
buffers. This is the regime that killed frames on the S24 Ultra.

Card instance (one fish, container-derived world): 2 documents, 2 WebGL contexts, 1 floor
canvas; order 3 to 6MB GPU and 25 to 40MB JS, roughly one eighth of today. Keeping all
eight fish in a card would shrink only buffers, not the eight three.js heaps, which is the
dominant cost; a card wants one fish.
