import { builtinModules } from 'node:module'

// compat: node<18.6 module.isBuiltin arrived in Node 18.6, so the check is spelled over builtinModules until the floor passes
/**
 * Reports whether an import specifier names a Node.js core module, with or
 * without the `node:` scheme.
 *
 * @param specifier - The import specifier being resolved.
 * @returns `true` for a core module such as `fs`, `node:fs` or `fs/promises`.
 *
 * @example Keeping core modules external
 * ```typescript
 * isNodeBuiltin('node:path') // => true
 * isNodeBuiltin('rollup') // => false
 * ```
 */
export const isNodeBuiltin = (specifier: string): boolean => specifier.startsWith('node:') || builtinModules.includes(specifier)
