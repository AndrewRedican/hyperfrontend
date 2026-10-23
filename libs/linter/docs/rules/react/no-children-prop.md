# react/no-children-prop

Forbid passing children through a [`children`](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children) prop.

## Rule Details

Children belong between an element's tags, or after the props argument of [`createElement`](https://react.dev/reference/react/createElement), where every reader expects them. This rule reports a [`children`](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children) attribute on a JSX element, and a [`createElement`](https://react.dev/reference/react/createElement) call whose props object literal has a [`children`](https://react.dev/learn/passing-props-to-a-component#passing-jsx-as-children) key. The call counts when it is read off the pragma, as [`React.createElement`](https://react.dev/reference/react/createElement), or when a bare [`createElement`](https://react.dev/reference/react/createElement) was imported or destructured from it. The pragma comes from a `@jsx` comment in the file, then the settings (`{ react: { pragma: 'h' } }`), then [`React`](https://react.dev/reference/react). It does not fix.

Reimplements [eslint-plugin-react's `no-children-prop`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-children-prop.md).

## Options

This rule has no options. The original's [`allowFunctions`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-children-prop.md#rule-options) option is not read: a function passed as the children prop is reported too.

## Examples

### ❌ Incorrect

```tsx
import { createElement } from 'react'

const note = <Note children="Saved" />
const card = createElement('div', { children: 'Saved' })
```

### ✅ Correct

```tsx
import { createElement } from 'react'

const note = <Note>Saved</Note>
const card = createElement('div', {}, 'Saved')
```
