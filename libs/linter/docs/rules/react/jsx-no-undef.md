# react/jsx-no-undef

Forbid JSX elements whose component is not declared.

## Rule Details

A JSX element names a variable, and an undeclared one fails only when the element renders, usually because an import is missing or misspelt. This rule reports a capitalised element name, or the root object of a member name such as `<Form.Field>`, that no scope from the element out to the module declares. Lower-case names are DOM elements and namespaced names such as `svg:rect` are left alone. In a module, a file with imports or exports, globals do not count; in a script they do. It does not fix.

Reimplements [eslint-plugin-react's `jsx-no-undef`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-undef.md).

## Options

This rule has no options. The original's [`allowGlobals`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-undef.md#rule-options) option is not read: a module's elements never resolve to globals.

## Examples

### ❌ Incorrect

```tsx
import { Button } from './button'

export const toolbar = (
  <Toolbar>
    <Button />
  </Toolbar>
)
```

### ✅ Correct

```tsx
import { Button } from './button'
import { Toolbar } from './toolbar'

export const toolbar = (
  <Toolbar>
    <Button />
  </Toolbar>
)
```
