# @hyperfrontend/demo-heartbeat

An anatomical heart that beats: a flat-vector heart (React) whose every contraction is contract traffic, embedded same-origin by a framework-free host page that draws the rhythm as a red ECG sweep across the stage. Tap the heart for an extra pulse and the host pops a toast sticker off it; hold to pause the rhythm; keep holding to flatline it and a skull materialises over the heart until the next beat; then release and watch it recover.

<!-- TODO(asset): short capture of the goo heart beating while the host ECG sweeps, then flatlining when the feature is killed -->

The split is the point: the **feature owns the rhythm and renders the heart**; the **host owns every effect drawn over or around the heart**: the ECG sweep, the toast stickers (which drift past the feature's boundary, because they never lived inside it), the flatline skull, and the approval-gated heartbeat sound. Both sides display a **measured** rate derived from the beats they actually observe: the configured `set-rate` target is pacing input, never the readout.

This app is a **self-contained hyperfrontend feature**: it consumes the published `@hyperfrontend/features` package from the npm registry exactly as an external consumer would (no workspace imports, its own lockfile and `node_modules`, a scaffold-native tsconfig that never extends the workspace base).

## Topology and origins

| Piece               | Where it runs                                                            | Origin boundary |
| ------------------- | ------------------------------------------------------------------------ | --------------- |
| Feature app (React) | `index.html` at the site root, built to `dist/apps/demos/heartbeat/app/` | —               |
| Host page (vanilla) | `host/index.html` on the **same origin**, using `createShell` directly   | **same-origin** |
| Host: dev host      | `hf dev` debug UI, local (`:4281`)                                       | cross-origin    |

Both pages ship from one Vite multi-page build, so the pair deploys as a single static site (the live Railway service and origin are recorded in [project.json](project.json) `metadata.deploy`). Unlike the clock demo's vendored-shell consumption, the host here calls `createShell` from `@hyperfrontend/features/host` directly against the feature page URL: the raw host-side SDK, no generated shell in between.

## Two heartbeats, deliberately kept apart

The demo's whole point is the contrast between two layers that both happen to be called a heartbeat:

| Layer                          | Cadence                               | Where you see it                                | What it means                                   |
| ------------------------------ | ------------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| **SDK liveness** (`__hf:beat`) | Fixed 1 s, not configurable           | The **Connection** panel (`shell.on('status')`) | Is the feature frame alive and responsive?      |
| **Cardiac contract events**    | ~72 bpm with jitter, user-disturbable | The **ECG**, vitals, and event log              | What the feature is _doing_, as product traffic |

The SDK's heartbeat is invisible infrastructure: the hostee emits `__hf:beat` every second with no consumer involvement, the host watchdog judges `healthy → unobservable → suspect → gone`, and `shell.on('status', …)` reports transitions as a snapshot object `{ state, missedBeats, lastBeatAt }`. Control traffic under the `__hf:` prefix never reaches consumer handlers, and contracts must not declare `__hf:*` types, so the cardiac rhythm could not ride the protocol heartbeat even if it wanted to. That is why the demo does **not** repurpose it: the ECG is driven entirely by app-level `beat` events, and flatlining the heart (hold ≥ 3 s) changes _nothing_ in the Connection panel. The frame is perfectly healthy while its rhythm is dramatically dead. One layer answers "is it running?", the other answers "what is it doing?".

## Contract

The feature owns the rhythm; the host observes and nudges it. Declared in [heartbeat.contract.ts](heartbeat.contract.ts) (referenced by [feature.config.ts](feature.config.ts)), version `0.2.0`.

| accepted (host → feature)   | emitted (feature → host)                                                   |
| --------------------------- | -------------------------------------------------------------------------- |
| `ping` `{seq, sentAt}`      | `beat` `{at, seq, bpm, source: 'rhythm'\|'user'}`: every heartbeat         |
| `set-rate` `{bpm}` (40–180) | `rhythm` `{state: 'beating'\|'suppressed'\|'flatline'\|'recovering', bpm}` |
|                             | `pong` `{seq, sentAt}`: answers `ping`, echoing `sentAt` for latency       |
|                             | `close-request` `{source: 'button'}`: the dialog ✕ was activated           |

`ping` doubles as a **correlated request** (`respondsWith: 'pong'`): the host calls `request('ping', …)` and gets the echo back directly, while plain listeners still observe the `pong` event. A disturbed rhythm (anything but `beating`) reports as **dirty state** (`setDirty`), so a host proposing a polite close sees the episode first. The config declares all four display modes — `embedded` (default, fills the container), `dialog` (460×540), `popup` (520×600), and `standalone` — plus the `autoplay` **permission**, the feature's declared capability request for heartbeat audio; a generated shell bakes it into the iframe allow list, while actual playback stays behind the host's own explicit user approval.

**Runtime modes are protocol facts, not URL guesses.** The SDK announces the display mode over the wire (`presentation`), so the feature renders its dialog chrome (a circular ✕ with an `esc` hint) only when a host genuinely presents it as a dialog. The ✕ emits `close-request`; the host performs the actual close (in-frame Escape already crosses as the SDK's own dismiss signal). Opened directly in a tab, nothing ever announces, no dialog chrome renders, Escape is not intercepted, and a local sound toggle appears instead: audio is hostee-owned standalone, host-owned when embedded.

## The rhythm

Baseline ~72 bpm, each interval sampled from a bounded Gaussian centred on `60000/bpm` (σ ≈ 4%, hard-limited to ±12%; `randomGaussian` from `@hyperfrontend/random-generator-utils`, injectable for deterministic tests), paced by chained timeouts, never `setInterval`. A quick tap/Enter fires one immediate premature beat (`source: 'user'`) followed by a slightly longer compensatory pause. A pointer or Space hold ≥ 300 ms suppresses the rhythm; at 3 s total it flatlines. Release enters recovery: the first beats come at half the baseline rate and each one closes half the remaining gap until the rhythm settles back to `beating`. Every transition emits `rhythm`; every beat emits `beat`.

The **displayed bpm is measured, not configured**: a rolling window over observed beat timestamps (`src/rhythm/measured-bpm.ts`) follows the mean observed interval while beats flow, lets the growing silence decay the value once they stop, pins 0 during flatline, and climbs back naturally through recovery. Extra taps genuinely raise it. Animation, sound, the measured readout, and both hosts' ECG/vitals all hang off the same beat-event stream.

The artwork is the source SVG decomposed into its natural subpaths and reassembled in place as independently animatable layers: a dark-red underlay that owns the grooves and line-work (the source's white divisions are gone; every cutout reveals flesh, not page), the vena cava, the aortic-arch crown, and the cardiac mass clip-split at the atrioventricular groove into an atria band and a ventricular mass. All plates share one user-space gradient, so shading stays continuous across their boundaries, and the shared container runs a gooey SVG filter (blur → alpha threshold → composite) that bridges the transient seams the pulse opens between independently scaling plates while leaving the outer silhouette crisp. Each beat animates the layers in stages from JS (Web Animations API, not an infinite CSS loop, because the timing varies): the atria band kicks (~110 ms), then the ventricular mass squeezes with a slight apex twist while the underlay flexes (~250 ms), and finally the aorta and cava take the pulse. Reduced-motion users get a gentle fade instead.

Heartbeat **sound** is a synthesized lub-dub (`src/audio/heartbeat-audio.ts`, Web Audio, no asset): two pitch-falling sine thumps per beat through a compressor, so rapid taps stack audibly without clipping. It never autoplays: standalone it sits behind the local toggle, hosted it sits behind the host's "Enable heartbeat sound" approval, and a flatlined rhythm emits no beats so nothing can sound while flat.

## Layout

| File                                    | Role                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `heartbeat.contract.ts`                 | The feature contract (accepted commands, emitted events)                                                          |
| `feature.config.ts`                     | Feature identity + contract pointer for the `hf` CLI                                                              |
| `hf-dev.config.ts`                      | Dev-server config (serves the built app from the workspace dist)                                                  |
| `src/hyperfrontend.feature.ts`          | Host integration: `createFeature` + `wireHeartbeatContract`                                                       |
| `src/feature/`                          | Contract-to-engine wiring (unit-tested, DI-friendly)                                                              |
| `src/rhythm/`                           | Framework-free rhythm engine (gaussian jitter, holds, flatline, recovery) and the measured-bpm window             |
| `src/runtime/`                          | Presentation-fed UI state: announced display mode + latched dialog close requests                                 |
| `src/audio/`                            | Web-Audio lub-dub synth, enable-gated, compressor-limited                                                         |
| `src/components/`                       | The layered anatomical heart SVG (goo-fused plates over a dark underlay), per-beat animation, dialog close chrome |
| `host/index.html` · `src/host/`         | The vanilla host page: `createShell`, the stage effects layer, vitals, panels                                     |
| `src/host/bpm.ts` · `src/host/ecg.ts`   | Pure host math: rolling BPM window, spike geometry, sweep gap, flatline judgement                                 |
| `src/host/fx.ts` · `src/host/fx-dom.ts` | Host effects: toast flight planning, flatline edge detection, overlay painter                                     |

## Working on it

```bash
npx nx run demo-heartbeat:install    # npm install in this directory
npx nx run demo-heartbeat:dev        # vite build --watch + dev servers (dev host on :4281)
npx nx test demo-heartbeat           # vitest (rhythm engine, wiring, bpm, ecg)
npx nx typecheck demo-heartbeat      # tsc --build
npx nx lint demo-heartbeat           # oxlint + eslint (app-local)
npx nx run demo-heartbeat:build      # type-check + vite build → dist/apps/demos/heartbeat/app/
npx nx run demo-heartbeat:pack-shell # hf build → self-contained shell tarball in dist/apps/demos/heartbeat/shell/
```

To drive the full pair locally: `npx nx run demo-heartbeat:build`, then `npm run preview` in this directory and open `/host/`; the host page embeds the feature from the same preview origin. Under `hf dev` (`:4281`) the host page is at `/host/index.html` (the dev server's static handler resolves `/` to the feature's `index.html` but does not resolve directory paths to their index files).

## SDK workarounds

None. The pairing runs the v1 security envelope on `features@0.5.x`: the packet-layer rejection of the SDK's payload-less `__hf:beat` that once forced this demo to `protocol: 'none'` was fixed in the nexus transport, so the four-state watchdog reads `healthy` under v1 and `pack-shell` no longer needs `--allow-open`.
