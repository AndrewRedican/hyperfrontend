# serve

Nx [`serve`](https://www.hyperfrontend.dev/docs/libraries/features/cli/#api-runServe) executor. A long-running async-iterator executor that starts the
hyperfrontend dev server by delegating to the SDK's headless `hf dev`, stays
alive until a shutdown signal, then closes the servers gracefully. Registered via
the package's `executors.json`. Despite the shared name, this executor is the
development-time surface (it wraps `hf dev`), distinct from the `hf serve` CLI
command, which is the production static server.

## Usage

```json
{
  "targets": {
    "serve": {
      "executor": "@hyperfrontend/features:serve",
      "options": { "config": "./hf-dev.config.json" }
    }
  }
}
```

| Option                                                                                                                    | Required | Description                                |
| ------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------ |
| [`config`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/serve/#api-ServeExecutorSchema-prop-config) | no       | Path to the dev-server config object.      |
| [`apps`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/serve/#api-ServeExecutorSchema-prop-apps)     | no       | Path to the dev-server apps array.         |
| [`port`](https://www.hyperfrontend.dev/docs/libraries/features/nx/executors/serve/#api-ServeExecutorSchema-prop-port)     | no       | Port the dev server's debug UI listens on. |
