/**
 * A component without a display name shows as anonymous in the developer tools. Components are
 * detected as React does: class components, factory objects, functions returning JSX or `null`
 * in a position a component can take, and the functions wrapped in `memo`, `forwardRef` or a
 * configured wrapper. A component has a name when it is declared or assigned under one, when
 * `displayName` is set on it, or when a factory object lists it.
 *
 * @module rules/react/display-name
 */

import type { Node } from '../../code/model'
import type { RuleContext } from '../../engine/rule'
import type { Definition, Reference } from '../../scope/model'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { max } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'
import { defineRule } from '../../engine/rule'
import { findVariable, scopeAnalysisOf, scopeOf } from '../../scope/analysis'
import { isEs5Component, isEs6Component } from './shared/class-components'
import { isFromPragma } from './shared/pragma-import'
import { atLeast, caret, pragmaOf, reactVersion } from './shared/settings'

/** A detected component. */
interface Component {
  /** How sure the detection is: 0 rules it out for good, 2 and more lists it. */
  confidence: number
  /** Whether it has a display name. */
  named: boolean
}

/** A function that wraps a component, by name and the object it is called on. */
interface Wrapper {
  /** The function's name. */
  readonly property: string
  /** The object it is read from, or null for a bare call. */
  readonly object: string | null
}

/** The message reported. */
const MESSAGE = 'Component definition is missing display name'

/**
 * Whether a name starts, past its underscores, with a character that does not change when
 * upper-cased.
 *
 * @param name - The name tested, or something else when the node had none
 * @returns Whether it reads as a component name
 */
function isCapitalised(name: unknown): boolean {
  if (typeof name !== 'string' || name === '') return false
  let index = 0
  while (name[index] === '_') index += 1
  const first = name.charAt(index)
  return first.toUpperCase() === first
}

/**
 * Whether a node is a function expression or an arrow.
 *
 * @param node - The node tested
 * @returns Whether it is a function a component can be
 */
function isFunctionLike(node: Node | undefined): boolean {
  return node !== undefined && (node.kind === 'FunctionExpression' || node.kind === 'ArrowFunctionExpression')
}

/**
 * The arguments of the returns a function yields through blocks, `if`, `for`, `while` and
 * `switch`: an expression body, or each return found without entering any other statement.
 *
 * @param fn - The function
 * @returns The returned expressions, null for a bare `return`
 */
function returnedBy(fn: Node): (Node | null)[] {
  const body = fn.body as Node
  if (body.kind !== 'BlockStatement') return [body]
  const found: (Node | null)[] = []
  const visit = (node: Node): void => {
    if (node.kind === 'ReturnStatement') {
      found.push(node.argument as Node | null)
      return
    }
    const nested: readonly (Node | null | undefined)[] =
      node.kind === 'BlockStatement'
        ? (node.body as readonly Node[])
        : node.kind === 'IfStatement'
          ? [node.consequent as Node, node.alternate as Node | null]
          : node.kind === 'ForStatement' || node.kind === 'WhileStatement'
            ? [node.body as Node]
            : node.kind === 'SwitchStatement'
              ? (node.cases as readonly Node[]).flatMap((entry) => entry.consequent as readonly Node[])
              : []
    for (const child of nested) if (child !== null && child !== undefined) visit(child)
  }
  visit(body)
  return found
}

