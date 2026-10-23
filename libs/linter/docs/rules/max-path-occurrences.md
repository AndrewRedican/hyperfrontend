# max-path-occurrences

Allow at most one type import and one value import per module path, and in an index file one type re-export and one value re-export per path.

## Rule Details

Imports from the same module scattered over several statements are noise that belongs in one statement. The rule groups a file's import statements by source and kind, `import type` apart from value imports, and reports every statement of a group that holds more than one. The pattern it leaves room for is one type import and one value import per path.

Re-exports (`export ... from` and `export * from`) are grouped the same way, but only in index files (`index.ts`, `index.tsx`, `index.js`, `index.jsx`), where they make up the public surface. Other files may re-export from one path as often as they like. The rule does not fix.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
import { foo } from './module'
import { bar } from './module'
```

```ts
import type { User } from './types'
import type { Config } from './types'
```

### ✅ Correct

```ts
import type { User, Config } from './types'
import { createUser } from './types'
```

Re-exports outside an index file are not counted:

```ts
export { foo } from './module'
export { bar } from './module'
```

## Limitations

An inline type specifier (`import { type User } from './types'`) makes a value import, so it shares a group with the other value imports from the path. Pair the rule with [no-mixed-type-import](./no-mixed-type-import.md) to keep the two kinds apart.
