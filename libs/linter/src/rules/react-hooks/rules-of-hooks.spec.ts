import { testRule } from '../../testing/rule-tester'
import rule from './rules-of-hooks'

// why: the flow analysis keeps a try block in one segment where the previous linter split it after its first throwing expression, so a hook after a call in a try block reads as unconditional; case 32 records that split.
testRule(rule, {
  valid: [
    {
      name: "#62 // Valid although unconditional return doesn't make sense an…",
      path: '/root/react.tsx',
      text: "\n// Valid although unconditional return doesn't make sense and would fail other rules.\n// We could make it invalid but it doesn't matter.\nfunction useUnreachable() {\n  return;\n  useHook();\n}\n",
    },
    {
      name: '#74 // Valid because classes can call functions.',
      path: '/root/react.tsx',
      text: "\n// Valid because classes can call functions.\n// We don't consider these to be hooks.\nclass C {\n  m() {\n    this.useHook();\n    super.useHook();\n  }\n}\n",
    },
    {
      name: '#75 // Valid -- this is a regression test.',
      path: '/root/react.tsx',
      text: '\n// Valid -- this is a regression test.\njest.useFakeTimers();\nbeforeEach(() => {\n  jest.useRealTimers();\n})\n',
    },
    {
      name: '#81 // Valid because exceptions abort rendering',
      path: '/root/react.tsx',
      text: "\n// Valid because exceptions abort rendering\nfunction RegressionTest() {\n  if (page == null) {\n    throw new Error('oh no!');\n  }\n  useState();\n}\n",
    },
    {
      name: "#82 // Valid because the loop doesn't change the order of hooks …",
      path: '/root/react.tsx',
      text: "\n// Valid because the loop doesn't change the order of hooks calls.\nfunction RegressionTest() {\n  const res = [];\n  const additionalCond = true;\n  for (let i = 0; i !== 10 && additionalCond; ++i ) {\n    res.push(i);\n  }\n  React.useLayoutEffect(() => {});\n}\n",
    },
    {
      name: '#84 // Valid because the neither the conditions before or after …',
      path: '/root/react.tsx',
      text: '\n// Valid because the neither the conditions before or after the hook affect the hook call\n// Failed prior to implementing BigInt because pathsFromStartToEnd and allPathsFromStartToEnd were too big and had rounding errors\nconst useSomeHook = () => {};\n\nconst SomeName = () => {\n  const filler = FILLER ?? FILLER ?? FILLER;\n  const filler2 = FILLER ?? FILLER ?? FILLER;\n  const filler3 = FILLER ?? FILLER ?? FILLER;\n  const filler4 = FILLER ?? FILLER ?? FILLER;\n  const filler5 = FILLER ?? FILLER ?? FILLER;\n  const filler6 = FILLER ?? FILLER ?? FILLER;\n  const filler7 = FILLER ?? FILLER ?? FILLER;\n  const filler8 = FILLER ?? FILLER ?? FILLER;\n\n  useSomeHook();\n\n  if (anyConditionCanEvenBeFalse) {\n    return null;\n  }\n\n  return (\n    <React.Fragment>\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n      {FILLER ? FILLER : FILLER}\n    </React.Fragment>\n  );\n};\n',
    },
    {
      name: '#85 // Valid because the neither the condition nor the loop affe…',
      path: '/root/react.tsx',
      text: '\n// Valid because the neither the condition nor the loop affect the hook call.\nfunction App(props) {\n  const someObject = {propA: true};\n  for (const propName in someObject) {\n    if (propName === true) {\n    } else {\n    }\n  }\n  const [myState, setMyState] = useState(null);\n}\n',
    },
    {
      name: "#87 import * as React from 'react';",
      path: '/root/react.tsx',
      text: '\nimport * as React from \'react\';\nfunction App() {\n  if (shouldShowText) {\n    const text = use(query);\n    const data = React.use(thing);\n    const data2 = react.use(thing2);\n    return <Text text={text} />\n  }\n  return <Text text={shouldFetchBackupText ? use(backupQuery) : "Nothing to see here"} />\n}\n',
    },
    {
      name: '#88 function App() {',
      path: '/root/react.tsx',
      text: '\nfunction App() {\n  let data = [];\n  for (const query of queries) {\n    const text = use(item);\n    data.push(text);\n  }\n  return <Child data={data} />\n}\n',
    },
    {
      name: '#91 export default () => {',
      path: '/root/react.tsx',
      text: '\nexport default () => {\n  if (isVal) {\n    useState(0);\n  }\n}\n',
    },
    {
      name: "#93 import { useCallback, useEffect, useState } from 'react'",
      path: '/root/copy-button.tsx',
      text: "\n      import { useCallback, useEffect, useState } from 'react'\n\n      interface CopyButtonProps {\n        text: string\n      }\n\n      export function CopyButton({ text }: CopyButtonProps) {\n        const [copied, setCopied] = useState<boolean>(false)\n        const copy = useCallback(async () => {\n          await navigator.clipboard.writeText(text)\n          setCopied(true)\n        }, [text])\n        useEffect(() => {\n          if (!copied) return undefined\n          const timer = setTimeout(() => setCopied(false), 1500)\n          return () => clearTimeout(timer)\n        }, [copied])\n        return <button onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>\n      }\n    ",
    },
    {
      name: '#94 class Store {',
      path: '/root/react.tsx',
      text: '\n      class Store {\n        load = () => {\n          useState();\n        };\n        static initial = useInitial();\n      }\n    ',
    },
    {
      name: '#95 const Panel = (({ open }: { open: boolean }) => {',
      path: '/root/panel.tsx',
      text: '\n      const Panel = (({ open }: { open: boolean }) => {\n        if (open) {\n          useState();\n        }\n        return null;\n      }) as unknown as React.FC;\n    ',
    },
    {
      name: '#96 a hook called in an anonymous function declaration exported by default, which has no name to take for a component',
      path: '/root/react.tsx',
      text: '\n      export default function () {\n        useState();\n      }\n    ',
    },
    {
      name: '#97 a hook called in the argument of a throw, which no path from the start counts',
      path: '/root/react.tsx',
      text: '\n      function ComponentWithHookInThrow() {\n        throw useHook();\n      }\n    ',
    },
  ],
  invalid: [
    {
      name: '#2 Hook.useState();',
      path: '/root/react.tsx',
      text: '\nHook.useState();\nHook._useState();\nHook.use42();\nHook.useHook();\nHook.use_hook();\n',
      errors: [
        {
          message:
            'React Hook "Hook.useState" cannot be called at the top level. React Hooks must be called in a React function component or a custom React Hook function.',
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 14,
        },
        {
          message:
            'React Hook "Hook.use42" cannot be called at the top level. React Hooks must be called in a React function component or a custom React Hook function.',
          line: 4,
          column: 1,
          endLine: 4,
          endColumn: 11,
        },
        {
          message:
            'React Hook "Hook.useHook" cannot be called at the top level. React Hooks must be called in a React function component or a custom React Hook function.',
          line: 5,
          column: 1,
          endLine: 5,
          endColumn: 13,
        },
      ],
    },
    {
      name: "#4 // This is a false positive (it's valid) that unfortunately",
      path: '/root/react.tsx',
      text: '\n// This is a false positive (it\'s valid) that unfortunately\n// we cannot avoid. Prefer to rename it to not start with "use"\nclass Foo extends Component {\n  render() {\n    if (cond) {\n      FooStore.useFeatureFlag();\n    }\n  }\n}\n',
      errors: [
        {
          message:
            'React Hook "FooStore.useFeatureFlag" cannot be called in a class component. React Hooks must be called in a React function component or a custom React Hook function.',
          line: 7,
          column: 7,
          endLine: 7,
          endColumn: 30,
        },
      ],
    },
    {
      name: "#13 // Invalid because it's a common misunderstanding.",
      path: '/root/react.tsx',
      text: "\n// Invalid because it's a common misunderstanding.\n// We *could* make it valid but the runtime error could be confusing.\nconst ComponentWithHookInsideCallback = React.memo(props => {\n  useEffect(() => {\n    useHookInsideCallback();\n  });\n  return <button {...props} />\n});\n",
      errors: [
        {
          message:
            'React Hook "useHookInsideCallback" cannot be called inside a callback. React Hooks must be called in a React function component or a custom React Hook function.',
          line: 6,
          column: 5,
          endLine: 6,
          endColumn: 26,
        },
      ],
    },
    {
      name: "#23 // Invalid because it's dangerous and might not warn otherwi…",
      path: '/root/react.tsx',
      text: "\n// Invalid because it's dangerous and might not warn otherwise.\n// This *must* be invalid.\nfunction useHookInLoops() {\n  while (a) {\n    useHook1();\n    if (b) return;\n    useHook2();\n  }\n  while (c) {\n    useHook3();\n    if (d) return;\n    useHook4();\n  }\n}\n",
      errors: [
        {
          message:
            'React Hook "useHook1" may be executed more than once. Possibly because it is called in a loop. React Hooks must be called in the exact same order in every component render.',
          line: 6,
          column: 5,
          endLine: 6,
          endColumn: 13,
        },
        {
          message:
            'React Hook "useHook2" may be executed more than once. Possibly because it is called in a loop. React Hooks must be called in the exact same order in every component render.',
          line: 8,
          column: 5,
          endLine: 8,
          endColumn: 13,
        },
        {
          message:
            'React Hook "useHook3" may be executed more than once. Possibly because it is called in a loop. React Hooks must be called in the exact same order in every component render.',
          line: 11,
          column: 5,
          endLine: 11,
          endColumn: 13,
        },
        {
          message:
            'React Hook "useHook4" may be executed more than once. Possibly because it is called in a loop. React Hooks must be called in the exact same order in every component render.',
          line: 13,
          column: 5,
          endLine: 13,
          endColumn: 13,
        },
      ],
    },
    {
      name: "#26 // Invalid because it's dangerous and might not warn otherwi…",
      path: '/root/react.tsx',
      text: "\n// Invalid because it's dangerous and might not warn otherwise.\n// This *must* be invalid.\nfunction useLabeledBlock() {\n  label: {\n    if (a) break label;\n    useHook();\n  }\n}\n",
      errors: [
        {
          message:
            'React Hook "useHook" is called conditionally. React Hooks must be called in the exact same order in every component render.',
          line: 7,
          column: 5,
          endLine: 7,
          endColumn: 12,
        },
      ],
    },
    {
      name: '#27 // Currently invalid.',
      path: '/root/react.tsx',
      text: '\n// Currently invalid.\n// These are variations capturing the current heuristic--\n// we only allow hooks in PascalCase or useFoo functions.\n// We *could* make some of these valid. But before doing it,\n// consider specific cases documented above that contain reasoning.\nfunction a() { useState(); }\nconst whatever = function b() { useState(); };\nconst c = () => { useState(); };\nlet d = () => useState();\ne = () => { useState(); };\n({f: () => { useState(); }});\n({g() { useState(); }});\nconst {j = () => { useState(); }} = {};\n({k = () => { useState(); }} = {});\n',
      errors: [
        {
          message:
            'React Hook "useState" is called in function "a" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".',
          line: 7,
          column: 16,
          endLine: 7,
          endColumn: 24,
        },
        {
          message:
            'React Hook "useState" is called in function "b" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".',
          line: 8,
          column: 33,
          endLine: 8,
          endColumn: 41,
        },
        {
          message:
            'React Hook "useState" is called in function "c" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".',
          line: 9,
          column: 19,
          endLine: 9,
          endColumn: 27,
        },
        {
          message:
            'React Hook "useState" is called in function "d" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".',
          line: 10,
          column: 15,
          endLine: 10,
          endColumn: 23,
        },
        {
          message:
            'React Hook "useState" is called in function "e" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".',
          line: 11,
          column: 13,
          endLine: 11,
          endColumn: 21,
        },
        {
          message:
            'React Hook "useState" is called in function "f" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".',
          line: 12,
          column: 14,
          endLine: 12,
          endColumn: 22,
        },
        {
          message:
            'React Hook "useState" is called in function "g" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".',
          line: 13,
          column: 9,
          endLine: 13,
          endColumn: 17,
        },
        {
          message:
            'React Hook "useState" is called in function "j" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".',
          line: 14,
          column: 20,
          endLine: 14,
          endColumn: 28,
        },
        {
          message:
            'React Hook "useState" is called in function "k" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".',
          line: 15,
          column: 15,
          endLine: 15,
          endColumn: 23,
        },
      ],
    },
    {
      name: "#35 // Invalid because it's dangerous and might not warn otherwi…",
      path: '/root/react.tsx',
      text: "\n// Invalid because it's dangerous and might not warn otherwise.\n// This *must* be invalid.\nconst FancyButton = forwardRef(function(props, ref) {\n  if (props.fancy) {\n    useCustomHook();\n  }\n  return <button ref={ref}>{props.children}</button>;\n});\n",
      errors: [
        {
          message:
            'React Hook "useCustomHook" is called conditionally. React Hooks must be called in the exact same order in every component render.',
          line: 6,
          column: 5,
          endLine: 6,
          endColumn: 18,
        },
      ],
    },
    {
      name: "#36 // Invalid because it's dangerous and might not warn otherwi…",
      path: '/root/react.tsx',
      text: "\n// Invalid because it's dangerous and might not warn otherwise.\n// This *must* be invalid.\nconst MemoizedButton = memo(function(props) {\n  if (props.fancy) {\n    useCustomHook();\n  }\n  return <button>{props.children}</button>;\n});\n",
      errors: [
        {
          message:
            'React Hook "useCustomHook" is called conditionally. React Hooks must be called in the exact same order in every component render.',
          line: 6,
          column: 5,
          endLine: 6,
          endColumn: 18,
        },
      ],
    },
    {
      name: '#39 // Technically this is a false positive.',
      path: '/root/react.tsx',
      text: "\n// Technically this is a false positive.\n// We *could* make it valid (and it used to be).\n//\n// However, top-level Hook-like calls can be very dangerous\n// in environments with inline requires because they can mask\n// the runtime error by accident.\n// So we prefer to disallow it despite the false positive.\n\nconst {createHistory, useBasename} = require('history-2.1.2');\nconst browserHistory = useBasename(createHistory)({\n  basename: '/',\n});\n",
      errors: [
        {
          message:
            'React Hook "useBasename" cannot be called at the top level. React Hooks must be called in a React function component or a custom React Hook function.',
          line: 11,
          column: 24,
          endLine: 11,
          endColumn: 35,
        },
      ],
    },
    {
      name: '#42 (class {useHook() { useState(); }});',
      path: '/root/react.tsx',
      text: '\n(class {useHook() { useState(); }});\n',
      errors: [
        {
          message:
            'React Hook "useState" cannot be called in a class component. React Hooks must be called in a React function component or a custom React Hook function.',
          line: 2,
          column: 21,
          endLine: 2,
          endColumn: 29,
        },
      ],
    },
    {
      name: '#53 async function AsyncComponent() {',
      path: '/root/react.tsx',
      text: '\nasync function AsyncComponent() {\n  use();\n}\n',
      errors: [{ message: 'React Hook "use" cannot be called in an async function.', line: 3, column: 3, endLine: 3, endColumn: 6 }],
    },
    {
      name: "#98 import { useState } from 'react'",
      path: '/root/banner.tsx',
      text: "\n      import { useState } from 'react'\n\n      export function Banner({ hidden }: { hidden: boolean }): JSX.Element | null {\n        if (hidden) {\n          return null\n        }\n        const [open, setOpen] = useState<boolean>(true)\n        return <div onClick={() => setOpen(!open)} />\n      }\n    ",
      errors: [
        {
          message:
            'React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render. Did you accidentally call a React Hook after an early return?',
          line: 8,
          column: 33,
          endLine: 8,
          endColumn: 41,
        },
      ],
    },
    {
      name: '#100 function useHookInLoops() {',
      path: '/root/react.tsx',
      text: '\n      function useHookInLoops() {\n        do {\n          useHook1();\n          if (a) continue;\n          useHook2();\n        } while (b);\n      }\n    ',
      errors: [
        {
          message:
            'React Hook "useHook1" may be executed more than once. Possibly because it is called in a loop. React Hooks must be called in the exact same order in every component render.',
          line: 4,
          column: 11,
          endLine: 4,
          endColumn: 19,
        },
        {
          message:
            'React Hook "useHook2" is called conditionally. React Hooks must be called in the exact same order in every component render.',
          line: 6,
          column: 11,
          endLine: 6,
          endColumn: 19,
        },
      ],
    },
  ],
})
