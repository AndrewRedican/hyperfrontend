/**
 * Built-ins are reached through the copies `@hyperfrontend/immutable-api-utils` captures at
 * startup, never through globals a polluted prototype could have replaced: no static method of a
 * built-in, no global function, no built-in constructor and no `Object.prototype` method called
 * through `call` is used directly. The copies themselves and test files are exempt.
 *
 * @module rules/workspace/no-unsafe-builtin-methods
 */

import type { Node } from '../../code/model.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '../../engine/rule.ts'

/** The package of the copies. */
const PACKAGE = '@hyperfrontend/immutable-api-utils'

/** A copy: its export and its module. */
interface Copy {
  /** The export's name. */
  readonly name: string
  /** The module path. */
  readonly module: string
}

/**
 * The copies one module offers, from a list of `name` or `original=copy` words.
 *
 * @param module - The module under `built-in-copy/`
 * @param words - The originals, each optionally followed by `=` and the copy's name
 * @returns The copies by original name
 */
function copies(module: string, words: string): Map<string, Copy> {
  return createMap(
    words.split(' ').map((word) => {
      const [original, name] = word.split('=') as [string, string | undefined]
      return [original, { name: name ?? original, module: `${PACKAGE}/built-in-copy/${module}` }]
    })
  )
}

/** The copies of the static members of each built-in. */
const STATICS = createMap<string, Map<string, Copy>>([
  [
    'Object',
    copies(
      'object',
      'freeze create keys entries values fromEntries assign defineProperty defineProperties setPrototypeOf getPrototypeOf seal isFrozen isSealed isExtensible preventExtensions getOwnPropertyDescriptor getOwnPropertyNames getOwnPropertySymbols getOwnPropertyDescriptors hasOwn'
    ),
  ],
  ['Array', copies('array', 'isArray from of')],
  ['JSON', copies('json', 'parse stringify')],
  [
    'Promise',
    copies(
      'promise',
      'resolve=promiseResolve reject=promiseReject all=promiseAll race=promiseRace allSettled=promiseAllSettled any=promiseAny withResolvers=promiseWithResolvers'
    ),
  ],
  ['Date', copies('date', 'now=dateNow parse=dateParse UTC=dateUTC')],
  ['Map', copies('map', 'groupBy=mapGroupBy')],
  ['Symbol', copies('symbol', 'for=symbolFor keyFor=symbolKeyFor')],
  [
    'Reflect',
    copies(
      'reflect',
      'apply construct get set has ownKeys defineProperty deleteProperty getOwnPropertyDescriptor getPrototypeOf setPrototypeOf isExtensible preventExtensions'
    ),
  ],
  [
    'console',
    copies(
      'console',
      'log warn error info debug trace dir table assert clear count countReset group groupCollapsed groupEnd time timeEnd timeLog'
    ),
  ],
  [
    'Math',
    copies(
      'math',
      'abs sign ceil floor round trunc max min pow sqrt cbrt hypot exp expm1 log log2 log10 log1p sin cos tan asin acos atan atan2 sinh cosh tanh asinh acosh atanh random fround clz32 imul'
    ),
  ],
  ['Number', copies('number', 'isNaN isFinite isInteger isSafeInteger parseFloat parseInt')],
  ['String', copies('string', 'fromCharCode fromCodePoint raw')],
  ['URL', copies('url', 'canParse createObjectURL revokeObjectURL parse=parseURL')],
  ['ArrayBuffer', copies('typed-arrays', 'isView')],
  ['Uint8Array', copies('typed-arrays', 'from=uint8ArrayFrom of=uint8ArrayOf')],
])

/** The copies of global functions. */
const GLOBALS = createMap([
  ...copies('timers', 'setTimeout setInterval clearTimeout clearInterval queueMicrotask requestAnimationFrame cancelAnimationFrame'),
  ...copies('messaging', 'structuredClone'),
  ...copies('encoding', 'atob btoa'),
  ...copies('number', 'parseInt parseFloat isNaN=globalIsNaN isFinite=globalIsFinite'),
])

