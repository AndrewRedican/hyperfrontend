# react/display-name

Require every React component to have a display name.

## Rule Details

A component without a name shows as anonymous in React's developer tools and in error stacks. This rule finds components the way React sees them: class components, [`createReactClass`](https://legacy.reactjs.org/docs/react-without-es6.html) objects, and functions that return JSX or `null` from a position a component can take, including those wrapped in [`memo`](https://react.dev/reference/react/memo) or [`forwardRef`](https://react.dev/reference/react/forwardRef). A component counts as named when it is declared or assigned under a name, when its [`displayName`](https://legacy.reactjs.org/docs/react-component.html#displayname) is set, or when a factory object lists it. An anonymous default export and an anonymous function handed to [`memo`](https://react.dev/reference/react/memo) or [`forwardRef`](https://react.dev/reference/react/forwardRef) are reported. It does not fix.

The rule reads the shared settings. The pragma (`{ react: { pragma: 'Preact' } }`, or a `@jsx` comment in the file) names the object [`memo`](https://react.dev/reference/react/memo) and [`forwardRef`](https://react.dev/reference/react/forwardRef) are read from, and `{ componentWrapperFunctions: [...] }` adds wrapper functions, as names or as `{ property, object }` objects. With a React version (`{ react: { version: '16.12' } }`) of 0.14.10 and later 0.14, 15.7 and later 15, or 16.12 and newer, the default when no version is set, a wrapper call whose argument is itself a call, such as `memo(forwardRef(...))`, is not reported, because those versions name it from the inner component.

Reimplements [eslint-plugin-react's `display-name`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/display-name.md).

## Options

This rule has no options. The [original's options](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/display-name.md#rule-options), which ignore names the transpiler infers and check legacy context objects, are not read: inferred names count, and context objects are not checked.

## Examples

### ❌ Incorrect

```tsx
import { forwardRef, memo } from 'react'

export const Card = memo(() => <div className="card" />)

export const Input = forwardRef<HTMLInputElement>((props, ref) => <input ref={ref} />)
```

### ✅ Correct

```tsx
import { forwardRef, memo } from 'react'

export const Card = memo(function Card() {
  return <div className="card" />
})

const Input = forwardRef<HTMLInputElement>((props, ref) => <input ref={ref} />)
Input.displayName = 'Input'
```
