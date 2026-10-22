import { describe, expect, it } from '@hyperfrontend/testing'
import { compileGlob, matchesAny } from './glob.ts'

const matches = (pattern: string, path: string): boolean => compileGlob(pattern).test(path)

describe('compileGlob', () => {
  it('keeps the pattern', () => {
    expect(compileGlob('**/*.ts').pattern).toBe('**/*.ts')
  })

  it.each([
    ['*.ts', 'a.ts', true],
    ['*.ts', 'dir/a.ts', false],
    ['**/*.ts', 'a.ts', true],
    ['**/*.ts', 'dir/sub/a.ts', true],
    ['**/*.ts', 'dir/sub/a.tsx', false],
    ['src/**', 'src/a/b.ts', true],
    ['src/**', 'src', false],
    ['src/**/*.spec.ts', 'src/x.spec.ts', true],
    ['src/**/*.spec.ts', 'src/a/b/x.spec.ts', true],
    ['**/*.{ts,tsx}', 'a/b.tsx', true],
    ['**/*.{ts,tsx}', 'a/b.js', false],
    ['*.{spec,test}.ts', 'a.test.ts', true],
    ['a?c.ts', 'abc.ts', true],
    ['a?c.ts', 'a/c.ts', false],
    ['[ab].ts', 'a.ts', true],
    ['[!ab].ts', 'a.ts', false],
    ['[!ab].ts', 'c.ts', true],
    ['dist/', 'dist/a.js', true],
    ['dist/', 'dist', true],
    ['dist/', 'distribution/a.js', false],
    ['**/node_modules/', 'a/node_modules/b.js', true],
    ['a.b.ts', 'axb.ts', false],
    ['lib**.ts', 'libx/y.ts', false],
    ['lib**.ts', 'library.ts', true],
    ['**', 'a/b/c', true],
    ['[a.ts', '[a.ts', true],
    ['{a.ts', '{a.ts', true],
    ['a(b).ts', 'a(b).ts', true],
  ])('%s against %s is %s', (pattern, path, expected) => {
    expect(matches(pattern, path)).toBe(expected)
  })
})

describe('matchesAny', () => {
  const globs = [compileGlob('*.md'), compileGlob('**/*.ts')]

  it('is true when one pattern matches', () => {
    expect(matchesAny(globs, 'src/a.ts')).toBe(true)
  })

  it('is false when none matches', () => {
    expect(matchesAny(globs, 'src/a.js')).toBe(false)
  })
})
