import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** MDN JavaScript reference root for language built-ins. */
const MDN_JS = 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects'

/** MDN Web API reference root for browser platform interfaces. */
const MDN_API = 'https://developer.mozilla.org/en-US/docs/Web/API'

/** TypeScript handbook page documenting the built-in utility types. */
const TS_UTILITY_TYPES = 'https://www.typescriptlang.org/docs/handbook/utility-types.html'

/** JavaScript language built-ins documented under MDN's global objects. */
const JS_BUILTINS = createSet([
  'AggregateError',
  'Array',
  'ArrayBuffer',
  'BigInt',
  'BigInt64Array',
  'BigUint64Array',
  'Boolean',
  'DataView',
  'Date',
  'Error',
  'EvalError',
  'Float32Array',
  'Float64Array',
  'Function',
  'Int8Array',
  'Int16Array',
  'Int32Array',
  'JSON',
  'Map',
  'Math',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'RangeError',
  'ReferenceError',
  'Reflect',
  'RegExp',
  'Set',
  'SharedArrayBuffer',
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'URIError',
  'Uint8Array',
  'Uint8ClampedArray',
  'Uint16Array',
  'Uint32Array',
  'WeakMap',
  'WeakSet',
])

/** Browser platform interfaces documented under MDN's Web APIs. */
const WEB_APIS = createSet([
  'AbortController',
  'AbortSignal',
  'AudioContext',
  'Blob',
  'BroadcastChannel',
  'CSSStyleDeclaration',
  'Crypto',
  'CryptoKey',
  'DOMRect',
  'DOMRectReadOnly',
  'Document',
  'Element',
  'Event',
  'EventTarget',
  'File',
  'FormData',
  'Headers',
  'KeyboardEvent',
  'MediaSource',
  'MessageChannel',
  'MessageEvent',
  'MessagePort',
  'MouseEvent',
  'MutationObserver',
  'Node',
  'Request',
  'ResizeObserver',
  'Response',
  'Storage',
  'SubtleCrypto',
  'TextDecoder',
  'TextEncoder',
  'URL',
  'URLSearchParams',
  'WebSocket',
  'Window',
  'Worker',
])

/** TypeScript built-in utility types and their handbook anchors. */
const TS_UTILITIES: Record<string, string> = {
  Awaited: 'awaitedtype',
  Capitalize: 'capitalizestringtype',
  Exclude: 'excludeuniontype-excludedmembers',
  Extract: 'extracttype-union',
  Lowercase: 'lowercasestringtype',
  NonNullable: 'nonnullabletype',
  Omit: 'omittype-keys',
  Parameters: 'parameterstype',
  Partial: 'partialtype',
  Pick: 'picktype-keys',
  Readonly: 'readonlytype',
  Record: 'recordkeys-type',
  Required: 'requiredtype',
  ReturnType: 'returntypetype',
  ThisType: 'thistypetype',
  Uncapitalize: 'uncapitalizestringtype',
  Uppercase: 'uppercasestringtype',
}

/** Curated targets for TypeScript lib types without a same-name MDN page. */
const TS_SPECIAL: Record<string, string> = {
  ArrayBufferLike: `${MDN_JS}/ArrayBuffer`,
  ArrayBufferView: `${MDN_JS}/TypedArray`,
  AsyncIterable: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols',
  AsyncIterator: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols',
  ErrorOptions: `${MDN_JS}/Error/Error`,
  FrameRequestCallback: `${MDN_API}/Window/requestAnimationFrame`,
  Iterable: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols',
  IterableIterator: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols',
  Iterator: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols',
  PromiseLike: `${MDN_JS}/Promise`,
  PropertyDescriptor: `${MDN_JS}/Object/defineProperty`,
  ReadonlyMap: `${MDN_JS}/Map`,
  ReadonlySet: `${MDN_JS}/Set`,
  Transferable: 'https://developer.mozilla.org/en-US/docs/Glossary/Transferable_objects',
}

/** Curated targets for Node.js types referenced through `@types/node`. */
const NODE_TYPES: Record<string, string> = {
  Buffer: 'https://nodejs.org/api/buffer.html#class-buffer',
  BufferEncoding: 'https://nodejs.org/api/buffer.html#buffers-and-character-encodings',
  IncomingMessage: 'https://nodejs.org/api/http.html#class-httpincomingmessage',
  ReadStream: 'https://nodejs.org/api/tty.html#class-ttyreadstream',
  Server: 'https://nodejs.org/api/http.html#class-httpserver',
  ServerResponse: 'https://nodejs.org/api/http.html#class-httpserverresponse',
  Timeout: 'https://nodejs.org/api/timers.html#class-timeout',
  WritableStream: 'https://nodejs.org/api/stream.html#class-streamwritable',
  WriteStream: 'https://nodejs.org/api/tty.html#class-ttywritestream',
}

/** Curated targets for third-party packages worth linking out to. */
const THIRD_PARTY: Record<string, Record<string, string>> = {
  rollup: {
    Plugin: 'https://rollupjs.org/plugin-development/',
  },
}

/**
 * Resolve the documentation URL for a type that lives outside the
 * hyperfrontend workspace — MDN for platform and language built-ins, the
 * TypeScript handbook for utility types, and nodejs.org for Node types.
 *
 * @param packageName - The package TypeDoc attributed the reference to
 * @param typeName - The referenced type's name
 * @returns The external documentation URL, or undefined when none is curated
 */
export function getExternalTypeHref(packageName: string, typeName: string): string | undefined {
  const name = typeName.replace(/^globalThis\./, '')

  if (packageName === 'typescript') {
    if (JS_BUILTINS.has(name)) return `${MDN_JS}/${name}`
    if (WEB_APIS.has(name) || /^HTML\w*Element$/.test(name)) return `${MDN_API}/${name}`
    if (TS_UTILITIES[name]) return `${TS_UTILITY_TYPES}#${TS_UTILITIES[name]}`
    return TS_SPECIAL[name]
  }

  if (packageName === '@types/node') {
    return NODE_TYPES[name]
  }

  return THIRD_PARTY[packageName]?.[name]
}
