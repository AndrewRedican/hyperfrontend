# process

Starting commands that are `.cmd` shims on Windows, such as `npm`, `npx`, `pnpm` and `yarn`, the same way on every platform.

Node refuses to start a `.cmd` file without a shell, and with a shell it joins an argument array without escaping it and prints the [`DEP0190`](https://nodejs.org/api/deprecations.html#DEP0190) deprecation. [`shimCommand`](https://www.hyperfrontend.dev/docs/libraries/project-scope/core/process/#api-shimCommand) returns the program, arguments and [`shell`](https://www.hyperfrontend.dev/docs/libraries/project-scope/core/process/#api-ShimCommand-prop-shell) option to spread into [`execFileSync`](https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options), [`execFile`](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback), [`spawn`](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options) or [`spawnSync`](https://nodejs.org/api/child_process.html#child_processspawnsynccommand-args-options): on Windows one command line with every argument passed through [`quoteForCmd`](https://www.hyperfrontend.dev/docs/libraries/project-scope/core/process/#api-quoteForCmd) and no argument array, elsewhere the command and its arguments as given with no shell. An argument holding `"`, `%`, `!` or a line break is refused on Windows, because the shim's batch file expands or splits those whatever the quoting.

```typescript
import { execFileSync } from 'node:child_process'
import { shimCommand } from '@hyperfrontend/project-scope/core/process'

const npm = shimCommand('npm', ['install', 'C:\\My Packages\\lib.tgz'])
execFileSync(npm.file, npm.args, { cwd: consumerDir, shell: npm.shell })
```
