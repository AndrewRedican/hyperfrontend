/**
 * A file holding more than one function stays within a line budget, a higher one for test files;
 * a single-purpose file may be as long as it needs.
 *
 * @module rules/workspace/max-file-lines
 */

import type { Node } from '../../code/model.ts'
import { defineRule } from '../../engine/rule.ts'

/** The rule's options. */
export interface MaxFileLinesOptions {
  /** The budget of an implementation file. */
  readonly maxLines?: number
  /** The budget of a test file. */
  readonly maxLinesTest?: number
}

/** A test file's name. */
const TEST_FILE = /\.(spec|test)\.[jt]sx?$/

export default defineRule<MaxFileLinesOptions | undefined, Node>({
  id: 'workspace/max-file-lines',
  language: 'code',
  fixable: false,
  create(context) {
    let functions = 0
    const count = (): void => {
      functions += 1
    }
    return {
      FunctionDeclaration: count,
      FunctionExpression: count,
      ArrowFunctionExpression: count,
      'Program:exit'() {
        const { file } = context
        const lines = file.lines.starts.length
        const max = TEST_FILE.test(file.path) ? (context.options?.maxLinesTest ?? 500) : (context.options?.maxLines ?? 300)
        if (functions < 2 || lines <= max) return
        context.report({
          start: 0,
          end: file.text.length,
          message: `File has ${lines} lines but the maximum allowed is ${max}. Consider splitting this file to improve separation of concerns.`,
        })
      },
    }
  },
})
