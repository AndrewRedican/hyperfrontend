# @hyperfrontend/demo-clock

A clock coin: a minted-metal coin floating on a transparent background, an analog clock face on one side and a digital face on the other. Spin it — the resting face _is_ the clock's format, so every flip is contract traffic.

This app is a **self-contained hyperfrontend feature**: it consumes the published `@hyperfrontend/features` package from the npm registry exactly as an external consumer would (no workspace imports, its own lockfile and `node_modules`, a scaffold-native tsconfig that never extends the workspace base).

## Topology and origins

| Piece              | Where it runs                                                                      | Origin boundary |
| ------------------ | ---------------------------------------------------------------------------------- | --------------- |
| Feature app (this) | Railway static service (`*.up.railway.app`), built to `dist/apps/demos/clock/app/` | —               |
| Host: docs-site    | Vercel (landing hero + demos-page carousel)                                        | **cross-site**  |
| Host: dev host     | `hf dev` control port (`scripts/hf-dev.ts`), local                                 | cross-origin    |

The docs-site consumes this feature through the **vendored shell tarball** (`@hyperfrontend/demo-clock-shell`, committed under `apps/docs-site/vendor/`) — a real install step simulating "the feature team shipped us a connector". The security envelope is deliberately **`protocol: 'none'`** and labeled as such: this demo's job is the composition path, not the envelope (that's the security demo's story).

## Contract

The feature owns all state; the host commands, the feature confirms with echo events. Declared in [clock.contract.ts](clock.contract.ts) (referenced by [feature.config.ts](feature.config.ts)).

| accepted (host → feature)           | emitted (feature → host)                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| `get-time`                          | `tick` `{epochMs, iso, timezone, locale, format, formatted}` @ 1 Hz                                |
| `set-format` `{format}`             | `time` — same snapshot, answers `get-time`                                                         |
| `set-timezone` `{timezone}`         | `format-changed` `{format, cause: 'user'\|'host'\|'alarm'}`                                        |
| `set-locale` `{locale}`             | `timezone-changed` `{timezone}`                                                                    |
| `set-alarm` `{at: 'HH:mm', label?}` | `locale-changed` `{locale}`                                                                        |
| `clear-alarm` `{id}`                | `alarm-set` `{id, at, firesAtEpochMs}` · `alarm-fired` `{id, at, label?}` · `alarm-cleared` `{id}` |

Timezone = IANA id, locale = BCP-47, both applied via `Intl`. Alarms are multiple, one-shot, in-memory.

## Layout

| File                           | Role                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| `clock.contract.ts`            | The feature contract (accepted commands, emitted events)         |
| `feature.config.ts`            | Feature identity + contract pointer for the `hf` CLI             |
| `hf-dev.config.ts`             | Dev-server config (serves the built app from the workspace dist) |
| `src/hyperfrontend.feature.ts` | Host integration — `createFeature` + `wireClockContract`         |
| `src/feature/`                 | Contract-to-store wiring (unit-tested, DI-friendly)              |
| `src/physics/`                 | Framework-agnostic coin physics (drag, momentum, snap, flips)    |
| `src/time/` · `src/alarms/`    | `Intl` time math and the one-shot alarm engine                   |
| `src/components/`              | The CSS-3D coin, analog and digital faces                        |
| `dev-host/`                    | Hand-rolled stand-in for the debug UI SDK v0.1.0 cannot serve    |
| `scripts/hf-dev.ts`            | Dev-server launcher keeping `hf dev` alive with local assets     |

## Working on it

```bash
npx nx run demo-clock:install    # npm install in this directory
npx nx run demo-clock:dev        # vite build --watch + dev servers (dev host on :4280)
npx nx test demo-clock           # vitest (physics, time, alarms, wiring, a11y/axe)
npx nx typecheck demo-clock      # vue-tsc
npx nx lint demo-clock           # oxlint + eslint (app-local)
npx nx run demo-clock:build      # type-check + vite build → dist/apps/demos/clock/app/
npx nx run demo-clock:pack-shell # shell tarball → dist/apps/demos/clock/shell/ (@hyperfrontend/app:pack-shell)
npx nx run docs-site:refresh-shell # re-pack, re-vendor, and reinstall the tarball in the docs-site
```

## Known SDK limitations this demo works around

Consuming `@hyperfrontend/features@0.1.0` end-to-end surfaced fourteen findings. The blockers to know about when reading this code: the CLI dev server and debug UI are unusable as published, the host SDK crashes on non-cross-origin-isolated pages without a `SharedArrayBuffer` stub, host↔feature message **delivery** is broken in both directions, and `hf build` cannot compile its own connector (worked around by the workspace `@hyperfrontend/app:pack-shell` executor, which drives the SDK's own generator from this app's `node_modules` and compiles with plain `tsc`). The feature side works fully — its tick stream, echoes, and heartbeats are all observable on the wire — but hosts cannot receive them until delivery is fixed in the SDK.
