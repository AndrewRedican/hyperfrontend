/**
 * What rules ask beyond the tree: tokens and comments around a node, children, scopes and
 * variables, JSON properties, positions, globs, merged fixes, and parsing another file.
 *
 * @module @hyperfrontend/linter/helpers
 */

export type { ParsedCode, ParseError, SourceType } from '../code/parse'
export type { Glob } from '../files/glob'
export type { JsonStringNode } from '../rules/shared/json'
export type { ScopeAnalysis } from '../scope/analysis'
export type { Definition, Reference, Scope, Variable } from '../scope/model'
export { childrenOf } from '../code/children'
export { parseCode } from '../code/parse'
export { commentsBetween, isParenthesised, tokenAfter, tokenBefore, tokensBetween, tokenText } from '../code/source'
export { compileGlob, matchesAny } from '../files/glob'
export { isGlobalReference, referenceOf } from '../rules/javascript/shared/constant'
export { indentationAt, isString, propertyOf, rootObject, stringsUnder, wholeDocument } from '../rules/shared/json'
export { mergeEdits } from '../rules/typescript/shared/edits'
export { findVariable, scopeAnalysisOf, scopeOf } from '../scope/analysis'
export { lineText, positionAt } from '../text/lines'
