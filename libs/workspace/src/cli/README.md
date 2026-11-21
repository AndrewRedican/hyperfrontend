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

| Command                                               | What it does                                                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `run <project>:<target> [--name=value ...]`           | Runs that one task alone, without the tasks it depends on                                                                                                          |
| `run-many -t <targets> (-p <names> \| --all)`         | Runs the tasks and their prerequisites in order, skipping the dependents of a failure; each `-t` is a stage                                                        |
| `affected -t <targets> [--base=<ref>] [--head=<ref>]` | Runs the tasks the change selects, from the merge base with the default branch unless a base is given; each `-t` is a stage                                        |
| `format --check\|--write [--all \| --files=<list>]`   | Runs prettier on the changed files, every file, or the files named                                                                                                 |
| `generate <generator> [--option=value ...]`           | Runs a generator of the workspace or of an installed package, by bare name or as `<package>:<name>`                                                                |
| `show projects [--with-target=<target>] [--json]`     | Lists the project names                                                                                                                                            |
| `graph <command>`                                     | Prints, verifies and explains the workspace graph ([`runGraph`](https://www.hyperfrontend.dev/docs/libraries/workspace/cli/#api-runGraph))                         |
| `hooks run <hook> [--only=<steps>] [--skip=<steps>]`  | Runs the steps `hooks.config.ts` lists for a Git hook, as the hook's stub does ([`/git-hooks`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/)) |
| `push [arguments of git push]`                        | Runs the steps `hooks.config.ts` lists under push, then `git push` with the arguments given                                                                        |

Every command finds the workspace root from any directory below it; generate also runs where no `hf.json` exists yet, taking the working directory as the root. A task's option is given after it as `--name=value`, read as the type the executor's schema declares, or `--name` alone for true; after a shell target the arguments reach the command. The command line's own messages go to standard error, and the exit code is 0 when the command succeeded and 1 otherwise.

## Stages and the progress view

The two commands that run many tasks take `-t` more than once, and each one names a stage:

```bash
npx hf affected -t typecheck,lint -t test -t build
```

Every task of a stage runs to its end and every failure in it is reported. A stage with a failure ends the run, so a type error is known before a build starts. A prerequisite runs in the earliest stage that needs it. One `-t` is one stage, which runs everything and skips only the dependents of a failure.

Each task writes its whole output to `.hf/logs/<project>__<target>.log`, and the command line shows the run instead:

```text
stage 1 of 3: typecheck, lint (4 tasks)
✓ lib-core:typecheck  3.2s  [1/7]
✗ lib-core:lint  1.4s  [2/7]
    src/index.ts:3:1 error no-default-export
    log: .hf/logs/lib-core__lint.log
✓ lib-util:typecheck  2.9s  [3/7]
✓ lib-util:lint  1.1s  [4/7]
stage 1 (typecheck, lint) did not succeed: 3 tasks not run

          typecheck  lint  test  build
lib-core  ✓          ✗     ·     ·
lib-util  ✓          ✓           ·
✓ passed  ✗ failed  - skipped  · not run

7 tasks in 8.6s: 3 passed, 1 failed, 3 not run
✗ lib-core:lint  .hf/logs/lib-core__lint.log
```

A task that runs long is named with its elapsed time: on a terminal as a status line rewritten in place, elsewhere as a line every 30 seconds. The view is plain text when standard error is not a terminal, when the NO_COLOR environment variable is set, or when the terminal declares itself dumb.

`--stream` turns the view off: every task writes straight to the terminal, standard input included, and the run ends on a list of the tasks. A target that keeps running, such as a development server, or one that asks a question, needs it.

## One name, two packages

[`@hyperfrontend/features`](https://www.hyperfrontend.dev/docs/libraries/features/) publishes an executable of the same name for its own commands. With both packages installed, either executable answers every command: a word it does not own is handed to the other package's command line, and `--help` prints both usages.
