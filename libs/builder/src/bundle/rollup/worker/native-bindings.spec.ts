import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('rollup native bindings', () => {
  it('declares every @rollup platform binding at the bundled rollup version in optionalDependencies', () => {
    // why: the bundled worker requires the platform binding at runtime; without these entries a cold install of the published package cannot resolve it.
    const pkg = JSON.parse(readFileSync(join(__dirname, '../../../../package.json'), 'utf8'))
    const rollupPkg = JSON.parse(readFileSync(join(__dirname, '../../../../../../node_modules/rollup/package.json'), 'utf8'))
    const bindings = Object.fromEntries(
      Object.entries(rollupPkg.optionalDependencies as Record<string, string>).filter(([name]) => name.startsWith('@rollup/rollup-'))
    )
    expect(pkg.optionalDependencies).toEqual(bindings)
  })
})
