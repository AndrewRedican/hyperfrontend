# react/jsx-no-duplicate-props

Forbid naming the same prop twice on one JSX element.

## Rule Details

When a JSX element repeats an attribute, only the last value takes effect, so the earlier one is dead code and usually a merge or copy mistake. This rule reports every attribute after the first with the same name, compared case-sensitively. Spread attributes and namespaced attributes such as `xlink:href` are not compared. It does not fix.

Reimplements [eslint-plugin-react's `jsx-no-duplicate-props`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-duplicate-props.md).

## Options

This rule has no options. The original's [`ignoreCase`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-duplicate-props.md#rule-options) option is not read: names that differ only in case are different props.

## Examples

### ❌ Incorrect

```tsx
const field = <input name="email" type="text" name="mail" />
```

### ✅ Correct

```tsx
const field = <input name="email" type="text" />
```
