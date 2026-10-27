import type { GeneratorSchema } from './generate'
import { describe, expect, it } from '@hyperfrontend/testing'
import { generatorName, parseGenerateArgs } from './generate'

/** A schema with a positional option, a second positional, every typed kind, an enumeration and a default. */
const SCHEMA: GeneratorSchema = {
  properties: {
    project: { type: 'string', $default: { $source: 'argv', index: 0 } },
    newName: { type: 'string', $default: { $source: 'argv', index: 1 } },
    publishable: { type: 'boolean', default: false },
    keywords: { type: 'array', default: ['a'] },
    compatibility: { type: 'string', enum: ['isomorphic', 'node-only'] },
    directory: { type: 'string', default: 'libs' },
    loose: {},
  },
  required: ['project'],
}

/**
 * The schema of every generator in these cases.
 *
 * @returns The shared schema
 */
const schema = (): GeneratorSchema => SCHEMA

describe('generatorName', () => {
  it('drops the package prefix', () => {
    expect(generatorName('@hyperfrontend/package:library')).toBe('library')
  })

  it('keeps a bare name', () => {
    expect(generatorName('move')).toBe('move')
  })
})

describe('parseGenerateArgs', () => {
  it('fills positionals, types flags and applies defaults', () => {
    expect(parseGenerateArgs(['@hyperfrontend/package:rename', 'lib-a', 'lib-b', '--publishable', '--keywords=x,,y'], schema)).toEqual({
      generator: 'rename',
      options: { project: 'lib-a', newName: 'lib-b', publishable: true, keywords: ['x', 'y'], directory: 'libs' },
      dryRun: false,
    })
  })

  it('copies an array default', () => {
    expect(parseGenerateArgs(['g', 'p'], schema).options['keywords']).toEqual(['a'])
  })

  it('reads a dry run', () => {
    expect(parseGenerateArgs(['g', 'p', '--dry-run'], schema).dryRun).toBe(true)
  })

  it('reads a dry run turned off', () => {
    expect(parseGenerateArgs(['g', 'p', '--dry-run=false'], schema).dryRun).toBe(false)
  })

  it('reads a false boolean', () => {
    expect(parseGenerateArgs(['g', 'p', '--publishable=false'], schema).options['publishable']).toBe(false)
  })

  it('keeps a flag over the positional filling the same option', () => {
    expect(parseGenerateArgs(['g', 'p', '--project=q'], schema).options['project']).toBe('q')
  })

  it('reads a bare flag of an untyped option as true', () => {
    expect(parseGenerateArgs(['g', 'p', '--loose'], schema).options['loose']).toBe(true)
  })

  it('reads a schema without properties or requirements', () => {
    expect(parseGenerateArgs(['g'], () => ({})).options).toEqual({})
  })

  it('refuses a missing generator', () => {
    expect(() => parseGenerateArgs(['--dry-run'], schema)).toThrow('name the generator')
  })

  it('refuses a missing required option', () => {
    expect(() => parseGenerateArgs(['g'], schema)).toThrow('g needs --project')
  })

  it('refuses a positional with no option to fill', () => {
    expect(() => parseGenerateArgs(['g', 'a', 'b', 'c'], schema)).toThrow('g takes no positional argument 3 (c)')
  })

  it('refuses a boolean given another word', () => {
    expect(() => parseGenerateArgs(['g', 'p', '--publishable=yes'], schema)).toThrow('--publishable takes true or false, got yes')
  })

  it('refuses a typed option without a value', () => {
    expect(() => parseGenerateArgs(['g', 'p', '--directory'], schema)).toThrow('--directory needs a value')
  })

  it('refuses a value outside the enumeration', () => {
    expect(() => parseGenerateArgs(['g', 'p', '--compatibility=web'], schema)).toThrow(
      '--compatibility takes one of "isomorphic", "node-only", got "web"'
    )
  })
})
