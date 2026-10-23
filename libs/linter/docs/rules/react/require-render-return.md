# react/require-render-return

Require the [`render`](https://react.dev/reference/react/Component#render) method of a class component to return something.

## Rule Details

A [`render`](https://react.dev/reference/react/Component#render) method without a `return` renders nothing, which is almost always a forgotten keyword after a refactor. This rule reports a [`render`](https://react.dev/reference/react/Component#render) member whose value is a function with a block body and no `return` of its own; a `return` inside a nested function, such as a `.map()` callback, does not count. An arrow function with an expression body passes. Class components are classes that extend [`Component`](https://react.dev/reference/react/Component) or [`PureComponent`](https://react.dev/reference/react/PureComponent), bare or read off the pragma, and objects passed to the class factory, [`createReactClass`](https://legacy.reactjs.org/docs/react-without-es6.html) unless the settings name another (`{ react: { createClass: 'createClass' } }`). It does not fix.

Reimplements [eslint-plugin-react's `require-render-return`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/require-render-return.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
import { Component } from 'react'

export class List extends Component<{ items: string[] }> {
  render() {
    ;<ul>
      {this.props.items.map((item) => {
        return <li key={item}>{item}</li>
      })}
    </ul>
  }
}
```

### ✅ Correct

```tsx
import { Component } from 'react'

export class List extends Component<{ items: string[] }> {
  render() {
    return (
      <ul>
        {this.props.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
}
```
