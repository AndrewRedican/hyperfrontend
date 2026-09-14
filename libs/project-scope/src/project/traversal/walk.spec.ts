import type { Tree } from '../../vfs'
import type { WalkEntry, WalkOptions, WalkVisitor } from './walk'
import { mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTree } from '../../vfs'
import { walkDirectory, walkTree } from './walk'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')
const TEST_DIR = join(import.meta.dirname, '__test_fixtures_walk__')
const SYMLINK_DIR = join(import.meta.dirname, '__test_fixtures_walk_symlink__')

/**
 * Collects the relative path of every entry a walk visits, sorted so a suite can
 * assert on the whole listing at once.
 *
 * @param startPath - Directory to walk
 * @param options - Walk options forwarded verbatim
 * @returns Sorted relative paths of the visited entries
 */
function collectRelativePaths(startPath: string, options?: WalkOptions): string[] {
  const found: string[] = []

  walkDirectory(
    startPath,
    (entry) => {
      found.push(entry.relativePath)
    },
    options
  )

  return found.sort()
}

describe('walkDirectory', () => {
  it('walks the directory tree', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(MINIMAL_PROJECT, visitor, { includeHidden: true })

    expect(entries.length).toBeGreaterThan(0)
    expect(entries.some((e) => e.name === 'package.json')).toBe(true)
    expect(entries.some((e) => e.name === 'src' && e.isDirectory)).toBe(true)
  })

  it('respects maxDepth option', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(MINIMAL_PROJECT, visitor, { maxDepth: 0 })

    const hasDeepFiles = entries.some((e) => e.depth > 0)
    expect(hasDeepFiles).toBe(false)
  })

  it('filters hidden files by default', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(MINIMAL_PROJECT, visitor, { includeHidden: false })

    const hasHiddenFiles = entries.some((e) => e.name.startsWith('.'))
    expect(hasHiddenFiles).toBe(false)
  })

  it('includes hidden files when includeHidden is true', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(MINIMAL_PROJECT, visitor, { includeHidden: true })

    expect(entries.some((e) => e.name === '.gitkeep')).toBe(true)
  })

  it('allows visitor to skip directories', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
      if (entry.name === 'src') {
        return 'skip'
      }
    }

    walkDirectory(MINIMAL_PROJECT, visitor, { includeHidden: true })

    const hasSrcChildren = entries.some((e) => e.relativePath.startsWith('src/'))
    expect(hasSrcChildren).toBe(false)
  })

  it('allows visitor to stop walking', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
      if (entries.length >= 2) {
        return 'stop'
      }
    }

    walkDirectory(MINIMAL_PROJECT, visitor, { includeHidden: true })

    expect(entries.length).toBe(2)
  })

  it('respects ignore patterns', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(MINIMAL_PROJECT, visitor, {
      includeHidden: true,
      ignorePatterns: ['src'],
    })

    const hasSrc = entries.some((e) => e.name === 'src')
    expect(hasSrc).toBe(false)
  })

  it('walks nested monorepo structure', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(MONOREPO, visitor, { includeHidden: true })

    expect(entries.some((e) => e.name === 'packages' && e.isDirectory)).toBe(true)
    expect(entries.some((e) => e.name === 'project.json')).toBe(true)
  })
})

describe('walkTree', () => {
  it('walks a virtual file system tree', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkTree(tree, '', visitor, { includeHidden: true })

    expect(entries.length).toBeGreaterThan(0)
    expect(entries.some((e) => e.name === 'package.json')).toBe(true)
  })

  it('respects maxDepth option for tree walking', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkTree(tree, '', visitor, { maxDepth: 0 })

    const hasDeepFiles = entries.some((e) => e.depth > 0)
    expect(hasDeepFiles).toBe(false)
  })

  it('allows visitor to skip directories', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
      if (entry.name === 'src') {
        return 'skip'
      }
    }

    walkTree(tree, '', visitor, { includeHidden: true })

    const hasSrcChildren = entries.some((e) => e.relativePath.startsWith('src/'))
    expect(hasSrcChildren).toBe(false)
  })

  it('allows visitor to stop walking', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
      if (entries.length >= 2) {
        return 'stop'
      }
    }

    walkTree(tree, '', visitor, { includeHidden: true })

    expect(entries.length).toBe(2)
  })

  it('stops walking when the visitor stops inside a nested directory', () => {
    const visited: string[] = []

    walkTree(
      createTree(MONOREPO),
      '',
      (entry) => {
        visited.push(entry.relativePath)
        if (entry.relativePath.includes('/')) {
          return 'stop'
        }
      },
      // why: the depth cap keeps the walk bounded even if the stop signal is ever dropped again.
      { maxDepth: 3 }
    )

    expect(visited.filter((path) => path.includes('/'))).toHaveLength(1)
  })

  it('filters hidden files by default', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkTree(tree, '', visitor, { includeHidden: false })

    const hasHiddenFiles = entries.some((e) => e.name.startsWith('.'))
    expect(hasHiddenFiles).toBe(false)
  })

  it('handles tree with non-existent start path', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkTree(tree, 'nonexistent', visitor)

    expect(entries.length).toBe(0)
  })

  it('walks nested directories in tree', () => {
    const tree = createTree(MONOREPO)
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkTree(tree, '', visitor, { includeHidden: true })

    expect(entries.some((e) => e.name === 'packages')).toBe(true)
    expect(entries.some((e) => e.relativePath === 'packages/core')).toBe(true)
  })
})

