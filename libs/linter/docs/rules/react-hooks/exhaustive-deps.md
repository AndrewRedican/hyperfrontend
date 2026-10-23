# react-hooks/exhaustive-deps

Require the dependency arrays of React effect, memo and callback hooks to list exactly the reactive values their callback reads.

## Rule Details

A hook such as [`useEffect`](https://react.dev/reference/react/useEffect) reruns its callback only when a value in its dependency array changes. A value the callback reads but the array omits leaves the callback working with a stale copy; a value listed but not read reruns it for nothing. The rule checks the calls of [`useEffect`](https://react.dev/reference/react/useEffect), [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect), [`useCallback`](https://react.dev/reference/react/useCallback), [`useMemo`](https://react.dev/reference/react/useMemo) and [`useImperativeHandle`](https://react.dev/reference/react/useImperativeHandle), bare or off the React namespace, and reports:

- a missing dependency: a prop, state value or other value from the component's render scope that the callback reads and the array omits;
- an unnecessary or duplicate dependency, such as an outer constant or a value listed twice;
- an array that is not an array literal, or a callback that is not an inline function or a function declared in the component, whose dependencies cannot be checked;
- a dependency that changes on every render, such as an object or function created in the component body;
- an effect callback that is `async`, a [`ref.current`](https://react.dev/reference/react/useRef#returns) read in an effect cleanup, and an assignment to an outer variable that is lost after each render;
- a state setter called by an effect with no dependency array, which loops, and a [`useMemo`](https://react.dev/reference/react/useMemo) or [`useCallback`](https://react.dev/reference/react/useCallback) with no array, which does nothing.

Values known to be stable, such as the setter returned by [`useState`](https://react.dev/reference/react/useState), the dispatch of [`useReducer`](https://react.dev/reference/react/useReducer) and a ref object from [`useRef`](https://react.dev/reference/react/useRef), need not be listed. The message names the array the rule would write. The rule does not fix.

Reimplements [eslint-plugin-react-hooks' `exhaustive-deps`](https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps).

## Options

This rule has no options. The original's [`additionalHooks`](https://react.dev/reference/eslint-plugin-react-hooks/lints/exhaustive-deps#options) option is not read, so custom hooks are never checked, and neither are its experimental options.

## Examples

### ❌ Incorrect

```tsx
function Search({ query }: { query: string }) {
  const [results, setResults] = useState([])
  useEffect(() => {
    find(query).then(setResults)
  }, [])
  return <List items={results} />
}
```

### ✅ Correct

```tsx
function Search({ query }: { query: string }) {
  const [results, setResults] = useState([])
  useEffect(() => {
    find(query).then(setResults)
  }, [query])
  return <List items={results} />
}
```

## Limitations

The original offers suggestions that rewrite the dependency array; this rule names the array in its message instead.
