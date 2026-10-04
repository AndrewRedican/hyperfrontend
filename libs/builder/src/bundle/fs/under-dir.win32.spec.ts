import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { isUnderDir } from './under-dir'

// why: the guard is only exercised against backslash separators when the module links against the win32 flavour of node:path.
jest.mock('node:path', () => {
  const { win32 } = jest.requireActual<typeof import('node:path')>('node:path')
  return { sep: win32.sep, posix: win32.posix }
})

const DIR = 'C:\\abs\\out\\_dependencies'

describe('isUnderDir on Windows', () => {
  it('treats a nested native path as contained', () => {
    expect(isUnderDir(`${DIR}\\lodash\\index.js`, DIR)).toBe(true)
  })

  it('treats a forward-slash spelling of a nested path as contained', () => {
    expect(isUnderDir('C:/abs/out/_dependencies/lodash/index.js', DIR)).toBe(true)
  })

  it('rejects a sibling sharing the directory name as a prefix', () => {
    expect(isUnderDir('C:\\abs\\out\\_dependencies-old\\index.js', DIR)).toBe(false)
  })
})
