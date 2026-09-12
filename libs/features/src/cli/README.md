# CLI

Programmatic entry point for the hyperfrontend features CLI: the [`init`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runInit), [`build`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runBuild), [`dev`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runDev), and [`serve`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runServe) commands behind the `hf` bin.

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

| Command                                                                            | Purpose                                                                                                    |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [`init`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runInit)   | Scaffolds the glue module, config, and contract types, then wires the entry import idempotently.           |
| [`build`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runBuild) | Resolves `feature.config.*`, generates the shell package, bundles it, and packs a publishable tarball.     |
| [`dev`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runDev)     | Resolves `hf-dev.config.*` and starts the dev server: one static server per app plus the debug UI.         |
| [`serve`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runServe) | Resolves `hf-serve.config.*` and serves a built site for production: compression, ETags, and header rules. |

## Config resolution

`feature.config.*` (and `hf-dev.config.*`, `hf-serve.config.*`) resolve through one tiered loader: `.json` via
[`@hyperfrontend/project-scope`](https://www.hyperfrontend.dev/docs/libraries/project-scope/), and `.js`/`.cjs`/`.mjs`/`.ts`/`.cts`/`.mts` via native `await import()`.
Every scalar `feature.config.*` key has a matching flag (`--name`, `--version`, `--protocol`, `--out`, `--url`; the serve config exposes `--root`/`--port`/`--host`, with header rules file-only), objects are
passed as path strings (`--contract`, `--config`), precedence is `defaults < config file < flags`, and
`--ci`/`--yes` run headlessly (erroring on any unresolved required key).

[`serve`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runServe) selects its config in its own order: `--config` names the file explicitly; otherwise, when `--root`
is given, an `hf-serve.config.json` carried inside the served artifact (`<root>/hf-serve.config.json`: JSON
is the one artifact-carried format) wins over a file beside the invocation, so the deploy policy travels
with the build output; otherwise the working directory is searched. No config is needed at all. With none
found, the working directory is served on port `4284` on every interface, and `--root`/`--port`/`--host`
override whatever the file says:

```jsonc
{
  "root": "dist/site",
  "port": 8080,
  "headers": [
    { "suffix": ".html", "headers": { "Cache-Control": "no-cache" } }, // ordered; later rules override per header
  ],
}
```

The optional [`display`](https://www.hyperfrontend.dev/docs/libraries/features/#api-FeatureConfig-prop-display) key declares the feature's presentation agreement: the display modes it
supports (first entry = default mode) and per-mode defaults, validated at build time and baked
into the generated shell, which composes only the declared modes:

```jsonc
{
  "display": {
    "modes": ["embedded", "dialog"],
    "embedded": { "width": 320, "height": 240 }, // optional fixed footprint; omit to fill the container
    "dialog": {
      "width": 480,
      "height": 360,
      "position": "center",
      "backdrop": "close",
    },
    "closeOnEscape": true,
  },
}
```
