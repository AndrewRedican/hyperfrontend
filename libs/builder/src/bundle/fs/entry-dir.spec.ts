import type { BuildContext, EntryPoint } from '../../models'
import { join } from '@hyperfrontend/project-scope/core'
import { entryDirOf } from './entry-dir'

const OUT = '/abs/out'
const context = <BuildContext>{ outputPath: OUT }

const ROOT_ENTRY: EntryPoint = { exportPath: '.', srcPath: '', inputFile: '/p/src/index.ts', isRoot: true }
const FEATURE_ENTRY: EntryPoint = {
  exportPath: './browser/v1',
  srcPath: 'browser/v1',
  inputFile: '/p/src/browser/v1/index.ts',
  isRoot: false,
}

describe('entryDirOf', () => {
  it('maps the root entry to the output root', () => {
    expect(entryDirOf(ROOT_ENTRY, context)).toBe(OUT)
  })

  it('mirrors a non-root entry srcPath under the output root', () => {
    expect(entryDirOf(FEATURE_ENTRY, context)).toBe(join(OUT, 'browser/v1'))
  })
})
