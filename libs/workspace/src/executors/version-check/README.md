# version-check

Compares a project's manifest and changelog with what its commits call for, without writing anything: the read-only half of the release flow, for CI to confirm that the bump the push carried is the one the commits earn.

```json
{
  "version-check": {
    "executor": "@hyperfrontend/workspace:version-check"
  }
}
```

| Option                  | What it does                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------ |
| `--skipIfVersionCommit` | Passes when the head commit is the project's own version commit; defaults to true                      |
| `--repository`          | How changelog compare links are resolved: inferred from the manifest or the remote, disabled, or given |
| `--maxCommitFallback`   | How many commits the flow reads at most; defaults to 500                                               |
| `--scopeFiltering`      | Which commit scopes count for the project                                                              |
| `--verbose, --quiet`    | More or less output                                                                                    |

A failing check names the remedy: run the project's version target and push again.
