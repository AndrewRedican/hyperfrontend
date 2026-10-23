# react-hooks/rules-of-hooks

Require React hooks to be called unconditionally, at the top level of a component or a custom hook.

## Rule Details

React matches hook calls to their state by call order, so every render must call the same hooks in the same order. A hook is a function whose name is "use", or starts with "use" followed by a capital letter or a digit, called bare or off a capitalised object (`React.useState(...)`). The rule follows the code paths of each function and reports a hook call that:

- runs only on some paths through a component or custom hook: inside a condition, after an early return, or behind `&&` and `?:`;
- may run more than once, in a loop;
- sits in an async component or hook;
- sits in a class method, in a function whose name is neither a component (capitalised) nor a hook, inside a callback nested in a component, or at the top level of the module.

A function passed to [`forwardRef`](https://react.dev/reference/react/forwardRef) or [`memo`](https://react.dev/reference/react/memo) counts as a component. React's `use()` may be called conditionally and in loops, and is only checked for where it is called. The rule does not fix.

Reimplements [eslint-plugin-react-hooks' `rules-of-hooks`](https://react.dev/reference/eslint-plugin-react-hooks/lints/rules-of-hooks).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
function Profile({ id }: { id?: string }) {
  if (!id) return null
  const [user, setUser] = useState(null)
  return <p>{user}</p>
}

function load() {
  return useContext(Session)
}
```

### ✅ Correct

```tsx
function Profile({ id }: { id?: string }) {
  const [user, setUser] = useState(null)
  if (!id) return null
  return <p>{user}</p>
}

function useSession() {
  return useContext(Session)
}
```

## Limitations

The checks the original's newer releases make on functions returned by [`useEffectEvent`](https://react.dev/reference/react/useEffectEvent) are not made.
