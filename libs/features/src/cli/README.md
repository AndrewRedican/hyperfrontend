# CLI

Programmatic entry point for the hyperfrontend features CLI — the `init`, `build`, and `dev` commands behind the `hf` bin.

```ts
import { runFeaturesCli } from '@hyperfrontend/features/cli'

const code = await runFeaturesCli({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
})
```

## Commands

| Command | Purpose                                                                                                 |
| ------- | ------------------------------------------------------------------------------------------------------- |
| `init`  | Scaffolds the hostee glue module and wires a marker-guarded import into the app entry file.             |
| `build` | Resolves `feature.config.*`, generates the host connector, bundles it, and packs a publishable tarball. |
| `dev`   | Resolves `hf-dev.config.*` and starts the dev server — one static server per app plus the debug UI.     |

## Config resolution

`feature.config.*` (and `hf-dev.config.*`) resolve through one tiered loader: `.json` via
`@hyperfrontend/project-scope`, and `.js`/`.cjs`/`.mjs`/`.ts`/`.cts`/`.mts` via native `await import()`.
Every config key has a matching flag (`--name`, `--version`, `--protocol`, `--out`, `--url`), objects are
passed as path strings (`--contract`, `--config`), precedence is `defaults < config file < flags`, and
`--ci`/`--yes` run headlessly (erroring on any unresolved required key).

The optional `display` key declares the feature's presentation agreement — the display modes it
supports (first entry = default mode) and per-mode defaults — validated at build time and baked
into the generated shell, which composes only the declared modes:

```jsonc
{
  "display": {
    "modes": ["embedded", "dialog"],
    "embedded": { "width": 320, "height": 240 }, // optional fixed footprint; omit to fill the container
    "dialog": { "width": 480, "height": 360, "position": "center", "backdrop": "close" },
    "closeOnEscape": true,
  },
}
```
