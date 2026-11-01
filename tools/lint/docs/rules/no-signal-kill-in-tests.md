# no-signal-kill-in-tests

End a child a test spawned with `sendSignal` from `@hyperfrontend/testing/process` rather than `kill('SIGINT')`.

## Rule Details

A spec that starts a real command and stops it with `SIGINT` or `SIGTERM` usually goes on to assert
the exit code the child reports. That assertion holds only where signals are delivered: Windows has
none, so `kill` ends the child outright and Node reports the signal in place of an exit code.
`sendSignal` sends the signal and resolves with the exit code and signal the child reports, and
`cleanSignalExit` is what a child that handled the signal reports on the running platform, so one
assertion holds everywhere.

The rule reports a `kill` call whose first argument is a string signal other than `SIGKILL`, when
the receiver is a child the file itself spawned: a call to `spawn`, `fork`, `exec` or `execFile`
imported from `node:child_process` or `child_process`, by name or through a default or namespace
import, or a variable one of whose declarations or assignments is such a call.

Left alone: `SIGKILL`, which ends a child the same way on every platform; a `kill` on a stand-in such
as `createFakeChildProcess`, on an array element, or on anything the file did not spawn itself; a
signal given as a number or a variable. The rule does not fix: the assertion that follows the
signal changes shape with the helper, which only the spec's author can rewrite.

### Why?

- **One assertion for every platform.** `expect(exit).toEqual(cleanSignalExit('SIGINT'))` holds on
  Linux, macOS and Windows; `expect(code).toBe(0)` fails on the Windows CI leg.
- **The platform difference stays visible.** `cleanSignalExit` says in one place that Windows ends the
  child rather than letting it leave on its own, so a spec reads as what it checks.

## Options

None.

## Examples

### ❌ Incorrect

```typescript
import { spawn } from 'node:child_process'

const child = spawn('node', [bin, 'serve'])
const exited = new Promise((resolve) => child.once('exit', resolve))
child.kill('SIGINT')
expect(await exited).toBe(0)
```

**Error**: `Send 'SIGINT' to a child the test spawned with sendSignal from '@hyperfrontend/testing/process' and compare its exit with cleanSignalExit: Windows ends the child outright instead of delivering the signal, so the exit it reports differs by platform.`

### ✅ Correct

```typescript
import { spawn } from 'node:child_process'
import { cleanSignalExit, sendSignal } from '@hyperfrontend/testing/process'

const child = spawn('node', [bin, 'serve'])
expect(await sendSignal(child, 'SIGINT')).toEqual(cleanSignalExit('SIGINT'))
```

## Configuration

Enabled from `lint.base.config.ts` for specs, `__test-utils__` modules and the package e2e suites'
`support` modules:

```js
{
  files: ['**/*.spec.{ts,tsx,mts,cts}', '**/__test-utils__/**/*.{ts,tsx,mts,cts}', 'apps/package-e2e/*/src/support/**/*.ts'],
  rules: {
    'workspace/no-signal-kill-in-tests': 'error',
  },
}
```

## Related Rules

- [no-mkdtemp-in-tests](./no-mkdtemp-in-tests.md): the other helper of `@hyperfrontend/testing`
  a spec reaches for instead of the raw Node call, so the platform differences stay in one place
