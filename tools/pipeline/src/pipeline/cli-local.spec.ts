import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { gitIn, LIBRARIES, runPipeline } from './__test-utils__/command-line'

/** What a local run answered and left behind. */
interface LocalRun {
  /** The exit code. */
  readonly status: number | null
  /** Standard output after the sentence describing the plan, with every duration written as `0s`. */
  readonly lines: string[]
  /** Whether the test of the first library left a log, which it does once it started. */
  readonly tested: boolean
}

const fixture = useTempDir({ prefix: 'pipeline-local-', tree: LIBRARIES })

/**
 * Runs the whole plan of the fixture locally.
 *
 * @param fails - The task that fails, or none
 * @returns The exit code, what was printed, and whether the test started
 */
function runLocal(fails: string): LocalRun {
  gitIn(fixture.path, 'init', '-q')
  const run = runPipeline(fixture.path, ['run', '--local', '--all', '--environment', 'linux'], { FIXTURE_FAILS: fails })
  return {
    status: run.status,
    lines: run.stdout
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.replace(/ {2}\d[\dms. ]*s {2}\[/, '  0s  [').replace(/ in \d[\dms. ]*s: /, ' in 0s: ')),
    tested: existsSync(join(fixture.path, '.hf', 'pipeline', 'logs', 'lib-a__test.log')),
  }
}

describe('pipeline run --local', () => {
  it('ends after the first stage with a failure, showing its excerpt and every later cell as not run', () => {
    expect(runLocal('lib-a:lint')).toEqual({
      status: 1,
      lines: [
        'stage 1 of 3: lint (2 tasks)',
        '✗ lib-a:lint  0s  [1/5]',
        '    ran lib-a:lint',
        '    log: .hf/pipeline/logs/lib-a__lint.log',
        '✓ lib-b:lint  0s  [2/5]',
        'stage 1 (lint) did not succeed: 3 tasks not run',
        '',
        '       lint  test  build',
        'lib-a  ✗     ·     ·',
        'lib-b  ✓           ·',
        '✓ passed  ✗ failed  - skipped  · not run',
        '',
        '5 tasks in 0s: 1 passed, 1 failed, 3 not run',
        '✗ lib-a:lint  .hf/pipeline/logs/lib-a__lint.log',
        '',
      ],
      tested: false,
    })
  })

  it("prints a line per task and the matrix, and no task's own output, when nothing fails", () => {
    expect(runLocal('')).toEqual({
      status: 0,
      lines: [
        'stage 1 of 3: lint (2 tasks)',
        '✓ lib-a:lint  0s  [1/5]',
        '✓ lib-b:lint  0s  [2/5]',
        'stage 2 of 3: test (1 task)',
        '✓ lib-a:test  0s  [3/5]',
        'stage 3 of 3: build (2 tasks)',
        '✓ lib-a:build  0s  [4/5]',
        '✓ lib-b:build  0s  [5/5]',
        '',
        '       lint  test  build',
        'lib-a  ✓     ✓     ✓',
        'lib-b  ✓           ✓',
        '✓ passed  ✗ failed  - skipped  · not run',
        '',
        '5 tasks in 0s: 5 passed',
        '',
      ],
      tested: true,
    })
  })
})
