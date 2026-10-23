import { testRule } from '../../testing/rule-tester'
import rule from './exhaustive-deps'

// why: the workspace runs the rule with its default options; the cases with `additionalHooks` or the dangerous autofix are left out.
testRule(rule, {
  valid: [
    {
      name: '#172 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const ref = useRef() as React.MutableRefObject<HTMLDivElement>;\n  useEffect(() => {\n    console.log(ref.current);\n  }, []);\n}\n',
    },
    {
      name: '#175 function App(props) {',
      path: '/root/react.tsx',
      text: '\nfunction App(props) {\n  React.useEffect(() => {\n    console.log(props.test);\n  }, [props.test] as const);\n}\n',
    },
    {
      name: '#177 function App(props) {',
      path: '/root/react.tsx',
      text: '\nfunction App(props) {\n  React.useEffect((() => {\n    console.log(props.test);\n  }) as any, [props.test]);\n}\n',
    },
    {
      name: '#178 function useMyThing<T>(): void {',
      path: '/root/react.tsx',
      text: '\nfunction useMyThing<T>(): void {\n  useEffect(() => {\n    let foo: T;\n    console.log(foo);\n  }, []);\n}\n',
    },
    {
      name: "#180 import { useEffect, useMemo, useRef, useState } from 'react'",
      path: '/root/search-box.tsx',
      text: "\n      import { useEffect, useMemo, useRef, useState } from 'react'\n\n      interface SearchBoxProps {\n        items: readonly string[]\n        onPick: (item: string) => void\n      }\n\n      export function SearchBox({ items, onPick }: SearchBoxProps) {\n        const [query, setQuery] = useState<string>('')\n        const input = useRef<HTMLInputElement>(null)\n        const matches = useMemo(() => items.filter((item) => item.includes(query)), [items, query])\n        useEffect(() => {\n          input.current?.focus()\n        }, [])\n        useEffect(() => {\n          if (matches.length === 1) onPick(matches[0] as string)\n        }, [matches, onPick])\n        return <input ref={input} value={query} onChange={(event) => setQuery(event.target.value)} />\n      }\n    ",
    },
    {
      name: '#211 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local = someFunc();\n  useEffect(() => {\n    console.log(local);\n  }, [,,,local,,,]);\n}\n',
    },
    {
      name: '#241 function MyComponent({delay}) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent({delay}) {\n  const local = {};\n  const myEffect = debounce(() => {\n    console.log(local);\n  }, delay);\n  useEffect(myEffect, [myEffect]);\n}\n',
    },
    {
      name: '#244 let local = {};',
      path: '/root/react.tsx',
      text: '\nlet local = {};\nfunction myEffect() {\n  console.log(local);\n}\nfunction MyComponent() {\n  useEffect(myEffect, []);\n}\n',
    },
    {
      name: '#246 function MyComponent({myEffect}) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent({myEffect}) {\n  useEffect(myEffect);\n}\n',
    },
    {
      name: '#252 const local = {};',
      path: '/root/react.tsx',
      text: '\nconst local = {};\nuseEffect(() => {\n  console.log(local);\n}, []);\n',
    },
    {
      name: '#256 function MyComponent({ maybeRef2, foo }) {',
      path: '/root/react.tsx',
      text: "\nfunction MyComponent({ maybeRef2, foo }) {\n  const definitelyRef1 = useRef();\n  const definitelyRef2 = useRef();\n  const maybeRef1 = useSomeOtherRefyThing();\n  const [state1, setState1] = useState();\n  const [state2, setState2] = React.useState();\n  const [state3, dispatch1] = useReducer();\n  const [state4, dispatch2] = React.useReducer();\n  const [state5, maybeSetState] = useFunnyState();\n  const [state6, maybeDispatch] = useFunnyReducer();\n  const [state9, dispatch5] = useActionState();\n  const [state10, dispatch6] = React.useActionState();\n  const [isPending1] = useTransition();\n  const [isPending2, startTransition2] = useTransition();\n  const [isPending3] = React.useTransition();\n  const [isPending4, startTransition4] = React.useTransition();\n  const mySetState = useCallback(() => {}, []);\n  let myDispatch = useCallback(() => {}, []);\n\n  useEffect(() => {\n    // Known to be static\n    console.log(definitelyRef1.current);\n    console.log(definitelyRef2.current);\n    console.log(maybeRef1.current);\n    console.log(maybeRef2.current);\n    setState1();\n    setState2();\n    dispatch1();\n    dispatch2();\n    dispatch5();\n    dispatch6();\n    startTransition1();\n    startTransition2();\n    startTransition3();\n    startTransition4();\n\n    // Dynamic\n    console.log(state1);\n    console.log(state2);\n    console.log(state3);\n    console.log(state4);\n    console.log(state5);\n    console.log(state6);\n    console.log(isPending2);\n    console.log(isPending4);\n    mySetState();\n    myDispatch();\n\n    // Not sure; assume dynamic\n    maybeSetState();\n    maybeDispatch();\n  }, [\n    // Dynamic\n    state1, state2, state3, state4, state5, state6, state9, state10,\n    maybeRef1, maybeRef2,\n    isPending2, isPending4,\n\n    // Not sure; assume dynamic\n    mySetState, myDispatch,\n    maybeSetState, maybeDispatch\n\n    // In this test, we don't specify static deps.\n    // That should be okay.\n  ]);\n}\n",
    },
    {
      name: '#262 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const myRef = useRef();\n  useEffect(() => {\n    const handleMove = () => {};\n    myRef.current = {};\n    return () => {\n      console.log(myRef.current.toString())\n    };\n  }, []);\n  return <div />;\n}\n',
    },
    {
      name: '#292 function App() {',
      path: '/root/react.tsx',
      text: "\nfunction App() {\n  const [query, setQuery] = useState('react');\n  const [state, setState] = useState(null);\n  useEffect(() => {\n    let ignore = false;\n    fetchSomething();\n    async function fetchSomething() {\n      const result = await (await fetch('http://hn.algolia.com/api/v1/search?query=' + query)).json();\n      if (!ignore) setState(result);\n    }\n    return () => { ignore = true; };\n  }, [query]);\n  return (\n    <>\n      <input value={query} onChange={e => setQuery(e.target.value)} />\n      {JSON.stringify(state)}\n    </>\n  );\n}\n",
    },
    {
      name: '#303 function useFoo(){',
      path: '/root/react.tsx',
      text: '\nfunction useFoo(){\n  let {foo} = {foo: 1};\n  return useMemo(() => foo, [foo]);\n}\n',
    },
    {
      name: '#307 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const foo = true ? "fine" : "also fine";\n  return useMemo(() => foo, [foo]);\n}\n',
    },
  ],
  invalid: [
    {
      name: '#2 function ComponentUsingFormState(props) {',
      path: '/root/react.tsx',
      text: '\nfunction ComponentUsingFormState(props) {\n  const [state7, dispatch3] = useFormState();\n  const [state8, dispatch4] = ReactDOM.useFormState();\n  useEffect(() => {\n    dispatch3();\n    dispatch4();\n\n    // dynamic\n    console.log(state7);\n    console.log(state8);\n\n  }, [state7, state8]);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'dispatch3' and 'dispatch4'. Either include them or remove the dependency array.",
          line: 13,
          column: 6,
          endLine: 13,
          endColumn: 22,
        },
      ],
    },
    {
      name: '#3 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  useCallback(() => {\n    console.log(props.foo?.bar.baz);\n  }, []);\n}\n',
      errors: [
        {
          message:
            "React Hook useCallback has a missing dependency: 'props.foo?.bar.baz'. Either include it or remove the dependency array.",
          line: 5,
          column: 6,
          endLine: 5,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#7 function Counter(unstableProp) {',
      path: '/root/react.tsx',
      text: '\nfunction Counter(unstableProp) {\n  let [count, setCount] = useState(0);\n  setCount = unstableProp\n  useEffect(() => {\n    let id = setInterval(() => {\n      setCount(c => c + 1);\n    }, 1000);\n    return () => clearInterval(id);\n  }, []);\n\n  return <h1>{count}</h1>;\n}\n',
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'setCount'. Either include it or remove the dependency array.",
          line: 10,
          column: 6,
          endLine: 10,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#10 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: "\nfunction MyComponent(props) {\n  const value = useMemo(() => { return 2*2; });\n  const fn = useCallback(() => { alert('foo'); });\n}\n",
      errors: [
        {
          message: 'React Hook useMemo does nothing when called with only one argument. Did you forget to pass an array of dependencies?',
          line: 3,
          column: 17,
          endLine: 3,
          endColumn: 24,
        },
        {
          message:
            'React Hook useCallback does nothing when called with only one argument. Did you forget to pass an array of dependencies?',
          line: 4,
          column: 14,
          endLine: 4,
          endColumn: 25,
        },
      ],
    },
    {
      name: '#12 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  useEffect()\n  useLayoutEffect()\n  useCallback()\n  useMemo()\n}\n',
      errors: [
        {
          message: 'React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 12,
        },
        {
          message: 'React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?',
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 18,
        },
        {
          message: 'React Hook useCallback requires an effect callback. Did you forget to pass a callback to the hook?',
          line: 5,
          column: 3,
          endLine: 5,
          endColumn: 14,
        },
        {
          message: 'React Hook useMemo requires an effect callback. Did you forget to pass a callback to the hook?',
          line: 6,
          column: 3,
          endLine: 6,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#14 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local = {};\n  useEffect(() => {\n    try {\n      console.log(local);\n    } finally {}\n  }, []);\n}\n',
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'local'. Either include it or remove the dependency array.",
          line: 8,
          column: 6,
          endLine: 8,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#18 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local1 = {};\n  const local2 = {};\n  useMemo(() => {\n    console.log(local1);\n  }, [local1, local2]);\n}\n',
      errors: [
        {
          message: "React Hook useMemo has an unnecessary dependency: 'local2'. Either exclude it or remove the dependency array.",
          line: 7,
          column: 6,
          endLine: 7,
          endColumn: 22,
        },
      ],
    },
    {
      name: '#19 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local1 = someFunc();\n  function MyNestedComponent() {\n    const local2 = {};\n    useCallback(() => {\n      console.log(local1);\n      console.log(local2);\n    }, [local1]);\n  }\n}\n',
      errors: [
        {
          message:
            "React Hook useCallback has a missing dependency: 'local2'. Either include it or remove the dependency array. Outer scope values like 'local1' aren't valid dependencies because mutating them doesn't re-render the component.",
          line: 9,
          column: 8,
          endLine: 9,
          endColumn: 16,
        },
      ],
    },
    {
      name: '#21 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local = {};\n  useEffect(() => {\n    console.log(local);\n    console.log(local);\n  }, [local, local]);\n}\n',
      errors: [
        {
          message: "React Hook useEffect has a duplicate dependency: 'local'. Either omit it or remove the dependency array.",
          line: 7,
          column: 6,
          endLine: 7,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#22 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  useCallback(() => {}, [window]);\n}\n',
      errors: [
        {
          message:
            "React Hook useCallback has an unnecessary dependency: 'window'. Either exclude it or remove the dependency array. Outer scope values like 'window' aren't valid dependencies because mutating them doesn't re-render the component.",
          line: 3,
          column: 25,
          endLine: 3,
          endColumn: 33,
        },
      ],
    },
    {
      name: '#28 function MyComponent({ foo, bar, baz }) {',
      path: '/root/react.tsx',
      text: "\nfunction MyComponent({ foo, bar, baz }) {\n  useEffect(() => {\n    console.log(foo, bar, baz);\n  }, ['foo', 'bar']);\n}\n",
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'bar', 'baz', and 'foo'. Either include them or remove the dependency array.",
          line: 5,
          column: 6,
          endLine: 5,
          endColumn: 20,
        },
        {
          message:
            "The 'foo' literal is not a valid dependency because it never changes. Did you mean to include foo in the array instead?",
          line: 5,
          column: 7,
          endLine: 5,
          endColumn: 12,
        },
        {
          message:
            "The 'bar' literal is not a valid dependency because it never changes. Did you mean to include bar in the array instead?",
          line: 5,
          column: 14,
          endLine: 5,
          endColumn: 19,
        },
      ],
    },
    {
      name: '#29 function MyComponent({ foo, bar, baz }) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent({ foo, bar, baz }) {\n  useEffect(() => {\n    console.log(foo, bar, baz);\n  }, [42, false, null]);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'bar', 'baz', and 'foo'. Either include them or remove the dependency array.",
          line: 5,
          column: 6,
          endLine: 5,
          endColumn: 23,
        },
        {
          message: 'The 42 literal is not a valid dependency because it never changes. You can safely remove it.',
          line: 5,
          column: 7,
          endLine: 5,
          endColumn: 9,
        },
        {
          message: 'The false literal is not a valid dependency because it never changes. You can safely remove it.',
          line: 5,
          column: 11,
          endLine: 5,
          endColumn: 16,
        },
        {
          message: 'The null literal is not a valid dependency because it never changes. You can safely remove it.',
          line: 5,
          column: 18,
          endLine: 5,
          endColumn: 22,
        },
      ],
    },
    {
      name: '#31 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local = {};\n  const dependencies = [local];\n  useEffect(() => {\n    console.log(local);\n  }, dependencies);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect was passed a dependency list that is not an array literal. This means we can't statically verify whether you've passed the correct dependencies.",
          line: 7,
          column: 6,
          endLine: 7,
          endColumn: 18,
        },
        {
          message: "React Hook useEffect has a missing dependency: 'local'. Either include it or remove the dependency array.",
          line: 7,
          column: 6,
          endLine: 7,
          endColumn: 18,
        },
      ],
    },
    {
      name: '#32 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local = {};\n  const dependencies = [local];\n  useEffect(() => {\n    console.log(local);\n  }, [...dependencies]);\n}\n',
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'local'. Either include it or remove the dependency array.",
          line: 7,
          column: 6,
          endLine: 7,
          endColumn: 23,
        },
        {
          message:
            "React Hook useEffect has a spread element in its dependency array. This means we can't statically verify whether you've passed the correct dependencies.",
          line: 7,
          column: 7,
          endLine: 7,
          endColumn: 22,
        },
      ],
    },
    {
      name: '#40 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  const local = {};\n  useCallback(() => {\n    console.log(props.foo);\n    console.log(props.bar);\n  }, []);\n}\n',
      errors: [
        {
          message:
            "React Hook useCallback has missing dependencies: 'props.bar' and 'props.foo'. Either include them or remove the dependency array.",
          line: 7,
          column: 6,
          endLine: 7,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#55 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  let a, b, c, d, e, f, g;\n  useEffect(() => {\n    console.log(b, e, d, c, a, g, f);\n  }, [c, a, g]);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'b', 'd', 'e', and 'f'. Either include them or remove the dependency array.",
          line: 6,
          column: 6,
          endLine: 6,
          endColumn: 15,
        },
      ],
    },
    {
      name: '#57 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  let a, b, c, d, e, f, g;\n  useEffect(() => {\n    console.log(b, e, d, c, a, g, f);\n  }, []);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'a', 'b', 'c', 'd', 'e', 'f', and 'g'. Either include them or remove the dependency array.",
          line: 6,
          column: 6,
          endLine: 6,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#60 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  useEffect(() => {\n    console.log(props.foo);\n  }, []);\n  useCallback(() => {\n    console.log(props.foo);\n  }, []);\n  useMemo(() => {\n    console.log(props.foo);\n  }, []);\n  React.useEffect(() => {\n    console.log(props.foo);\n  }, []);\n  React.useCallback(() => {\n    console.log(props.foo);\n  }, []);\n  React.useMemo(() => {\n    console.log(props.foo);\n  }, []);\n  React.notReactiveHook(() => {\n    console.log(props.foo);\n  }, []);\n}\n',
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'props.foo'. Either include it or remove the dependency array.",
          line: 5,
          column: 6,
          endLine: 5,
          endColumn: 8,
        },
        {
          message: "React Hook useCallback has a missing dependency: 'props.foo'. Either include it or remove the dependency array.",
          line: 8,
          column: 6,
          endLine: 8,
          endColumn: 8,
        },
        {
          message: "React Hook useMemo has a missing dependency: 'props.foo'. Either include it or remove the dependency array.",
          line: 11,
          column: 6,
          endLine: 11,
          endColumn: 8,
        },
        {
          message: "React Hook React.useEffect has a missing dependency: 'props.foo'. Either include it or remove the dependency array.",
          line: 14,
          column: 6,
          endLine: 14,
          endColumn: 8,
        },
        {
          message: "React Hook React.useCallback has a missing dependency: 'props.foo'. Either include it or remove the dependency array.",
          line: 17,
          column: 6,
          endLine: 17,
          endColumn: 8,
        },
        {
          message: "React Hook React.useMemo has a missing dependency: 'props.foo'. Either include it or remove the dependency array.",
          line: 20,
          column: 6,
          endLine: 20,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#64 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  useEffect(() => {}, [props?.attribute.method()]);\n}\n',
      errors: [
        {
          message:
            'React Hook useEffect has a complex expression in the dependency array. Extract it to a separate variable so it can be statically checked.',
          line: 3,
          column: 24,
          endLine: 3,
          endColumn: 49,
        },
      ],
    },
    {
      name: '#70 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  const ref1 = useRef();\n  const ref2 = useRef();\n  useEffect(() => {\n    ref1?.current?.focus();\n    console.log(ref2?.current?.textContent);\n    alert(props.someOtherRefs.current.innerHTML);\n    fetch(props.color);\n  }, [ref1?.current, ref2?.current, props.someOtherRefs, props.color]);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has unnecessary dependencies: 'ref1.current' and 'ref2.current'. Either exclude them or remove the dependency array. Mutable values like 'ref1.current' aren't valid dependencies because mutating them doesn't re-render the component.",
          line: 10,
          column: 6,
          endLine: 10,
          endColumn: 70,
        },
      ],
    },
    {
      name: '#71 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const ref = useRef();\n  useEffect(() => {\n    console.log(ref.current);\n  }, [ref.current]);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has an unnecessary dependency: 'ref.current'. Either exclude it or remove the dependency array. Mutable values like 'ref.current' aren't valid dependencies because mutating them doesn't re-render the component.",
          line: 6,
          column: 6,
          endLine: 6,
          endColumn: 19,
        },
      ],
    },
    {
      name: '#73 function MyComponent({ activeTab, initY }) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent({ activeTab, initY }) {\n  const ref1 = useRef();\n  const ref2 = useRef();\n  const fn = useCallback(() => {\n    ref1.current.scrollTop = initY;\n    ref2.current.scrollTop = initY;\n  }, [ref1.current, ref2.current, activeTab, initY]);\n}\n',
      errors: [
        {
          message:
            "React Hook useCallback has unnecessary dependencies: 'activeTab', 'ref1.current', and 'ref2.current'. Either exclude them or remove the dependency array. Mutable values like 'ref1.current' aren't valid dependencies because mutating them doesn't re-render the component.",
          line: 8,
          column: 6,
          endLine: 8,
          endColumn: 52,
        },
      ],
    },
    {
      name: '#75 const MyComponent = forwardRef((props, ref) => {',
      path: '/root/react.tsx',
      text: '\nconst MyComponent = forwardRef((props, ref) => {\n  useImperativeHandle(ref, () => ({\n    focus() {\n      alert(props.hello);\n    }\n  }), [])\n});\n',
      errors: [
        {
          message:
            "React Hook useImperativeHandle has a missing dependency: 'props.hello'. Either include it or remove the dependency array.",
          line: 7,
          column: 7,
          endLine: 7,
          endColumn: 9,
        },
      ],
    },
    {
      name: '#77 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  useEffect(() => {\n    if (props?.onChange) {\n      props?.onChange();\n    }\n  }, []);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has a missing dependency: 'props'. Either include it or remove the dependency array. However, 'props' will change when *any* prop changes, so the preferred fix is to destructure the 'props' object outside of the useEffect call and refer to those specific props inside useEffect.",
          line: 7,
          column: 6,
          endLine: 7,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#82 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  const [skillsCount] = useState();\n  useEffect(() => {\n    if (skillsCount === 0 && !props.isEditMode) {\n      props.toggleEditMode();\n    }\n  }, []);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'props' and 'skillsCount'. Either include them or remove the dependency array. However, 'props' will change when *any* prop changes, so the preferred fix is to destructure the 'props' object outside of the useEffect call and refer to those specific props inside useEffect.",
          line: 8,
          column: 6,
          endLine: 8,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#85 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  let value;\n  let value2;\n  let value3;\n  let value4;\n  let asyncValue;\n  useEffect(() => {\n    if (value4) {\n      value = {};\n    }\n    value2 = 100;\n    value = 43;\n    value4 = true;\n    console.log(value2);\n    console.log(value3);\n    setTimeout(() => {\n      asyncValue = 100;\n    });\n  }, []);\n}\n',
      errors: [
        {
          message:
            "Assignments to the 'value2' variable from inside React Hook useEffect will be lost after each render. To preserve the value over time, store it in a useRef Hook and keep the mutable value in the '.current' property. Otherwise, you can move this variable directly inside useEffect.",
          line: 12,
          column: 14,
          endLine: 12,
          endColumn: 17,
        },
        {
          message:
            "Assignments to the 'value' variable from inside React Hook useEffect will be lost after each render. To preserve the value over time, store it in a useRef Hook and keep the mutable value in the '.current' property. Otherwise, you can move this variable directly inside useEffect.",
          line: 13,
          column: 13,
          endLine: 13,
          endColumn: 15,
        },
        {
          message:
            "Assignments to the 'value4' variable from inside React Hook useEffect will be lost after each render. To preserve the value over time, store it in a useRef Hook and keep the mutable value in the '.current' property. Otherwise, you can move this variable directly inside useEffect.",
          line: 14,
          column: 14,
          endLine: 14,
          endColumn: 18,
        },
        {
          message:
            "Assignments to the 'asyncValue' variable from inside React Hook useEffect will be lost after each render. To preserve the value over time, store it in a useRef Hook and keep the mutable value in the '.current' property. Otherwise, you can move this variable directly inside useEffect.",
          line: 18,
          column: 20,
          endLine: 18,
          endColumn: 23,
        },
      ],
    },
    {
      name: '#89 function MyComponent() {',
      path: '/root/react.tsx',
      text: "\nfunction MyComponent() {\n  const myRef = useRef();\n  useEffect(() => {\n    const handleMove = () => {};\n    myRef.current.addEventListener('mousemove', handleMove);\n    return () => myRef.current.removeEventListener('mousemove', handleMove);\n  });\n  return <div ref={myRef} />;\n}\n",
      errors: [
        {
          message:
            "The ref value 'myRef.current' will likely have changed by the time this effect cleanup function runs. If this ref points to a node rendered by React, copy 'myRef.current' to a variable inside the effect, and use that variable in the cleanup function.",
          line: 7,
          column: 24,
          endLine: 7,
          endColumn: 31,
        },
      ],
    },
    {
      name: '#94 function MyComponent() {',
      path: '/root/react.tsx',
      text: "\nfunction MyComponent() {\n  const local1 = 42;\n  const local2 = '42';\n  const local3 = null;\n  const local4 = {};\n  useEffect(() => {\n    console.log(local1);\n    console.log(local2);\n    console.log(local3);\n    console.log(local4);\n  }, [local1, local3]);\n}\n",
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'local4'. Either include it or remove the dependency array.",
          line: 12,
          column: 6,
          endLine: 12,
          endColumn: 22,
        },
      ],
    },
    {
      name: '#95 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  useEffect(() => {\n    window.scrollTo(0, 0);\n  }, [window]);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has an unnecessary dependency: 'window'. Either exclude it or remove the dependency array. Outer scope values like 'window' aren't valid dependencies because mutating them doesn't re-render the component.",
          line: 5,
          column: 6,
          endLine: 5,
          endColumn: 14,
        },
      ],
    },
    {
      name: "#98 import MutableStore from 'store';",
      path: '/root/react.tsx',
      text: "\nimport MutableStore from 'store';\nlet z = {};\n\nfunction MyComponent(props) {\n  let x = props.foo;\n  {\n    let y = props.bar;\n    useEffect(() => {\n      // nothing\n    }, [MutableStore.hello.world, props.foo, x, y, z, global.stuff]);\n  }\n}\n",
      errors: [
        {
          message:
            "React Hook useEffect has unnecessary dependencies: 'MutableStore.hello.world', 'global.stuff', and 'z'. Either exclude them or remove the dependency array. Outer scope values like 'MutableStore.hello.world' aren't valid dependencies because mutating them doesn't re-render the component.",
          line: 11,
          column: 8,
          endLine: 11,
          endColumn: 68,
        },
      ],
    },
    {
      name: "#99 import MutableStore from 'store';",
      path: '/root/react.tsx',
      text: "\nimport MutableStore from 'store';\nlet z = {};\n\nfunction MyComponent(props) {\n  let x = props.foo;\n  {\n    let y = props.bar;\n    const fn = useCallback(() => {\n      // nothing\n    }, [MutableStore.hello.world, props.foo, x, y, z, global.stuff]);\n  }\n}\n",
      errors: [
        {
          message:
            "React Hook useCallback has unnecessary dependencies: 'MutableStore.hello.world', 'global.stuff', 'props.foo', 'x', 'y', and 'z'. Either exclude them or remove the dependency array. Outer scope values like 'MutableStore.hello.world' aren't valid dependencies because mutating them doesn't re-render the component.",
          line: 11,
          column: 8,
          endLine: 11,
          endColumn: 68,
        },
      ],
    },
    {
      name: '#102 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: "\nfunction MyComponent(props) {\n  let [, setState] = useState();\n  let [, dispatch] = React.useReducer();\n  let taint = props.foo;\n\n  // Shouldn't affect anything\n  function handleChange() {}\n\n  function handleNext1(value) {\n    let value2 = value * taint;\n    setState(value2);\n    console.log('hello');\n  }\n  const handleNext2 = (value) => {\n    setState(taint(value));\n    console.log('hello');\n  };\n  let handleNext3 = function(value) {\n    console.log(taint);\n    dispatch({ type: 'x', value });\n  };\n  useEffect(() => {\n    return Store.subscribe(handleNext1);\n  }, []);\n  useLayoutEffect(() => {\n    return Store.subscribe(handleNext2);\n  }, []);\n  useMemo(() => {\n    return Store.subscribe(handleNext3);\n  }, []);\n}\n",
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'handleNext1'. Either include it or remove the dependency array.",
          line: 25,
          column: 6,
          endLine: 25,
          endColumn: 8,
        },
        {
          message: "React Hook useLayoutEffect has a missing dependency: 'handleNext2'. Either include it or remove the dependency array.",
          line: 28,
          column: 6,
          endLine: 28,
          endColumn: 8,
        },
        {
          message: "React Hook useMemo has a missing dependency: 'handleNext3'. Either include it or remove the dependency array.",
          line: 31,
          column: 6,
          endLine: 31,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#107 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: "\nfunction MyComponent(props) {\n  function handleNext1() {\n    console.log('hello');\n  }\n  const handleNext2 = () => {\n    console.log('hello');\n  };\n  let handleNext3 = function() {\n    console.log('hello');\n  };\n  useEffect(() => {\n    return Store.subscribe(handleNext1);\n  }, [handleNext1]);\n  useLayoutEffect(() => {\n    return Store.subscribe(handleNext2);\n  }, [handleNext2]);\n  useMemo(() => {\n    return Store.subscribe(handleNext3);\n  }, [handleNext3]);\n}\n",
      errors: [
        {
          message:
            "The 'handleNext1' function makes the dependencies of useEffect Hook (at line 14) change on every render. Move it inside the useEffect callback. Alternatively, wrap the definition of 'handleNext1' in its own useCallback() Hook.",
          line: 3,
          column: 3,
          endLine: 5,
          endColumn: 4,
        },
        {
          message:
            "The 'handleNext2' function makes the dependencies of useLayoutEffect Hook (at line 17) change on every render. Move it inside the useLayoutEffect callback. Alternatively, wrap the definition of 'handleNext2' in its own useCallback() Hook.",
          line: 6,
          column: 9,
          endLine: 8,
          endColumn: 4,
        },
        {
          message:
            "The 'handleNext3' function makes the dependencies of useMemo Hook (at line 20) change on every render. Move it inside the useMemo callback. Alternatively, wrap the definition of 'handleNext3' in its own useCallback() Hook.",
          line: 9,
          column: 7,
          endLine: 11,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#109 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: "\nfunction MyComponent(props) {\n  function handleNext1() {\n    console.log('hello');\n  }\n  const handleNext2 = () => {\n    console.log('hello');\n  };\n  let handleNext3 = function() {\n    console.log('hello');\n  };\n  useEffect(() => {\n    handleNext1();\n    return Store.subscribe(() => handleNext1());\n  }, [handleNext1]);\n  useLayoutEffect(() => {\n    handleNext2();\n    return Store.subscribe(() => handleNext2());\n  }, [handleNext2]);\n  useMemo(() => {\n    handleNext3();\n    return Store.subscribe(() => handleNext3());\n  }, [handleNext3]);\n  return (\n    <div\n      onClick={() => {\n        handleNext1();\n        setTimeout(handleNext2);\n        setTimeout(() => {\n          handleNext3();\n        });\n      }}\n    />\n  );\n}\n",
      errors: [
        {
          message:
            "The 'handleNext1' function makes the dependencies of useEffect Hook (at line 15) change on every render. To fix this, wrap the definition of 'handleNext1' in its own useCallback() Hook.",
          line: 3,
          column: 3,
          endLine: 5,
          endColumn: 4,
        },
        {
          message:
            "The 'handleNext2' function makes the dependencies of useLayoutEffect Hook (at line 19) change on every render. To fix this, wrap the definition of 'handleNext2' in its own useCallback() Hook.",
          line: 6,
          column: 9,
          endLine: 8,
          endColumn: 4,
        },
        {
          message:
            "The 'handleNext3' function makes the dependencies of useMemo Hook (at line 23) change on every render. To fix this, wrap the definition of 'handleNext3' in its own useCallback() Hook.",
          line: 9,
          column: 7,
          endLine: 11,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#111 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: "\nfunction MyComponent(props) {\n  let handleNext = () => {\n    console.log('hello');\n  };\n  if (props.foo) {\n    handleNext = () => {\n      console.log('hello');\n    };\n  }\n  useEffect(() => {\n    return Store.subscribe(handleNext);\n  }, [handleNext]);\n}\n",
      errors: [
        {
          message:
            "The 'handleNext' function makes the dependencies of useEffect Hook (at line 13) change on every render. To fix this, wrap the definition of 'handleNext' in its own useCallback() Hook.",
          line: 3,
          column: 7,
          endLine: 5,
          endColumn: 4,
        },
      ],
    },
    {
      name: '#114 function Counter() {',
      path: '/root/react.tsx',
      text: '\nfunction Counter() {\n  let [count, setCount] = useState(0);\n  let [increment, setIncrement] = useState(0);\n\n  useEffect(() => {\n    let id = setInterval(() => {\n      setCount(count + increment);\n    }, 1000);\n    return () => clearInterval(id);\n  }, []);\n\n  return <h1>{count}</h1>;\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'count' and 'increment'. Either include them or remove the dependency array. You can also do a functional update 'setCount(c => ...)' if you only need 'count' in the 'setCount' call.",
          line: 11,
          column: 6,
          endLine: 11,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#115 function Counter() {',
      path: '/root/react.tsx',
      text: '\nfunction Counter() {\n  let [count, setCount] = useState(0);\n  let [increment, setIncrement] = useState(0);\n\n  useEffect(() => {\n    let id = setInterval(() => {\n      setCount(count => count + increment);\n    }, 1000);\n    return () => clearInterval(id);\n  }, []);\n\n  return <h1>{count}</h1>;\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has a missing dependency: 'increment'. Either include it or remove the dependency array. You can also replace multiple useState variables with useReducer if 'setCount' needs the current value of 'increment'.",
          line: 11,
          column: 6,
          endLine: 11,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#116 function Counter() {',
      path: '/root/react.tsx',
      text: '\nfunction Counter() {\n  let [count, setCount] = useState(0);\n  let increment = useCustomHook();\n\n  useEffect(() => {\n    let id = setInterval(() => {\n      setCount(count => count + increment);\n    }, 1000);\n    return () => clearInterval(id);\n  }, []);\n\n  return <h1>{count}</h1>;\n}\n',
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'increment'. Either include it or remove the dependency array.",
          line: 11,
          column: 6,
          endLine: 11,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#119 function Counter({ increment }) {',
      path: '/root/react.tsx',
      text: '\nfunction Counter({ increment }) {\n  let [count, setCount] = useState(0);\n\n  useEffect(() => {\n    let id = setInterval(() => {\n      setCount(count => count + increment);\n    }, 1000);\n    return () => clearInterval(id);\n  }, []);\n\n  return <h1>{count}</h1>;\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has a missing dependency: 'increment'. Either include it or remove the dependency array. If 'setCount' needs the current value of 'increment', you can also switch to useReducer instead of useState and read 'increment' in the reducer.",
          line: 10,
          column: 6,
          endLine: 10,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#123 function Podcasts({ api: { fetchPodcasts }, id }) {',
      path: '/root/react.tsx',
      text: '\nfunction Podcasts({ api: { fetchPodcasts }, id }) {\n  let [podcasts, setPodcasts] = useState(null);\n  useEffect(() => {\n    fetchPodcasts(id).then(setPodcasts);\n  }, [id]);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has a missing dependency: 'fetchPodcasts'. Either include it or remove the dependency array. If 'fetchPodcasts' changes too often, find the parent component that defines it and wrap that definition in useCallback.",
          line: 6,
          column: 6,
          endLine: 6,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#124 function Podcasts({ fetchPodcasts, fetchPodcasts2, id }) {',
      path: '/root/react.tsx',
      text: '\nfunction Podcasts({ fetchPodcasts, fetchPodcasts2, id }) {\n  let [podcasts, setPodcasts] = useState(null);\n  useEffect(() => {\n    setTimeout(() => {\n      console.log(id);\n      fetchPodcasts(id).then(setPodcasts);\n      fetchPodcasts2(id).then(setPodcasts);\n    });\n  }, [id]);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'fetchPodcasts' and 'fetchPodcasts2'. Either include them or remove the dependency array. If 'fetchPodcasts' changes too often, find the parent component that defines it and wrap that definition in useCallback.",
          line: 10,
          column: 6,
          endLine: 10,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#126 function Podcasts({ fetchPodcasts, id }) {',
      path: '/root/react.tsx',
      text: '\nfunction Podcasts({ fetchPodcasts, id }) {\n  let [podcasts, setPodcasts] = useState(null);\n  useEffect(() => {\n    console.log(fetchPodcasts);\n    fetchPodcasts?.(id).then(setPodcasts);\n  }, [id]);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has a missing dependency: 'fetchPodcasts'. Either include it or remove the dependency array. If 'fetchPodcasts' changes too often, find the parent component that defines it and wrap that definition in useCallback.",
          line: 7,
          column: 6,
          endLine: 7,
          endColumn: 10,
        },
      ],
    },
    {
      name: '#127 function Thing() {',
      path: '/root/react.tsx',
      text: '\nfunction Thing() {\n  useEffect(() => {\n    const fetchData = async () => {};\n    fetchData();\n  }, [fetchData]);\n}\n',
      errors: [
        {
          message: "React Hook useEffect has an unnecessary dependency: 'fetchData'. Either exclude it or remove the dependency array.",
          line: 6,
          column: 6,
          endLine: 6,
          endColumn: 17,
        },
      ],
    },
    {
      name: '#128 function Hello() {',
      path: '/root/react.tsx',
      text: '\nfunction Hello() {\n  const [state, setState] = useState(0);\n  useEffect(() => {\n    setState({});\n  });\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect contains a call to 'setState'. Without a list of dependencies, this can lead to an infinite chain of updates. To fix this, pass [] as a second argument to the useEffect Hook.",
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#130 function Hello({ country }) {',
      path: '/root/react.tsx',
      text: '\nfunction Hello({ country }) {\n  const [data, setData] = useState(0);\n  useEffect(() => {\n    fetchData(country).then(setData);\n  });\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect contains a call to 'setData'. Without a list of dependencies, this can lead to an infinite chain of updates. To fix this, pass [country] as a second argument to the useEffect Hook.",
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#131 function Hello({ prop1, prop2 }) {',
      path: '/root/react.tsx',
      text: '\nfunction Hello({ prop1, prop2 }) {\n  const [state, setState] = useState(0);\n  useEffect(() => {\n    if (prop1) {\n      setState(prop2);\n    }\n  });\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect contains a call to 'setState'. Without a list of dependencies, this can lead to an infinite chain of updates. To fix this, pass [prop1, prop2] as a second argument to the useEffect Hook.",
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#132 function Thing() {',
      path: '/root/react.tsx',
      text: '\nfunction Thing() {\n  useEffect(async () => {}, []);\n}\n',
      errors: [
        {
          message:
            "Effect callbacks are synchronous to prevent race conditions. Put the async function inside:\n\nuseEffect(() => {\n  async function fetchData() {\n    // You can await here\n    const response = await MyAPI.getData(someId);\n    // ...\n  }\n  fetchData();\n}, [someId]); // Or [] if effect doesn't need props or state\n\nLearn more about data fetching with Hooks: https://react.dev/link/hooks-data-fetching",
          line: 3,
          column: 13,
          endLine: 3,
          endColumn: 27,
        },
      ],
    },
    {
      name: '#134 function Example() {',
      path: '/root/react.tsx',
      text: '\nfunction Example() {\n  const foo = useCallback(() => {\n    foo();\n  }, [foo]);\n}\n',
      errors: [
        {
          message: "React Hook useCallback has an unnecessary dependency: 'foo'. Either exclude it or remove the dependency array.",
          line: 5,
          column: 6,
          endLine: 5,
          endColumn: 11,
        },
      ],
    },
    {
      name: '#136 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local = {};\n  function myEffect() {\n    console.log(local);\n  }\n  useEffect(myEffect, []);\n}\n',
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'local'. Either include it or remove the dependency array.",
          line: 7,
          column: 23,
          endLine: 7,
          endColumn: 25,
        },
      ],
    },
    {
      name: '#137 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local = {};\n  const myEffect = () => {\n    console.log(local);\n  };\n  useEffect(myEffect, []);\n}\n',
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'local'. Either include it or remove the dependency array.",
          line: 7,
          column: 23,
          endLine: 7,
          endColumn: 25,
        },
      ],
    },
    {
      name: '#141 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local = {};\n  const myEffect = debounce(() => {\n    console.log(local);\n  }, delay);\n  useEffect(myEffect, [local]);\n}\n',
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'myEffect'. Either include it or remove the dependency array.",
          line: 7,
          column: 3,
          endLine: 7,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#143 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const local = {};\n  useEffect(debounce(() => {\n    console.log(local);\n  }, delay), []);\n}\n',
      errors: [
        {
          message: 'React Hook useEffect received a function whose dependencies are unknown. Pass an inline function instead.',
          line: 4,
          column: 3,
          endLine: 4,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#145 function MyComponent(props) {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent(props) {\n  let foo = {}\n  useEffect(() => {\n    foo.bar.baz = 43;\n    props.foo.bar.baz = 1;\n  }, []);\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has missing dependencies: 'foo.bar' and 'props.foo.bar'. Either include them or remove the dependency array.",
          line: 7,
          column: 6,
          endLine: 7,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#147 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  const foo = [];\n  useMemo(() => foo, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' array makes the dependencies of useMemo Hook (at line 4) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 17,
        },
      ],
    },
    {
      name: '#149 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  const foo = function bar(){};\n  useMemo(() => foo, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' function makes the dependencies of useMemo Hook (at line 4) change on every render. Move it inside the useMemo callback. Alternatively, wrap the definition of 'foo' in its own useCallback() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 31,
        },
      ],
    },
    {
      name: '#150 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  const foo = class {};\n  useMemo(() => foo, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' class makes the dependencies of useMemo Hook (at line 4) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 23,
        },
      ],
    },
    {
      name: '#151 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  const foo = true ? {} : "fine";\n  useMemo(() => foo, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' conditional could make the dependencies of useMemo Hook (at line 4) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 33,
        },
      ],
    },
    {
      name: '#152 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  const foo = bar || {};\n  useMemo(() => foo, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' logical expression could make the dependencies of useMemo Hook (at line 4) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 24,
        },
      ],
    },
    {
      name: '#157 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  var foo = {};\n  useMemo(() => foo, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' object makes the dependencies of useMemo Hook (at line 4) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 7,
          endLine: 3,
          endColumn: 15,
        },
      ],
    },
    {
      name: '#158 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  const foo = {};\n  useCallback(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' object makes the dependencies of useCallback Hook (at line 6) change on every render. Move it inside the useCallback callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 17,
        },
      ],
    },
    {
      name: '#159 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  const foo = {};\n  useEffect(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' object makes the dependencies of useEffect Hook (at line 6) change on every render. Move it inside the useEffect callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 17,
        },
      ],
    },
    {
      name: '#160 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  const foo = {};\n  useLayoutEffect(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' object makes the dependencies of useLayoutEffect Hook (at line 6) change on every render. Move it inside the useLayoutEffect callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 17,
        },
      ],
    },
    {
      name: '#161 function Component() {',
      path: '/root/react.tsx',
      text: '\nfunction Component() {\n  const foo = {};\n  useImperativeHandle(\n    ref,\n    () => {\n       console.log(foo);\n    },\n    [foo]\n  );\n}\n',
      errors: [
        {
          message:
            "The 'foo' object makes the dependencies of useImperativeHandle Hook (at line 9) change on every render. Move it inside the useImperativeHandle callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 17,
        },
      ],
    },
    {
      name: '#162 function Foo(section) {',
      path: '/root/react.tsx',
      text: '\nfunction Foo(section) {\n  const foo = section.section_components?.edges ?? [];\n  useEffect(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' logical expression could make the dependencies of useEffect Hook (at line 6) change on every render. Move it inside the useEffect callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 54,
        },
      ],
    },
    {
      name: '#163 function Foo(section) {',
      path: '/root/react.tsx',
      text: '\nfunction Foo(section) {\n  const foo = {};\n  console.log(foo);\n  useMemo(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' object makes the dependencies of useMemo Hook (at line 7) change on every render. To fix this, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 17,
        },
      ],
    },
    {
      name: '#164 function Foo() {',
      path: '/root/react.tsx',
      text: '\nfunction Foo() {\n  const foo = <>Hi!</>;\n  useMemo(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' JSX fragment makes the dependencies of useMemo Hook (at line 6) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 23,
        },
      ],
    },
    {
      name: '#165 function Foo() {',
      path: '/root/react.tsx',
      text: '\nfunction Foo() {\n  const foo = <div>Hi!</div>;\n  useMemo(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' JSX element makes the dependencies of useMemo Hook (at line 6) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 29,
        },
      ],
    },
    {
      name: '#166 function Foo() {',
      path: '/root/react.tsx',
      text: '\nfunction Foo() {\n  const foo = bar = {};\n  useMemo(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' assignment expression makes the dependencies of useMemo Hook (at line 6) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 23,
        },
      ],
    },
    {
      name: '#167 function Foo() {',
      path: '/root/react.tsx',
      text: "\nfunction Foo() {\n  const foo = new String('foo'); // Note 'foo' will be boxed, and thus an object and thus compared by reference.\n  useMemo(() => {\n    console.log(foo);\n  }, [foo]);\n}\n",
      errors: [
        {
          message:
            "The 'foo' object construction makes the dependencies of useMemo Hook (at line 6) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 32,
        },
      ],
    },
    {
      name: '#169 function Foo() {',
      path: '/root/react.tsx',
      text: '\nfunction Foo() {\n  const foo = /reg/;\n  useMemo(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' regular expression makes the dependencies of useMemo Hook (at line 6) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 20,
        },
      ],
    },
    {
      name: '#170 function Foo() {',
      path: '/root/react.tsx',
      text: '\nfunction Foo() {\n  class Bar {};\n  useMemo(() => {\n    console.log(new Bar());\n  }, [Bar]);\n}\n',
      errors: [
        {
          message:
            "The 'Bar' class makes the dependencies of useMemo Hook (at line 6) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'Bar' in its own useMemo() Hook.",
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 15,
        },
      ],
    },
    {
      name: '#171 function Foo() {',
      path: '/root/react.tsx',
      text: '\nfunction Foo() {\n  const foo = {};\n  useLayoutEffect(() => {\n    console.log(foo);\n  }, [foo]);\n  useEffect(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' object makes the dependencies of useLayoutEffect Hook (at line 6) change on every render. To fix this, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 17,
        },
        {
          message:
            "The 'foo' object makes the dependencies of useEffect Hook (at line 9) change on every render. To fix this, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 17,
        },
      ],
    },
    {
      name: '#191 function MyComponent() {',
      path: '/root/react.tsx',
      text: '\nfunction MyComponent() {\n  const [state, setState] = React.useState<number>(0);\n\n  useEffect(() => {\n    const someNumber: typeof state = 2;\n    setState(prevState => prevState + someNumber + state);\n  }, [])\n}\n',
      errors: [
        {
          message:
            "React Hook useEffect has a missing dependency: 'state'. Either include it or remove the dependency array. You can also do a functional update 'setState(s => ...)' if you only need 'state' in the 'setState' call.",
          line: 8,
          column: 6,
          endLine: 8,
          endColumn: 8,
        },
      ],
    },
    {
      name: '#193 function Foo() {',
      path: '/root/react.tsx',
      text: '\nfunction Foo() {\n  const foo = {} as any;\n  useMemo(() => {\n    console.log(foo);\n  }, [foo]);\n}\n',
      errors: [
        {
          message:
            "The 'foo' object makes the dependencies of useMemo Hook (at line 6) change on every render. Move it inside the useMemo callback. Alternatively, wrap the initialization of 'foo' in its own useMemo() Hook.",
          line: 3,
          column: 9,
          endLine: 3,
          endColumn: 24,
        },
      ],
    },
    {
      name: '#194 function Foo({ Component }) {',
      path: '/root/react.tsx',
      text: '\nfunction Foo({ Component }) {\n  React.useEffect(() => {\n    console.log(<Component />);\n  }, []);\n};\n',
      errors: [
        {
          message: "React Hook React.useEffect has a missing dependency: 'Component'. Either include it or remove the dependency array.",
          line: 5,
          column: 6,
          endLine: 5,
          endColumn: 8,
        },
      ],
    },
    {
      name: "#196 import { useEffect, useState } from 'react'",
      path: '/root/clock.tsx',
      text: "\n      import { useEffect, useState } from 'react'\n\n      export function Clock({ every }: { every: number }) {\n        const [now, setNow] = useState<number>(Date.now())\n        useEffect(() => {\n          const timer = setInterval(() => setNow(Date.now()), every)\n          return () => clearInterval(timer)\n        }, [])\n        return <time>{now}</time>\n      }\n    ",
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'every'. Either include it or remove the dependency array.",
          line: 9,
          column: 12,
          endLine: 9,
          endColumn: 14,
        },
      ],
    },
    {
      name: '#198 useEffect(handler, []);',
      path: '/root/react.tsx',
      text: 'useEffect(handler, []);',
      language: { sourceType: 'script', globals: { handler: 'readonly' } },
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'handler'. Either include it or remove the dependency array.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 10,
        },
      ],
    },
  ],
})

testRule(rule, {
  valid: [],
  invalid: [
    {
      name: 'a named callback with a dependency list that is no array',
      path: '/root/file.tsx',
      text: 'function C() { const f = () => {}; useEffect(f, deps) }',
      errors: [
        {
          message:
            "React Hook useEffect was passed a dependency list that is not an array literal. This means we can't statically verify whether you've passed the correct dependencies.",
          line: 1,
          column: 49,
        },
      ],
    },
    {
      name: 'a callback variable declared without a value',
      path: '/root/file.tsx',
      text: 'function C() { let f; useEffect(f, []) }',
      errors: [
        {
          message: "React Hook useEffect has a missing dependency: 'f'. Either include it or remove the dependency array.",
          line: 1,
          column: 23,
        },
      ],
    },
  ],
})
