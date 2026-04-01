import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the no-unsafe-builtin-methods rule.
 */
export const RULE_NAME = 'no-unsafe-builtin-methods'

const PKG = '@hyperfrontend/immutable-api-utils'

const OBJECT = `${PKG}/built-in-copy/object`
const ARRAY = `${PKG}/built-in-copy/array`
const JSON_COPY = `${PKG}/built-in-copy/json`
const PROMISE = `${PKG}/built-in-copy/promise`
const CONSOLE = `${PKG}/built-in-copy/console`
const TIMERS = `${PKG}/built-in-copy/timers`
const MESSAGING = `${PKG}/built-in-copy/messaging`
const MAP = `${PKG}/built-in-copy/map`
const SET = `${PKG}/built-in-copy/set`
const WEAK_MAP = `${PKG}/built-in-copy/weak-map`
const WEAK_SET = `${PKG}/built-in-copy/weak-set`
const REGEXP = `${PKG}/built-in-copy/regexp`
const DATE = `${PKG}/built-in-copy/date`
const ERROR = `${PKG}/built-in-copy/error`
const FUNCTION = `${PKG}/built-in-copy/function`
const REFLECT = `${PKG}/built-in-copy/reflect`
const SYMBOL = `${PKG}/built-in-copy/symbol`
const ENCODING = `${PKG}/built-in-copy/encoding`
const TYPED_ARRAYS = `${PKG}/built-in-copy/typed-arrays`
const URL_COPY = `${PKG}/built-in-copy/url`
const WEBSOCKET = `${PKG}/built-in-copy/websocket`
const MATH = `${PKG}/built-in-copy/math`
const NUMBER_COPY = `${PKG}/built-in-copy/number`
const STRING_COPY = `${PKG}/built-in-copy/string`

type SafeImport = { import: string; from: string }

/**
 * Maps unsafe method access to safe imports
 */
