/**
 * Test material lives in code, never in files at rest: a spec's inputs are held in a
 * `__test-utils__` module and handed over as text, or written to a temporary directory while the
 * spec runs. The check runs once, from the workspace's own `package.json`.
 *
 * @module rules/workspace/no-test-fixtures
 */

import type { JsonTreeNode } from '@hyperfrontend/linter'
import type { SweptEntry } from './shared/sweep.ts'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { wholeDocument } from '@hyperfrontend/linter/helpers'
import { sweep } from './shared/sweep.ts'

/** Directory names that mean test material, compared once case, underscores, hyphens and dots are dropped. */
const MATERIAL_DIRECTORIES = [
  'fixture',
  'fixtures',
  'testfixture',
  'testfixtures',
  'testdata',
  'testfiles',
  'testinput',
  'testinputs',
  'testassets',
  'golden',
  'goldens',
  'goldenfiles',
]

/** The directory Jest and Vitest write snapshot files to. */
const SNAPSHOTS = '__snapshots__'

/** Name segments that mark a file as test material, as in `user.fixture.json` or `parse.golden.txt`. */
const MATERIAL_SEGMENTS = ['fixture', 'fixtures', 'golden']

/** Extensions that mark a file as test material whatever its name. */
const MATERIAL_EXTENSIONS = ['snap', 'golden']

/** Extensions of the code modules a `__test-utils__` directory may hold. */
const CODE_EXTENSIONS = ['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs']

/** The directory that holds test helpers and test data as code. */
const TEST_UTILS = '__test-utils__'

/**
 * A name reduced to the letters and digits that carry its meaning.
 *
 * @param name - A file or directory name
 * @returns The name lowercased, without underscores, hyphens or dots
 */
const normalised = (name: string): string =>
  [...name.toLowerCase()].filter((character) => character !== '-' && character !== '_' && character !== '.').join('')

/**
 * Why an entry is test material at rest, or `null` when it is not.
 *
 * @param entry - The entry the sweep reached
 * @returns The reason, as the message phrases it
 */
function materialReason(entry: SweptEntry): string | null {
  if (entry.directory) {
    return entry.name === SNAPSHOTS || MATERIAL_DIRECTORIES.includes(normalised(entry.name)) ? 'a directory named for test material' : null
  }
  const segments = entry.name.toLowerCase().split('.')
  const extension = segments.length > 1 ? segments[segments.length - 1] : ''
  if (MATERIAL_EXTENSIONS.includes(extension) || segments.slice(1, -1).some((segment) => MATERIAL_SEGMENTS.includes(segment))) {
    return 'a file named as test material'
  }
  if (entry.segments.includes(TEST_UTILS) && !CODE_EXTENSIONS.includes(extension)) {
    return `a file other than a code module inside ${TEST_UTILS}`
  }
  return null
}

/** One entry of test material at rest. */
interface MaterialAtRest {
  /** Its POSIX path relative to the workspace root. */
  readonly path: string
  /** Why it counts as test material, as the message phrases it. */
  readonly reason: string
}

/**
 * Every entry below a root that is test material at rest, with the reason; a reported directory is not entered.
 *
 * @param root - The workspace root
 * @returns The entries in walk order
 */
function materialAtRest(root: string): MaterialAtRest[] {
  const found: MaterialAtRest[] = []
  sweep(root, (entry) => {
    const reason = materialReason(entry)
    if (reason === null) return true
    found.push({ path: entry.path, reason })
    return false
  })
  return found
}

export default defineRule<undefined, JsonTreeNode>({
  id: 'workspace/no-test-fixtures',
  language: 'json',
  fixable: false,
  create(context) {
    const directory = dirname(context.file.path)
    if (basename(context.file.path) !== 'package.json' || !existsSync(join(directory, 'nx.json'))) return {}
    return {
      document() {
        for (const { path, reason } of materialAtRest(directory)) {
          context.report({
            ...wholeDocument(context.file),
            message: `Test material belongs in code, not in files at rest. Found '${path}', ${reason}: hold its contents in a ${TEST_UTILS} module and hand them to the spec as text, or write them to a temporary directory while it runs.`,
          })
        }
      },
    }
  },
})
