import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { join, normalizeToForwardSlashes } from './posix-path'

// why: native separators are only backslashes when the module links against the win32 flavour of node:path.
jest.mock('node:path', () => {
  const { win32 } = jest.requireActual<typeof import('node:path')>('node:path')
  return { join: win32.join, sep: win32.sep, posix: win32.posix }
})

describe('posix-path on Windows', () => {
  it('rewrites backslash separators to forward slashes', () => {
    expect(normalizeToForwardSlashes('a\\b\\index.d.ts')).toBe('a/b/index.d.ts')
  })

  it('joins segments into a forward-slash path', () => {
    expect(join('C:\\abs\\dist', 'models', 'index.d.ts')).toBe('C:/abs/dist/models/index.d.ts')
  })
})