const UNSAFE_METHODS: Record<string, Record<string, SafeImport>> = {
  Object: fromEntries(
    [
      'freeze',
      'create',
      'keys',
      'entries',
      'values',
      'fromEntries',
      'assign',
      'defineProperty',
      'defineProperties',
      'setPrototypeOf',
      'getPrototypeOf',
      'seal',
      'isFrozen',
      'isSealed',
      'isExtensible',
      'preventExtensions',
      'getOwnPropertyDescriptor',
      'getOwnPropertyNames',
      'getOwnPropertySymbols',
      'getOwnPropertyDescriptors',
    ].map((m) => [m, { import: m, from: OBJECT }])
  ),
  Array: fromEntries(['isArray', 'from', 'of'].map((m) => [m, { import: m, from: ARRAY }])),
  JSON: fromEntries(['parse', 'stringify'].map((m) => [m, { import: m, from: JSON_COPY }])),
  Promise: fromEntries(
    ['resolve', 'reject', 'all', 'race', 'allSettled', 'any', 'withResolvers'].map((m) => [
      m,
      { import: m === 'withResolvers' ? 'promiseWithResolvers' : `promise${m.charAt(0).toUpperCase()}${m.slice(1)}`, from: PROMISE },
    ])
  ),
  Date: fromEntries(
    [
      ['now', 'dateNow'],
      ['parse', 'dateParse'],
      ['UTC', 'dateUTC'],
    ].map(([m, i]) => [m, { import: i, from: DATE }])
  ),
  Map: fromEntries([['groupBy', { import: 'mapGroupBy', from: MAP }]]),
  Symbol: fromEntries(
    [
      ['for', 'symbolFor'],
      ['keyFor', 'symbolKeyFor'],
    ].map(([m, i]) => [m, { import: i, from: SYMBOL }])
  ),
  Reflect: fromEntries(
    [
      'apply',
      'construct',
      'get',
      'set',
      'has',
      'ownKeys',
      'defineProperty',
      'deleteProperty',
      'getOwnPropertyDescriptor',
      'getPrototypeOf',
      'setPrototypeOf',
      'isExtensible',
      'preventExtensions',
    ].map((m) => [m, { import: m, from: REFLECT }])
  ),
  console: fromEntries(
    [
      'log',
      'warn',
      'error',
      'info',
      'debug',
      'trace',
      'dir',
      'table',
      'assert',
      'clear',
      'count',
      'countReset',
      'group',
      'groupCollapsed',
      'groupEnd',
      'time',
      'timeEnd',
      'timeLog',
    ].map((m) => [m, { import: m, from: CONSOLE }])
  ),
  Math: fromEntries(
    [
      'abs',
      'sign',
      'ceil',
      'floor',
      'round',
      'trunc',
      'max',
      'min',
      'pow',
      'sqrt',
      'cbrt',
      'hypot',
      'exp',
      'expm1',
      'log',
      'log2',
      'log10',
      'log1p',
      'sin',
      'cos',
      'tan',
      'asin',
      'acos',
      'atan',
      'atan2',
      'sinh',
      'cosh',
      'tanh',
      'asinh',
      'acosh',
      'atanh',
      'random',
      'fround',
      'clz32',
      'imul',
    ].map((m) => [m, { import: m, from: MATH }])
  ),
  Number: fromEntries(
    [
      ['isNaN', 'isNaN'],
      ['isFinite', 'isFinite'],
      ['isInteger', 'isInteger'],
      ['isSafeInteger', 'isSafeInteger'],
      ['parseFloat', 'parseFloat'],
      ['parseInt', 'parseInt'],
    ].map(([m, i]) => [m, { import: i, from: NUMBER_COPY }])
  ),
  String: fromEntries(
    [
      ['fromCharCode', 'fromCharCode'],
      ['fromCodePoint', 'fromCodePoint'],
      ['raw', 'raw'],
    ].map(([m, i]) => [m, { import: i, from: STRING_COPY }])
  ),
  URL: fromEntries(
    [
      ['canParse', 'canParse'],
      ['createObjectURL', 'createObjectURL'],
      ['revokeObjectURL', 'revokeObjectURL'],
      ['parse', 'parseURL'],
    ].map(([m, i]) => [m, { import: i, from: URL_COPY }])
  ),
  ArrayBuffer: fromEntries([['isView', { import: 'isView', from: TYPED_ARRAYS }]]),
  Uint8Array: fromEntries(
    [
      ['from', 'uint8ArrayFrom'],
      ['of', 'uint8ArrayOf'],
    ].map(([m, i]) => [m, { import: i, from: TYPED_ARRAYS }])
  ),
}

UNSAFE_METHODS['Object']['hasOwn'] = { import: 'hasOwn', from: OBJECT }

/**
 * Maps unsafe global function calls to safe imports
 */
const UNSAFE_GLOBALS: Record<string, SafeImport> = {
  setTimeout: { import: 'setTimeout', from: TIMERS },
  setInterval: { import: 'setInterval', from: TIMERS },
  clearTimeout: { import: 'clearTimeout', from: TIMERS },
  clearInterval: { import: 'clearInterval', from: TIMERS },
  queueMicrotask: { import: 'queueMicrotask', from: TIMERS },
  requestAnimationFrame: { import: 'requestAnimationFrame', from: TIMERS },
  cancelAnimationFrame: { import: 'cancelAnimationFrame', from: TIMERS },
  structuredClone: { import: 'structuredClone', from: MESSAGING },
  atob: { import: 'atob', from: ENCODING },
  btoa: { import: 'btoa', from: ENCODING },
  parseInt: { import: 'parseInt', from: NUMBER_COPY },
  parseFloat: { import: 'parseFloat', from: NUMBER_COPY },
  isNaN: { import: 'globalIsNaN', from: NUMBER_COPY },
  isFinite: { import: 'globalIsFinite', from: NUMBER_COPY },
}

