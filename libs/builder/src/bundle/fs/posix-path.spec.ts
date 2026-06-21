import { join, normalizeToForwardSlashes } from './posix-path'

describe('normalizeToForwardSlashes', () => {
  it('rewrites backslashes to forward slashes', () => {
    expect(normalizeToForwardSlashes('a\\b\\index.d.ts')).toBe('a/b/index.d.ts')
  })

  it('leaves an already-POSIX path untouched', () => {
    expect(normalizeToForwardSlashes('a/b/index.d.ts')).toBe('a/b/index.d.ts')
  })
})

describe('join', () => {
  it('joins segments into a POSIX path', () => {
    expect(join('/abs/dist/libs/foo', 'models', 'index.d.ts')).toBe('/abs/dist/libs/foo/models/index.d.ts')
  })

  it('normalizes separators in the joined result', () => {
    expect(join('a', 'b', 'c')).toBe('a/b/c')
  })
})
