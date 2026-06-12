import ts from 'typescript'
import { join } from '@hyperfrontend/project-scope/core'

/**
 * Parses a bundled chunk's source into a `ts.SourceFile`.
 *
 * Always parses as plain JavaScript with parent pointers set, so callers can
 * inspect each node's lexical context (member-access position, declaration
 * names) during the dead-export analysis. One source file is materialized per
 * call and released by the caller before the next, keeping the memory profile
 * flat across a whole `_dependencies/` tree.
 *
 * @param source - Raw chunk source text.
 * @returns The parsed source file with parent nodes populated.
 *
 * @example Parsing a chunk before analysis
 * ```typescript
 * const sourceFile = parseChunk("export { a };\nconst a = 1")
 * ```
 */
export const parseChunk = (source: string): ts.SourceFile =>
  ts.createSourceFile('chunk.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)

/**
 * Resolves a module specifier to the absolute chunk path it targets, or `null`
 * when the specifier is not a relative chunk reference.
 *
 * Only specifiers starting with `.` are real edges into the `_dependencies/`
 * tree; bare and node-builtin specifiers resolve to `null` and are ignored by
 * reachability and usage analysis alike.
 *
 * @param importerDir - Absolute directory of the file containing the specifier.
 * @param specifier - The raw module specifier string.
 * @returns The absolute resolved path, or `null` for non-relative specifiers.
 *
 * @example Resolving a sibling chunk reference
 * ```typescript
 * resolveRelativeTarget('/dist/libs/foo/_dependencies/a', '../b/index.esm.js')
 * // => '/dist/libs/foo/_dependencies/b/index.esm.js'
 * ```
 */
export const resolveRelativeTarget = (importerDir: string, specifier: string): string | null =>
  specifier.startsWith('.') ? join(importerDir, specifier) : null

/**
 * Returns the literal specifier of a `require('…')` call expression, or `null`
 * when the node is not a single-string-literal `require` call.
 *
 * @param node - Any AST node.
 * @returns The required specifier string, or `null`.
 *
 * @example Extracting a CJS chunk dependency
 * ```typescript
 * // for the call node in `var x = require('./dep/index.cjs.js')`
 * getRequireSpecifier(callNode) // => './dep/index.cjs.js'
 * ```
 */
export const getRequireSpecifier = (node: ts.Node): string | null => {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'require' || node.arguments.length !== 1)
    return null
  const arg = <ts.Expression>node.arguments[0]
  return ts.isStringLiteralLike(arg) ? arg.text : null
}
