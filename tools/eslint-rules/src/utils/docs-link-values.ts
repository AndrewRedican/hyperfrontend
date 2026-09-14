/**
 * What an inline code span is, before anything is looked up.
 *
 * A span in package prose is either a value the reader copies (a literal, a
 * file name, a command line, an expression) or a name the reader might look
 * up. Nothing on the site documents a value, so telling the two apart is the
 * first thing a linking rule does, and no index is needed for it.
 *
 * @module utils/docs-link-values
 */

import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** Language keywords and literal values, which are syntax rather than names. */
const KEYWORDS = createSet([
  'true',
  'false',
  'null',
  'undefined',
  'NaN',
  'Infinity',
  'this',
  'void',
  'typeof',
  'instanceof',
  'new',
  'async',
  'await',
  'yield',
  'import',
  'export',
  'default',
  'class',
  'function',
  'const',
  'let',
  'var',
  'return',
  'throw',
  'try',
  'catch',
  'finally',
  'if',
  'else',
  'switch',
  'case',
  'for',
  'while',
  'do',
  'break',
  'continue',
  'in',
  'of',
  'delete',
  'super',
  'extends',
  'implements',
  'interface',
  'type',
  'enum',
  'namespace',
  'declare',
  'readonly',
  'keyof',
  'infer',
  'satisfies',
  'as',
  'is',
  'string',
  'number',
  'boolean',
  'object',
  'unknown',
  'any',
  'never',
  'symbol',
  'bigint',
])

/**
 * Names the runtime defines, which the site cannot document and the reader
 * already knows where to find: ECMAScript's globals, the web platform's, and
 * Node's modules and globals.
 */
const PLATFORM_GLOBALS = createSet([
  'Array',
  'ArrayBuffer',
  'SharedArrayBuffer',
  'Atomics',
  'BigInt',
  'Boolean',
  'DataView',
  'Date',
  'Error',
  'AggregateError',
  'EvalError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'TypeError',
  'URIError',
  'Function',
  'Map',
  'WeakMap',
  'Set',
  'WeakSet',
  'WeakRef',
  'FinalizationRegistry',
  'Math',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'Reflect',
  'RegExp',
  'String',
  'Symbol',
  'JSON',
  'Intl',
  'globalThis',
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
  'Iterator',
  'Generator',
  'AsyncGenerator',
  'window',
  'document',
  'navigator',
  'console',
  'crypto',
  'webcrypto',
  'subtle',
  'CryptoKey',
  'SubtleCrypto',
  'fetch',
  'Request',
  'Response',
  'Headers',
  'URL',
  'URLSearchParams',
  'TextEncoder',
  'TextDecoder',
  'Blob',
  'File',
  'FormData',
  'Worker',
  'SharedWorker',
  'ServiceWorker',
  'MessageChannel',
  'MessagePort',
  'MessageEvent',
  'BroadcastChannel',
  'postMessage',
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'queueMicrotask',
  'structuredClone',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'ResizeObserver',
  'IntersectionObserver',
  'MutationObserver',
  'PerformanceObserver',
  'AbortController',
  'AbortSignal',
  'Event',
  'EventTarget',
  'CustomEvent',
  'ErrorEvent',
  'PromiseRejectionEvent',
  'Element',
  'HTMLElement',
  'HTMLIFrameElement',
  'HTMLScriptElement',
  'Node',
  'Document',
  'DocumentFragment',
  'ShadowRoot',
  'Window',
  'WebSocket',
  'XMLHttpRequest',
  'AudioContext',
  'OfflineAudioContext',
  'CSS',
  'CSSStyleSheet',
  'matchMedia',
  'history',
  'location',
  'performance',
  'screen',
  'process',
  'Buffer',
  'require',
  'module',
  'exports',
  'global',
  'worker_threads',
  'child_process',
  'fs',
  'path',
  'os',
  'http',
  'https',
  'net',
  'stream',
  'events',
  'util',
  'url',
  'zlib',
  'readline',
  'tty',
  'assert',
  'timers',
  'perf_hooks',
  'EventEmitter',
  'Readable',
  'Writable',
  'Duplex',
  'Transform',
  'PassThrough',
  'atob',
  'btoa',
  'FileReader',
  'createElement',
  'appendChild',
  'removeChild',
  'querySelector',
  'querySelectorAll',
  'getElementById',
  'innerHTML',
  'textContent',
  'iframe',
  'script',
  'style',
  'body',
  'head',
  'html',
  'div',
  'span',
  'canvas',
  'video',
  'audio',
  'img',
])

/** Shell commands a code span may open with, marking it as a command line rather than a name. */
const COMMANDS = /^(npx|npm|pnpm|yarn|node|nx|hf|git|cd|ls|cat|curl|docker|bash|sh|tsc|vite|rollup)(\s|$)/

/** File extensions that mark a code span as a file name. */
const FILE_EXTENSION = /\.(m?[jt]sx?|c?js|json|md|ya?ml|html?|css|tgz|txt|svg|png|gif|webp|mp4|lock|toml|xml)$/i

/** Characters that only appear in an expression, a literal or a pattern, never in a bare name. */
const EXPRESSION_CHARACTERS = /[\s()[\]{}<>=|*!?+&;,\\'"`#%^~$]/

/** A hyphenated lowercase word, which is how event names, reasons and enum values are spelled. */
const KEBAB_VALUE = /^[a-z][a-z0-9]*-[a-z0-9-]*[a-z0-9]$/

/** One segment of a name: an identifier. */
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/**
 * Whether a span is a bare identifier, optionally followed by member accesses.
 *
 * @param text - The span's text.
 * @returns True for `name` and `name.member.member`, false for anything else.
 */
export function isDottedName(text: string): boolean {
  return text.split('.').every((segment) => IDENTIFIER.test(segment))
}

/**
 * Decides whether a code span is a value the reader copies rather than a name
 * the reader might look up.
 *
 * @param text - The span's text.
 * @returns The reason it is exempt, or null when it looks like a name.
 */
export function exemptionOf(text: string): string | null {
  if (KEYWORDS.has(text)) {
    return 'keyword'
  }
  if (text.length === 1) {
    return 'character'
  }
  if (/^-?\d/.test(text)) {
    return 'number'
  }
  if (/^["'`]/.test(text)) {
    return 'quoted'
  }
  if (/^-/.test(text)) {
    return 'flag'
  }
  if (COMMANDS.test(text)) {
    return 'command'
  }
  if (FILE_EXTENSION.test(text)) {
    return 'file'
  }
  if (/^\./.test(text) || /^~/.test(text) || text.endsWith('/') || (/\//.test(text) && !/^[@/]/.test(text))) {
    return 'path'
  }
  if (EXPRESSION_CHARACTERS.test(text)) {
    return 'expression'
  }
  if (text.startsWith('__')) {
    return 'reserved'
  }
  if (KEBAB_VALUE.test(text)) {
    return 'value'
  }
  if (!text.startsWith('@') && !text.startsWith('/') && !isDottedName(text)) {
    return 'not-a-name'
  }
  const head = text.split('.')[0] ?? ''
  if (PLATFORM_GLOBALS.has(head)) {
    return 'platform'
  }
  return null
}
