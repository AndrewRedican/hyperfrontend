/**
 * The sources the scope specs read, each with the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/analysis-cases
 */

import { COMMONJS } from './cases/commonjs'
import { DECLARATIONS } from './cases/declarations'
import { DEFAULT_CLASS } from './cases/default-class'
import { ELEMENTS } from './cases/elements'
import { EXPORT_ASSIGNMENT } from './cases/export-assignment'
import { EXPORT_EXPRESSION } from './cases/export-expression'
import { NO_PRAGMA } from './cases/no-pragma'
import { PRAGMA } from './cases/pragma'
import { SCRIPT } from './cases/script'
import { STRICT_SCRIPT } from './cases/strict-script'
import { TYPES } from './cases/types'
import { UNDECLARED_PRAGMA } from './cases/undeclared-pragma'
import { VALUES } from './cases/values'

/** One source and the scopes the reference scope manager finds in it. */
export interface ScopeCase {
  /** The file name, whose extension picks the language. */
  readonly name: string
  /** The source text. */
  readonly source: string
  /** The recorded scopes, one line per scope, variable and reference. */
  readonly scopes: string
}

/** Every source, by file name. */
export const ANALYSIS_CASES = {
  'commonjs.cjs': COMMONJS,
  'declarations.ts': DECLARATIONS,
  'default-class.ts': DEFAULT_CLASS,
  'elements.tsx': ELEMENTS,
  'export-assignment.ts': EXPORT_ASSIGNMENT,
  'export-expression.ts': EXPORT_EXPRESSION,
  'no-pragma.tsx': NO_PRAGMA,
  'pragma.tsx': PRAGMA,
  'script.ts': SCRIPT,
  'strict-script.ts': STRICT_SCRIPT,
  'types.ts': TYPES,
  'undeclared-pragma.tsx': UNDECLARED_PRAGMA,
  'values.ts': VALUES,
} satisfies Readonly<Record<string, ScopeCase>>
