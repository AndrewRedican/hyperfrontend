import { describe, expect, it } from '@hyperfrontend/testing'
import { hasMatrixEntry, hasPathFilter, registerLibraryInCiLibraries } from './ci-libraries-workflow'
import { deriveLibraryFacts } from './library-facts'

const TESTING = deriveLibraryFacts({
  projectName: 'lib-testing',
  projectRoot: 'libs/testing',
  packageName: '@hyperfrontend/testing',
  description: 'Jest-style testing on node:test.',
  tags: ['type:core'],
  exports: { '.': './src/index.js' },
  hasArchitecture: false,
})

const WEB_WORKER = { ...TESTING, projectName: 'lib-web-worker', projectRoot: 'libs/web-worker', coverageFlag: 'web-worker' }

const FILTERS = [
  '        with:',
  '          filters: |',
  '            # EXCLUDED LIBRARIES (not ready for CI):',
  '            # - web-worker: Excluded - experimental/unstable',
  '',
  '            # ACTIVE LIBRARIES:',
  '            builder:',
  "              - 'libs/builder/**'",
  '            json-utils:',
  "              - 'libs/utils/json/**'",
]

const CLOSING = [
  '            workflow-changed:',
  "              - '.github/workflows/ci-libraries.yml'",
  "              - '.github/workflows/_lib-ci.yml'",
  '',
]

const MATRIX = [
  '      - name: Build matrix from filter outputs',
  '        run: |',
  '          # EXCLUDED LIBRARIES (not ready for CI):',
  '          # add_if_changed "${{ steps.filter.outputs.web-worker }}" "lib-web-worker" "libs/web-worker" "web-worker"',
  '',
  '          # ACTIVE LIBRARIES:',
  '          add_if_changed "${{ steps.filter.outputs.builder }}" "lib-builder" "libs/builder" "builder"',
  '          add_if_changed "${{ steps.filter.outputs.json-utils }}" "lib-json-utils" "libs/utils/json" "json-utils"',
  '',
  '          # Check if matrix is empty',
]

const TESTING_FILTER = ['            testing:', "              - 'libs/testing/**'"]

const TESTING_ENTRY = '          add_if_changed "${{ steps.filter.outputs.testing }}" "lib-testing" "libs/testing" "testing"'

const WORKFLOW = [...FILTERS, ...CLOSING, ...MATRIX].join('\n')

describe('registerLibraryInCiLibraries', () => {
  it('filters on the library before the workflow filter and adds it to the matrix after the last active entry', () => {
    expect(registerLibraryInCiLibraries(WORKFLOW, TESTING).split(/\r?\n/)).toEqual([
      ...FILTERS,
      ...TESTING_FILTER,
      ...CLOSING,
      ...MATRIX.slice(0, 8),
      TESTING_ENTRY,
      ...MATRIX.slice(8),
    ])
  })

  it('changes nothing the second time', () => {
    const once = registerLibraryInCiLibraries(WORKFLOW, TESTING)
    expect(registerLibraryInCiLibraries(once, TESTING)).toBe(once)
  })

  it('adds only the matrix entry when the filter is already there', () => {
    const filtered = [...FILTERS, ...TESTING_FILTER, ...CLOSING, ...MATRIX].join('\n')
    expect(registerLibraryInCiLibraries(filtered, TESTING).split(/\r?\n/)).toEqual([
      ...FILTERS,
      ...TESTING_FILTER,
      ...CLOSING,
      ...MATRIX.slice(0, 8),
      TESTING_ENTRY,
      ...MATRIX.slice(8),
    ])
  })

  it('adds only the filter when the matrix entry is already there', () => {
    const listed = [...FILTERS, ...CLOSING, ...MATRIX.slice(0, 8), TESTING_ENTRY, ...MATRIX.slice(8)].join('\n')
    expect(registerLibraryInCiLibraries(listed, TESTING).split(/\r?\n/)).toEqual([
      ...FILTERS,
      ...TESTING_FILTER,
      ...CLOSING,
      ...MATRIX.slice(0, 8),
      TESTING_ENTRY,
      ...MATRIX.slice(8),
    ])
  })

  it('appends the filter after the last one when no filter closes the list', () => {
    expect(
      registerLibraryInCiLibraries([...FILTERS, '', ...MATRIX].join('\n'), TESTING)
        .split(/\r?\n/)
        .slice(0, 13)
    ).toEqual([...FILTERS, ...TESTING_FILTER, ''])
  })

  it('stops the filter list at a comment written at the entries indentation', () => {
    const commented = [...FILTERS, '            # no more filters', ...CLOSING, ...MATRIX].join('\n')
    expect(registerLibraryInCiLibraries(commented, TESTING).split(/\r?\n/).slice(10, 13)).toEqual([
      ...TESTING_FILTER,
      '            # no more filters',
    ])
  })

  it('stops the filter list at a deeper line that is not a path', () => {
    const nested = [...FILTERS, '              nested:', ...CLOSING, ...MATRIX].join('\n')
    expect(registerLibraryInCiLibraries(nested, TESTING).split(/\r?\n/).slice(10, 13)).toEqual([...TESTING_FILTER, '              nested:'])
  })

  it('appends the matrix entry at the end of a file that ends on the matrix', () => {
    const ending = [...FILTERS, ...CLOSING, ...MATRIX.slice(0, 8)].join('\n')
    expect(registerLibraryInCiLibraries(ending, TESTING).split(/\r?\n/).slice(-2)).toEqual([MATRIX[7], TESTING_ENTRY])
  })

  it('keeps the line ending the workflow was written with', () => {
    const crlf = WORKFLOW.split(/\r?\n/).join('\r\n')
    expect(registerLibraryInCiLibraries(crlf, TESTING)).toBe(registerLibraryInCiLibraries(WORKFLOW, TESTING).split(/\r?\n/).join('\r\n'))
  })

  it('refuses a workflow without both active-library markers', () => {
    expect(() => registerLibraryInCiLibraries(FILTERS.join('\n'), TESTING)).toThrow(
      'ci-libraries.yml must open both its filter list and its matrix list with "# ACTIVE LIBRARIES:", found 1'
    )
  })
})

describe('hasPathFilter', () => {
  it('finds a path listed after the first one of its filter', () => {
    const filter = ['x:', "  - 'libs/other/**'", "  - 'libs/testing/**'", 'y:'].join('\n')
    expect(hasPathFilter(filter, 'x', 'libs/testing')).toBe(true)
  })

  it('does not count a filter of the same name on another path', () => {
    expect(hasPathFilter(['testing:', "  - 'libs/other/**'"].join('\n'), 'testing', 'libs/testing')).toBe(false)
  })

  it('reports a filter at the end of the file', () => {
    expect(hasPathFilter(['testing:', "  - 'libs/testing/**'"].join('\n'), 'testing', 'libs/testing')).toBe(true)
  })
})

describe('hasMatrixEntry', () => {
  it('ignores an entry that is commented out', () => {
    expect(hasMatrixEntry(WORKFLOW, WEB_WORKER)).toBe(false)
  })

  it('finds the entry naming the filter, project, path and flag', () => {
    expect(hasMatrixEntry(registerLibraryInCiLibraries(WORKFLOW, TESTING), TESTING)).toBe(true)
  })
})
