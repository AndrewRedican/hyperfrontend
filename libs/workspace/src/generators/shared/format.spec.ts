import { mkdirSync, symlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { beforeEach } from 'node:test'
import { createFsTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { formatFiles, prettierOf } from './format'

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
