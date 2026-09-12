# @hyperfrontend/media

Records real browser sessions, and plays scripted ones of its own, turning both into size-budgeted, infinitely looping GIFs and still images.

Everything about this repository lives in [`media.config.ts`](./media.config.ts) and the files under [`scenes/`](./scenes/). Nothing under [`src/`](./src/) knows a path, a port, a project name or a command belonging to hyperfrontend, which is what keeps the recorder portable.

## Two kinds of scene

A **browser scene** points at something that already exists: it starts a server, opens a page, and records whatever that page does. Use it when the subject is a real application.

A **scripted scene** has nothing to point at, because the recorder draws it. A stage returns a stylesheet once and markup for each instant asked of it, and the recorder walks a timeline rather than watching a clock: it asks for a moment, mounts it, photographs it, and only then asks for the next one. Use it for anything explanatory, and for anything that has to look the same on every machine.

|                | Browser scene                       | Scripted scene                           |
| -------------- | ----------------------------------- | ---------------------------------------- |
| Subject        | A running application               | A stage in this package                  |
| Needs a build  | Usually                             | Never                                    |
| Needs a server | Usually                             | Never                                    |
| Timing         | Real, so the clock has to be pinned | A timeline, so there is no clock to pin  |
| Two runs agree | Approximately                       | Exactly                                  |
| Encoding path  | Video, demuxed and decimated        | Captured frames, straight to the encoder |

## Commands

| Command                                    | What it does                                                    |
| ------------------------------------------ | --------------------------------------------------------------- |
| `npx nx media tool-media`                  | Record every scene                                              |
| `npx nx media tool-media --scene=koi-pond` | Record one scene                                                |
| `npx nx run tool-media:preview -- ...`     | Draw chosen moments of a scripted scene onto one contact sheet  |
| `npx nx run tool-media:check`              | Verify committed assets against their scenes, without a browser |
| `npx nx run tool-media:doctor`             | Report which browsers and encoders this machine has             |
| `npx nx run tool-media:shot -- ...`        | Take one screenshot, no scene file involved                     |

Run `npx tsx src/cli/main.ts --help` from this directory for the full option list.

Nothing runs the recorder but these commands. No build, publish or documentation target depends on `media`, and Nx never caches it, because two recordings of one scene differ byte for byte even when the scene has not changed. An asset is regenerated when someone decides it should be, by recording the scene (one, or all of them) and committing what landed; everything else that needs the asset reads the committed file. `check` is the target for everywhere else, because it verifies without recording.

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

`--wait` takes a selector rather than a delay, because a delay that is long enough on one machine is short on another and the failure is a blank image. `--console` writes the page's console output and uncaught errors to a `.log.json` file beside the image, so a render that came out wrong explains itself. `--format webp` is roughly twenty times smaller than PNG for the same frame when size matters more than fidelity. `--omit-background` keeps the transparency of a page that paints no background of its own, instead of compositing it onto the browser's white; `png` and `webp` carry the alpha through, `jpeg` discards it.

A screenshot is the way to iterate, not the way to commit. It is unbudgeted, it cannot pin the clock, and it leaves no audit record, so a page that renders the time or the date produces a different image on every run. Anything that gets committed belongs in a scene.

## Adding a browser scene

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
| `stills`       | Frames captured inside the record window, at offsets measured from the first kept frame. Each takes its own `format`, `quality`, `width`, `maxBytes` and `omitBackground`.         |
| `outputs`      | What the scene is for. A scene that does not list `gif` records no video and encodes nothing.                                                                                      |

### Scenes that emit only a still

Drop `gif` from `outputs` and the run opens the page, holds it for the record window, writes the stills and stops. Nothing is recorded and nothing is encoded, so a scene whose asset is one frame costs a few seconds rather than a video and a palette:

```typescript
export default defineBrowserScene({
  slug: 'my-demo-preview',
  asset: 'preview',
  outputs: ['still'],
  viewport: { width: 640, height: 640 },
  serve: {
    command: ['npx', 'hf', 'serve', '--root', '{root}', '--port', '{port}'],
    root: 'dist/apps/my-app',
  },
  page: { path: '/' },
  determinism: { clock: { time: '2026-01-01T10:09:30Z', resume: true } },
  ready: { selector: '[data-state="ready"]', timeoutMs: 60_000 },
  record: { settleMs: 2_500, durationMs: 0 },
  stills: [
    {
      name: 'preview',
      atMs: 0,
      format: 'webp',
      quality: 82,
      width: 640,
      maxBytes: 60_000,
    },
  ],
})
```

