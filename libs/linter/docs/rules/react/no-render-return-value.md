# react/no-render-return-value

Forbid using the return value of [`ReactDOM.render`](https://react.dev/reference/react-dom/render).

## Rule Details

The legacy [`ReactDOM.render`](https://react.dev/reference/react-dom/render) returns a reference to the root component instance, which future React versions do not provide and which is not ready during concurrent rendering; a ref callback is the supported way to reach it. This rule reports a [`render`](https://react.dev/reference/react-dom/render) call on the renderer object when its value is used: assigned, stored in a variable or object property, returned, or the body of an arrow function. It does not fix.

The renderer object depends on the React version in the settings (`{ react: { version: '0.14' } }`): [`ReactDOM`](https://react.dev/reference/react-dom) from 15 on and when no version is set, [`React`](https://react.dev/reference/react) or [`ReactDOM`](https://react.dev/reference/react-dom) in 0.14, and [`React`](https://react.dev/reference/react) in 0.13.

Reimplements [eslint-plugin-react's `no-render-return-value`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-render-return-value.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
import ReactDOM from 'react-dom'

const app = ReactDOM.render(<App />, document.getElementById('root'))
```

### ✅ Correct

```tsx
import ReactDOM from 'react-dom'

ReactDOM.render(<App />, document.getElementById('root'))
```
