/**
 * The documents the Markdown parser specs read, each with the tree the reference parser builds from it.
 *
 * @module markdown/__test-utils__/parse-cases
 */

import { AUTOLINKS } from './cases/autolinks'
import { BLOCKS } from './cases/blocks'
import { CONTAINERS } from './cases/containers'
import { CRLF } from './cases/crlf'
import { EDGES } from './cases/edges'
import { INLINES } from './cases/inlines'
import { LISTS } from './cases/lists'
import { TABLES } from './cases/tables'

/** One document and the tree the reference parser builds from it. */
export interface ParseCase {
  /** The file name. */
  readonly name: string
  /** The document text. */
  readonly source: string
  /** The reference tree, one line per node. */
  readonly tree: string
}

/** Every document, in file-name order. */
export const PARSE_CASES: readonly ParseCase[] = [AUTOLINKS, BLOCKS, CONTAINERS, CRLF, EDGES, INLINES, LISTS, TABLES]