`record.durationMs` is the window the stills are taken in, so a single frame at `atMs: 0` needs none of it; `settleMs` is what decides which moment gets photographed. `check` verifies every still the audit record names, against the same `maxBytes` the run enforced.

## Previewing a scripted scene

Recording a scene in every variant takes minutes; a contact sheet of four moments takes seconds, and it answers the questions a recording would be asked: whether a line wraps, whether a column overflows, whether the caption lands on top of a row.

```bash
npx nx run tool-media:preview -- \
  --scene=project-scope-detect \
  --at=every:4 \
  --out=tmp/sheet.png

npx nx run tool-media:preview -- \
  --scene=questions-prompt \
  --theme=light \
  --at=1200,7400 \
  --out=tmp/sheet.png
```

`--at` takes millisecond offsets, or `every:N` to spread N moments evenly to the end of the timeline. `--theme` picks `portable` (the default), `dark` or `light`; a portable frame is composited onto `--background`, white by default, because a transparent frame on its own shows nothing about how it will sit on a page.

## Adding a scripted scene

A scripted scene names a **stage**, hands it a **configuration**, and picks a **profile**. It may also name a **hue**, which tints the ground the way the documentation site tints that package's pages. That is the whole of it.

```typescript
import { defineScriptedScene } from '../src/scene/define-scene'
import { terminalStage } from '../src/terminal/stage'

export default defineScriptedScene({
  slug: 'hf-serve',
  outputs: ['gif', 'still'],
  profile: 'compact',
  hue: 217,
  stage: terminalStage,
  holdMs: 1_400,
  config: {
    title: 'hyperfrontend',
    prompt: '~/storefront',
    script: [
      { step: 'type', text: 'npx hf build' },
      { step: 'run', thinkMs: 520 },
      { step: 'output', lines: [{ text: '  3 features built', tone: 'success' }] },
      { step: 'pause', ms: 1_200 },
    ],
  },
})
```

`stage` and `config` are checked against each other where the scene is written, so a terminal script handed to the flow stage is a typecheck failure rather than a blank recording. There is no server, no build command and no readiness gate, because there is nothing to wait for. An output step whose command has not returned, a server that has announced its address say, sets `running: true` so the prompt does not come back under it.

### Themes and variants

A scripted scene is recorded once per configured variant, and every variant shares the frames, the timing, the layout and the content; only the palette changes. The workspace configures three:

| Variant    | Files                                 | For                                                                      |
| ---------- | ------------------------------------- | ------------------------------------------------------------------------ |
| `portable` | `hero.gif`, `poster.webp`             | npm, GitHub, and any page whose theme is not known                       |
| `dark`     | `hero.dark.gif`, `poster.dark.webp`   | the documentation site's dark theme, which swaps it in for the bare file |
| `light`    | `hero.light.gif`, `poster.light.webp` | the documentation site's light theme                                     |

The bare name goes to the portable variant because it is the file a readme points at, and a readme is rendered on pages nobody here controls. The portable theme draws on a transparent canvas: everything sits on one opaque plate with an edge that shows on both black and white, the palette is neutral rather than the site's blue, and there are no shadows, because a GIF has no half-transparency to blend one with. The dark and light themes are the documentation site's own palettes, drawn edge to edge because the page around them supplies the ground. All three grounds are the same composition, a wash of the package's hue at the top of the frame thinning into the page: deep on the dark ground, pale on the light one, and barely there on the portable plate.

A stage never names a colour. It draws with the tokens of the theme it is handed (`surface`, `border`, `rule`, `accent`, `text.muted`, the six `tones`, the `syntax` colours, the window `chrome`), so one implementation carries every look. A scene can tint the ground with its package's `hue`, the same number the documentation site tints that package's pages with, and can override tokens for every variant or one:

```typescript
export default defineScriptedScene({
  slug: 'my-scene',
  hue: 217,
  themeOverrides: { all: { accent: '#5eead4' }, light: { accentSoft: 'rgba(20, 184, 166, 0.12)' } },
  themes: ['portable', 'dark'], // omit to record every configured variant
  // ...
})
```

The audit record beside the asset lists every variant with its size, its budget and any compromise the optimiser made to reach it, and `check` verifies each one against the budget the configuration states today. A scene that names a theme the workspace does not configure is refused, as is a configuration with two variants under one suffix or one theme, or with none at all.

