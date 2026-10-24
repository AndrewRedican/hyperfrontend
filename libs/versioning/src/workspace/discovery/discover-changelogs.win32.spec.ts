import type { Tree } from '@hyperfrontend/project-scope/vfs'
import { createMock, describe, expect, it, jest } from '@hyperfrontend/testing'
import { findProjectChangelogInTree } from './discover-changelogs'

// why: a native project path only carries backslashes when the module links against the win32 flavour of node:path.
jest.mock('node:path', () => {
  const { win32 } = jest.requireActual<typeof import('node:path')>('node:path')
  // why: the tree path is derived by project-scope's workspaceRelativePath, which resolves and normalizes before it converts.
  return {
    isAbsolute: win32.isAbsolute,
    join: win32.join,
    normalize: win32.normalize,
    posix: win32.posix,
    relative: win32.relative,
    resolve: win32.resolve,
    sep: win32.sep,
  }
})

describe('findProjectChangelogInTree on Windows', () => {
  it('looks a native absolute project path up by its root-relative POSIX tree path', () => {
    const tree = createMock<Tree>({ root: 'C:/workspace', isFile: (path: string) => path === 'libs/my-lib/CHANGELOG.md' })
    expect(findProjectChangelogInTree(tree, 'C:\\workspace\\libs\\my-lib')).toBe('C:\\workspace\\libs\\my-lib\\CHANGELOG.md')
  })
})
