import type { BuildContext } from '../../models'
import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { depsRootOf } from './deps-root'

describe('depsRootOf', () => {
  it('joins the output root with the _dependencies directory', () => {
    expect(depsRootOf({ outputPath: '/abs/dist/libs/foo' } as BuildContext)).toBe(normalizeToNative('/abs/dist/libs/foo/_dependencies'))
  })
})
