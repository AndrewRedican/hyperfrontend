/**
 * Hooks must run in the same order on every render: a hook called conditionally, in a loop,
 * after an early return, in an async function, a class, a plain function, a callback or at the
 * top level is reported. Calls are counted over the control flow of the function holding them:
 * a hook is unconditional when every path from the start to the end runs through it.
 *
 * @module rules/react-hooks/rules-of-hooks
 */

import type { Node } from '../../code/model.ts'
import type { CodePath, Segment } from '../../flow/model.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../engine/rule.ts'
import { flowAnalysisOf } from '../../flow/analysis.ts'
import { PathCounter } from './shared/path-counts.ts'

/** The rule-text tail of the messages about where hooks may be called. */
const WHERE = 'React Hooks must be called in a React function component or a custom React Hook function.'

/** The rule-text tail of the messages about the order of hooks. */
const ORDER = 'React Hooks must be called in the exact same order in every component render.'

/**
 * Whether a name is a hook's: `use`, or `use` followed by a capital letter or a digit.
 *
 * @param name - The name tested
 * @returns Whether it names a hook
 */
function isHookName(name: unknown): boolean {
  if (typeof name !== 'string' || !name.startsWith('use')) return false
  if (name.length === 3) return true
  const next = name[3] as string
  return (next >= 'A' && next <= 'Z') || (next >= '0' && next <= '9')
}

/**
 * Whether a callee or a function's name is a hook: a hook name, or a hook name read off an
 * object whose name starts with a capital letter.
 *
 * @param node - The callee or name
 * @returns Whether it is a hook
 */
function isHook(node: Node): boolean {
  if (node.kind === 'Identifier') return isHookName(node.name)
  if (node.kind !== 'MemberExpression' || node.computed === true || !isHook(node.property as Node)) return false
  const object = node.object as Node
  return object.kind === 'Identifier' && isCapitalised(object.name as string)
}

/**
 * Whether a name starts with a capital letter.
 *
 * @param name - The name tested
 * @returns Whether its first character is `A` to `Z`
 */
function isCapitalised(name: string): boolean {
  const first = name.charAt(0)
  return first >= 'A' && first <= 'Z'
}

/**
 * Whether a name node names a component: an identifier starting with a capital letter.
 *
 * @param node - The function name node tested
 * @returns Whether it is a component's name
 */
function isComponentName(node: Node): boolean {
  return node.kind === 'Identifier' && isCapitalised(node.name as string)
}

/**
 * Whether a callee is a React function, bare or off `React`.
 *
 * @param node - The callee
 * @param name - The React function's export name, such as `memo`
 * @returns Whether it calls that function
 */
function isReactFunction(node: Node, name: string): boolean {
  if (node.name === name) return true
  return node.kind === 'MemberExpression' && (node.object as Node).name === 'React' && (node.property as Node).name === name
}

/**
 * Whether a function is the argument of `forwardRef` or `memo`.
 *
 * @param node - The function or other node
 * @returns Whether it is wrapped as a component
 */
function isWrappedComponent(node: Node): boolean {
  const callee = node.parent?.callee as Node | undefined
  return callee !== undefined && (isReactFunction(callee, 'forwardRef') || isReactFunction(callee, 'memo'))
}

/**
 * The name a function goes by: its own, or the declarator, assignment, property or default it
 * is the value of.
 *
 * @param node - The function or other code path root
 * @returns The name node, or null when it has none
 */
function functionNameOf(node: Node): Node | null {
  if (node.kind === 'FunctionDeclaration' || (node.kind === 'FunctionExpression' && node.id !== null && node.id !== undefined)) {
    return (node.id as Node | null) ?? null
  }
  if (node.kind !== 'FunctionExpression' && node.kind !== 'ArrowFunctionExpression') return null
  const parent = node.parent as Node
  if (parent.kind === 'VariableDeclarator' && parent.init === node) return parent.id as Node
  if (parent.kind === 'AssignmentExpression' && parent.right === node && parent.operator === '=') return parent.left as Node
  if (parent.kind === 'Property' && parent.value === node && parent.computed !== true) return parent.key as Node
  if (parent.kind === 'AssignmentPattern' && parent.right === node) return parent.left as Node
  return null
}

