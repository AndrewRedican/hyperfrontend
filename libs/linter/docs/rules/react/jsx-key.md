# react/jsx-key

Require a [`key`](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key) prop on JSX elements in arrays and iterator callbacks.

## Rule Details

React tells list items apart by their [`key`](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key); without one it falls back to the index, which mixes up state and DOM nodes when the list is reordered. This rule reports a JSX element without a [`key`](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key) attribute when it sits directly in an array literal, or when it is returned by the callback of a `.map()` call or the second argument of `Array.from()`. In a callback it follows an expression body, both branches of a conditional, the right side of a logical expression, and the returns of a block body through `if` statements. A key passed only through a spread does not count. Nothing inside a `Children.toArray()` call is checked, since it assigns keys itself; the pragma setting (`{ react: { pragma: 'Preact' } }`, or a `@jsx` comment) names the object [`Children`](https://react.dev/reference/react/Children) may be read from. It does not fix.

Reimplements [eslint-plugin-react's `jsx-key`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-key.md).

## Options

This rule has no options. The [original's options](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-key.md#rule-options), which check fragment shorthands, require the key before a spread and warn on duplicate keys, are not read: shorthand fragments are not checked.

## Examples

### ❌ Incorrect

```tsx
const items = ['a', 'b'].map((label) => <li>{label}</li>)

const cells = [<td>1</td>, <td>2</td>]
```

### ✅ Correct

```tsx
const items = ['a', 'b'].map((label) => <li key={label}>{label}</li>)

const cells = [<td key="one">1</td>, <td key="two">2</td>]
```
