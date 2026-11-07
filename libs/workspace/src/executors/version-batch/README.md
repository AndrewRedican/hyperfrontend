# version-batch

Versions every library a change between two refs makes due a release, in dependency order, and records the bumps in one commit. It stands down on the base branch itself, so a pre-push hook can run it on every branch.

```json
{
  "version:all": {
    "executor": "@hyperfrontend/workspace:version-batch",
    "options": { "base": "origin/main" }
  }
}
```

| Option                | What it does                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `--base`              | The ref the change is measured from; defaults to `origin/main`. The batch fails when git cannot compare it with `--head` |
| `--head`              | The ref it is measured to; defaults to the head of the checkout                                                          |
| `--dryRun`            | Prints the libraries and bumps and writes nothing                                                                        |
| `--releaseAs`         | Forces this bump on the libraries named with `--libraries`, for a change in the artifact rather than the code            |
| `--libraries`         | The projects to version instead of the affected set; only with `--releaseAs`                                             |
| `--maxCommitFallback` | How many commits the flow reads at most; defaults to what the project's version target declares                          |
| `--scopeFiltering`    | Which commit scopes count for a project; defaults to the project's version target's                                      |
| `--verbose`           | Prints each library's decision                                                                                           |

The commit subject names every bumped library. A failed run restores the working tree to what it was.
