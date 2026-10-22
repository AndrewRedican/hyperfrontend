# require-node-protocol

Require `node:` prefix for Node.js built-in module imports.

## Rule Details

This rule requires using the `node:` protocol prefix when importing Node.js built-in modules.

### Why?

- **Clarity**: Explicitly identifies Node.js built-ins vs npm packages
- **Security**: Prevents npm packages from shadowing built-in modules
- **Modern standard**: The `node:` prefix is the recommended approach
- **No ambiguity**: `node:test` vs `test` (npm package)

## Examples

### ❌ Incorrect

```typescript
import { readFileSync } from 'fs'
import path from 'path'
import { createServer } from 'http'
import { EventEmitter } from 'events'
```

### ✅ Correct

```typescript
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createServer } from 'node:http'
import { EventEmitter } from 'node:events'
```

## Fixable

This rule is auto-fixable. It will add the `node:` prefix to built-in module imports.

## When Not To Use It

If you need to support older Node.js versions that don't support the `node:` protocol (< 12.20.0 for most modules, < 14.13.1 for ESM).

## Supported Modules

All Node.js built-in modules are covered, including:

- `fs`, `path`, `http`, `https`, `crypto`
- `events`, `stream`, `buffer`, `util`
- `child_process`, `cluster`, `worker_threads`
- And all other built-in modules...

## Related Rules

- [no-async-fs-api](./no-async-fs-api.md)
- [import-order](./import-order.md)
