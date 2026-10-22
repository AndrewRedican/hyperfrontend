# prefer-exec-file-sync

Prefer `execFileSync` over `execSync` for safer command execution.

## Rule Details

This rule disallows the use of `execSync` from the `child_process` module in favor of `execFileSync`. While both functions execute external commands synchronously, `execFileSync` is the safer choice for most use cases.

### Why?

- **Shell injection prevention**: `execSync` runs commands through a shell, making it vulnerable to command injection attacks if user input is interpolated into the command string. `execFileSync` executes the command directly without a shell, eliminating this attack vector.

- **No shell parsing issues**: `execSync` relies on shell parsing for arguments, which can lead to unexpected behavior with special characters, spaces in paths, or platform-specific shell differences. `execFileSync` passes arguments as an array, avoiding these parsing pitfalls.

- **Explicit argument handling**: With `execFileSync`, you must explicitly pass arguments as an array, making the code clearer and the command composition more predictable.

- **Cross-platform consistency**: Shell behavior varies between platforms (bash vs cmd vs powershell). `execFileSync` provides more consistent behavior across operating systems.

## Examples

### ❌ Incorrect

```typescript
import { execSync } from 'node:child_process'

// Vulnerable to shell injection if path contains special characters
execSync(`git add ${filePath}`)

// Shell parsing can cause unexpected issues
execSync('git --no-pager log --oneline')
```

```typescript
import * as cp from 'node:child_process'

cp.execSync('npm install')
cp['execSync']('ls -la')
```

```typescript
const { execSync } = require('node:child_process')

execSync('rm -rf ./dist')
```

### ✅ Correct

```typescript
import { execFileSync } from 'node:child_process'

// Safe - no shell injection possible
execFileSync('git', ['add', filePath])

// Clear argument separation
execFileSync('git', ['--no-pager', 'log', '--oneline'])
```

```typescript
import * as cp from 'node:child_process'

cp.execFileSync('npm', ['install'])
cp.execFileSync('ls', ['-la'])
```

```typescript
const { execFileSync } = require('node:child_process')

execFileSync('rm', ['-rf', './dist'])
```

## Options

This rule has no configurable options.

## When Not To Use It

- When you genuinely need shell features like pipes (`|`), redirects (`>`), or shell globbing (`*`), though consider using Node.js APIs for these operations instead
- In interactive scripts where shell features are intentionally desired
- When working with legacy code that would require significant refactoring

## Migration Guide

To migrate from `execSync` to `execFileSync`:

1. Replace `execSync(command)` with `execFileSync(executable, args)`
2. Split the command into the executable name and an array of arguments
3. Remove any shell-specific syntax and implement it in Node.js

```typescript
// Before
execSync('git commit -m "message"')

// After
execFileSync('git', ['commit', '-m', 'message'])
```

## Related Rules

- [no-async-fs-api](./no-async-fs-api.md)
- [require-node-protocol](./require-node-protocol.md)