/**
 * Whether a node is inside a component or a hook: it or an ancestor is named as one or wrapped
 * as a component.
 *
 * @param from - The node looked from
 * @returns Whether a component or hook encloses it
 */
function isInsideComponentOrHook(from: Node): boolean {
  for (let node: Node | null = from; node !== null; node = node.parent) {
    const name = functionNameOf(node)
    if (name !== null && (isComponentName(name) || isHook(name))) return true
    if (isWrappedComponent(node)) return true
  }
  return false
}

export default defineRule<undefined, Node>({
  id: 'react-hooks/rules-of-hooks',
  language: 'code',
  fixable: false,
  create(context) {
    const hooks: Node[] = []
    const source = (node: Node): string => context.file.text.slice(node.start, node.end)
    const report = (hook: Node, message: string): void => context.report({ start: hook.start, end: hook.end, message })
    const checkPath = (path: CodePath, byPath: Map<Segment, Node[]>): void => {
      const counter = new PathCounter(path)
      const all = counter.toEnd(path.initial)
      const root = path.root
      const name = functionNameOf(root)
      const direct = name === null ? isWrappedComponent(root) : isComponentName(name) || isHook(name)
      const inside = isInsideComponentOrHook(root)
      const shortestFinal = counter.shortestFinalDistance()
      for (const [segment, calls] of byPath) {
        if (!segment.reachable) continue
        const distance = counter.distanceToStart(segment)
        const early = counter.endsAt(segment) ? shortestFinal <= distance : shortestFinal < distance
        const through = counter.fromStart(segment) * counter.toEnd(segment)
        const cycled = counter.cyclic.has(segment.id)
        for (const hook of calls) {
          const use = isReactFunction(hook, 'use')
          if (cycled && !use)
            report(hook, `React Hook "${source(hook)}" may be executed more than once. Possibly because it is called in a loop. ${ORDER}`)
          if (direct) {
            if (root.async === true) report(hook, `React Hook "${source(hook)}" cannot be called in an async function.`)
            if (!cycled && through !== all && !use) {
              const suffix = early ? ' Did you accidentally call a React Hook after an early return?' : ''
              report(hook, `React Hook "${source(hook)}" is called conditionally. ${ORDER}${suffix}`)
            }
          } else if (root.parent?.kind === 'MethodDefinition' && root.parent.value === root) {
            report(hook, `React Hook "${source(hook)}" cannot be called in a class component. ${WHERE}`)
          } else if (name !== null) {
            report(
              hook,
              `React Hook "${source(hook)}" is called in function "${source(name)}" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".`
            )
          } else if (root.kind === 'Program') {
            report(hook, `React Hook "${source(hook)}" cannot be called at the top level. ${WHERE}`)
          } else if (inside && !use) {
            report(hook, `React Hook "${source(hook)}" cannot be called inside a callback. ${WHERE}`)
          }
        }
      }
    }
    return {
      CallExpression(node) {
        if (isHook(node.callee as Node)) hooks.push(node)
      },
      'Program:exit'() {
        if (hooks.length === 0) return
        const flow = flowAnalysisOf(context)
        const byPath = createMap<CodePath, Map<Segment, Node[]>>()
        for (const call of hooks) {
          const segment = flow.segmentOf(call) as Segment
          const path = flow.pathOf(segment)
          let segments = byPath.get(path)
          if (segments === undefined) {
            segments = createMap<Segment, Node[]>()
            byPath.set(path, segments)
          }
          const calls = segments.get(segment) ?? []
          calls.push(call.callee as Node)
          segments.set(segment, calls)
        }
        for (const [path, segments] of byPath) checkPath(path, segments)
      },
    }
  },
})
