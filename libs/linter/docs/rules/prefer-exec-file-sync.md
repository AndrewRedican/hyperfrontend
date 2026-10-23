# prefer-exec-file-sync

Forbid [`execSync`](https://nodejs.org/api/child_process.html#child_processexecsynccommand-options) from the child process module in favour of [`execFileSync`](https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options).

## Rule Details

[`execSync`](https://nodejs.org/api/child_process.html#child_processexecsynccommand-options) runs its command string through a shell. Anything interpolated into the string is parsed by that shell, so a path with a space breaks the command and untrusted input can inject one; quoting rules also differ between bash, cmd and PowerShell. [`execFileSync`](https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options) runs the executable directly with an argument array that no shell sees. The rule reports [`execSync`](https://nodejs.org/api/child_process.html#child_processexecsynccommand-options) wherever it is taken from `child_process` or `node:child_process`:

- a named import, or a property destructured from `require()` of the module;
- a member read through a namespace, default import or required module object, dotted or bracketed (`cp.execSync(...)`, `cp['execSync'](...)`).

The rule does not fix: moving to [`execFileSync`](https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options) means splitting the command into the executable and its arguments, and replacing shell features with Node code.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
import { execSync } from 'node:child_process'

execSync(`git add ${filePath}`)
```

```ts
import * as cp from 'node:child_process'

cp.execSync('npm install')
```

```ts
const { execSync } = require('node:child_process')
```

### ✅ Correct

```ts
import { execFileSync } from 'node:child_process'

execFileSync('git', ['add', filePath])
execFileSync('git', ['commit', '-m', 'a message with spaces'])
```

## When Not To Use It

When a script needs shell features such as pipes, redirects or globbing on purpose. Node APIs usually cover those without a shell.

## Limitations

Only the synchronous function is covered: [`exec`](https://nodejs.org/api/child_process.html#child_processexeccommand-options-callback) and the `shell: true` option of the other functions also run through a shell and are not reported.
