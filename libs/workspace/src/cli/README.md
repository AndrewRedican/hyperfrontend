# cli

The command line behind `npx hf`, as a function: [`runWorkspaceCli`](https://www.hyperfrontend.dev/docs/libraries/workspace/cli/#api-runWorkspaceCli) takes the arguments, the directory the command ran in and two streams, and resolves to the exit code.

```ts
import { runWorkspaceCli } from '@hyperfrontend/workspace/cli'

const code = await runWorkspaceCli({
  argv: process.argv.slice(2),
  cwd: process.cwd(),
  stdout: process.stdout,
  stderr: process.stderr,
})
```

## Commands

| Command                                               | What it does                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `run <project>:<target> [--name=value ...]`           | Runs that one task alone, without the tasks it depends on                                                                                  |
| `run-many -t <targets> (-p <names> \| --all)`         | Runs the tasks and their prerequisites in order, skipping the dependents of a failure                                                      |
| `affected -t <targets> [--base=<ref>] [--head=<ref>]` | Runs the tasks the change selects, from the merge base with the default branch unless a base is given                                      |
| `format --check\|--write [--all \| --files=<list>]`   | Runs prettier on the changed files, every file, or the files named                                                                         |
| `generate <generator> [--option=value ...]`           | Runs a generator of the workspace or of an installed package, by bare name or as `<package>:<name>`                                        |
| `show projects [--with-target=<target>] [--json]`     | Lists the project names                                                                                                                    |
| `graph <command>`                                     | Prints, verifies and explains the workspace graph ([`runGraph`](https://www.hyperfrontend.dev/docs/libraries/workspace/cli/#api-runGraph)) |

Every command finds the workspace root from any directory below it; generate also runs where no `hf.json` exists yet, taking the working directory as the root. A task's option is given after it as `--name=value`, read as the type the executor's schema declares, or `--name` alone for true; after a shell target the arguments reach the command. The command line's own messages go to standard error, and the exit code is 0 when the command succeeded and 1 otherwise.

## One name, two packages

[`@hyperfrontend/features`](https://www.hyperfrontend.dev/docs/libraries/features/) publishes an executable of the same name for its own commands. With both packages installed, either executable answers every command: a word it does not own is handed to the other package's command line, and `--help` prints both usages.
