# no-unsafe-builtin-methods

Prohibit direct use of certain built-in methods in favor of safe alternatives.

## Rule Details

This rule disallows direct access to certain global built-in methods (like `Object.freeze`, `Array.isArray`, `JSON.parse`) and requires using the safe versions from `@hyperfrontend/immutable-api-utils`.

### Why?

- **Prototype pollution protection**: Built-in methods can be overwritten via prototype pollution
- **Consistency**: Centralized, tested implementations
- **Security**: Safe versions include input validation
- **Immutability**: Ensures frozen copies are used consistently

## Examples

### ❌ Incorrect

```typescript
const frozen = Object.freeze(obj)
const isArr = Array.isArray(value)
const parsed = JSON.parse(str)
console.log('debug')
```

### ✅ Correct

```typescript
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { log } from '@hyperfrontend/immutable-api-utils/built-in-copy/console'

const frozen = freeze(obj)
const isArr = isArray(value)
const parsed = parse(str)
log('debug')
```

## Covered Built-ins

This rule covers methods from:

- `Object` (freeze, keys, entries, values, etc.)
- `Array` (isArray, from, of)
- `JSON` (parse, stringify)
- `Promise` (resolve, reject, all, race, etc.)
- `console` (log, warn, error, etc.)
- `Math`, `Date`, `Map`, `Set`, `Reflect`, `Symbol`
- And more...

## When Not To Use It

If you don't use `@hyperfrontend/immutable-api-utils` or have different security requirements.

## Related Rules

- [no-enum](./no-enum.md)
