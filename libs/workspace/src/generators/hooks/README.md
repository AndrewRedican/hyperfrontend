# hooks

Installs the Git hooks a workspace configures into the clone: one POSIX `sh` stub per hook that has steps in `hooks.config.ts`, written into the repository's hooks directory and starting `hf hooks run <hook>`. A workspace without a configuration gets a first one, with a format step before a commit and the affected checks before a push, and `.gitignore` gains the line that keeps a clone's `hooks.local.config.ts` out of the repository.

```bash
npx hf generate hooks
```

| Option         | What it sets                                                       |
| -------------- | ------------------------------------------------------------------ |
| `--force`      | Replace a hook file that neither this generator nor Lefthook wrote |
| `--skipFormat` | Leave the first configuration unformatted                          |

Running it again is how a change to the configured hooks reaches the clone: it rewrites its own stubs, takes the place of Lefthook's, and removes the stubs of hooks that no longer have steps. A repository installs its hooks on every install by naming the generator in the prepare script of its root manifest; where the CI variable is set or there is no repository it writes nothing and succeeds, so the script is harmless in a deploy build.

It writes nothing, and says why, where the workspace is not the root of its repository or Git reads the hooks from a directory outside the workspace. The steps, the skips and the commands are described under [`/git-hooks`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/).
