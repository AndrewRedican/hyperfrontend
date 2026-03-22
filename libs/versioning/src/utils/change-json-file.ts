/**
 * JSON File Transformation Utility
 *
 * Provides a helper for transforming JSON files using the VFS Tree `changeFile()` pattern.
 * This reduces boilerplate by handling read, parse, transform, stringify, and write in one call.
 */

import type { Tree } from '@hyperfrontend/project-scope'
import { parse, stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * Options for JSON file transformation.
 */
export interface ChangeJsonFileOptions {
  /** Indentation level for stringification (default: 2) */
  readonly indent?: number

  /** Whether to add trailing newline (default: true) */
  readonly trailingNewline?: boolean
}

/**
 * Default options for JSON file transformation.
 */
export const DEFAULT_CHANGE_JSON_FILE_OPTIONS: Required<ChangeJsonFileOptions> = {
  indent: 2,
  trailingNewline: true,
}

/**
 * Transforms a JSON file using the VFS Tree `changeFile()` pattern.
 *
 * This helper encapsulates the common read-parse-transform-stringify-write pattern,
 * reducing boilerplate and ensuring consistent JSON handling.
 *
 * @param tree - Virtual file system tree
 * @param path - Path to the JSON file
 * @param transform - Transformation function that receives the parsed JSON and returns modified JSON
 * @param options - Optional formatting options
 * @throws {Error} If the file doesn't exist (propagated from tree.changeFile)
 *
 * @example
 * ```typescript
 * // Update package.json version
 * changeJsonFile<{ version: string }>(tree, 'package.json', (pkg) => {
 *   pkg.version = '2.0.0'
 *   return pkg
 * })
 *
 * // Update multiple fields
 * changeJsonFile(tree, 'tsconfig.json', (config) => {
 *   config.compilerOptions.strict = true
 *   return config
 * })
 * ```
 */
export function changeJsonFile<T>(tree: Tree, path: string, transform: (data: T) => T, options: ChangeJsonFileOptions = {}): void {
  const opts = { ...DEFAULT_CHANGE_JSON_FILE_OPTIONS, ...options }

  tree.changeFile(path, (content) => {
    const data = <T>parse(content.toString())
    const updated = transform(data)
    const serialized = stringify(updated, null, opts.indent)
    const result = opts.trailingNewline ? serialized + '\n' : serialized
    return Buffer.from(result)
  })
}
