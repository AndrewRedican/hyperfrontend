/**
 * The sources the control-flow specs read, each with the paths and segments recorded for it.
 *
 * @module flow/__test-utils__/analysis-cases
 */

import { CONTROL } from './cases/control'
import { EXCEPTIONS } from './cases/exceptions'
import { EXPRESSIONS } from './cases/expressions'

/** One source and the control flow recorded for it. */
export interface FlowCase {
  /** The file name, whose extension picks the language. */
  readonly name: string
  /** The source text. */
  readonly source: string
  /** The recorded flow, one line per path, segment and switch case. */
  readonly flow: string
}

/** Every source, in file-name order. */
export const ANALYSIS_CASES: readonly FlowCase[] = [CONTROL, EXCEPTIONS, EXPRESSIONS]
