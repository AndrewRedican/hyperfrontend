import { describe, expect, it } from '@hyperfrontend/testing'
import { validateExecutorsManifest, validateGeneratorsManifest } from './validate'

const files = [
  'src/executors/build/executor.ts',
  'src/executors/build/schema.json',
  'src/generators/init/generator.ts',
  'src/generators/init/schema.json',
]
const exists = (path: string): boolean => files.includes(path)

describe('validateExecutorsManifest', () => {
  it('accepts a manifest whose entries name existing modules and schemas', () => {
    const manifest = {
      executors: { build: { implementation: './src/executors/build/executor', schema: './src/executors/build/schema.json' } },
    }
    expect(validateExecutorsManifest(manifest, exists)).toEqual([])
  })

  it('rejects a manifest that is not an object', () => {
    expect(validateExecutorsManifest(null, exists)).toEqual([{ path: '', message: 'the manifest must be an object' }])
  })

  it('rejects an executors field that is not an object', () => {
    expect(validateExecutorsManifest({ executors: [] }, exists)).toEqual([
      { path: 'executors', message: '"executors" must be an object keyed by name' },
    ])
  })

  it('rejects an entry that is not an object', () => {
    expect(validateExecutorsManifest({ executors: { build: 'x' } }, exists)).toEqual([
      { path: 'executors.build', message: 'must be an object' },
    ])
  })

  it('reports a missing implementation and schema together', () => {
    expect(validateExecutorsManifest({ executors: { build: {} } }, exists)).toEqual([
      { path: 'executors.build', message: '"implementation" must name the module' },
      { path: 'executors.build', message: '"schema" must name the options schema' },
    ])
  })

  it('reports an implementation that names no file', () => {
    const manifest = {
      executors: { build: { implementation: './src/executors/missing/executor', schema: './src/executors/build/schema.json' } },
    }
    expect(validateExecutorsManifest(manifest, exists)).toEqual([
      { path: 'executors.build', message: '"implementation" names a module that does not exist: ./src/executors/missing/executor' },
    ])
  })

  it('accepts an implementation written with its extension', () => {
    const manifest = {
      executors: { build: { implementation: 'src/executors/build/executor.ts', schema: 'src/executors/build/schema.json' } },
    }
    expect(validateExecutorsManifest(manifest, exists)).toEqual([])
  })

  it('reports a schema that is not a JSON file', () => {
    const manifest = {
      executors: { build: { implementation: './src/executors/build/executor', schema: './src/executors/build/schema.ts' } },
    }
    expect(validateExecutorsManifest(manifest, exists)).toEqual([
      { path: 'executors.build', message: '"schema" must name a JSON file: ./src/executors/build/schema.ts' },
    ])
  })

  it('reports a schema that names no file', () => {
    const manifest = {
      executors: { build: { implementation: './src/executors/build/executor', schema: './src/executors/build/options.json' } },
    }
    expect(validateExecutorsManifest(manifest, exists)).toEqual([
      { path: 'executors.build', message: '"schema" names a file that does not exist: ./src/executors/build/options.json' },
    ])
  })
})

describe('validateGeneratorsManifest', () => {
  it('accepts a manifest whose entries name existing factories and schemas', () => {
    const manifest = { generators: { init: { factory: './src/generators/init/generator', schema: './src/generators/init/schema.json' } } }
    expect(validateGeneratorsManifest(manifest, exists)).toEqual([])
  })

  it('rejects a manifest that is not an object', () => {
    expect(validateGeneratorsManifest([], exists)).toEqual([{ path: '', message: 'the manifest must be an object' }])
  })

  it('reports a factory that is empty', () => {
    const manifest = { generators: { init: { factory: '', schema: './src/generators/init/schema.json' } } }
    expect(validateGeneratorsManifest(manifest, exists)).toEqual([{ path: 'generators.init', message: '"factory" must name the module' }])
  })
})
