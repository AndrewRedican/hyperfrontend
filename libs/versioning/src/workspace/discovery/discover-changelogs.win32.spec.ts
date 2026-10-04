import type { Tree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { findProjectChangelogInTree } from './discover-changelogs'

// why: a native project path only carries backslashes when the module links against the win32 flavour of node:path.
jest.mock('node:path', () => {
  const { win32 } = jest.requireActual<typeof import('node:path')>('node:path')
  return { isAbsolute: win32.isAbsolute, join: win32.join, posix: win32.posix, relative: win32.relative, sep: win32.sep }
})

describe('findProjectChangelogInTree on Windows', () => {
  it('looks a native absolute project path up by its root-relative POSIX tree path', () => {
    const tree = { root: 'C:/workspace', isFile: jest.fn((path: string) => path === 'libs/my-lib/CHANGELOG.md') }
    expect(findProjectChangelogInTree(tree as unknown as Tree, 'C:\\workspace\\libs\\my-lib')).toBe(
      'C:\\workspace\\libs\\my-lib\\CHANGELOG.md'
    )
  })
})
