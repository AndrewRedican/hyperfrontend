# react/no-direct-mutation-state

Forbid assigning to [`this.state`](https://react.dev/reference/react/Component#state) outside the constructor of a class component.

## Rule Details

React only re-renders when state changes through [`setState`](https://react.dev/reference/react/Component#setstate); writing to [`this.state`](https://react.dev/reference/react/Component#state) directly leaves the screen stale and can be overwritten by the next update. In class components and [`createReactClass`](https://legacy.reactjs.org/docs/react-without-es6.html) objects, this rule reports an assignment to [`this.state`](https://react.dev/reference/react/Component#state) or to anything under it, and an increment or decrement of something under it. Inside the constructor, where state is set up, assignments pass, but those inside a callback passed to a call there are reported, since the callback runs later. It does not fix.

Reimplements [eslint-plugin-react's `no-direct-mutation-state`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-direct-mutation-state.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
import { Component } from 'react'

export class Counter extends Component<object, { count: number }> {
  increment() {
    this.state.count += 1
  }
}
```

### ✅ Correct

```tsx
import { Component } from 'react'

export class Counter extends Component<object, { count: number }> {
  constructor(props: object) {
    super(props)
    this.state = { count: 0 }
  }

  increment() {
    this.setState(({ count }) => ({ count: count + 1 }))
  }
}
```
