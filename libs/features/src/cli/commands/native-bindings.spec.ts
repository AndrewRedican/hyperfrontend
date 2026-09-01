import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'

describe('rollup native bindings', () => {
  it('mirrors the builder optionalDependencies so a cold hf build resolves its platform binding', () => {
    // why: hf build runs the builder's bundled rollup worker from inside this package, so the same platform-binding declarations must ship here.
    const features = JSON.parse(readFileSync(join(import.meta.dirname, '../../../package.json'), 'utf8'))
    const builder = JSON.parse(readFileSync(join(import.meta.dirname, '../../../../builder/package.json'), 'utf8'))
    expect(features.optionalDependencies).toEqual(builder.optionalDependencies)
  })
})
