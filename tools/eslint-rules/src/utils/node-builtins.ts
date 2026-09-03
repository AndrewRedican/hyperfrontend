import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * List of Node.js built-in module names.
 * These modules can be imported with or without the `node:` prefix.
 */
export const NODE_BUILTIN_MODULES: ReadonlySet<string> = createSet([
  'assert',
  'async_hooks',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'diagnostics_channel',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'os',
  'path',
  'perf_hooks',
  'process',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'timers',
  'tls',
  'trace_events',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
])

/**
 * Checks if an import source is a Node.js built-in module without the `node:` prefix.
 *
 * @param source - The import source string.
 * @returns True if the source is a bare Node.js built-in module.
 */
export function isNodeBuiltinWithoutPrefix(source: string): boolean {
  if (source.startsWith('node:')) {
    return false
  }

  const moduleName = source.split('/')[0]
  // why: moduleName is always defined from split
  return NODE_BUILTIN_MODULES.has(moduleName ?? '')
}

/**
 * Adds the `node:` prefix to a module source.
 *
 * @param source - The import source string.
 * @returns The source with `node:` prefix.
 */
export function addNodePrefix(source: string): string {
  return `node:${source}`
}
