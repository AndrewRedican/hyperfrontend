import type { MatrixTask } from './matrix'
import { describe, expect, it } from '@hyperfrontend/testing'
import { Ending, markOf, matrixLines } from './matrix'

/**
 * Leaves text as it is, as plain output does.
 *
 * @param text - What a terminal would set apart
 * @returns The same text, unstyled
 */
function plain(text: string): string {
  return text
}

/**
 * A task of the matrix.
 *
 * @param id - `<project>:<target>`
 * @param stage - The stage it ran in
 * @param ending - How it ended
 * @returns The task, in the row of its project and the column of its target
 */
function task(id: string, stage: number, ending: Ending): MatrixTask {
  return { project: id.slice(0, id.indexOf(':')), target: id.slice(id.indexOf(':') + 1), stage, ending }
}

describe('markOf', () => {
  it('paints the mark of an ending in its style', () => {
    expect(markOf(Ending.Failed, (text, style) => `<${style}>${text}`)).toBe('<31>✗')
  })
})

describe('matrixLines', () => {
  it('heads with the targets in the order of their stages and rows the projects by name', () => {
    expect(
      matrixLines(
        [
          task('lib-util:build', 1, Ending.NotRun),
          task('lib-util:typecheck', 0, Ending.Passed),
          task('lib-core:typecheck', 0, Ending.Failed),
          task('lib-core:build', 1, Ending.Skipped),
        ],
        plain
      )
    ).toEqual([
      '          typecheck  build',
      'lib-core  ✗          -',
      'lib-util  ✓          ·',
      '✓ passed  ✗ failed  - skipped  · not run',
    ])
  })

  it('leaves the cell of a target a project does not have empty', () => {
    expect(matrixLines([task('a:lint', 0, Ending.Passed), task('b:test', 1, Ending.Passed)], plain).slice(0, 3)).toEqual([
      '   lint  test',
      'a  ✓',
      'b        ✓',
    ])
  })

  it('shows the gravest ending of the tasks sharing a cell', () => {
    const tasks = [
      { project: 'lib', target: 'e2e', stage: 0, ending: Ending.Passed },
      { project: 'lib', target: 'e2e', stage: 0, ending: Ending.NotRun },
      { project: 'lib', target: 'e2e', stage: 0, ending: Ending.Skipped },
    ]
    expect(matrixLines(tasks, plain)[1]).toBe('lib  -')
  })

  it('pads a cell by what a reader sees, not by the style around its mark', () => {
    const tasks = [task('a:lint', 0, Ending.Passed), task('a:test', 1, Ending.Passed)]
    expect(matrixLines(tasks, (text) => `[${text}]`)[1]).toBe('a  [✓]     [✓]')
  })
})
