import { describe, expect, it } from '@hyperfrontend/testing'
import { parseArgs } from './args.ts'

describe('parseArgs', () => {
  it('defaults to linting the given paths with the stylish report', () => {
    expect(parseArgs(['.', 'src/a.ts'])).toEqual({
      patterns: ['.', 'src/a.ts'],
      fix: false,
      fixDryRun: false,
      format: 'stylish',
      maxWarnings: -1,
      stdin: false,
      stdinFilename: null,
      errorOnUnmatchedPattern: true,
      config: null,
      help: false,
    })
  })

  it('reads the boolean flags', () => {
    expect(parseArgs(['--fix', '--fix-dry-run', '--stdin', '--no-error-on-unmatched-pattern', '--help'])).toMatchObject({
      fix: true,
      fixDryRun: true,
      stdin: true,
      errorOnUnmatchedPattern: false,
      help: true,
    })
  })

  it('reads a value given as the next argument', () => {
    expect(parseArgs(['--format', 'json', '--max-warnings', '0', '--stdin-filename', 'a.ts', '--config', 'c.ts'])).toMatchObject({
      format: 'json',
      maxWarnings: 0,
      stdinFilename: 'a.ts',
      config: 'c.ts',
    })
  })

  it('reads a value given with an equals sign', () => {
    expect(parseArgs(['--max-warnings=5'])).toMatchObject({ maxWarnings: 5 })
  })

  it('rejects an unknown format', () => {
    expect(parseArgs(['--format', 'xml'])).toEqual({ error: 'Unknown format xml; use stylish or json' })
  })

  it('rejects an unknown option', () => {
    expect(parseArgs(['--colour'])).toEqual({ error: 'Unknown option --colour' })
  })

  it('reads a missing value as empty', () => {
    expect(parseArgs(['--stdin-filename'])).toMatchObject({ stdinFilename: '' })
  })
})