The theme reaches a stage through the recorder and nowhere else: `resolveTheme` is called once per variant, the result is handed to the stage's `styles` and `frame`, and no stage imports a theme table of its own. That is what keeps a scene's overrides from leaking into the next scene's recording.

### Budgets and the optimiser

Every variant carries a byte budget: the workspace's `defaults.gif.maxBytes` for the themed variants, and a stricter one the portable variant sets for itself, because a readme's images load before anything else on a package page. Runs of identical frames are always folded into one held frame, which costs nothing. When a first encode is still over budget the optimiser walks a fixed ladder, cheapest compromise first: stronger inter-frame merging, a smaller palette, half the frame rate, and only then a narrower frame in small steps down to three quarters of the composed width. Each rung it takes is logged and written into the audit record, and a variant that is still over budget at the bottom of the ladder fails the run with the list of what was tried, because the scene then has to show less.

### Profiles

A scene is composed for a target rather than made once and scaled. `npx nx run tool-media:doctor` prints the list.

| Profile     | Size    | For                                                              |
| ----------- | ------- | ---------------------------------------------------------------- |
| `compact`   | 640x360 | npm package pages, GitHub readmes, documentation read on a phone |
| `docs-wide` | 928x522 | the documentation site's content column on a laptop or desktop   |

Both are sixteen by nine, both are captured at twice their stated size and resampled back down by exactly two, and both are stated at the width the asset is actually displayed at. A GIF holds 256 colours and no subpixel information, so a frame scaled by anything other than a whole number arrives as dithered mush wherever it carries text. The widths come from where the assets are embedded: npm renders a readme in a column a little over 640 pixels wide, and the documentation site's own column peaks a little over 900.

The profile reaches the stage, so a stage can show less at the smaller size rather than showing the same thing smaller. A scene that needs a size neither profile covers passes a profile object instead of a name.

### The stages that ship

| Stage            | Import                | Draws                                                                      |
| ---------------- | --------------------- | -------------------------------------------------------------------------- |
| `terminalStage`  | `src/terminal/stage`  | A terminal window playing a typed script                                   |
| `flowStage`      | `src/flow/stage`      | Two endpoints exchanging messages over a wire                              |
| `panelStage`     | `src/panel/stage`     | Columns of source and results, filling in over time                        |
| `gaugeStage`     | `src/gauge/stage`     | Labelled quantities moving between stated values                           |
| `byteStage`      | `src/byte/stage`      | A field of bytes assembling into labelled segments                         |
| `scanStage`      | `src/scan/stage`      | A beam reading a file tree, with findings threaded back to their evidence  |
| `dialStage`      | `src/dial/stage`      | Countdowns as rings draining, and a card that interrupts them              |
| `lifecycleStage` | `src/lifecycle/stage` | A widget mounted and unmounted, on a page that lets go and one that cannot |
| `sequenceStage`  | `src/sequence/stage`  | Two or three of the above as chapters of one story                         |
| `bannerStage`    | `src/banner/stage`    | A package's identity strip for the top of its readme, as a slow loop       |
| `matrixStage`    | `src/matrix/stage`    | Where a package runs, as a strip of cells                                  |
| `graphStage`     | `src/graph/stage`     | An object graph walked to its leaves, lighting the edges that point back   |
| `envelopeStage`  | `src/envelope/stage`  | A secret sealed into salt, IV, ciphertext and tag, and opened by its key   |
| `forgeStage`     | `src/forge/stage`     | Source entries forged into formats, and the manifest wired to what landed  |
| `embedStage`     | `src/embed/stage`     | A host page and the feature it seats: session, watchdog, flush window      |
| `portsStage`     | `src/ports/stage`     | Two brokers with shaped slots; only a message that fits its slot gets in   |
| `lanesStage`     | `src/lanes/stage`     | The same calls dropped into four lanes, each wrapper deciding their fate   |
| `sealedStage`    | `src/sealed/stage`    | A pipe between two ends: hello, numbered sealed frames, a replay refused   |
| `derivedStage`   | `src/derived/stage`   | Base lamps wired to derived names; an action flips lamps, names light      |
| `transcodeStage` | `src/transcode/stage` | Text tiles dropping bytes that regroup into Base64, and back               |
| `cascadeStage`   | `src/cascade/stage`   | One commit header, and everything a release derives from it, falling       |
| `vaultStage`     | `src/vault/stage`     | Built-ins copied into a vault before an intruder rewrites the globals      |
| `queueStage`     | `src/queue/stage`     | A tube and a cup: the same discs out oldest first, or newest first         |
| `levelsStage`    | `src/levels/stage`    | A level knob filtering a fixed stream of log lines                         |
| `galtonStage`    | `src/galton/stage`    | Grains falling into columns until two distributions show their shape       |

