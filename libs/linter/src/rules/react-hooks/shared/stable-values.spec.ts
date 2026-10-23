import type { Node } from '../../../code/model'
import type { Scope, Variable } from '../../../scope/model'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { describe, expect, it } from '@hyperfrontend/testing'
import { parseCode } from '../../../code/parse'
import { DEFAULT_LANGUAGE } from '../../../config/model'
import { analyzeScopes } from '../../../scope/analysis'
import { StableValues } from './stable-values'

/** A parsed component: its function scope and its variables by name. */
interface Parsed {
  /** The component's function scope. */
  readonly component: Scope
  /** Finds a variable declared anywhere by name. */
  readonly variable: (name: string) => Variable
}

/**
 * Parses a text whose first function is the component.
 *
 * @param text - The text, a component function first
 * @returns The component scope and a variable lookup
 */
function parse(text: string): Parsed {
  const analysis = analyzeScopes(parseCode(text, '.tsx').tree as Node, DEFAULT_LANGUAGE)
  const component = analysis.scopes.find((scope) => scope.kind === 'function') as Scope
  const variable = (name: string): Variable => analysis.scopes.find((scope) => scope.set.has(name))?.set.get(name) as Variable
  return { component, variable }
}

describe('StableValues.isStable', () => {
  const cases: readonly (readonly [string, string, string, boolean])[] = [
    ['a parameter', 'function C(p) {}', 'p', false],
    ['a declaration without a value', 'function C() { let a }', 'a', false],
    ['a constant number', 'function C() { const a = 1 }', 'a', true],
    ['a constant string', "function C() { const a = 'x' }", 'a', true],
    ['a constant null', 'function C() { const a = null }', 'a', true],
    ['a constant regular expression', 'function C() { const a = /x/ }', 'a', false],
    ['a variable number', 'function C() { let a = 1 }', 'a', false],
    ['an asserted constant', 'function C() { const a = 1 as number }', 'a', true],
    ['a ref', 'function C() { const r = useRef() }', 'r', true],
    ['a namespaced ref', 'function C() { const r = React.useRef() }', 'r', true],
    ['a ref destructured', 'function C() { const { current } = useRef() }', 'current', false],
    ['a computed callee', 'function C() { const r = hooks[name]() }', 'r', false],
    ['another namespace', 'function C() { const r = Other.useRef() }', 'r', false],
    ['a call of something else', 'function C() { const r = make()() }', 'r', false],
    ['a state setter', 'function C() { const [s, set] = useState() }', 'set', true],
    ['a state value', 'function C() { const [s, set] = useState() }', 's', false],
    ['a reassigned setter', 'function C() { let [s, set] = useState(); set = f }', 'set', false],
    ['a dispatcher', 'function C() { const [s, d] = useReducer() }', 'd', true],
    ['a reducer state', 'function C() { const [s, d] = useReducer() }', 's', false],
    ['a transition starter', 'function C() { const [p, start] = useTransition() }', 'start', true],
    ['a pending flag', 'function C() { const [p, start] = useTransition() }', 'p', false],
    ['a triple', 'function C() { const [a, b, c] = useState() }', 'b', false],
    ['an unknown hook', 'function C() { const r = useOther() }', 'r', false],
    ['an unknown pair', 'function C() { const [a, b] = useOther() }', 'b', false],
  ]
  for (const [name, text, variable, verdict] of cases) {
    it(`decides ${name}`, () => {
      expect(new StableValues().isStable(parse(text).variable(variable))).toBe(verdict)
    })
  }
  it('remembers a verdict', () => {
    const values = new StableValues()
    const variable = parse('function C() { const r = useRef() }').variable('r')
    values.isStable(variable)
    expect(values.isStable(variable)).toBe(true)
  })
})

describe('StableValues state records', () => {
  const text = 'function C() { const [count, setCount] = useState(); setCount(count) }'
  const parsed = parse(text)
  const values = new StableValues()
  values.isStable(parsed.variable('setCount'))
  values.isStable(parsed.variable('count'))
  const setter = parsed.variable('setCount').references[0]?.identifier as Node
  const state = parsed.variable('count').references[0]?.identifier as Node
  it('records a setter call', () => {
    expect(values.isSetterCall(setter)).toBe(true)
  })
  it('records the state a setter sets', () => {
    expect(values.stateOf(setter)?.name).toBe('count')
  })
  it('records a state read', () => {
    expect(values.isStateRead(state)).toBe(true)
  })
})

describe('StableValues.isCaptureFree', () => {
  const cases: readonly (readonly [string, string, string, boolean])[] = [
    ['a function reading a constant', 'function C() { const x = 1; function f() { return x } }', 'f', true],
    ['a function reading a parameter', 'function C(p) { function f() { return p } }', 'f', false],
    ['a function reading an undeclared name', 'function C() { function f() { return missing } }', 'f', true],
    ['an arrow reading a parameter', 'function C(p) { const g = () => p }', 'g', false],
    ['a value that is no function', 'function C() { const h = 1 }', 'h', false],
    ['a parameter', 'function C(p) {}', 'p', false],
  ]
  for (const [name, text, variable, verdict] of cases) {
    it(`decides ${name}`, () => {
      const parsed = parse(text)
      expect(new StableValues().isCaptureFree(parsed.variable(variable), parsed.component, createSet([parsed.component]))).toBe(verdict)
    })
  }
  it('decides a function reading an outer value', () => {
    const parsed = parse('const outer = f(); function C() { function g() { return outer } }')
    expect(new StableValues().isCaptureFree(parsed.variable('g'), parsed.component, createSet([parsed.component]))).toBe(true)
  })
  it('decides a global without a declaration', () => {
    const analysis = analyzeScopes(parseCode('function C() {}', '.tsx').tree as Node, { ...DEFAULT_LANGUAGE, globals: { g: 'readonly' } })
    const component = analysis.scopes.find((scope) => scope.kind === 'function') as Scope
    expect(new StableValues().isCaptureFree(analysis.global.set.get('g') as Variable, component, createSet([component]))).toBe(false)
  })
  it('remembers a verdict', () => {
    const parsed = parse('function C() { function f() {} }')
    const values = new StableValues()
    values.isCaptureFree(parsed.variable('f'), parsed.component, createSet([parsed.component]))
    expect(values.isCaptureFree(parsed.variable('f'), parsed.component, createSet([parsed.component]))).toBe(true)
  })
})
