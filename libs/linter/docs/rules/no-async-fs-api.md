# no-async-fs-api

Forbid the asynchronous Node file system APIs in favour of their synchronous twins.

## Rule Details

In scripts, build tools and command-line programs, synchronous file access is simpler to read and to order: each operation finishes before the next line runs, and errors arrive as ordinary exceptions. The rule reports:

- an import or `require()` of `fs/promises` or `node:fs/promises`;
- a named import from `fs` or `node:fs` of a method that has a synchronous twin, such as [`readFile`](https://nodejs.org/api/fs.html#fsreadfilepath-options-callback) (use [`readFileSync`](https://nodejs.org/api/fs.html#fsreadfilesyncpath-options));
- such a method read through a namespace or default import of `fs`, such as `fs.readFile(...)`.

The set of methods is read from the running Node's own `fs` module: every method that has a twin of the same name ending in Sync. The rule does not fix.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
import { readFile } from 'node:fs/promises'

const content = await readFile('file.txt', 'utf-8')
```

```ts
import * as fs from 'node:fs'

fs.readFile('file.txt', (error, data) => {})
```

### ✅ Correct

```ts
import { readFileSync, writeFileSync } from 'node:fs'

const content = readFileSync('file.txt', 'utf-8')
writeFileSync('output.txt', content)
```

## When Not To Use It

In servers and other long-running processes, where blocking I/O stalls the event loop, and wherever many files are processed concurrently.

## Limitations

The promise API reached as a property, `fs.promises.readFile(...)`, and methods called on an inline `require('fs')` are not reported.
