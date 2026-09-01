import { describe, expect, it } from '@hyperfrontend/testing'
import { isSafePath } from './guard'

const NUL = '\u0000'

describe('core/fs/guard', () => {
  describe('isSafePath', () => {
    it('accepts an ordinary relative path', () => {
      expect(isSafePath('src/index.ts')).toBe(true)
    })

    it('accepts an absolute path', () => {
      expect(isSafePath('/workspace/libs/project-scope/package.json')).toBe(true)
    })

    it('accepts forward and back slashes as legal separators', () => {
      expect(isSafePath('a/b\\c')).toBe(true)
    })

    it('rejects a path carrying a NUL byte', () => {
      expect(isSafePath(`src/index.ts${NUL}.png`)).toBe(false)
    })
  })
})
