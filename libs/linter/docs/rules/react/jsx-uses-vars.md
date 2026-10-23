# react/jsx-uses-vars

Mark variables named as JSX elements as used.

## Rule Details

A component referenced only as `<Button />` is a use of the variable Button, but a generic unused-variable check does not see JSX element names as references. This rule reports nothing itself: it marks the variable an element names as used, or the root object of a member name such as `<Form.Field>`, so that [`typescript/no-unused-vars`](../typescript/no-unused-vars.md) does not report it. Lower-case and namespaced names are DOM elements and mark nothing. It only has an effect when that rule runs too.

Reimplements [eslint-plugin-react's `jsx-uses-vars`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-uses-vars.md).

## Options

This rule has no options.

## Examples

### ✅ Correct

```tsx
import { Button } from './button'

export const toolbar = <Button />
```
