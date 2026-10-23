# react/no-find-dom-node

Forbid calls to [`findDOMNode`](https://react.dev/reference/react-dom/findDOMNode).

## Rule Details

[`findDOMNode`](https://react.dev/reference/react-dom/findDOMNode) reaches through a component to its DOM node, which breaks the component's abstraction, does not work with function components, is deprecated in strict mode and was removed in React 19. A ref on the element is the replacement. This rule reports a call of a bare [`findDOMNode`](https://react.dev/reference/react-dom/findDOMNode) and of any member named [`findDOMNode`](https://react.dev/reference/react-dom/findDOMNode), such as `ReactDOM.findDOMNode(this)`. It does not fix.

Reimplements [eslint-plugin-react's `no-find-dom-node`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-find-dom-node.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
import { findDOMNode } from 'react-dom'

export function focus(component: React.Component) {
  ;(findDOMNode(component) as HTMLElement).focus()
}
```

### ✅ Correct

```tsx
import { useRef } from 'react'

export function Field() {
  const input = useRef<HTMLInputElement>(null)
  return <input ref={input} onClick={() => input.current?.focus()} />
}
```
