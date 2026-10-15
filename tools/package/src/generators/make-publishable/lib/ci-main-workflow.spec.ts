import { posix } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { hasCoverageEntry, registerLibraryCoverageUpload } from './ci-main-workflow'
import { deriveLibraryFacts } from './library-facts'

/**
 * The facts of a package at a root.
 *
 * @param projectRoot - Workspace-relative project root
 * @returns Facts derived from that root alone
 */
function at(projectRoot: string): ReturnType<typeof deriveLibraryFacts> {
  return deriveLibraryFacts({
    projectName: `lib-${projectRoot.split(posix.sep).slice(-1).join('')}`,
    projectRoot,
    packageName: `@hyperfrontend/${projectRoot.split(posix.sep).slice(-1).join('')}`,
    description: '',
    tags: [],
    exports: {},
    hasArchitecture: false,
  })
}

const BEFORE = ['        run: |', '          # Define library coverage mappings: flag:path', '          LIBS=(']

const LIBS = [
  '"builder:libs/builder"',
  '"questions:libs/questions"',
  '"versioning:libs/versioning"',
  '"data-utils:libs/utils/data"',
  '"json-utils:libs/utils/json"',
]

const AFTER = ['          )', '', '          for entry in "${LIBS[@]}"; do']

/**
 * A workflow listing the given entries.
 *
 * @param entries - The quoted entries
 * @returns The workflow text
 */
function workflow(entries: readonly string[]): string {
  return [...BEFORE, ...entries.map((entry) => `            ${entry}`), ...AFTER].join('\n')
}

describe('registerLibraryCoverageUpload', () => {
  it('lists a package alphabetically among the packages under libs', () => {
    expect(registerLibraryCoverageUpload(workflow(LIBS), at('libs/testing'))).toBe(
      workflow([...LIBS.slice(0, 2), '"testing:libs/testing"', ...LIBS.slice(2)])
    )
  })

  it('lists a utility alphabetically among the utilities', () => {
    expect(registerLibraryCoverageUpload(workflow(LIBS), at('libs/utils/function'))).toBe(
      workflow([...LIBS.slice(0, 4), '"function-utils:libs/utils/function"', ...LIBS.slice(4)])
    )
  })

  it('lists a utility sorting last at the end', () => {
    expect(registerLibraryCoverageUpload(workflow(LIBS), at('libs/utils/ui'))).toBe(workflow([...LIBS, '"ui-utils:libs/utils/ui"']))
  })

  it('lists the first utility after every package under libs', () => {
    expect(registerLibraryCoverageUpload(workflow(LIBS.slice(0, 3)), at('libs/utils/data'))).toBe(
      workflow([...LIBS.slice(0, 3), '"data-utils:libs/utils/data"'])
    )
  })

  it('lists a package under libs before the utilities when it sorts after every other', () => {
    expect(registerLibraryCoverageUpload(workflow(LIBS), at('libs/web-worker'))).toBe(
      workflow([...LIBS.slice(0, 3), '"web-worker:libs/web-worker"', ...LIBS.slice(3)])
    )
  })

  it('skips lines of the array that are not entries', () => {
    const odd = ['# a comment', '"broken', '"noseparator"', ...LIBS]
    expect(registerLibraryCoverageUpload(workflow(odd), at('libs/testing'))).toBe(
      workflow([...odd.slice(0, 5), '"testing:libs/testing"', ...odd.slice(5)])
    )
  })

  it('indents the first entry two deeper than the array when it is empty', () => {
    expect(registerLibraryCoverageUpload(workflow([]), at('libs/testing'))).toBe(workflow(['"testing:libs/testing"']))
  })

  it('changes nothing the second time', () => {
    const once = registerLibraryCoverageUpload(workflow(LIBS), at('libs/testing'))
    expect(registerLibraryCoverageUpload(once, at('libs/testing'))).toBe(once)
  })

  it('refuses a workflow without the array', () => {
    expect(() => registerLibraryCoverageUpload('run: echo', at('libs/testing'))).toThrow(
      'ci-main.yml coverage uploads: the block that opens it was not found'
    )
  })
})

describe('hasCoverageEntry', () => {
  it('finds the flag and path pair', () => {
    expect([
      hasCoverageEntry(workflow(LIBS), 'builder', 'libs/builder'),
      hasCoverageEntry(workflow(LIBS), 'builder', 'libs/other'),
    ]).toEqual([true, false])
  })
})
