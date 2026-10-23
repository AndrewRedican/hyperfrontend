import type { InvalidCase } from '../../../testing/rule-tester'
import { testRule } from '../../../testing/rule-tester'
import rule from '../exhaustive-deps'

/**
 * A case reporting one problem, located at the last occurrence of a marker.
 *
 * @param name - The test's name
 * @param text - The text linted, on one line
 * @param at - The text the problem starts at, found from the end
 * @param message - The message the rule must report
 * @returns The case
 */
function reported(name: string, text: string, at: string, message: string): InvalidCase {
  return { name, path: '/root/file.tsx', text, errors: [{ message, line: 1, column: text.lastIndexOf(at) + 1 }] }
}

/**
 * The message of a dependency report.
 *
 * @param hook - The hook's callee text
 * @param summary - The part naming the dependencies
 * @param extra - The advice added, with its leading space, or nothing
 * @returns The message
 */
function dependencies(hook: string, summary: string, extra = ''): string {
  return `React Hook ${hook} has ${summary}${extra}`
}

/**
 * The message of a construction report.
 *
 * @param name - The value's name
 * @param kind - The kind of value
 * @param hook - The hook's name
 * @param advice - The sentence advising the fix
 * @returns The message
 */
function construction(name: string, kind: string, hook: string, advice: string): string {
  const causation = kind === 'conditional' ? 'could make' : 'makes'
  return `The '${name}' ${kind} ${causation} the dependencies of ${hook} Hook (at line 1) change on every render. ${advice}`
}

/**
 * The advice to move a value into the callback.
 *
 * @param hook - The hook's name
 * @param what - `definition` or `initialization`
 * @param name - The value's name
 * @param wrapper - `useCallback` or `useMemo`
 * @returns The advice
 */
function moveInside(hook: string, what: string, name: string, wrapper: string): string {
  return `Move it inside the ${hook} callback. Alternatively, wrap the ${what} of '${name}' in its own ${wrapper}() Hook.`
}

