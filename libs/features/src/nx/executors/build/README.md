# build

Nx [`build`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runBuild) executor. A thin wrapper that builds a hyperfrontend feature's shell
package by delegating to the SDK's headless `hf build`, run against the executing
project's root directory. When the build fails, it checks whether rollup's native
binding for the current platform is installed and, when it is missing, prints the
exact install command for the workspace's package manager on stderr. Registered
via the package's `executors.json`.

## Usage

```json
{
  "targets": {
    "build": {
      "executor": "@hyperfrontend/features:build",
      "options": { "config": "./feature.config.json" }
    }
  }
}
```

| Option      | Required | Description                                                                       |
| ----------- | -------- | --------------------------------------------------------------------------------- |
| [`config`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/build/#api-BuildExecutorSchema-prop-config)    | no       | Path to the feature config object.                                                |
| [`out`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/build/#api-BuildExecutorSchema-prop-out)       | no       | Output directory for the built shell.                                             |
| [`protocol`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/build/#api-BuildExecutorSchema-prop-protocol)  | no       | Security envelope: [`none`](https://www.hyperfrontend.dev/docs/libraries/features/#api-SecurityProtocol), [`v3`](https://www.hyperfrontend.dev/docs/libraries/features/#api-SecurityProtocol), or [`v4`](https://www.hyperfrontend.dev/docs/libraries/features/#api-SecurityProtocol).                                         |
| [`name`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/build/#api-BuildExecutorSchema-prop-name)      | no       | Feature name override.                                                            |
| [`version`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/build/#api-BuildExecutorSchema-prop-version)   | no       | Feature version override.                                                         |
| `url`       | no       | URL the generated shell loads the feature from.                                   |
| [`contract`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/build/#api-BuildExecutorSchema-prop-contract)  | no       | Path to the contract file.                                                        |
| [`allowOpen`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/build/#api-BuildExecutorSchema-prop-allowOpen) | no       | Acknowledge an explicit [`none`](https://www.hyperfrontend.dev/docs/libraries/features/#api-SecurityProtocol) protocol and build an open, unauthenticated shell. |
