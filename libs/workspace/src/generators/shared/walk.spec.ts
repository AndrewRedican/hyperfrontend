import { createMemoryTree } from '@hyperfrontend/project-scope/vfs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { compileIgnoreRules, isIgnored, visitNotIgnoredFiles } from './walk'

const ROOT_IGNORE = ['# built', 'dist', '*.log', '!keep.log', '/out', 'build/', 'docs/**/draft-*', ''].join('\n')

/**
 * The files a walk visits.
 *
 * @param tree - The tree walked
 * @param directory - Where to start
 * @returns The paths, in visiting order
 */
function visited(tree: ReturnType<typeof createMemoryTree>, directory: string): string[] {
  const paths: string[] = []
  visitNotIgnoredFiles(tree, directory, (path) => paths.push(path))
  return paths
}

describe('compileIgnoreRules', () => {
  it('drops comments and blank lines and keeps the rest in order', () => {
    expect(compileIgnoreRules(ROOT_IGNORE, '').map((rule) => [rule.negated, rule.directoryOnly, rule.anchored, rule.glob])).toEqual([
      [false, false, false, 'dist'],
      [false, false, false, '*.log'],
      [true, false, false, 'keep.log'],
      [false, false, true, 'out'],
      [false, true, false, 'build'],
      [false, false, true, 'docs/**/draft-*'],
    ])
  })
})

describe('isIgnored', () => {
  const rules = compileIgnoreRules(ROOT_IGNORE, '')

  it.each([
    ['dist', true, true],
    ['libs/a/dist', true, true],
    ['libs/a/debug.log', false, true],
    ['libs/a/keep.log', false, false],
    ['out', true, true],
    ['libs/out', true, false],
    ['build', false, false],
    ['build', true, true],
    ['docs/guides/draft-intro.md', false, true],
    ['docs/draft-intro.md', false, true],
    ['docs/guides/intro.md', false, false],
  ])('decides %s (directory: %s) as %s', (path, directory, ignored) => {
    expect(isIgnored(path, directory, rules)).toBe(ignored)
  })

  it('anchors the rules of a nested ignore file to its directory', () => {
    expect(isIgnored('apps/x/generated', true, compileIgnoreRules('generated/\n', 'apps/x'))).toBe(true)
  })

  it('spans directories with a trailing double star and matches a one-character wildcard', () => {
    expect(
      ['tmp/a/b.ts', 'tmp', 'f1.ts', 'f12.ts'].map((path) => isIgnored(path, false, compileIgnoreRules('tmp/**\nf?.ts\n', '')))
    ).toEqual([true, true, true, false])
  })

  it('applies a nested rule to the paths under its directory alone', () => {
    expect(
      ['apps/x/generated', 'generated', 'apps/y/generated'].map((path) =>
        isIgnored(path, true, compileIgnoreRules('generated/\n', 'apps/x'))
      )
    ).toEqual([true, false, false])
  })
})

describe('visitNotIgnoredFiles', () => {
  const tree = createMemoryTree({
    '.gitignore': ROOT_IGNORE,
    'README.md': '',
    'dist/out.js': '',
    'node_modules/pkg/index.js': '',
    'libs/a/src/index.ts': '',
    'libs/a/debug.log': '',
    'libs/a/keep.log': '',
    'apps/x/.gitignore': 'generated/\n!important.log\n',
    'apps/x/generated/file.ts': '',
    'apps/x/important.log': '',
    'apps/x/src/main.ts': '',
  })

  it('visits every file git would keep, nested ignore files applied, from the root', () => {
    expect(visited(tree, '.')).toEqual([
      '.gitignore',
      'README.md',
      'apps/x/.gitignore',
      'apps/x/important.log',
      'apps/x/src/main.ts',
      'libs/a/keep.log',
      'libs/a/src/index.ts',
    ])
  })

  it('starts inside a directory with the ignore files above it in force', () => {
    expect(visited(tree, './libs/a/')).toEqual(['libs/a/keep.log', 'libs/a/src/index.ts'])
  })

  it('visits nothing under a directory git ignores', () => {
    expect(visited(tree, 'apps/x/generated')).toEqual([])
  })

  it('never enters node_modules', () => {
    expect(visited(tree, 'node_modules')).toEqual([])
  })
})