testRule(rule, {
  valid: [],
  invalid: [
    reported(
      'a ref read declared in a callback',
      'function C() { const r = useRef(); useCallback(() => {}, [r.current]) }',
      '[r.current]',
      dependencies(
        'useCallback',
        "an unnecessary dependency: 'r.current'. Either exclude it or remove the dependency array.",
        " Mutable values like 'r.current' aren't valid dependencies because mutating them doesn't re-render the component."
      )
    ),
    reported(
      'an outer value declared',
      'const outer = 1; function C() { useCallback(() => {}, [outer]) }',
      '[outer]',
      dependencies(
        'useCallback',
        "an unnecessary dependency: 'outer'. Either exclude it or remove the dependency array.",
        " Outer scope values like 'outer' aren't valid dependencies because mutating them doesn't re-render the component."
      )
    ),
    reported(
      'an outer value the callback shadows',
      'let outer; function C() { useCallback(() => { let outer = 2 }, [outer]) }',
      '[outer]',
      dependencies('useCallback', "an unnecessary dependency: 'outer'. Either exclude it or remove the dependency array.")
    ),
    reported(
      'a component value nothing needs',
      'function C(p) { useCallback(() => {}, [p]) }',
      '[p]',
      dependencies('useCallback', "an unnecessary dependency: 'p'. Either exclude it or remove the dependency array.")
    ),
    reported(
      'props read only through members',
      'function C(props) { useEffect(() => { props.onChange() }, []) }',
      '[]',
      dependencies(
        'useEffect',
        "a missing dependency: 'props'. Either include it or remove the dependency array.",
        " However, 'props' will change when *any* prop changes, so the preferred fix is to destructure the 'props' object outside of the useEffect call and refer to those specific props inside useEffect."
      )
    ),
    reported(
      'props passed on whole',
      'function C(props) { useEffect(() => { f(props) }, []) }',
      '[]',
      dependencies('useEffect', "a missing dependency: 'props'. Either include it or remove the dependency array.")
    ),
    reported(
      'a callback prop',
      'function C({ onChange }) { useEffect(() => { onChange() }, []) }',
      '[]',
      dependencies(
        'useEffect',
        "a missing dependency: 'onChange'. Either include it or remove the dependency array.",
        " If 'onChange' changes too often, find the parent component that defines it and wrap that definition in useCallback."
      )
    ),
    reported(
      'a shadowed component value',
      'function C() { const x = 1; { const x = f(); useEffect(() => { g(x) }, []) } }',
      '[]',
      dependencies('useEffect', "a missing dependency: 'x'. Either include it or remove the dependency array.")
    ),
    reported(
      'a called value that is no prop',
      'function C() { const fn = make(); useEffect(() => { fn() }, []) }',
      '[]',
      dependencies('useEffect', "a missing dependency: 'fn'. Either include it or remove the dependency array.")
    ),
    reported(
      'a missing member path',
      'function C(p) { useEffect(() => { g(p.a) }, []) }',
      '[]',
      dependencies('useEffect', "a missing dependency: 'p.a'. Either include it or remove the dependency array.")
    ),
    reported(
      'a state read in its own setter',
      'function C() { const [count, setCount] = useState(0); useEffect(() => { setCount(count + 1) }, []) }',
      '[]',
      dependencies(
        'useEffect',
        "a missing dependency: 'count'. Either include it or remove the dependency array.",
        " You can also do a functional update 'setCount(c => ...)' if you only need 'count' in the 'setCount' call."
      )
    ),
    reported(
      'another state read in a setter',
      'function C() { const [count, setCount] = useState(); const [step, setStep] = useState(); useEffect(() => { setCount(step) }, []) }',
      '[]',
      dependencies(
        'useEffect',
        "a missing dependency: 'step'. Either include it or remove the dependency array.",
        " You can also replace multiple useState variables with useReducer if 'setCount' needs the current value of 'step'."
      )
    ),
    reported(
      'a prop read in a setter',
      'function C({ step }) { const [count, setCount] = useState(); useEffect(() => { setCount(step) }, []) }',
      '[]',
      dependencies(
        'useEffect',
        "a missing dependency: 'step'. Either include it or remove the dependency array.",
        " If 'setCount' needs the current value of 'step', you can also switch to useReducer instead of useState and read 'step' in the reducer."
      )
    ),
    reported(
      'a computed value read in a setter',
      'function C() { const [count, setCount] = useState(); const x = f(); useEffect(() => { setCount(x) }, []) }',
      '[]',
      dependencies('useEffect', "a missing dependency: 'x'. Either include it or remove the dependency array.")
    ),
    reported(
      'a function declaration declared',
      'function C() { function f() {} useEffect(() => { f() }, [f]) }',
      'function f',
      construction('f', 'function', 'useEffect', moveInside('useEffect', 'definition', 'f', 'useCallback'))
    ),
    reported(
      'a class declared',
      'function C() { class K {} useMemo(() => new K(), [K]) }',
      'class K',
      construction('K', 'class', 'useMemo', moveInside('useMemo', 'initialization', 'K', 'useMemo'))
    ),
    reported(
      'an object used outside the hook',
      'function C() { const o = {}; f(o); useMemo(() => o, [o]) }',
      'o = {}',
      construction('o', 'object', 'useMemo', "To fix this, wrap the initialization of 'o' in its own useMemo() Hook.")
    ),
    reported(
      'an object assigned twice',
      'function C() { let o = {}; o = {}; useMemo(() => o, [o]) }',
      'o = {}; o =',
      construction('o', 'object', 'useMemo', "To fix this, wrap the initialization of 'o' in its own useMemo() Hook.")
    ),
    reported(
      'a conditional object',
      'function C(a) { const o = a ? {} : 1; useMemo(() => o, [o]) }',
      'o = a',
      construction('o', 'conditional', 'useMemo', moveInside('useMemo', 'initialization', 'o', 'useMemo'))
    ),
  ],
})

testRule(rule, {
  valid: [
    { name: 'a destructured value declared', path: '/root/file.tsx', text: 'function C() { const { o } = make(); useMemo(() => o, [o]) }' },
    { name: 'a value declared without one', path: '/root/file.tsx', text: 'function C() { let o; useMemo(() => o, [o]) }' },
    { name: 'a member path declared', path: '/root/file.tsx', text: 'function C(p) { useMemo(() => p.a, [p.a]) }' },
    { name: 'the arguments object declared', path: '/root/file.tsx', text: 'function C() { useEffect(() => {}, [arguments]) }' },
  ],
  invalid: [],
})
