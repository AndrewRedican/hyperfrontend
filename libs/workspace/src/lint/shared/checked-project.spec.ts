import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { checkedProject, isNodeProject } from './checked-project'

/** A runtime source importing a `node:` module. */
const NODE_IMPORT = "import { join } from 'node:path'\n"

/** The project file of a publishable library. */
const PUBLISHABLE = stringify({ projectType: 'library', targets: { build: {}, publish: {} } })

/**
 * One project per verdict: a publishable library on Node, one whose `node:` imports sit only
 * where they must not count, one without sources, and a library that is not published.
 */
const workspace = createTempDir({
  prefix: 'lint-checked-project-',
  tree: {
    'hf.json': '{}',
    'node/project.json': PUBLISHABLE,
    'node/src/view.ts': 'export {}\n',
    'node/src/deep/runtime.ts': NODE_IMPORT,
    'browser/project.json': PUBLISHABLE,
    'browser/src/view.ts': 'export {}\n',
    'browser/src/view.spec.ts': NODE_IMPORT,
    'browser/src/test.setup.ts': NODE_IMPORT,
    'browser/src/types.d.ts': NODE_IMPORT,
    'browser/src/__fixtures__/fixture.ts': NODE_IMPORT,
    'browser/src/node_modules/dep/index.ts': NODE_IMPORT,
    'browser/src/notes.md': NODE_IMPORT,
    'bare/project.json': PUBLISHABLE,
    'unpublished/project.json': stringify({ projectType: 'library', targets: { build: {} } }),
    'unpublished/src/runtime.ts': NODE_IMPORT,
    'projectless/.keep': '',
  },
})
const ROOT = workspace.path

describe('isNodeProject', () => {
  it('finds a node: import in a runtime source at any depth', () => {
    expect(isNodeProject(join(ROOT, 'node'))).toBe(true)
  })

  it('ignores specs, declarations, the test setup, fixtures, vendored modules and files that are not TypeScript', () => {
    expect(isNodeProject(join(ROOT, 'browser'))).toBe(false)
  })

  it('answers false for a project without sources', () => {
    expect(isNodeProject(join(ROOT, 'bare'))).toBe(false)
  })

  it('answers the same for a project asked twice', () => {
    expect([isNodeProject(join(ROOT, 'node')), isNodeProject(join(ROOT, 'node'))]).toEqual([true, true])
  })
})

describe('checkedProject', () => {
  it('selects a file of a publishable library by the default selector', () => {
    expect(checkedProject(join(ROOT, 'node', 'src', 'view.ts'), [{ publishableLibraries: true }])).toBe(join(ROOT, 'node'))
  })

  it('leaves a library that is not published when only publishable libraries are selected', () => {
    expect(checkedProject(join(ROOT, 'unpublished', 'src', 'runtime.ts'), [{ publishableLibraries: true }])).toBe(null)
  })

  it('selects a file by a workspace-relative glob', () => {
    expect(checkedProject(join(ROOT, 'unpublished', 'src', 'runtime.ts'), [{ files: ['unpublished/**'] }])).toBe(join(ROOT, 'unpublished'))
  })

  it('leaves a file no glob matches', () => {
    expect(checkedProject(join(ROOT, 'unpublished', 'src', 'runtime.ts'), [{ files: ['node/**'] }, {}])).toBe(null)
  })

  it('leaves a file no project owns', () => {
    expect(checkedProject(join(ROOT, 'projectless', '.keep'), [{ publishableLibraries: true }])).toBe(null)
  })
})