/**
 * Maps unsafe constructors (new Xxx()) to safe factory imports
 */
const UNSAFE_CONSTRUCTORS: Record<string, SafeImport> = {
  Promise: { import: 'createPromise', from: PROMISE },
  MessageChannel: { import: 'createMessageChannel', from: MESSAGING },
  BroadcastChannel: { import: 'createBroadcastChannel', from: MESSAGING },
  Map: { import: 'createMap', from: MAP },
  TextEncoder: { import: 'createTextEncoder', from: ENCODING },
  TextDecoder: { import: 'createTextDecoder', from: ENCODING },
  URL: { import: 'createURL', from: URL_COPY },
  URLSearchParams: { import: 'createURLSearchParams', from: URL_COPY },
  WebSocket: { import: 'createWebSocket', from: WEBSOCKET },
  ArrayBuffer: { import: 'createArrayBuffer', from: TYPED_ARRAYS },
  SharedArrayBuffer: { import: 'createSharedArrayBuffer', from: TYPED_ARRAYS },
  DataView: { import: 'createDataView', from: TYPED_ARRAYS },
  Uint8Array: { import: 'createUint8Array', from: TYPED_ARRAYS },
  Uint8ClampedArray: { import: 'createUint8ClampedArray', from: TYPED_ARRAYS },
  Uint16Array: { import: 'createUint16Array', from: TYPED_ARRAYS },
  Uint32Array: { import: 'createUint32Array', from: TYPED_ARRAYS },
  Int8Array: { import: 'createInt8Array', from: TYPED_ARRAYS },
  Int16Array: { import: 'createInt16Array', from: TYPED_ARRAYS },
  Int32Array: { import: 'createInt32Array', from: TYPED_ARRAYS },
  Float32Array: { import: 'createFloat32Array', from: TYPED_ARRAYS },
  Float64Array: { import: 'createFloat64Array', from: TYPED_ARRAYS },
  BigInt64Array: { import: 'createBigInt64Array', from: TYPED_ARRAYS },
  BigUint64Array: { import: 'createBigUint64Array', from: TYPED_ARRAYS },
  Set: { import: 'createSet', from: SET },
  WeakMap: { import: 'createWeakMap', from: WEAK_MAP },
  WeakSet: { import: 'createWeakSet', from: WEAK_SET },
  RegExp: { import: 'createRegExp', from: REGEXP },
  Date: { import: 'createDate', from: DATE },
  Error: { import: 'createError', from: ERROR },
  TypeError: { import: 'createTypeError', from: ERROR },
  RangeError: { import: 'createRangeError', from: ERROR },
  ReferenceError: { import: 'createReferenceError', from: ERROR },
  SyntaxError: { import: 'createSyntaxError', from: ERROR },
  URIError: { import: 'createURIError', from: ERROR },
  EvalError: { import: 'createEvalError', from: ERROR },
  AggregateError: { import: 'createAggregateError', from: ERROR },
  Function: { import: 'createFunction', from: FUNCTION },
}

/**
 * Maps unsafe prototype method call patterns
 */
const UNSAFE_PROTOTYPE_CALLS: Record<string, SafeImport> = {
  'Object.prototype.hasOwnProperty': { import: 'hasOwn', from: OBJECT },
  'Object.prototype.toString': { import: 'typeTag', from: OBJECT },
}

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

