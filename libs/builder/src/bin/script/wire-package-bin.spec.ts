import type { BinOutput, PackageJson } from '../../models'
import { wireBinFieldInPackageJson } from './wire-package-bin'

const OUTPUT_ROOT = '/abs/dist/libs/builder'

describe('wireBinFieldInPackageJson', () => {
  it('leaves pkg.bin untouched when no JS bin outputs are supplied', () => {
    const pkg: PackageJson = { name: 'foo', bin: { existing: './existing.js' } }
    wireBinFieldInPackageJson(pkg, [], OUTPUT_ROOT)
    expect(pkg.bin).toEqual({ existing: './existing.js' })
  })

  it('does nothing when only native outputs are present', () => {
    const pkg: PackageJson = { name: 'foo' }
    const outputs: BinOutput[] = [
      { name: 'cli', kind: 'native', outputPath: '/abs/dist/libs/builder/bin/cli.linux-x64', platform: 'linux-x64' },
    ]
    wireBinFieldInPackageJson(pkg, outputs, OUTPUT_ROOT)
    expect(pkg.bin).toBeUndefined()
  })

  it('maps a single CJS output to a relative `./bin/<name>.js` path', () => {
    const pkg: PackageJson = { name: 'foo' }
    const outputs: BinOutput[] = [{ name: 'cz', kind: 'cjs', outputPath: '/abs/dist/libs/builder/bin/cz.js' }]
    wireBinFieldInPackageJson(pkg, outputs, OUTPUT_ROOT)
    expect(pkg.bin).toEqual({ cz: './bin/cz.js' })
  })

  it('prefers CJS over ESM when both are available for the same name', () => {
    const pkg: PackageJson = { name: 'foo' }
    const outputs: BinOutput[] = [
      { name: 'hf-build', kind: 'esm', outputPath: '/abs/dist/libs/builder/bin/hf-build.mjs' },
      { name: 'hf-build', kind: 'cjs', outputPath: '/abs/dist/libs/builder/bin/hf-build.cjs.js' },
    ]
    wireBinFieldInPackageJson(pkg, outputs, OUTPUT_ROOT)
    expect(pkg.bin).toEqual({ 'hf-build': './bin/hf-build.cjs.js' })
  })

  it('falls back to ESM when no CJS output is available', () => {
    const pkg: PackageJson = { name: 'foo' }
    const outputs: BinOutput[] = [{ name: 'hf-build', kind: 'esm', outputPath: '/abs/dist/libs/builder/bin/hf-build.mjs' }]
    wireBinFieldInPackageJson(pkg, outputs, OUTPUT_ROOT)
    expect(pkg.bin).toEqual({ 'hf-build': './bin/hf-build.mjs' })
  })

  it('preserves entries on pkg.bin for names not present in the new outputs', () => {
    const pkg: PackageJson = { name: 'foo', bin: { keep: './keep.js' } }
    const outputs: BinOutput[] = [{ name: 'add', kind: 'cjs', outputPath: '/abs/dist/libs/builder/bin/add.js' }]
    wireBinFieldInPackageJson(pkg, outputs, OUTPUT_ROOT)
    expect(pkg.bin).toEqual({ keep: './keep.js', add: './bin/add.js' })
  })

  it('overwrites an existing entry for a name that is rebuilt by the bin phase', () => {
    const pkg: PackageJson = { name: 'foo', bin: { cz: './old.js' } }
    const outputs: BinOutput[] = [{ name: 'cz', kind: 'cjs', outputPath: '/abs/dist/libs/builder/bin/cz.js' }]
    wireBinFieldInPackageJson(pkg, outputs, OUTPUT_ROOT)
    expect(pkg.bin).toEqual({ cz: './bin/cz.js' })
  })

  it('replaces a string-form pkg.bin with a normalized object map', () => {
    const pkg: PackageJson = { name: 'foo', bin: './legacy.js' }
    const outputs: BinOutput[] = [{ name: 'cz', kind: 'cjs', outputPath: '/abs/dist/libs/builder/bin/cz.js' }]
    wireBinFieldInPackageJson(pkg, outputs, OUTPUT_ROOT)
    expect(pkg.bin).toEqual({ cz: './bin/cz.js' })
  })

  it('preserves an already-relative `..`-prefixed path without re-prefixing', () => {
    const pkg: PackageJson = { name: 'foo' }
    const outputs: BinOutput[] = [{ name: 'cz', kind: 'cjs', outputPath: '/abs/dist/libs/other/bin/cz.js' }]
    wireBinFieldInPackageJson(pkg, outputs, OUTPUT_ROOT)
    expect(pkg.bin).toEqual({ cz: '../other/bin/cz.js' })
  })

  it('handles multiple distinct bin names independently', () => {
    const pkg: PackageJson = { name: 'foo' }
    const outputs: BinOutput[] = [
      { name: 'cz', kind: 'cjs', outputPath: '/abs/dist/libs/builder/bin/cz.js' },
      { name: 'cl', kind: 'cjs', outputPath: '/abs/dist/libs/builder/bin/cl.js' },
    ]
    wireBinFieldInPackageJson(pkg, outputs, OUTPUT_ROOT)
    expect(pkg.bin).toEqual({ cz: './bin/cz.js', cl: './bin/cl.js' })
  })
})
