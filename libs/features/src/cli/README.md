# CLI

Programmatic entry point for the hyperfrontend features CLI — the `init`, `build`, and `dev` commands plus `feature.config.*` handling, exposed for the `hf` bin and for in-process use.

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
| `dev`   | Resolves `hf-dev.config.*` through the shared loader (the dev server itself is not yet available).      |

## Config resolution

`feature.config.*` (and `hf-dev.config.*`) resolve through one tiered loader: `.json` via
`@hyperfrontend/project-scope`, and `.js`/`.cjs`/`.mjs`/`.ts`/`.cts`/`.mts` via native `await import()`.
Every config key has a matching flag (`--name`, `--version`, `--protocol`, `--out`, `--url`), objects are
passed as path strings (`--contract`, `--config`), precedence is `defaults < config file < flags`, and
`--ci`/`--yes` run headlessly (erroring on any unresolved required key).
