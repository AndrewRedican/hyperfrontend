import { parseCliArgs } from './args'

describe('parseCliArgs', () => {
  it('reads the command and a string flag value', () => {
    expect(parseCliArgs(['build', '--out', './dist'])).toEqual(expect.objectContaining({ command: 'build' }))
  })

  it('maps every string flag to its key', () => {
    expect(
      parseCliArgs([
        'init',
        '--name',
        'clock',
        '--version',
        '1.0.0',
        '--protocol',
        'v2',
        '--out',
        'd',
        '--url',
        '/u',
        '--contract',
        'c.json',
        '--config',
        'f.ts',
        '--cwd',
        '/w',
        '--entry',
        'e.ts',
      ]).flags
    ).toEqual(
      expect.objectContaining({
        name: 'clock',
        version: '1.0.0',
        protocol: 'v2',
        out: 'd',
        url: '/u',
        contract: 'c.json',
        config: 'f.ts',
        cwd: '/w',
        entry: 'e.ts',
      })
    )
  })

  it('sets every boolean flag when present', () => {
    expect(parseCliArgs(['init', '--ci', '--yes', '--dry-run', '--help']).flags).toEqual(
      expect.objectContaining({ ci: true, yes: true, dryRun: true, help: true })
    )
  })

  it('defaults every boolean flag to false when absent', () => {
    expect(parseCliArgs(['init']).flags).toEqual(expect.objectContaining({ ci: false, yes: false, dryRun: false, help: false }))
  })

  it('treats -h as the help flag', () => {
    expect(parseCliArgs(['-h']).flags.help).toBe(true)
  })

  it('leaves the command undefined when only flags are given', () => {
    expect(parseCliArgs(['--help']).command).toBeUndefined()
  })

  it('throws on an unknown flag', () => {
    expect(() => parseCliArgs(['--bogus'])).toThrow('Unknown flag: --bogus')
  })

  it('throws when a value flag has no value', () => {
    expect(() => parseCliArgs(['--name'])).toThrow('--name requires a value')
  })

  it('throws on a second positional argument', () => {
    expect(() => parseCliArgs(['init', 'build'])).toThrow('Unexpected argument: build')
  })
})
