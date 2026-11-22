import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { updateContentReferences, updateModuleJSDoc, updateReadmeReferences } from './content-updaters'

const FILES = {
  'libs/a/README.md': '# @acme/a\n\nnpm install @acme/a\n',
  'libs/a/src/index.ts': '/**\n * A.\n *\n * @module @acme/a\n */\n',
}
const RENAME = { projectRoot: 'libs/a', currentPackageName: '@acme/a', newPackageName: '@acme/z' }
const RENAME_CORE = { projectRoot: 'libs/core', currentPackageName: '@acme/core', newPackageName: '@acme/kernel' }

describe('updateReadmeReferences', () => {
  it('rewrites every mention of the package in the README', () => {
    const tree = createMemoryTree(FILES)
    updateReadmeReferences(tree, RENAME)
    expect(tree.read('libs/a/README.md', 'utf-8')).toBe('# @acme/z\n\nnpm install @acme/z\n')
  })

  it('leaves the mention of a package whose name merely starts with the renamed one alone', () => {
    const tree = createMemoryTree({ 'libs/core/README.md': '# @acme/core\n\nSee also @acme/core-ui and `@acme/core/testing`.\n' })
    updateReadmeReferences(tree, RENAME_CORE)
    expect(tree.read('libs/core/README.md', 'utf-8')).toBe('# @acme/kernel\n\nSee also @acme/core-ui and `@acme/kernel/testing`.\n')
  })

  it('rewrites the image and the link of a badge that name the package', () => {
    const tree = createMemoryTree({
      'libs/core/README.md': '[![npm](https://img.shields.io/npm/v/@acme/core.svg)](https://www.npmjs.com/package/@acme/core)\n',
    })
    updateReadmeReferences(tree, RENAME_CORE)
    expect(tree.read('libs/core/README.md', 'utf-8')).toBe(
      '[![npm](https://img.shields.io/npm/v/@acme/kernel.svg)](https://www.npmjs.com/package/@acme/kernel)\n'
    )
  })

  it('rewrites the badge of a package without a scope', () => {
    const tree = createMemoryTree({
      'libs/core/README.md': '# core\n\n[![npm](https://img.shields.io/npm/v/core.svg)](https://www.npmjs.com/package/core)\n',
    })
    updateReadmeReferences(tree, { projectRoot: 'libs/core', currentPackageName: 'core', newPackageName: 'kernel' })
    expect(tree.read('libs/core/README.md', 'utf-8')).toBe(
      '# kernel\n\n[![npm](https://img.shields.io/npm/v/kernel.svg)](https://www.npmjs.com/package/kernel)\n'
    )
  })

  it.each([
    ['does not mention the package', '# Notes\n\nSee @acme/a-ui.\n'],
    ['is empty', ''],
  ])('leaves a README that %s unwritten', (_case, readme) => {
    const tree = createMemoryTree({ 'libs/a/README.md': readme })
    updateReadmeReferences(tree, RENAME)
    expect(tree.listChanges()).toEqual([])
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

  it('leaves the module header of a package whose name merely starts with the renamed one alone', () => {
    const tree = createMemoryTree({ 'libs/core/src/index.ts': '/** @module @acme/core */\n/** @module @acme/core-ui */\n' })
    updateModuleJSDoc(tree, RENAME_CORE)
    expect(tree.read('libs/core/src/index.ts', 'utf-8')).toBe('/** @module @acme/kernel */\n/** @module @acme/core-ui */\n')
  })

  it('rewrites the module header of an entry of the package', () => {
    const tree = createMemoryTree({ 'libs/core/src/index.ts': '/** @module @acme/core/testing */\n' })
    updateModuleJSDoc(tree, RENAME_CORE)
    expect(tree.read('libs/core/src/index.ts', 'utf-8')).toBe('/** @module @acme/kernel/testing */\n')
  })

  it('leaves a mention of the package outside a module header alone', () => {
    const tree = createMemoryTree({ 'libs/core/src/index.ts': "/** @module @acme/core */\nexport * from '@acme/core'\n" })
    updateModuleJSDoc(tree, RENAME_CORE)
    expect(tree.read('libs/core/src/index.ts', 'utf-8')).toBe("/** @module @acme/kernel */\nexport * from '@acme/core'\n")
  })

  it('leaves an entry without a module header of the package unwritten', () => {
    const tree = createMemoryTree({ 'libs/a/src/index.ts': "export * from '@acme/a'\n" })
    updateModuleJSDoc(tree, RENAME)
    expect(tree.listChanges()).toEqual([])
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
