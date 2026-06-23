import ts from 'typescript'
import { join } from '@hyperfrontend/project-scope/core'

/**
 * Parses a bundled chunk's source into a `ts.SourceFile`.
 *
 * Always parses as plain JavaScript with parent pointers set, so callers can
 * inspect each node's lexical context (member-access position, declaration
 * names) during the dead-export analysis.
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

/** `require('F').Export` — a single export selected by static property access. */
export interface RequirePropShape {
  /** Discriminant. */
  kind: 'prop'
  /** The member node, for classifying how the selected export is then used. */
  member: ts.PropertyAccessExpression
  /** The selected export name. */
  name: string
}

/** `require('F')['Export']` — a single export selected by string-literal element access. */
export interface RequireElemStaticShape {
  /** Discriminant. */
  kind: 'elem-static'
  /** The member node, for classifying how the selected export is then used. */
  member: ts.ElementAccessExpression
  /** The selected export name. */
  name: string
}

/** `require('F')[k]` — a computed element access that could select any export. */
export interface RequireElemDynamicShape {
  /** Discriminant. */
  kind: 'elem-dynamic'
}

/** A bare `require('F');` expression statement that binds nothing — side-effect only. */
export interface RequireSideEffectShape {
  /** Discriminant. */
  kind: 'side-effect'
}

/** `var dep = require('F')` — the whole module bound to a local identifier. */
export interface RequireNsBindingShape {
  /** Discriminant. */
  kind: 'ns-binding'
  /** The bound local identifier. */
  name: ts.Identifier
}

/** `var { … } = require('F')` — the module destructured into named locals. */
export interface RequireDestructureShape {
  /** Discriminant. */
  kind: 'destructure'
  /** The binding pattern destructured from the require result. */
  pattern: ts.ObjectBindingPattern
}

/** Any other position (call argument, spread, reassignment, …) — consumes the module wholesale. */
export interface RequireEscapeShape {
  /** Discriminant. */
  kind: 'escape'
}

/**
 * The syntactic shape of how a `require('…')` call's result is consumed,
 * derived from the call's parent node.
 */
export type RequireBindingShape =
  | RequirePropShape
  | RequireElemStaticShape
  | RequireElemDynamicShape
  | RequireSideEffectShape
  | RequireNsBindingShape
  | RequireDestructureShape
  | RequireEscapeShape

/**
 * Classifies how a `require('…')` call's result is consumed, by inspecting the
 * call's parent node.
 *
 * A bare `require('F');` statement is classified as `side-effect`, not `escape`.
 * A `require('F').#priv` (not valid JS) does not match `prop` and falls through
 * to `escape`.
 *
 * @param call - The `require('…')` call expression to classify.
 * @returns The discriminated shape of the call's binding position.
 *
 * @example A destructured require
 * ```typescript
 * // for the call in `var { a, b } = require('./x.cjs.js')`
 * classifyRequireBinding(call) // => { kind: 'destructure', pattern: … }
 * ```
 */
export const classifyRequireBinding = (call: ts.CallExpression): RequireBindingShape => {
  const parent = call.parent
  if (ts.isPropertyAccessExpression(parent) && parent.expression === call && ts.isIdentifier(parent.name))
    return { kind: 'prop', member: parent, name: parent.name.text }
  if (ts.isElementAccessExpression(parent) && parent.expression === call)
    return ts.isStringLiteralLike(parent.argumentExpression)
      ? { kind: 'elem-static', member: parent, name: parent.argumentExpression.text }
      : { kind: 'elem-dynamic' }
  if (ts.isExpressionStatement(parent)) return { kind: 'side-effect' }
  if (!ts.isVariableDeclaration(parent) || parent.initializer !== call) return { kind: 'escape' }
  if (ts.isIdentifier(parent.name)) return { kind: 'ns-binding', name: parent.name }
  if (ts.isObjectBindingPattern(parent.name)) return { kind: 'destructure', pattern: parent.name }
  return { kind: 'escape' }
}
