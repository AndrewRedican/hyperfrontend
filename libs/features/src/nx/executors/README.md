# executors

Nx executors for hyperfrontend features: `build` packages a feature's shell by delegating to the SDK's headless `hf build`, `serve` runs the SDK dev server as a long-lived target.

```ts
import { runBuildExecutor, serveExecutor } from '@hyperfrontend/features/nx/executors'

const result = await runBuildExecutor({ config: './feature.config.json' }, context)
```

## Executors

| Executor | Purpose                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| `build`  | Builds the feature's shell package against the executing project's root; explains a missing rollup binding.    |
| `serve`  | Starts the dev server, yields the startup result, and keeps the servers alive until a shutdown signal arrives. |

When a build fails, the executor checks whether rollup's native binding for
the current platform is installed and, when it is missing, prints the exact
install command for the workspace's package manager on stderr.

## Usage

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/features:build",
      "options": { "config": "./feature.config.json" }
    },
    "serve": {
      "executor": "@hyperfrontend/features:serve",
      "options": { "port": "4600" }
    }
  }
}
```

See the [`build`](./build/README.md) and [`serve`](./serve/README.md) docs for the full option tables.
