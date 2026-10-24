import type { TempDir } from '@hyperfrontend/testing/fs'
import { existsSync } from 'node:fs'
import { fromEntries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import rule from './no-test-fixtures.ts'

/**
 * A disposable workspace root holding the named files, each empty.
 *
 * @param prefix - The temporary directory's prefix
 * @param files - POSIX paths relative to the root
 * @returns The root
 */
function workspace(prefix: string, files: readonly string[]): TempDir {
  return createTempDir({ prefix, tree: fromEntries(files.map((file) => [file, ''])) })
}

// why: the rule walks the whole directory tree below the manifest, so each case is a disposable workspace root in the temporary directory rather than a tree inside this one.
const CLEAN = workspace('lint-material-clean-', [
  'nx.json',
  'LICENSE',
  'src/__test-utils__/sample-projects/minimal.ts',
  'src/__test-utils__/write-samples.mts',
  'src/test-fixtures.ts',
  'src/snapshots/take.ts',
  'node_modules/pkg/__fixtures__/a.json',
  '_/fixtures/notes.md',
])
const DIRTY = workspace('lint-material-dirty-', [
  'nx.json',
  'a.snap',
  'parse.golden',
  'user.Fixture.json',
  'lib/__fixtures__/plain/package.json',
  'lib/__fixtures__/plain/fixtures/nested.json',
  'lib/src/__snapshots__/parse.spec.ts.txt',
  'lib/src/__test-utils__/data.ts',
  'lib/src/__test-utils__/deep/sample.json',
  'lib/src/Test-Data/input.txt',
  'lib/src/golden_files/out.txt',
  'lib/src/fixtures/a.ts',
])
const OUTSIDE = workspace('lint-material-outside-', ['fixtures/a.json'])

const message = (path: string, reason: string): string =>
  `Test material belongs in code, not in files at rest. Found '${path}', ${reason}: hold its contents in a __test-utils__ module and hand them to the spec as text, or write them to a temporary directory while it runs.`
const directory = (path: string): { message: string; line: number; column: number } => ({
  message: message(path, 'a directory named for test material'),
  line: 1,
  column: 1,
})
const named = (path: string): { message: string; line: number; column: number } => ({
  message: message(path, 'a file named as test material'),
  line: 1,
  column: 1,
})

testRule(rule, {
  valid: [
    { name: 'a manifest outside the workspace root', path: OUTSIDE.resolve('package.json'), text: '{}' },
    { name: 'a file that is no manifest at the workspace root', path: DIRTY.resolve('nx.json'), text: '{}' },
    {
      name: 'a root whose test data is code under __test-utils__, with fixture-like names only on code modules and skipped trees',
      path: CLEAN.resolve('package.json'),
      text: '{}',
    },
  ],
  invalid: [
    {
      name: 'the root manifest, once per directory or file of test material, never inside a reported directory',
      path: DIRTY.resolve('package.json'),
      text: '{}\n',
      errors: [
        named('a.snap'),
        directory('lib/__fixtures__'),
        directory('lib/src/Test-Data'),
        directory('lib/src/__snapshots__'),
        {
          message: message('lib/src/__test-utils__/deep/sample.json', 'a file other than a code module inside __test-utils__'),
          line: 1,
          column: 1,
        },
        directory('lib/src/fixtures'),
        directory('lib/src/golden_files'),
        named('parse.golden'),
        named('user.Fixture.json'),
      ],
    },
  ],
})

describe('the disposable workspace roots', () => {
  it('are removed once the cases have run', () => {
    for (const root of [CLEAN, DIRTY, OUTSIDE]) root.remove()
    expect([CLEAN, DIRTY, OUTSIDE].some((root) => existsSync(root.path))).toBe(false)
  })
})
