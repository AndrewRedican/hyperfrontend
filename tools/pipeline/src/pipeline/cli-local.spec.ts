import type { FileTree } from '@hyperfrontend/testing/fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'

/** The workspace these sources belong to. */
const WORKSPACE_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')

/** The hook the command line loads workspace sources through, as `--import` takes it. */
const ALIASES = pathToFileURL(resolve(WORKSPACE_ROOT, 'libs', 'workspace', 'src', 'hooks', 'index.ts')).href

/** The pipeline's command line. */
const PIPELINE = resolve(WORKSPACE_ROOT, 'tools', 'pipeline', 'bin', 'pipeline.ts')

/** What stands in for the workspace's command line: it says which task it ran and fails the one the environment names. */
const STUB = [
  'const id = process.argv[3]',
  'process.stdout.write(`ran ${id}\\n`)',
  "process.exit(id === process.env['FIXTURE_FAILS'] ? 1 : 0)",
  '',
].join('\n')

/** Two libraries with a lint and a build each, one of them tested, and the entries every task of a plan starts. */
const TREE: FileTree = {
  'hf.json': {},
  'package.json': { name: '@fixture/workspace', private: true, type: 'module' },
  '.gitignore': '.hf\n',
  'libs/workspace/src/hooks/index.ts': 'export {}\n',
  'libs/workspace/bin/hf.mjs': STUB,
  'libs/a/project.json': { name: 'lib-a', projectType: 'library', sourceRoot: 'libs/a/src', targets: { lint: {}, test: {}, build: {} } },
  'libs/a/package.json': { name: '@fixture/a', version: '0.0.0', private: true },
  'libs/a/src/index.ts': 'export const a = 1\n',
  'libs/b/project.json': { name: 'lib-b', projectType: 'library', sourceRoot: 'libs/b/src', targets: { lint: {}, build: {} } },
  'libs/b/package.json': { name: '@fixture/b', version: '0.0.0', private: true },
  'libs/b/src/index.ts': 'export const b = 1\n',
}

/** What a local run answered and left behind. */
interface LocalRun {
  /** The exit code. */
  readonly status: number | null
  /** Standard output after the sentence describing the plan, with every duration written as `0s`. */
  readonly lines: string[]
  /** Whether the test of the first library left a log, which it does once it started. */
  readonly tested: boolean
}

const fixture = useTempDir({ prefix: 'pipeline-local-', tree: TREE })

/**
 * Runs the whole plan of the fixture locally.
 *
 * @param fails - The task that fails, or none
 * @returns The exit code, what was printed, and whether the test started
 */
function runLocal(fails: string): LocalRun {
  execFileSync('git', ['init', '-q'], { cwd: fixture.path })
  const run = spawnSync(process.execPath, ['--import', ALIASES, PIPELINE, 'run', '--local', '--all', '--environment', 'linux'], {
    cwd: fixture.path,
    encoding: 'utf8',
    env: { ...process.env, FIXTURE_FAILS: fails },
  })
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
