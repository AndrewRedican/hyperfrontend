# git-hooks

Git hooks owned by the workspace: a typed configuration of named steps per hook, the runner behind `hf hooks run`, and the stubs Git starts.

## Configuration

The hooks live in `hooks.config.ts` at the workspace root, declared with [`defineHooks`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-defineHooks). Each of `pre-commit`, `commit-msg` and `pre-push` is a list of named steps that run in order, and the first step that fails ends the hook.

```ts
import { defineHooks } from '@hyperfrontend/workspace/git-hooks'

export default defineHooks({
  'pre-commit': [
    {
      name: 'format',
      run: ['hf', 'format', '--write'],
      stageFixed: true,
    },
  ],
  'commit-msg': [
    {
      name: 'message',
      run: ['cl'],
      passArgs: true,
      failText: 'Write a conventional commit message.',
    },
  ],
  'pre-push': [
    {
      name: 'version-check',
      run: ['hf', 'affected', '-t', 'version-check'],
      failText: 'A library is due a version bump.',
    },
    {
      name: 'checks',
      run: ['hf', 'affected', '-t', 'typecheck,lint', '-t', 'test'],
      env: { CI: '1' },
    },
  ],
})
```

| Field of a [`HookStep`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-HookStep)        | What it sets                                                                     |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`name`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-HookStep-prop-name)             | What the step is listed, skipped and selected by                                 |
| [`run`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-HookStep-prop-run)               | The program and its arguments, started without a shell from the workspace root   |
| [`env`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-HookStep)                        | Variables set for the step, over the environment the hook runs in                |
| [`failText`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-HookStep-prop-failText)     | What is printed when the step fails                                              |
| [`stageFixed`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-HookStep-prop-stageFixed) | Stage again the files that were fully staged before the step and that it changed |
| [`passArgs`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-HookStep-prop-passArgs)     | Append the arguments Git gave the hook, such as the message file of `commit-msg` |

A step is an argument array, so nothing is quoted and no variable is written in front of a command. `hf` starts this command line again the way it was started and `node` is the running Node.js. Any other program is found on the search path with the workspace's `node_modules/.bin` first; on Windows it starts through the command shim a package manager writes for it.

[`stageFixed`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-HookStep-prop-stageFixed) never stashes and never touches unstaged content: a file that was only partly staged is left exactly as it was staged.

## Skipping

A clone that does not want a step names it in an untracked `hooks.local.config.ts` beside the configuration, declared with [`defineLocalHooks`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-defineLocalHooks):

```ts
import { defineLocalHooks } from '@hyperfrontend/workspace/git-hooks'

export default defineLocalHooks({ skip: ['checks', 'pre-commit:format'] })
```

A name skips the step in every hook that has one; `<hook>:<step>` skips it in that hook alone. For one invocation, the variable HF_HOOKS_SKIP takes the same names separated by commas, and HF_HOOKS set to 0 skips every step:

```bash
HF_HOOKS_SKIP=checks git push
```

A skip is never silent. The hook ends on one line per step, and a skipped step is listed with what skipped it; a name that matches no step is reported too.

```text
pre-push
  ✓ version-check  2.1s
  - checks         skipped by hooks.local.config.ts
```

## Rehearsing

`hf hooks run <hook>` is what a stub starts, and by hand it rehearses the hook without committing or pushing. `--only` and `--skip` select steps by name:

```bash
npx hf hooks run pre-push
npx hf hooks run pre-push --only=version-check
```

## Building on the parts

The commands are built from exported parts. [`loadHooks`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-loadHooks) reads both files, [`skipReason`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-skipReason) says what skips a step, and [`runHook`](https://www.hyperfrontend.dev/docs/libraries/workspace/git-hooks/#api-runHook) runs steps through a host you supply:

```ts
import { loadHooks, runHook, skipReason } from '@hyperfrontend/workspace/git-hooks'
import { createTerminal } from '@hyperfrontend/workspace/progress'

const { config, local } = await loadHooks(process.cwd())
const sources = { env: process.env, local, only: [], skip: [] }

const code = await runHook(
  {
    hook: 'pre-push',
    steps: config['pre-push'] ?? [],
    args: [],
    skipOf: (step) => skipReason('pre-push', step, sources),
  },
  {
    start: async (step) => (step.name === 'checks' ? 0 : 1),
    now: () => performance.now(),
    terminal: createTerminal(process.stderr, process.env),
    fullyStaged: () => [],
    restage: () => [],
  }
)
```