describe('walkDirectory - edge cases', () => {
  beforeAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
    mkdirSync(TEST_DIR, { recursive: true })
  })

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true })
  })

  it('handles non-existent directory gracefully', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory('/non/existent/path', visitor)

    expect(entries.length).toBe(0)
  })

  it('respects .gitignore patterns', () => {
    mkdirSync(join(TEST_DIR, 'gitignore-test'), { recursive: true })
    mkdirSync(join(TEST_DIR, 'gitignore-test', 'node_modules'), { recursive: true })
    mkdirSync(join(TEST_DIR, 'gitignore-test', 'dist'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'gitignore-test', '.gitignore'), 'node_modules\ndist')
    writeFileSync(join(TEST_DIR, 'gitignore-test', 'index.ts'), 'export {}')
    writeFileSync(join(TEST_DIR, 'gitignore-test', 'node_modules', 'pkg.js'), 'module.exports = {}')
    writeFileSync(join(TEST_DIR, 'gitignore-test', 'dist', 'index.js'), 'console.log("dist")')

    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(join(TEST_DIR, 'gitignore-test'), visitor, {
      includeHidden: true,
      respectGitignore: true,
    })

    expect(entries.some((e) => e.name === 'node_modules')).toBe(false)
    expect(entries.some((e) => e.name === 'dist')).toBe(false)
    expect(entries.some((e) => e.name === 'index.ts')).toBe(true)
  })

  it('ignores gitignore when respectGitignore is false', () => {
    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(join(TEST_DIR, 'gitignore-test'), visitor, {
      includeHidden: true,
      respectGitignore: false,
    })

    expect(entries.some((e) => e.name === 'node_modules')).toBe(true)
  })

  it('re-includes a path matched by a later negation pattern', () => {
    mkdirSync(join(TEST_DIR, 'negation-test'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'negation-test', '.gitignore'), '*.log\n!keep.log')
    writeFileSync(join(TEST_DIR, 'negation-test', 'debug.log'), 'debug')
    writeFileSync(join(TEST_DIR, 'negation-test', 'keep.log'), 'keep')
    writeFileSync(join(TEST_DIR, 'negation-test', 'index.ts'), 'export {}')

    expect(collectRelativePaths(join(TEST_DIR, 'negation-test'), { includeHidden: true, respectGitignore: true })).toEqual([
      '.gitignore',
      'index.ts',
      'keep.log',
    ])
  })

  it('keeps unrelated entries when the ignore file holds a negation', () => {
    mkdirSync(join(TEST_DIR, 'negation-keeps', 'dist'), { recursive: true })
    mkdirSync(join(TEST_DIR, 'negation-keeps', 'src'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'negation-keeps', '.gitignore'), 'dist\n!dist/.gitkeep')
    writeFileSync(join(TEST_DIR, 'negation-keeps', 'dist', '.gitkeep'), '')
    writeFileSync(join(TEST_DIR, 'negation-keeps', 'package.json'), '{}')
    writeFileSync(join(TEST_DIR, 'negation-keeps', 'src', 'index.ts'), 'export {}')

    expect(collectRelativePaths(join(TEST_DIR, 'negation-keeps'), { respectGitignore: true })).toEqual([
      'package.json',
      'src',
      'src/index.ts',
    ])
  })

  it('ignores a directory named by a trailing-slash pattern', () => {
    mkdirSync(join(TEST_DIR, 'dir-only-test', 'build'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'dir-only-test', '.gitignore'), 'build/')
    writeFileSync(join(TEST_DIR, 'dir-only-test', 'build', 'out.js'), 'out')
    writeFileSync(join(TEST_DIR, 'dir-only-test', 'index.ts'), 'export {}')

    expect(collectRelativePaths(join(TEST_DIR, 'dir-only-test'), { respectGitignore: true })).toEqual(['index.ts'])
  })

  it('keeps a file whose name matches a trailing-slash pattern', () => {
    mkdirSync(join(TEST_DIR, 'dir-only-file'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'dir-only-file', '.gitignore'), 'build/')
    writeFileSync(join(TEST_DIR, 'dir-only-file', 'build'), 'a file, not a directory')

    expect(collectRelativePaths(join(TEST_DIR, 'dir-only-file'), { respectGitignore: true })).toEqual(['build'])
  })

  it('handles patterns starting with slash', () => {
    mkdirSync(join(TEST_DIR, 'slash-pattern-test'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'slash-pattern-test', '.gitignore'), '/root-only.txt')
    writeFileSync(join(TEST_DIR, 'slash-pattern-test', 'root-only.txt'), 'root')

    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(join(TEST_DIR, 'slash-pattern-test'), visitor, {
      includeHidden: true,
      respectGitignore: true,
    })

    expect(entries.some((e) => e.name === 'root-only.txt')).toBe(false)
  })

  it('handles stop return value in nested directories', () => {
    mkdirSync(join(TEST_DIR, 'nested-stop'), { recursive: true })
    mkdirSync(join(TEST_DIR, 'nested-stop', 'zzz'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'nested-stop', 'aaa-stop.txt'), 'stop here')
    writeFileSync(join(TEST_DIR, 'nested-stop', 'zzz', 'after.txt'), 'should not reach')

    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
      if (entry.name === 'aaa-stop.txt') {
        return 'stop'
      }
    }

    walkDirectory(join(TEST_DIR, 'nested-stop'), visitor, { includeHidden: true })

    expect(entries.some((e) => e.name === 'aaa-stop.txt')).toBe(true)
    expect(entries.some((e) => e.name === 'after.txt')).toBe(false)
  })

  it('handles empty directory', () => {
    mkdirSync(join(TEST_DIR, 'empty-dir'), { recursive: true })

    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
    }

    walkDirectory(join(TEST_DIR, 'empty-dir'), visitor)

    expect(entries.length).toBe(0)
  })

  it('returns undefined from visitor by default', () => {
    mkdirSync(join(TEST_DIR, 'undefined-return'), { recursive: true })
    writeFileSync(join(TEST_DIR, 'undefined-return', 'a.txt'), 'a')
    writeFileSync(join(TEST_DIR, 'undefined-return', 'b.txt'), 'b')

    const entries: WalkEntry[] = []
    const visitor: WalkVisitor = (entry) => {
      entries.push(entry)
      return undefined
    }

    walkDirectory(join(TEST_DIR, 'undefined-return'), visitor)

    expect(entries.length).toBe(2)
  })
})

