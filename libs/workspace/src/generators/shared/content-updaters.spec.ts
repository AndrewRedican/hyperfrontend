import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { updateContentReferences, updateModuleJSDoc, updateReadmeReferences } from './content-updaters'

const FILES = {
  'libs/a/README.md': '# @acme/a\n\nnpm install @acme/a\n',
  'libs/a/src/index.ts': '/**\n * A.\n *\n * @module @acme/a\n */\n',
}
const RENAME = { projectRoot: 'libs/a', currentPackageName: '@acme/a', newPackageName: '@acme/z' }

describe('updateReadmeReferences', () => {
  it('rewrites every mention of the package in the README', () => {
    const tree = createMemoryTree(FILES)
    updateReadmeReferences(tree, RENAME)
    expect(tree.read('libs/a/README.md', 'utf-8')).toBe('# @acme/z\n\nnpm install @acme/z\n')
  })

  it('leaves a project without a README alone', () => {
    const tree = createMemoryTree()
    updateReadmeReferences(tree, RENAME)
    expect(tree.listChanges()).toEqual([])
  })

  it('changes nothing when the name stays', () => {
    const tree = createMemoryTree(FILES)
    updateReadmeReferences(tree, { ...RENAME, newPackageName: '@acme/a' })
    expect(tree.listChanges()).toEqual([])
  })
})

describe('updateModuleJSDoc', () => {
  it('rewrites the module header of the entry', () => {
    const tree = createMemoryTree(FILES)
    updateModuleJSDoc(tree, RENAME)
    expect(tree.read('libs/a/src/index.ts', 'utf-8')).toBe('/**\n * A.\n *\n * @module @acme/z\n */\n')
  })

  it('leaves a project without an entry alone', () => {
    const tree = createMemoryTree()
    updateModuleJSDoc(tree, RENAME)
    expect(tree.listChanges()).toEqual([])
  })

  it('changes nothing when the name stays', () => {
    const tree = createMemoryTree(FILES)
    updateModuleJSDoc(tree, { ...RENAME, newPackageName: '@acme/a' })
    expect(tree.listChanges()).toEqual([])
  })
})

describe('updateContentReferences', () => {
  it('rewrites the README and the module header together', () => {
    const tree = createMemoryTree(FILES)
    updateContentReferences(tree, RENAME)
    expect(tree.listChanges().map((change) => change.path)).toEqual(['libs/a/README.md', 'libs/a/src/index.ts'])
  })
})
