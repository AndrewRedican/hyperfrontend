# test

Runs a project's suites on Node's built-in test runner through [`@hyperfrontend/testing`](https://www.hyperfrontend.dev/docs/libraries/testing/): it starts a Node process with the runtime's preload, loads the project's test configuration, prints the coverage table and the reasons a run failed.

```json
{
  "test": {
    "executor": "@hyperfrontend/workspace:test"
  }
}
```

| Option                | What it does                                                                    |
| --------------------- | ------------------------------------------------------------------------------- |
| `--testConfig`        | The test configuration; defaults to `test.config.ts` in the project             |
| `--coverageDirectory` | Where coverage is written; defaults to `coverage/<project root>` under the root |

The runtime is resolved from the workspace that runs the task.
