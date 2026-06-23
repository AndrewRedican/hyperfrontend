import type { BuildContext } from '../../models'
import { depsRootOf } from './deps-root'

describe('depsRootOf', () => {
  it('joins the output root with the _dependencies directory', () => {
    expect(depsRootOf(<BuildContext>{ outputPath: '/abs/dist/libs/foo' })).toBe('/abs/dist/libs/foo/_dependencies')
  })
})
