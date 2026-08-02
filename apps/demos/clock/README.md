# @hyperfrontend/demo-clock

A clock coin: a minted-metal coin floating on a transparent background, an analog clock face on one side and a digital face on the other. Spin it — the resting face _is_ the clock's format, so every flip is contract traffic.

This app is a **self-contained hyperfrontend feature**: it consumes the published `@hyperfrontend/features` package from the npm registry exactly as an external consumer would (no workspace imports, its own lockfile and `node_modules`, a scaffold-native tsconfig that never extends the workspace base).

## Topology and origins

| Piece              | Where it runs                                                                      | Origin boundary |
| ------------------ | ---------------------------------------------------------------------------------- | --------------- |
| Feature app (this) | Railway static service (`*.up.railway.app`), built to `dist/apps/demos/clock/app/` | —               |
| Host: docs-site    | Vercel (landing hero + demos-page carousel)                                        | **cross-site**  |
| Host: dev host     | `hf dev` debug UI, local                                                           | cross-origin    |

The docs-site consumes this feature through the **vendored shell tarball** (`@hyperfrontend/demo-clock-shell`, committed under `apps/docs-site/vendor/`) — a real install step simulating "the feature team shipped us a shell". The shell is self-contained (`hf build` bundles the SDK; zero install-time dependencies) and carries the feature's declared display modes, its contract version, and the **v1 security envelope** — [feature.config.ts](feature.config.ts) declares `protocol: 'v1'`, so product traffic crosses the boundary enveloped without a key-provisioning story (v2's pre-shared key is the security demo's territory).

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

The contract carries `version: 0.2.0` (gated for compatibility at the handshake). `get-time` doubles as a **correlated request**: a host calling `request('get-time')` gets the snapshot back directly, while plain listeners still observe the `time` echo. Armed alarms report as **dirty state** (`setDirty`), so a host proposing a polite close can see unsaved work first. The config declares all four display modes — `embedded` (default, fills the container), `dialog` (420×420 inner box), `popup` (480×480), and `standalone`.

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

## Working on it

```bash
npx nx run demo-clock:install    # npm install in this directory
npx nx run demo-clock:dev        # vite build --watch + dev servers (dev host on :4280)
npx nx test demo-clock           # vitest (physics, time, alarms, wiring, a11y/axe)
npx nx typecheck demo-clock      # vue-tsc
npx nx lint demo-clock           # oxlint + eslint (app-local)
npx nx run demo-clock:build      # type-check + vite build → dist/apps/demos/clock/app/
npx nx run demo-clock:pack-shell # hf build → self-contained shell tarball in dist/apps/demos/clock/shell/
npx nx run docs-site:refresh-shell # re-pack, re-vendor, and reinstall the tarball in the docs-site
```

To see the full host↔hostee wiring locally before any deploy: run `npx nx run demo-clock:dev`
(serves the built app at `http://localhost:4280/`) alongside the docs-site's `npm run dev` — the
docs-site's committed `.env.development` points its embeds at that port, while production builds
keep the deployed origin.

## Known SDK limitations this demo works around

The demo consumes `@hyperfrontend/features@^0.3.0`; the 0.1.0-era workarounds (hand-rolled dev host, `SharedArrayBuffer` stub, dev-server launcher script, external shell compiler) are gone — `hf dev` and `hf build` are the real dev loop now. The workarounds that remain are all published-package gaps already fixed in workspace source and awaiting the next release (each filed in the showcase findings registry): the `rollup` and `tslib` devDependencies exist only so a fresh install can run `hf build` at all; the generated shell's handle type omits the runtime `request`/`handle`/`isDirty` members, so typed hosts cast for those; and [feature.config.ts](feature.config.ts) authors its extended keys against a local widened type because the published `defineConfig` rejects them — migrate it back to `defineConfig` once the fixed version ships.