/** The modules whose factories replace each constructor, the factory named `create` and the constructor. */
const CONSTRUCTOR_MODULES: Readonly<Record<string, string>> = {
  promise: 'Promise',
  messaging: 'MessageChannel BroadcastChannel',
  map: 'Map',
  encoding: 'TextEncoder TextDecoder',
  url: 'URL URLSearchParams',
  websocket: 'WebSocket',
  'typed-arrays':
    'ArrayBuffer SharedArrayBuffer DataView Uint8Array Uint8ClampedArray Uint16Array Uint32Array Int8Array Int16Array Int32Array Float32Array Float64Array BigInt64Array BigUint64Array',
  set: 'Set',
  'weak-map': 'WeakMap',
  'weak-set': 'WeakSet',
  regexp: 'RegExp',
  date: 'Date',
  error: 'Error TypeError RangeError ReferenceError SyntaxError URIError EvalError AggregateError',
  function: 'Function',
}

/** The factories replacing each constructor. */
const CONSTRUCTORS = createMap(
  entries(CONSTRUCTOR_MODULES).flatMap(([module, names]) => [
    ...copies(
      module,
      names
        .split(' ')
        .map((name) => `${name}=create${name}`)
        .join(' ')
    ),
  ])
)

/** The copies of `Object.prototype` methods called through `call`. */
const PROTOTYPE_CALLS = copies('object', 'hasOwnProperty=hasOwn toString=typeTag')

/**
 * The name of an identifier node.
 *
 * @param node - A callee or constructor expression
 * @returns The name, or null for anything but an identifier
 */
function nameOf(node: Node): string | null {
  return node.kind === 'Identifier' ? (node.name as string) : null
}

export default defineRule<undefined, Node>({
  id: 'workspace/no-unsafe-builtin-methods',
  language: 'code',
  fixable: false,
  create(context) {
    const path = context.file.path
    if (path.includes('built-in-copy') || path.includes('.spec.') || path.includes('.test.')) return {}
    const imported = createSet<string>()
    const report = (node: Node, copy: Copy, instead: string): void =>
      context.report({
        start: node.start,
        end: node.end,
        message: `Use '${copy.name}' from '${copy.module}' instead of ${instead} to protect against prototype pollution.`,
      })
    return {
      ImportDeclaration(node) {
        if (!((node.source as Node).value as string).startsWith(PACKAGE)) return
        for (const specifier of node.specifiers as readonly Node[])
          if (specifier.kind === 'ImportSpecifier') imported.add(nameOf(specifier.local as Node) as string)
      },
      MemberExpression(node) {
        const owner = nameOf(node.object as Node)
        const member = nameOf(node.property as Node)
        const copy = owner === null || member === null ? undefined : STATICS.get(owner)?.get(member)
        if (copy !== undefined) report(node, copy, `direct '${owner}.${member}' access`)
      },
      CallExpression(node) {
        const callee = node.callee as Node
        const global = nameOf(callee)
        const copy = global === null ? undefined : GLOBALS.get(global)
        if (copy !== undefined && !imported.has(global as string)) return report(node, copy, `'${global}'`)
        if (callee.kind !== 'MemberExpression' || nameOf(callee.property as Node) !== 'call') return
        const method = callee.object as Node
        const prototype = method.object as Node | undefined
        if (method.kind !== 'MemberExpression' || prototype?.kind !== 'MemberExpression') return
        const methodName = nameOf(method.property as Node)
        if (nameOf(prototype.object as Node) !== 'Object' || nameOf(prototype.property as Node) !== 'prototype' || methodName === null)
          return
        const prototypeCopy = PROTOTYPE_CALLS.get(methodName)
        if (prototypeCopy !== undefined) report(node, prototypeCopy, `'Object.prototype.${methodName}.call()'`)
      },
      NewExpression(node) {
        const name = nameOf(node.callee as Node)
        const copy = name === null ? undefined : CONSTRUCTORS.get(name)
        if (copy !== undefined) report(node, copy, `'new ${name}()'`)
      },
    }
  },
})
