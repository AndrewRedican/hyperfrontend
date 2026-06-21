import { isUnderDir } from './under-dir'

const DIR = '/abs/out/_dependencies'

describe('isUnderDir', () => {
  it('treats the directory itself as contained', () => {
    expect(isUnderDir(DIR, DIR)).toBe(true)
  })

  it('treats a nested path as contained', () => {
    expect(isUnderDir(`${DIR}/lodash/index.js`, DIR)).toBe(true)
  })

  it('rejects a path outside the directory', () => {
    expect(isUnderDir('/abs/out/index.esm.js', DIR)).toBe(false)
  })

  it('rejects a sibling sharing the directory name as a prefix', () => {
    expect(isUnderDir('/abs/out/_dependencies-old/index.js', DIR)).toBe(false)
  })
})