None of them takes a colour. Each draws with the theme the recorder hands it, which is what lets one scene become three assets that differ in nothing but their palette.

The first eleven are general: a terminal, a wire, columns of lines. The showcases at the top of each package readme are not drawn with them, because a showcase has to carry one idea in a few seconds and a general stage carries a transcript. Each showcase has a stage of its own under `src/`, named for the metaphor it draws (`graph`, `envelope`, `lanes`, `ports`, `queue`), and the table below lists them.

### What a showcase may say

A showcase is understood from its motion and imagery or not at all, so it carries no heading, no caption, no phase label and no progress rail, and it shows no source code unless the subject is a command line or a textual transformation. Three kinds of text are allowed, and each is drawn one way everywhere:

- The package's own API, drawn with `renderApiChip(name, mark)` from `src/stage/api-chip`: the package mark, then the name, in the accent on a soft band. The mark comes from `packageIdentity(name)` in `scenes/lib/identity`, which reads the same file the documentation site tints its pages from.
- A platform or example name the package is being compared with (`setTimeout`, `btoa`, `send`), drawn with `renderForeignLabel(name)`: muted mono, no mark.
- The vocabulary of the idea itself: a node's name, a segment's name, a value that is the evidence. Single words, never a sentence.

Motion is a function of the instant, as it is for every stage, and the helpers in `src/lib/motion` (`progress`, `easeInOut`, `easeOut`, `pulse`, `lerp`) keep one stage's easing the same as the next's.

#### `sequenceStage`

Some packages are undersold by one scene: the frame that shows what they detect says nothing about what they can then safely do. A sequence plays two or three chapters in turn, each drawn by its own stage, with a short slide between them and a rail along the top naming every chapter so a reader who arrives mid-loop still knows where they are. Use it only when one capability alone gives an incomplete impression; three chapters is the ceiling, and the whole should still be read in a short attention span.

```typescript
import { chapter, sequenceStage } from '../src/sequence/stage'

config: {
  segments: [
    chapter(
      'Read a repository it has never seen',
      scanStage,
      { root: 'fish-svelte/', files: [...], findings: [...] },
      700
    ),
    chapter('Change it without touching disk', panelStage, { panels: [...] }),
  ],
}
```

Each chapter is composed against the frame less the rail, so a stage inside a sequence lays itself out exactly as it would on its own at that size, and each chapter's stylesheet is confined to its own element, so two chapters drawn by the same stage cannot restyle each other. The fourth argument to `chapter` is a hold on the chapter's last frame before the next one arrives; `transitionMs` on the sequence sets the length of every move, and `rail: false` drops the rail and gives the chapters the whole frame.

The timeline is laid out from the scene's numbers alone: chapters run in the order given, each for its own duration plus its hold, one transition apart. A sequence with no chapters, a negative transition or a negative hold is refused before anything is drawn, and a stage that throws while drawing its chapter does so under the chapter's label, so a failure in a three-chapter scene says which third. The layout is a pure function (`placeSegments` and `chaptersAt` in `src/sequence/timeline`), which is what makes a sequence testable without a browser.

#### `panelStage`

A row of columns; each column a stack of lines; each line knowing when it arrives, whether it types itself in, and when it leaves again. Two columns are a before and an after, four are four wrappers fed the same call, one is a listing that fills.

```typescript
config: {
  heading: 'One line over the frame',
  caption: 'One line under it, arriving last',
  panels: [
    {
      title: 'setup.mjs',
      kind: 'code',           // 'code' is tokenised, 'result' is not, 'note' is set in the sans face
      align: 'top',           // or 'center' / 'bottom', for a short column beside a long one
      rows: [
        { text: "const n = encrypt('secret')", atMs: 200, typeMs: 700 },
        { text: '', atMs: 900 },                       // a blank row is a spacer
      ],
    },
    {
      title: 'node setup.mjs',
      chrome: true,           // draws the column as a terminal window
      kind: 'result',
      rows: [
        // leaves again, for a surface that repaints
        { text: '  ◯ Playwright', atMs: 1_200, untilMs: 2_400 },
        {
          text: 'Uint8Array(58)',
          atMs: 2_400,
          marker: '›',
          emphasis: true,
          tone: 'accent',
        },
      ],
    },
  ],
}
```

