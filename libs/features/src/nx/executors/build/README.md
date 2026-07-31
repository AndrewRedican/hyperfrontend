# build

Nx `build` executor. A thin wrapper that builds a hyperfrontend feature's shell
package by delegating to the SDK's headless `hf build`, run against the executing
project's root directory. Registered via the package's `executors.json`.

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
| `config`    | no       | Path to the feature config object.                                                |
| `out`       | no       | Output directory for the built shell.                                             |
| `protocol`  | no       | Security envelope: `none`, `v1`, or `v2`.                                         |
| `name`      | no       | Feature name override.                                                            |
| `version`   | no       | Feature version override.                                                         |
| `url`       | no       | URL the generated shell loads the feature from.                                   |
| `contract`  | no       | Path to the contract file.                                                        |
| `allowOpen` | no       | Acknowledge an explicit `none` protocol and build an open, unauthenticated shell. |
