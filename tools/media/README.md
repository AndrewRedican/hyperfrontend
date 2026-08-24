# @hyperfrontend/media

Records real browser sessions and turns them into size-budgeted, infinitely looping GIFs and still images.

Everything about this repository lives in [`media.config.ts`](./media.config.ts) and the files under [`scenes/`](./scenes/). Nothing under [`src/`](./src/) knows a path, a port, a project name or a command belonging to hyperfrontend, which is what keeps the recorder portable.

## Commands

| Command                                    | What it does                                                    |
| ------------------------------------------ | --------------------------------------------------------------- |
| `npx nx media tool-media`                  | Record every scene                                              |
| `npx nx media tool-media --scene=koi-pond` | Record one scene                                                |
| `npx nx run tool-media:check`              | Verify committed assets against their scenes, without a browser |
| `npx nx run tool-media:doctor`             | Report which browsers and encoders this machine has             |
| `npx nx run tool-media:shot -- ...`        | Take one screenshot, no scene file involved                     |

Run `npx tsx src/cli/main.ts --help` from this directory for the full option list.

## Taking a screenshot

The fastest way to see what a page actually renders. It writes wherever you point it, is never budgeted, and never touches the asset tree.

```bash
npx nx run tool-media:shot -- \
  --url http://localhost:4288/ \
  --out /tmp/pond.png \
  --viewport 1440x810 \
  --wait '.koi-shoal-pill .koi-shoal-dot[data-connected="true"]' \
  --settle 2000 \
  --selector '#pond' \
  --console
```

`--wait` takes a selector rather than a delay, because a delay that is long enough on one machine is short on another and the failure is a blank image. `--console` writes the page's console output and uncaught errors to a `.log.json` file beside the image, so a render that came out wrong explains itself. `--format webp` is roughly twenty times smaller than PNG for the same frame when size matters more than fidelity.

## Adding a scene

A scene is one TypeScript file under `scenes/`, named `<slug>.scene.ts`, default-exporting `defineBrowserScene({ ... })`. Only the fields that differ from the workspace defaults need stating.

```typescript
import { defineBrowserScene } from '../src/scene/define-scene'

export default defineBrowserScene({
  slug: 'my-demo',
  outputs: ['gif'],
  viewport: { width: 1440, height: 810 },
  serve: {
    build: ['npx', 'nx', 'build', 'my-app'],
    command: ['npx', 'http-server', '{root}', '-p', '{port}', '-c-1'],
    root: 'dist/apps/my-app',
  },
  page: { path: '/' },
  ready: { selector: '[data-state="ready"]', timeoutMs: 60_000 },
  record: { settleMs: 1_000, durationMs: 12_000 },
  gif: { width: 560, maxBytes: 2_000_000 },
})
```

`{root}` and `{port}` are substituted at run time. The port is allocated when the run starts, so a scene never collides with a development server that is already listening.

### Fields worth knowing

| Field          | Why it matters                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ready`        | The one signal that says the page is worth recording. Always a selector, never a delay.                                                                                            |
| `record`       | Video capture starts when the browser opens, so a page with a long boot has that boot in the file. Both values are measured from the readiness gate and the encoder trims to them. |
| `determinism`  | Pins the clock and the reported device capability, so the same scene records the same way on every machine.                                                                        |
| `assert`       | Conditions the ready page must satisfy before anything is encoded. A page can pass its readiness gate and still be visibly wrong.                                                  |
| `gif.maxBytes` | A finished asset above this fails the run rather than landing.                                                                                                                     |
| `stills`       | Frames captured inside the record window, at offsets measured from the first kept frame.                                                                                           |

## Determinism

Two things vary by machine and would otherwise change the asset depending on who regenerated it:

```typescript
determinism: {
  clock: { time: '2026-01-01T09:00:00Z', resume: true },
  navigator: { hardwareConcurrency: 4, deviceMemory: 8 },
}
```

`resume` is not optional in practice. Installing a clock pins the date but leaves time frozen, which stalls any animation whose frame delta comes from the clock and makes screenshots hang on a page that waits for web fonts. Resuming keeps the pinned date and lets time run again.

## When a run fails

| Message                       | What to do                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `exceeds the ... budget`      | Narrow the frame, shorten the record window, or drop the frame rate. Raising `maxBytes` is the last resort.     |
| `never appeared within ...ms` | The readiness selector is wrong or the page did not settle. Take a `shot` with the same selector to see why.    |
| `Expected N elements ...`     | The page reached its readiness gate but is not what the scene describes. Look at it before changing the number. |
| `No Chromium build found`     | Run `npx playwright install chromium`.                                                                          |

## Encoders

Two interchangeable backends produce the GIF, and `doctor` says which one this machine will use.

- **ffmpeg** generates a palette from the clip's own colours and hands the result to gifsicle. Markedly smaller on scenes where the whole frame is in motion.
- **sharp** does everything inside libvips and needs no system binaries at all, falling back to the ffmpeg build that ships alongside the cached browsers just to read the video.

Neither wins everywhere. On flat interface scenes sharp has produced the smaller file; on continuous full-frame motion ffmpeg has won by about a third. `--encoder ffmpeg` or `--encoder sharp` pins one when comparing.

`bash .devcontainer/media-tools.sh` installs ffmpeg and gifsicle. It is optional, and the container's post-create step already runs it.

## Verifying committed assets

```bash
npx nx run tool-media:check
```

Identical scenes produce different bytes on every run, so an asset can never be verified by regenerating it and comparing. What `check` verifies instead is that the file exists, is within its budget, matches the size its audit record claims, and was produced from the scene as it stands today. It needs no browser and no encoder, which makes it the part of this pipeline that is safe to run anywhere.

Every asset is written with an audit record beside it recording the scene digest, the viewport, the encoding parameters, the encoder and its binary versions, the browser build, the determinism overrides, and what the page said for itself while it was recorded.

## Where assets go

Finished assets land in `assets/media/<slug>/` at the workspace root, which is committed. The documentation site copies that directory into its own `public/media/` at build time, so one file serves npm, GitHub and the site from a single absolute URL.