`emphasis` puts a row on a lit band, `emphasisAtMs` puts it there from a stated moment (for the line an error turns out to be about), `strike` rules it through, `marker` sets a character in the margin. Type is smaller here than in the terminal stage at the same profile, because a terminal is one column and this is two to four.

#### `gaugeStage`

Quantities that move. Each track carries a label, a maximum and a list of `{ atMs, value }` stops; the value between two stops is interpolated, so a countdown that pauses is two stops with the same number and a bar that fills is two stops with different ones. `orientation: 'column'` draws the tracks as vertical bins, which is what a histogram is.

#### `byteStage`

A row of cells that fill in as a buffer is built, grouped into labelled segments. For the packages whose subject is a layout rather than a call: what `encrypt` actually returns, what a sealed frame is made of.

#### `flowStage`

Two endpoints and a wire. Beyond the message list it carries three things a protocol scene needs: `detail` on a message (what it actually carries, under the name on the wire and after it in the log), `phases` (named stretches of the exchange, captioned as each begins), and `repeatEveryMs`/`repeatUntilMs` for traffic that is a cadence rather than an event. A heartbeat is one fact about a session, so it pulses on the wire and takes one line in the log with a count beside it.

### Writing a new stage

A stage is three functions and an id. Put it in its own directory under `src/`, beside `terminal/` and `flow/`.

```typescript
import { defineStage } from '../stage/define-stage'

export const timelineStage = defineStage<TimelineConfig>({
  id: 'timeline',
  styles: (config, profile) => `.t-bar { height: ${profile.height / 8}px; }`,
  durationMs: (config) => config.steps.length * 900,
  frame: ({ config, profile, atMs }) => `<div class="t-bar" style="width:${atMs / 20}px"></div>`,
})
```

The one rule is that a stage must not animate itself. CSS animations, transitions and page timers all measure real time, and real time is what a recording cannot reproduce: the same scene would land differently depending on how quickly the machine got through it. Motion belongs in `frame` as a function of `atMs`, which costs a stage very little and buys an asset that can be regenerated rather than merely remade. The harness replaces the stage's markup on every frame, so anything a transition would have carried between frames is gone anyway.

Everything else is the stage's own business. The harness mounts the stylesheet, mounts the markup, and photographs the result; it has no opinion about what is in either, which is why the flow stage needed nothing added to the harness to exist.

### Scenes that are one file, many scenes

A scene file may default-export a list of scenes instead of one. That is for the case where one table drives many near-identical scenes, one per package say, so a row added to the table gets its asset on the next recording without anyone adding a file. Every scene still needs a slug of its own: two scenes sharing one is refused when the files are read, naming the second.

## The package banner and the runtime strip

Two scene files draw one asset per publishable package, read from the workspace rather than listed by hand. `scenes/package-banners.scene.ts` draws the identity strip for the top of a readme with `bannerStage`, from the package's manifest, project configuration and identity file. `scenes/package-runtimes.scene.ts` draws where the package runs with `matrixStage`, from `metadata.compatibility` in its `project.json` and `engines.node` in its manifest. The banner is a twelve-second loop rather than a still: the light behind the tile drifts once round a closed path, slowly enough that a glance sees a still image, and the last frame leads back into the first. The runtime strip is a still recorded in the portable theme only, because the one page that shows it is a package readme on the registry. Neither asset is placed by hand: the build executor of `@hyperfrontend/package` substitutes them into the readme it writes to `dist`, and that executor's README describes the markers that say where.

## Determinism

A scripted scene needs none of this: it is drawn frame by frame from a timeline, so there is no clock to pin and no device capability it can read. The rest of this section is about browser scenes.

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

Every asset is written with an audit record beside it recording the scene digest, the viewport, the encoding parameters, the encoder and its binary versions, the browser build, the determinism overrides, and what the page said for itself while it was recorded. A scripted scene's record also lists every variant it was rendered as, with each one's size, budget and the compromises the optimiser made to reach it.

## Where assets go

Finished assets land in `assets/media/<slug>/` at the workspace root, which is committed. The documentation site copies that directory into its own `public/media/` at build time, so one file serves npm, GitHub and the site from a single absolute URL. The site's markdown pipeline recognises a reference to `<slug>/hero.gif` whose record lists dark and light variants and puts both in the page, lazily, for the theme to choose between; a readme keeps pointing at the bare, portable file.
