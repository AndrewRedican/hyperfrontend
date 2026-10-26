import { createFsTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { formatFiles } from './format'

const workspace = useTempDir({
  prefix: 'format-',
  tree: { '.prettierrc': '{ "semi": false, "singleQuote": true }\n', '.prettierignore': 'skip.ts\n', 'old.ts': 'const  old = "x";\n' },
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
