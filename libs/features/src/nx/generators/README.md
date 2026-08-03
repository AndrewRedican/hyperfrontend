# generators

Nx generators for hyperfrontend features — `init` declares the SDK dependency in the consumer workspace, `feature` scaffolds a feature by delegating to the SDK's headless `hf init`.

```ts
import { featureGenerator, initGenerator } from '@hyperfrontend/features/nx/generators'

const installCallback = await initGenerator(tree, {})
```

## Generators

| Generator | Purpose                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `init`    | Ensures `@hyperfrontend/features` is declared in the root `package.json`; run automatically by `nx add`.                     |
| `feature` | Scaffolds the glue module, `feature.config.json`, and entry wiring for a feature, declaring the SDK dependency when missing. |

Both generators stage every write into the Nx tree, so `nx g ... --dry-run`
previews the full change set without touching the disk. When the consumer
workspace has `@nx/devkit` installed, staged files are formatted with it and
installs run through its `installPackagesTask`; otherwise built-in equivalents
take over. Each generator returns a callback Nx runs after flushing, which
installs dependencies only when the root manifest actually changed.

## Usage

```bash
nx g @hyperfrontend/features:init
nx g @hyperfrontend/features:feature \
  --name=clock --contract=./clock.contract.json --entry=./src/main.ts --directory=apps/clock
```

See the [`init`](./init/README.md) and [`feature`](./feature/README.md) docs for the full option tables.
