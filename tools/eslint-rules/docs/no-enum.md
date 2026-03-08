# no-enum

Prohibit the `enum` keyword in favor of frozen const objects.

## Rule Details

This rule disallows TypeScript `enum` declarations, encouraging the use of frozen const objects instead.

### Why?

- **Tree-shaking**: Enums compile to IIFEs that can't be tree-shaken
- **Consistency**: Const objects behave the same at compile-time and runtime
- **Immutability**: Using `freeze` explicitly communicates the intent
- **Bundle size**: Const objects with `as const` result in smaller compiled output

## Examples

### ❌ Incorrect

```typescript
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

enum Direction {
  Up,
  Down,
  Left,
  Right,
}
```

### ✅ Correct

```typescript
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

const Status = freeze(<const>{
  Active: 'active',
  Inactive: 'inactive',
})

const Direction = freeze(<const>{
  Up: 0,
  Down: 1,
  Left: 2,
  Right: 3,
})

type Status = (typeof Status)[keyof typeof Status]
type Direction = (typeof Direction)[keyof typeof Direction]
```

## When Not To Use It

If you prefer TypeScript enums or need features specific to enums like reverse mappings for numeric enums.

## Related Rules

- [no-unsafe-builtin-methods](./no-unsafe-builtin-methods.md) (for using safe `freeze`)
