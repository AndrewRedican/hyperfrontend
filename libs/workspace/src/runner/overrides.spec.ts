import type { ExecutorSchema } from './executors'
import { describe, expect, it } from '@hyperfrontend/testing'
import { camelCase, parseOverrides, readFlag, typedOverrides } from './overrides'

describe('camelCase', () => {
  it('folds the dashes of a kebab-case name into capitals', () => {
    expect(camelCase('skip-if-version-commit')).toBe('skipIfVersionCommit')
  })

  it('lower-cases the name it folds', () => {
    expect(camelCase('Dry-Run')).toBe('dryRun')
  })

  it('keeps a name whose first dash comes before its third character', () => {
    expect(camelCase('a-b')).toBe('a-b')
  })

  it('keeps a name without a dash', () => {
    expect(camelCase('dryRun')).toBe('dryRun')
  })
})

describe('readFlag', () => {
  it('reads a name and a value', () => {
    expect(readFlag('--tag=next')).toEqual({ name: 'tag', value: 'next' })
  })

  it('reads a bare flag as true', () => {
    expect(readFlag('--dry-run')).toEqual({ name: 'dry-run', value: true })
  })

  it('reads an empty value as an empty string', () => {
    expect(readFlag('--otp=')).toEqual({ name: 'otp', value: '' })
  })

  it('keeps the equals signs of the value', () => {
    expect(readFlag('--define=a=b').value).toBe('a=b')
  })

  it.each(['plan', '-v', '--', '--=x', '---x'])('refuses %j', (arg) => {
    expect(() => readFlag(arg)).toThrow(`expected --name=value or --name after the task, got ${arg}`)
  })
})

describe('parseOverrides', () => {
  it('reads every argument into options by camelCase name', () => {
    expect(parseOverrides(['--dry-run', '--tag=next', '--max-commit-fallback=5'])).toEqual({
      options: { dryRun: true, tag: 'next', maxCommitFallback: '5' },
      args: ['--dry-run', '--tag=next', '--max-commit-fallback=5'],
    })
  })
})

describe('typedOverrides', () => {
  const schema: ExecutorSchema = {
    properties: {
      tag: { type: 'string' },
      dryRun: { type: 'boolean' },
      maxCommitFallback: { type: 'number' },
      depth: { type: 'integer' },
      formats: { type: 'array' },
      scope: { type: 'object' },
    },
  }

  it.each([
    ['a digit-only string option as text', { tag: '2' }, { tag: '2' }],
    ['a boolean option written true', { dryRun: 'true' }, { dryRun: true }],
    ['a boolean option written false', { dryRun: 'false' }, { dryRun: false }],
    ['a bare boolean option as true', { dryRun: true }, { dryRun: true }],
    ['a number option as a number', { maxCommitFallback: '5' }, { maxCommitFallback: 5 }],
    ['an integer option as a number', { depth: '-3' }, { depth: -3 }],
    ['an undeclared option as text', { other: '7' }, { other: '7' }],
    ['a bare undeclared option as true', { other: true }, { other: true }],
  ] as const)('reads %s', (_, options, typed) => {
    expect(typedOverrides(options, schema)).toEqual(typed)
  })

  it.each([
    [{ dryRun: 'maybe' }, '--dryRun takes true or false, got maybe'],
    [{ tag: true }, '--tag needs a value'],
    [{ maxCommitFallback: 'many' }, '--maxCommitFallback takes a number, got many'],
    [{ maxCommitFallback: ' ' }, '--maxCommitFallback takes a number, got  '],
    [{ formats: 'esm' }, '--formats cannot be set from the command line'],
    [{ scope: 'x' }, '--scope cannot be set from the command line'],
  ] as const)('refuses %j', (options, message) => {
    expect(() => typedOverrides(options, schema)).toThrow(message)
  })

  it('reads every option as text from a schema without properties', () => {
    expect(typedOverrides({ tag: '2' }, {})).toEqual({ tag: '2' })
  })
})
