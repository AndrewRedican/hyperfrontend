# no-mixed-type-export

Prohibit mixing type exports and value exports in a single export statement.

## Rule Details

This rule requires that type exports and value exports be in separate statements.

### Why?

- **Clarity**: Separating type and value exports makes dependencies clearer
- **Tooling**: Some tools handle type exports differently (e.g., for elision)
- **Consistency**: Establishes a predictable export structure
- **TypeScript behavior**: Type exports are erased at compile time

## Examples

### ❌ Incorrect

```typescript
export { type User, createUser } from './module'

export { type Config, type Options, initConfig } from './config'
```

### ✅ Correct

```typescript
export type { User } from './module'
export { createUser } from './module'

export type { Config, Options } from './config'
export { initConfig } from './config'
```

## Fixable

This rule is auto-fixable. It will split mixed exports into separate type and value export statements.

## When Not To Use It

If you prefer the conciseness of mixed exports or use `verbatimModuleSyntax` in tsconfig with inline type specifiers.

## Related Rules

- [no-mixed-type-import](./no-mixed-type-import.md)
- [import-order](./import-order.md)
