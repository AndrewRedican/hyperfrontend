# e2e

Packs a library's build, installs the tarball into the project that tests it, and runs that project's suites on Node's test runner, handing each the tarball's path in the environment as HF_E2E_TARBALL so a suite can install it into a consumer outside the workspace.

```json
{
  "e2e": {
    "executor": "@hyperfrontend/workspace:e2e",
    "dependsOn": ["^build"],
    "options": {
      "formats": [
        "cjs",
        "esm",
        "browser",
        {
          "name": "consumer",
          "specs": ["src/consumer.spec.ts"],
          "timeoutMs": 300000
        }
      ]
    }
  }
}
```

| Option             | What it does                                                                                                                                                                                                                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--packageDir`     | The built package; defaults to the build output of the library this project implicitly depends on                                                                                                                                                                                                                |
| `--testDir`        | The e2e project; defaults to the project the task runs in                                                                                                                                                                                                                                                        |
| `--formats`        | What to run: the built-in [formats](https://www.hyperfrontend.dev/docs/libraries/workspace/executors/e2e/#api-E2eFormat) cjs, esm and browser run the conventional spec files, and an object names a suite of the project's own with its specs, a timeout, whether it needs the DOM and what it runs serially on |
| `--skipInstall`    | Reuses an install already in place                                                                                                                                                                                                                                                                               |
| `--cleanupTarball` | Removes the tarball afterwards; defaults to true                                                                                                                                                                                                                                                                 |

The browser suite preloads a DOM for the IIFE and UMD bundles, which needs jsdom installed beside [`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/).
