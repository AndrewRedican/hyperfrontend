# version

Versions a project from its conventional commits with [`@hyperfrontend/versioning`](https://www.hyperfrontend.dev/docs/libraries/versioning/), the npm registry being the source of truth for what is published: it bumps the manifest, writes the changelog entry, pins every workspace project that depends on the package to the new version, and commits.

```json
{
  "version": {
    "executor": "@hyperfrontend/workspace:version",
    "options": { "maxCommitFallback": 500 }
  }
}
```

| Option                | What it does                                                            |
| --------------------- | ----------------------------------------------------------------------- |
| `--dryRun`            | Prints what would change and writes nothing                             |
| `--releaseAs`         | Forces the bump: major, minor or patch                                  |
| `--tagPrefix`         | The tag prefix; defaults to `{projectName}@`                            |
| `--skipCommit`        | Leaves the bump uncommitted                                             |
| `--skipTag`           | Creates no tag; defaults to true, as tags are created after the publish |
| `--maxCommitFallback` | How many commits the flow reads at most; defaults to 500                |
| `--scopeFiltering`    | Which commit scopes count for the project, beyond its own files         |
| `--verbose, --quiet`  | More or less output                                                     |

## What the flow assumes

- A commit's scope names a project: `feat(my-utils): ...` belongs to the project named my-utils.
- A library is due a release when a commit touches code it ships, or when the graph selects its build for a change to the toolchain its build target declares as inputs.
- A package still below 1.0.0 takes a minor bump for a breaking change.
- A run whose head commit is already the project's version commit does nothing, so the task is safe to repeat.

An executor that wraps this one passes follow-ups through [`runVersion`](https://www.hyperfrontend.dev/docs/libraries/workspace/executors/version/#api-runVersion): functions called after the bump and before the commit, each answering the files the commit must also carry. No configuration can set them.