export default defineRule<undefined, Node>({
  id: 'react/display-name',
  language: 'code',
  fixable: false,
  create(context) {
    const pragma = pragmaOf(context.file, context.settings)
    const version = reactVersion(context.settings)
    const configured = (context.settings['componentWrapperFunctions'] ?? []) as readonly (string | Wrapper)[]
    const wrappers: Wrapper[] = [
      { property: 'forwardRef', object: pragma },
      { property: 'memo', object: pragma },
      ...configured.map((entry) =>
        typeof entry === 'string' ? { property: entry, object: null } : { ...entry, object: entry.object ?? null }
      ),
    ]
    const components = createMap<Node, Component>()
    const add = (node: Node, confidence: number): Component => {
      const existing = components.get(node)
      if (existing === undefined) {
        const component = { confidence, named: false }
        components.set(node, component)
        return component
      }
      existing.confidence = confidence === 0 || existing.confidence === 0 ? 0 : max(existing.confidence, confidence)
      return existing
    }
    const markNamed = (from: Node): void => {
      for (let node: Node | null = from; node !== null; node = node.parent) {
        const component = components.get(node)
        if (component !== undefined && component.confidence >= 1) {
          component.named = true
          return
        }
      }
    }
    const isWrapper = (node: Node | null): boolean => {
      if (node === null || node.kind !== 'CallExpression') return false
      const callee = node.callee as Node
      return wrappers.some((wrapper) => {
        if (callee.kind === 'MemberExpression') {
          return wrapper.object === (callee.object as Node).name && wrapper.property === (callee.property as Node).name
        }
        if (wrapper.property !== callee.name) return false
        return wrapper.object === null || (wrapper.object === pragma && isFromPragma(context, node, callee.name, pragma))
      })
    }
    const outerWrapper = (node: Node): Node | null => {
      let found: Node | null = null
      for (let current = node.parent; isWrapper(current); current = (current as Node).parent) found = current
      return found
    }
    const isCreateElement = (call: Node): boolean => {
      const callee = call.callee as Node
      if (callee.kind === 'MemberExpression') {
        return (callee.property as Node).name === 'createElement' && (callee.object as Node).name === pragma
      }
      return callee.name === 'createElement' && isFromPragma(context, call, 'createElement', pragma)
    }
    const isJsxValue = (node: Node | null, ignoreNull: boolean): boolean => {
      if (node === null) return false
      switch (node.kind) {
        case 'ConditionalExpression':
          return isJsxValue(node.consequent as Node, ignoreNull) || isJsxValue(node.alternate as Node, ignoreNull)
        case 'LogicalExpression':
          return isJsxValue(node.left as Node, ignoreNull) || isJsxValue(node.right as Node, ignoreNull)
        case 'SequenceExpression':
          return isJsxValue((node.expressions as readonly Node[]).at(-1) as Node, ignoreNull)
        case 'JSXElement':
        case 'JSXFragment':
          return true
        case 'CallExpression':
          return isCreateElement(node)
        case 'Literal':
          return !ignoreNull && node.value === null
        case 'Identifier':
          return isJsxIdentifier(context, node)
        default:
          return false
      }
    }
    const returnsJsx = (fn: Node, ignoreNull: boolean): boolean => returnedBy(fn).some((value) => isJsxValue(value, ignoreNull))
    const returnsOnlyNull = (fn: Node): boolean => {
      const values = returnedBy(fn).filter((value): value is Node => value !== null)
      return values.length > 0 && values.every((value) => value.kind === 'Literal' && value.value === null)
    }
    const statelessComponentOf = (node: Node): Node | null => {
      if (node.kind === 'FunctionDeclaration') {
        const id = node.id as Node | null
        return (id === null || isCapitalised(id.name)) && returnsJsx(node, false) ? node : null
      }
      if (!isFunctionLike(node)) return null
      return functionComponentOf(node)
    }
    const functionComponentOf = (node: Node): Node | null => {
      const parent = node.parent as Node
      const left = parent.left as Node | undefined
      const propertyAssignment = parent.kind === 'AssignmentExpression' && left?.kind === 'MemberExpression'
      const moduleExports =
        propertyAssignment && ((left as Node).object as Node).name === 'module' && ((left as Node).property as Node).name === 'exports'
      const orNull = returnsJsx(node, false)
      const grand = parent.parent as Node
      if (parent.kind === 'ExportDefaultDeclaration') return returnsJsx(node, true) ? node : null
      if (parent.kind === 'VariableDeclarator' && orNull) return isCapitalised((parent.id as Node).name) ? node : null
      const expressionArrow = parent.kind === 'ArrowFunctionExpression' && (parent.body as Node).kind !== 'BlockStatement'
      if ((parent.kind === 'ReturnStatement' || expressionArrow) && !returnsJsx(node, true)) return null
      if (parent.kind === 'AssignmentExpression' && !propertyAssignment && orNull) return isCapitalised((left as Node).name) ? node : null
      if (parent.kind === 'ArrowFunctionExpression' && grand.kind === 'AssignmentExpression' && orNull) {
        return isCapitalised((grand.left as Node).name) ? node : null
      }
      if (parent.kind === 'ArrowFunctionExpression' && grand.kind === 'Property' && orNull) {
        return isCapitalised((grand.key as Node).name) ? node : null
      }
      if (parent.kind === 'ReturnStatement') {
        if (isCapitalised((node.id as Node | null)?.name)) return node
        const outer = (grand.parent as Node).parent as Node
        if ((outer.kind === 'AssignmentExpression' || outer.kind === 'Property') && orNull) {
          return isCapitalised(outer.kind === 'Property' ? (outer.key as Node).name : (outer.left as Node).name) ? node : null
        }
      }
      if ((parent.key as Node | undefined)?.kind === 'MemberExpression' && !returnsJsx(node, true) && !returnsOnlyNull(node)) return null
      if (parent.kind === 'Property' && parent.computed !== true && (parent.method === true || node.id === null || node.id === undefined)) {
        return isCapitalised((parent.key as Node).name) && returnsJsx(node, true) ? node : null
      }
      const wrapper = outerWrapper(node)
      if (wrapper !== null && orNull) return wrapper
      if (!isAllowedPosition(node) || !orNull) return null
      const key = parent.key as Node | undefined
      if (key?.kind === 'Identifier' && !isCapitalised(key.name) && (node.params as readonly Node[]).length > 0) return null
      const id = node.id as Node | null | undefined
      if (id !== null && id !== undefined) return isCapitalised(id.name) ? node : null
      if (propertyAssignment && !moduleExports && !isCapitalised(((left as Node).property as Node).name)) return null
      if (parent.kind === 'Property' && returnsOnlyNull(node)) return null
      return node
    }
    const detectFunction = (node: Node): void => {
      if (node.async === true) {
        add(node, 0)
        return
      }
      const component = statelessComponentOf(node)
      if (component !== null) add(component, 2)
    }
    const hasTranspilerName = (node: Node): boolean => {
      const parent = node.parent as Node
      if (node.kind === 'ObjectExpression') {
        const holder = parent.parent as Node
        if (holder.kind === 'VariableDeclarator') return true
        if (holder.kind !== 'AssignmentExpression') return false
        const target = holder.left as Node
        return target.object === undefined || (target.object as Node).name !== 'module' || (target.property as Node).name !== 'exports'
      }
      if (node.kind !== 'ArrowFunctionExpression' && typeof (node.id as Node | null | undefined)?.name === 'string') return true
      if (!isFunctionLike(node)) return false
      if (parent.kind !== 'VariableDeclarator' && parent.kind !== 'Property' && parent.method !== true) return false
      const holder = parent.parent as Node
      return holder.kind !== 'ObjectExpression' || !isEs5Component(context, holder)
    }
    const markRelated = (member: Node): void => {
      const target = relatedComponentOf(context, member)
      if (target === null) return
      const component = components.get(target) ?? add(target, 1)
      if (component.confidence >= 1) component.named = true
      const inner = target.kind === 'TSAsExpression' ? components.get(target.expression as Node) : undefined
      if (inner !== undefined && inner.confidence >= 1) inner.named = true
    }
    const checkFunction = (node: Node): void => {
      detectFunction(node)
      if (hasTranspilerName(node) && components.get(node) !== undefined && (components.get(node) as Component).confidence >= 1)
        markNamed(node)
    }
    const checkClass = (node: Node): void => {
      if (isEs6Component(context, node)) add(node, 2)
      if (hasTranspilerName(node)) markNamed(node)
    }
    return {
      CallExpression(node) {
        if (!isWrapper(node) || !isFunctionLike((node.arguments as readonly Node[])[0])) return
        const component = add(node, 2)
        if (outerWrapper(node) === null && !hasTranspilerName((node.arguments as readonly Node[])[0] as Node)) return
        if (component.confidence >= 1) markNamed(node)
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
      ObjectExpression(node) {
        if (!isEs5Component(context, node)) return
        add(node, 2)
        const listed = (node.properties as readonly Node[]).some((property) => isDisplayNameKey(property.key as Node | undefined))
        if (hasTranspilerName(node) || listed) markNamed(node)
      },
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
      ArrowFunctionExpression: checkFunction,
      ThisExpression(node) {
        if ((node.parent as Node).property === undefined) return
        for (let scope: ReturnType<typeof scopeOf> | null = scopeOf(scopeAnalysisOf(context), node); scope !== null; scope = scope.upper) {
          const component = statelessComponentOf(scope.block)
          if (component === null) continue
          if (component.kind.includes('Function')) add(component, 0)
          return
        }
      },
      PropertyDefinition(node) {
        if ((node.key as Node).name === 'displayName') markNamed(node)
      },
      MethodDefinition(node) {
        if (isDisplayNameKey(node.key as Node)) markNamed(node)
      },
      MemberExpression(node) {
        if (isDisplayNameKey(node.property as Node)) markRelated(node)
      },
      'Program:exit'() {
        const skipsNested = caret(version, [0, 14, 10]) || caret(version, [15, 7, 0]) || atLeast(version, [16, 12, 0])
        for (const [node, component] of components) {
          if (component.confidence < 2 || component.named) continue
          const first = (node.arguments as readonly Node[] | undefined)?.[0]
          if (skipsNested && node.kind === 'CallExpression' && first?.kind === 'CallExpression' && isWrapper(node)) continue
          context.report({ start: node.start, end: node.end, message: MESSAGE })
        }
      },
    }
  },
})

/**
 * Whether a key names `displayName`, as an identifier or a string.
 *
 * @param key - The key or property, or undefined
 * @returns Whether it declares the display name
 */
function isDisplayNameKey(key: Node | undefined): boolean {
  if (key === undefined) return false
  return key.kind === 'Identifier' ? key.name === 'displayName' : key.kind === 'Literal' && key.value === 'displayName'
}

/**
 * Whether a function's position lets it be a component: the value of a declarator, assignment,
 * property, return, default export or arrow body, or the last expression of a sequence there.
 *
 * @param node - The function
 * @returns Whether a component may stand there
 */
function isAllowedPosition(node: Node): boolean {
  const parent = node.parent as Node
  switch (parent.kind) {
    case 'VariableDeclarator':
    case 'AssignmentExpression':
    case 'Property':
    case 'ReturnStatement':
    case 'ExportDefaultDeclaration':
    case 'ArrowFunctionExpression':
      return true
    case 'SequenceExpression':
      return (parent.expressions as readonly Node[]).at(-1) === node && isAllowedPosition(parent)
    default:
      return false
  }
}

/**
 * Whether an identifier names a variable first declared as JSX.
 *
 * @param context - The rule's context, for the scope analysis
 * @param identifier - The identifier returned
 * @returns Whether its first definition is a JSX element or fragment
 */
function isJsxIdentifier(context: RuleContext<unknown, Node>, identifier: Node): boolean {
  const variable = findVariable(scopeOf(scopeAnalysisOf(context), identifier), identifier.name as string)
  const definition = variable?.defs[0] as Definition | undefined
  const value = definition?.kind === 'ImportBinding' ? definition.node : (definition?.node.init as Node | null | undefined)
  return value?.kind === 'JSXElement' || value?.kind === 'JSXFragment'
}

/**
 * The node a `displayName` member is set on: the value a reference of its root variable is
 * assigned or initialised with, or the variable's declaration followed down the member path.
 *
 * @param context - The rule's context, for the scope analysis
 * @param member - The member expression naming `displayName`
 * @returns The node, or null when the root variable is not found
 */
function relatedComponentOf(context: RuleContext<unknown, Node>, member: Node): Node | null {
  const path: string[] = []
  let root = member
  while (root.kind === 'MemberExpression') {
    path.unshift((root.property as Node).name as string)
    root = root.object as Node
  }
  if (root.kind !== 'Identifier') return null
  const variable = findVariable(scopeOf(scopeAnalysisOf(context), member), root.name as string)
  if (variable === null) return null
  const name = [root.name as string, ...path.slice(0, -1)].join('.')
  const reference = variable.references.find((candidate: Reference) => {
    const holder = candidate.identifier.parent as Node
    const target = holder.kind === 'MemberExpression' ? holder : candidate.identifier
    return context.file.text.slice(target.start, target.end) === name
  })
  const holder = reference?.identifier.parent as Node | undefined
  const assigned = holder?.kind === 'MemberExpression' ? ((holder.parent as Node).right as Node | undefined) : undefined
  const initialised = holder?.kind === 'VariableDeclarator' ? (holder.init as Node | null) : null
  if (assigned !== undefined) return assigned
  if (initialised !== null && initialised.kind !== 'Identifier') return initialised
  const definition = variable.defs.find((candidate) => ['ClassName', 'FunctionName', 'Variable'].includes(candidate.kind))
  if (definition === undefined) return null
  let node = (definition.node.init as Node | null | undefined) ?? definition.node
  for (const step of path) {
    const properties = node.properties as readonly Node[] | undefined
    if (properties === undefined) continue
    const value = properties.find((candidate) => (candidate.key as Node | undefined)?.name === step)?.value as Node | null | undefined
    if (value === undefined || value === null) return null
    node = value
  }
  return node
}
