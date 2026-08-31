import type { BuildContext } from '../../models'
import { depsRootOf } from './deps-root'

describe('depsRootOf', () => {
  it('joins the output root with the _dependencies directory', () => {
    expect(depsRootOf({ outputPath: '/abs/dist/libs/foo' } as BuildContext)).toBe('/abs/dist/libs/foo/_dependencies')
  })
})
