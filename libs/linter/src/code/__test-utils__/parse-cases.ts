/**
 * The sources the parser specs read, each with the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/parse-cases
 */

import { BOM } from './cases/bom'
import { CLASSES } from './cases/classes'
import { COMMENT_ONLY } from './cases/comment-only'
import { COMMENTS } from './cases/comments'
import { COMMONJS } from './cases/commonjs'
import { CRLF } from './cases/crlf'
import { DECORATED_EXPORT } from './cases/decorated-export'
import { DEFAULT_ABSTRACT } from './cases/default-abstract'
import { DEFAULT_ASYNC } from './cases/default-async'
import { DEFAULT_CLASS } from './cases/default-class'
import { DEFAULT_EXPRESSION } from './cases/default-expression'
import { DEFAULT_INTERFACE } from './cases/default-interface'
import { EDGES } from './cases/edges'
import { ELEMENTS } from './cases/elements'
import { EMPTY } from './cases/empty'
import { ESM } from './cases/esm'
import { EXPRESSIONS } from './cases/expressions'
import { MODULES } from './cases/modules'
import { SCRIPT } from './cases/script'
import { STATEMENTS } from './cases/statements'
import { TYPES } from './cases/types'
import { WHITESPACE } from './cases/whitespace'

/** One source and the tree the reference parser builds from it. */
export interface ParseCase {
  /** The file name, whose extension picks the language. */
  readonly name: string
  /** The source text. */
  readonly source: string
  /** The reference tree, one line per node. */
  readonly tree: string
}

/** Every source, in file-name order. */
export const PARSE_CASES: readonly ParseCase[] = [
  BOM,
  CLASSES,
  COMMENT_ONLY,
  COMMENTS,
  COMMONJS,
  CRLF,
  DECORATED_EXPORT,
  DEFAULT_ABSTRACT,
  DEFAULT_ASYNC,
  DEFAULT_CLASS,
  DEFAULT_EXPRESSION,
  DEFAULT_INTERFACE,
  EDGES,
  ELEMENTS,
  EMPTY,
  ESM,
  EXPRESSIONS,
  MODULES,
  SCRIPT,
  STATEMENTS,
  TYPES,
  WHITESPACE,
]
