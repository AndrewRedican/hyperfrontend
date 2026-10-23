# react/no-is-mounted

Forbid calls to `this.isMounted()`.

## Rule Details

[`isMounted`](https://legacy.reactjs.org/blog/2015/12/16/ismounted-antipattern.html) is an anti-pattern: code that checks it usually hides a missing cleanup, such as a subscription or timer left running after unmount, and the method does not exist on ES6 class components. This rule reports a call of `this.isMounted()` inside an object property or a class method. It does not fix: cancel the pending work when the component unmounts instead.

Reimplements [eslint-plugin-react's `no-is-mounted`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-is-mounted.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
import createReactClass from 'create-react-class'

export const Clock = createReactClass({
  tick() {
    if (this.isMounted()) this.setState({ now: Date.now() })
  },
})
```

### ✅ Correct

```tsx
import createReactClass from 'create-react-class'

export const Clock = createReactClass({
  componentWillUnmount() {
    clearInterval(this.timer)
  },
})
```
