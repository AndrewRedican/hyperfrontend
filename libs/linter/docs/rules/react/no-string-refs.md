# react/no-string-refs

Forbid string refs.

## Rule Details

String refs are a legacy API with known problems, such as attaching to the wrong owner, and React 19 removed them; [`useRef`](https://react.dev/reference/react/useRef), [`createRef`](https://react.dev/reference/react/createRef) or a ref callback replaces them. This rule reports a [`ref`](https://react.dev/learn/manipulating-the-dom-with-refs) attribute whose value is a string literal, quoted or in braces. For React versions before 18.3, set in the settings (`{ react: { version: '16.14' } }`), it also reports reading [`this.refs`](https://legacy.reactjs.org/docs/refs-and-the-dom.html#legacy-api-string-refs) inside a class component or [`createReactClass`](https://legacy.reactjs.org/docs/react-without-es6.html) object; with a newer version, or none set, that read is not reported. It does not fix.

Reimplements [eslint-plugin-react's `no-string-refs`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-string-refs.md).

## Options

This rule has no options. The original's [`noTemplateLiterals`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-string-refs.md#rule-options) option is not read: a template literal used as a ref is not reported.

## Examples

### ❌ Incorrect

```tsx
const field = <input ref="email" />
```

### ✅ Correct

```tsx
import { useRef } from 'react'

export function Field() {
  const email = useRef<HTMLInputElement>(null)
  return <input ref={email} />
}
```
