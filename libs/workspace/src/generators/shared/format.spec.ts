import { mkdirSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { beforeEach } from 'node:test'
import { createFsTree, createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { formatFiles, formatText, formatWhere, prettierOf } from './format'

const workspace = useTempDir({
  prefix: 'format-',
  tree: { '.prettierrc': '{ "semi": false, "singleQuote": true }\n', '.prettierignore': 'skip.ts\n', 'old.ts': 'const  old = "x";\n' },
})

// why: formatting resolves prettier from the workspace being formatted, so the temporary one links to the prettier this repository installs
beforeEach(() => {
  mkdirSync(join(workspace.path, 'node_modules'))
  symlinkSync(
    dirname(createRequire(import.meta.url).resolve('prettier/package.json')),
    join(workspace.path, 'node_modules', 'prettier'),
    'junction'
  )
})

describe('prettierOf', () => {
  it('refuses a workspace that installs no prettier', () => {
    expect(() => prettierOf(join(sep, 'no-workspace'))).toThrow('prettier is not installed in the workspace')
  })
})

describe('formatFiles', () => {
  it('formats a created file with the configuration beside it', async () => {
    const tree = createFsTree(workspace.path)
    tree.write('a.ts', 'const  a = "x";')
    await formatFiles(tree)
    expect(tree.read('a.ts', 'utf-8')).toBe("const a = 'x'\n")
  })

  it('leaves alone what the ignore file covers, what has no parser, and what was deleted', async () => {
    const tree = createFsTree(workspace.path)
    tree.write('skip.ts', 'const  skip = "x";')
    tree.write('notes.unknown', 'a   b')
    tree.delete('old.ts')
    await formatFiles(tree)
    expect(tree.listChanges().map((change) => [change.path, change.type, change.content?.toString('utf-8')])).toEqual([
      ['notes.unknown', 'CREATE', 'a   b'],
      ['old.ts', 'DELETE', undefined],
      ['skip.ts', 'CREATE', 'const  skip = "x";'],
    ])
  })

  it('refuses a file prettier cannot parse', async () => {
    const tree = createFsTree(workspace.path)
    tree.write('bad.ts', 'const = ;')
    await expect(formatFiles(tree)).rejects.toThrow('Variable declaration expected')
  })
})

describe('formatWhere', () => {
  it('formats the created and updated files the predicate takes, and leaves the others as they were written', async () => {
    const tree = createFsTree(workspace.path)
    tree.write('a.ts', 'const  a = "x";')
    tree.write('b.ts', 'const  b = "x";')
    await formatWhere(tree, (path) => path === 'a.ts')
    expect({ a: tree.read('a.ts', 'utf-8'), b: tree.read('b.ts', 'utf-8') }).toEqual({ a: "const a = 'x'\n", b: 'const  b = "x";' })
  })
})

describe('formatText', () => {
  it('formats a text with the configuration that applies at the path', async () => {
    expect(await formatText(createFsTree(workspace.path), 'a.ts', 'const  a = "x";')).toBe("const a = 'x'\n")
  })

  it.each([
    ['the ignore file covers', 'skip.ts'],
    ['prettier has no parser for', 'notes.unknown'],
  ])('answers the text as it is for a path %s', async (_case, path) => {
    expect(await formatText(createFsTree(workspace.path), path, 'const  a = "x";')).toBe('const  a = "x";')
  })

  it('answers the text as it is in a workspace that installs no prettier', async () => {
    expect(await formatText(createMemoryTree({}, { root: join(sep, 'no-workspace') }), 'a.ts', 'const  a = "x";')).toBe('const  a = "x";')
  })
})