type MessageIds = 'unsafeBuiltinMethod' | 'unsafePrototypeCall' | 'unsafeConstructor' | 'unsafeGlobalFunction'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: `Enforce use of safe built-in copies from ${PKG} to prevent prototype pollution attacks`,
    },
    schema: [],
    messages: {
      unsafeBuiltinMethod:
        "Use '{{ safeImport }}' from '{{ safeFrom }}' instead of direct '{{ unsafeAccess }}' access to protect against prototype pollution.",
      unsafePrototypeCall:
        "Use '{{ safeImport }}' from '{{ safeFrom }}' instead of '{{ unsafeAccess }}' to protect against prototype pollution.",
      unsafeConstructor:
        "Use '{{ safeImport }}' from '{{ safeFrom }}' instead of 'new {{ constructorName }}()' to protect against prototype pollution.",
      unsafeGlobalFunction:
        "Use '{{ safeImport }}' from '{{ safeFrom }}' instead of '{{ unsafeName }}' to protect against prototype pollution.",
    },
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename

    if (filename.includes('built-in-copy')) {
      return {}
    }

    if (filename.includes('.spec.') || filename.includes('.test.')) {
      return {}
    }

    const safeImports = createSet<string>()

    return {
      ImportDeclaration(node: TSESTree.ImportDeclaration) {
        const source = node.source.value
        if (typeof source === 'string' && source.startsWith(PKG)) {
          for (const specifier of node.specifiers) {
            if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
              safeImports.add(specifier.local.name)
            }
          }
        }
      },

      MemberExpression(node: TSESTree.MemberExpression) {
        if (node.object.type !== AST_NODE_TYPES.Identifier) return
        if (node.property.type !== AST_NODE_TYPES.Identifier) return

        const objectName = node.object.name
        const methodName = node.property.name

        const objectMethods = UNSAFE_METHODS[objectName]
        if (objectMethods) {
          const safeMethod = objectMethods[methodName]
          if (safeMethod) {
            context.report({
              node,
              messageId: 'unsafeBuiltinMethod',
              data: {
                safeImport: safeMethod.import,
                safeFrom: safeMethod.from,
                unsafeAccess: `${objectName}.${methodName}`,
              },
            })
          }
        }
      },

      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type === AST_NODE_TYPES.Identifier) {
          const funcName = node.callee.name
          const safeMethod = UNSAFE_GLOBALS[funcName]
          if (safeMethod && !safeImports.has(funcName)) {
            context.report({
              node,
              messageId: 'unsafeGlobalFunction',
              data: {
                safeImport: safeMethod.import,
                safeFrom: safeMethod.from,
                unsafeName: funcName,
              },
            })
          }
        }

        if (
          node.callee.type === AST_NODE_TYPES.MemberExpression &&
          node.callee.object.type === AST_NODE_TYPES.MemberExpression &&
          node.callee.property.type === AST_NODE_TYPES.Identifier &&
          node.callee.property.name === 'call'
        ) {
          const innerMember = node.callee.object
          if (
            innerMember.object.type === AST_NODE_TYPES.MemberExpression &&
            innerMember.object.object.type === AST_NODE_TYPES.Identifier &&
            innerMember.object.property.type === AST_NODE_TYPES.Identifier &&
            innerMember.property.type === AST_NODE_TYPES.Identifier
          ) {
            const objectName = innerMember.object.object.name
            const prototypeName = innerMember.object.property.name
            const methodName = innerMember.property.name
            const fullPath = `${objectName}.${prototypeName}.${methodName}`

            const safeMethod = UNSAFE_PROTOTYPE_CALLS[fullPath]
            if (safeMethod) {
              context.report({
                node,
                messageId: 'unsafePrototypeCall',
                data: {
                  safeImport: safeMethod.import,
                  safeFrom: safeMethod.from,
                  unsafeAccess: `${fullPath}.call()`,
                },
              })
            }
          }
        }
      },

      NewExpression(node: TSESTree.NewExpression) {
        if (node.callee.type === AST_NODE_TYPES.Identifier) {
          const constructorName = node.callee.name
          const safeMethod = UNSAFE_CONSTRUCTORS[constructorName]
          if (safeMethod) {
            context.report({
              node,
              messageId: 'unsafeConstructor',
              data: {
                safeImport: safeMethod.import,
                safeFrom: safeMethod.from,
                constructorName,
              },
            })
          }
        }
      },
    }
  },
})
