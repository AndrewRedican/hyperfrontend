# no-async-fs-api

Prohibit async Node.js file system APIs and suggest using synchronous alternatives.

## Rule Details

This rule disallows the use of asynchronous Node.js file system APIs (`fs/promises` and callback-based `fs` methods) in favor of their synchronous counterparts.

### Why?

- **Simplicity**: Synchronous code is easier to reason about in scripts and build tools
- **Determinism**: Synchronous operations complete before the next line executes
- **Error handling**: No need for try/catch with async/await or callback handling
- **Build tooling**: Most CLI tools and build scripts benefit from synchronous I/O

## Examples

### ❌ Incorrect

```typescript
import { readFile } from 'node:fs/promises'
import * as fs from 'node:fs/promises'

const content = await readFile('file.txt', 'utf-8')

fs.readFile('file.txt', (err, data) => {
  // callback pattern
})
```

### ✅ Correct

```typescript
import { readFileSync, writeFileSync } from 'node:fs'

const content = readFileSync('file.txt', 'utf-8')
writeFileSync('output.txt', content)
```

## Options

This rule has no configurable options.

## When Not To Use It

- In application code where async I/O is preferred for performance
- In long-running servers where blocking I/O would block the event loop
- When processing many files concurrently

## Related Rules

- [require-node-protocol](./require-node-protocol.md)
