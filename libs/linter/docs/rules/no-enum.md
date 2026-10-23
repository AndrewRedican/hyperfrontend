# no-enum

Forbid TypeScript `enum` declarations in favour of frozen const objects.

## Rule Details

An `enum` compiles to a function call that bundlers cannot tree-shake, and it is one of the few TypeScript constructs with run-time behaviour of its own, such as the reverse mapping of a numeric enum. A frozen const object with `<const>` says the same thing, stays plain JavaScript, and a type derived from it gives the union of its values. The rule reports every `enum` declaration, `const enum` and `declare enum` included. It does not fix; its message shows the replacement to write.

## Options

| Option                     | Type     | Default | Meaning                                                                                                                                                          |
| -------------------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`freezeImport`](#options) | `string` | none    | An import statement the replacement in the message starts with, such as `"import { freeze } from 'my-utils'"`; the replacement then calls the imported function. |

Without it the message suggests `Object.freeze(...)`.

## Examples

### ❌ Incorrect

```ts
enum Status {
  Active = 'active',
  Inactive = 'inactive',
}

enum Direction {
  Up,
  Down,
}
```

### ✅ Correct

```ts
const Status = Object.freeze(<const>{
  Active: 'active',
  Inactive: 'inactive',
})

type Status = (typeof Status)[keyof typeof Status]
```

## When Not To Use It

When a project prefers enums, or relies on enum-only features such as the reverse mapping of numeric members.