describe('walkTree - error propagation', () => {
  it('propagates an error the tree throws that is not a filesystem failure', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const broken: Tree = {
      ...tree,
      children: () => {
        throw new TypeError('isAbsolute$1 is not defined')
      },
    }

    expect(() => walkTree(broken, '', () => undefined)).toThrow('isAbsolute$1 is not defined')
  })

  it('treats a filesystem failure from the tree as an empty directory', () => {
    const tree = createTree(MINIMAL_PROJECT)
    const failing: Tree = {
      ...tree,
      children: () => {
        const error = new Error('ENOENT: no such file or directory')
        ;(error as { code?: string }).code = 'ENOENT'
        throw error
      },
    }

    const entries: WalkEntry[] = []
    walkTree(failing, '', (entry) => {
      entries.push(entry)
    })

    expect(entries).toEqual([])
  })
})

describe('walkTree - symlinked directories', () => {
  beforeAll(() => {
    rmSync(SYMLINK_DIR, { recursive: true, force: true })
    mkdirSync(join(SYMLINK_DIR, 'src'), { recursive: true })
    writeFileSync(join(SYMLINK_DIR, 'src', 'a.ts'), 'export {}')
    symlinkSync(join(SYMLINK_DIR, 'src'), join(SYMLINK_DIR, 'link-dir'), 'dir')
    symlinkSync('..', join(SYMLINK_DIR, 'src', 'loop'), 'dir')
  })

  afterAll(() => {
    rmSync(SYMLINK_DIR, { recursive: true, force: true })
  })

  it('reports a directory symlink as a symlink', () => {
    const entries: WalkEntry[] = []
    walkTree(
      createTree(SYMLINK_DIR),
      '',
      (entry) => {
        entries.push(entry)
      },
      { maxDepth: 0 }
    )

    expect(entries).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'link-dir', isSymlink: true })]))
  })

  it('reports a real directory as not a symlink', () => {
    const entries: WalkEntry[] = []
    walkTree(
      createTree(SYMLINK_DIR),
      '',
      (entry) => {
        entries.push(entry)
      },
      { maxDepth: 0 }
    )

    expect(entries).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'src', isSymlink: false })]))
  })

  it('stops at a symlink instead of walking the loop behind it', () => {
    const visited: string[] = []
    walkTree(
      createTree(SYMLINK_DIR),
      '',
      (entry) => {
        visited.push(entry.relativePath)
      },
      // why: the depth cap keeps a regression bounded; without the symlink guard this tree doubles its matches at every extra level.
      { maxDepth: 4 }
    )

    expect(visited.sort()).toEqual(['link-dir', 'src', 'src/a.ts', 'src/loop'])
  })
})
