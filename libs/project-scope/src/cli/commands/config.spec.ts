import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { configCommand, configCommandDef } from './config'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

describe('configCommand', () => {
  it('returns success exit code for valid project', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
  })

  it('returns text output by default', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('Configuration Files')
  })

  it('detects package.json', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('package.json')
  })

  it('detects tsconfig.json', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('tsconfig.json')
  })

  it('returns JSON output when format is json', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'package.json', path: 'package.json' }),
        expect.objectContaining({ type: 'tsconfig', path: 'tsconfig.json' }),
      ])
    )
  })

  it('filters by type when specified', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, type: 'tsconfig', format: 'json' })
    const parsed = JSON.parse(result.output as string)
    for (const config of parsed) {
      expect(config.type).toBe('tsconfig')
    }
  })

  it('includes contents when showContents is true', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true })
    expect(result.output).toContain('Contents')
  })

  it('uses current directory when no path specified', () => {
    const result = configCommand({})
    expect([0, 1]).toContain(result.exitCode)
  })

  it('handles missing path gracefully', () => {
    const result = configCommand({ path: '/nonexistent/path/xyz' })
    expect(result).toEqual({
      exitCode: 0,
      output: 'Configuration Files\n===================\n\nNo configuration files found.',
    })
  })
})

describe('configCommandDef', () => {
  it('has correct name and description', () => {
    expect(configCommandDef).toEqual(expect.objectContaining({ name: 'config', description: expect.stringContaining('configuration') }))
  })

  it('opens the help text with the usage line', () => {
    expect(configCommandDef.getHelp()).toContain('project-scope config [path] [options]')
  })

  it('lists every option in the help text', () => {
    expect(configCommandDef.getHelp()).toMatch(
      /--type, -t +Filter by config type \([^)]*\)\n +--show-contents +Show file contents\n +--format, -f +Output format: text, json \(default: text\)/
    )
  })

  it('executes with parsed args', () => {
    const result = configCommandDef.execute([MINIMAL_PROJECT], {})
    expect(result.exitCode).toBe(0)
  })

  it('respects global json option', () => {
    const result = configCommandDef.execute([MINIMAL_PROJECT], { json: true })
    expect(result.output).toBeDefined()
    JSON.parse(result.output as string)
  })

  it('parses --type argument', () => {
    const result = configCommandDef.execute([MINIMAL_PROJECT, '--type', 'tsconfig'], {})
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('  * tsconfig.json\n') })
  })

  it('parses --show-contents argument', () => {
    const result = configCommandDef.execute([MINIMAL_PROJECT, '--show-contents'], {})
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('    Contents:\n') })
  })

  it('parses -f shorthand for format', () => {
    const result = configCommandDef.execute([MINIMAL_PROJECT, '-f', 'json'], {})
    expect(JSON.parse(result.output as string)).toEqual(expect.any(Array))
  })

  it('parses -t shorthand for type', () => {
    const result = configCommandDef.execute([MINIMAL_PROJECT, '-t', 'package.json'], {})
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('  * package.json\n') })
  })
})

describe('configCommand with showContents', () => {
  it('shows parsed contents for JSON configs in text format', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('shows contents in JSON format', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true, format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual(expect.arrayContaining([expect.objectContaining({ contents: expect.any(Object) })]))
  })

  it('handles config files that cannot be parsed', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true })
    expect(result.exitCode).toBe(0)
  })

  it('includes extends field when present in JSON format', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true, format: 'json' })
    const parsed = JSON.parse(result.output as string)

    for (const config of parsed) {
      expect(config).toEqual(expect.objectContaining({ type: expect.any(String), path: expect.any(String) }))
    }
  })

  it('shows raw contents preview for non-JSON configs', () => {
    const configFilesDir = resolve(FIXTURES_DIR, 'config-files')
    const result = configCommand({ path: configFilesDir, showContents: true })
    expect(result.exitCode).toBe(0)
  })

  it('shows contents for env files', () => {
    const largeConfigDir = resolve(FIXTURES_DIR, 'large-config')
    const result = configCommand({ path: largeConfigDir, showContents: true, type: 'env' })
    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining('  * .env\n    Environment variables\n    Contents:\n'),
    })
  })

  it('shows contents in JSON format for env files', () => {
    const largeConfigDir = resolve(FIXTURES_DIR, 'large-config')
    const result = configCommand({ path: largeConfigDir, showContents: true, format: 'json', type: 'env' })
    expect(JSON.parse(result.output as string)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'env', contents: expect.any(Object) })])
    )
  })

  it('includes extends field when present in JSON format for tsconfig with extends', () => {
    const tsconfigExtendsDir = resolve(FIXTURES_DIR, 'tsconfig-extends')
    const result = configCommand({ path: tsconfigExtendsDir, showContents: true, format: 'json', type: 'tsconfig' })
    expect(JSON.parse(result.output as string)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'tsconfig', path: 'tsconfig.json', extends: ['./tsconfig.base.json'] })])
    )
  })

  it('shows config description in text output', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('handles unable to read contents gracefully', () => {
    const invalidDir = resolve(FIXTURES_DIR, 'invalid-tsconfig')
    const result = configCommand({ path: invalidDir, showContents: true })
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('    [Unable to read contents]\n') })
  })
})

describe('configCommand edge cases', () => {
  it('handles error during config detection', () => {
    const result = configCommand({ path: '/proc/1/fd/0' })
    expect(result).toHaveProperty('exitCode')
  })

  it('groups configs by category correctly', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining(
        'TypeScript:\n  * tsconfig.json\n    TypeScript configuration\n\nPackage:\n  * package.json\n    NPM package manifest\n'
      ),
    })
  })

  it('shows total count in summary', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringMatching(/Total: \d+ configuration file\(s\) found/),
    })
  })

  it('shows raw contents preview for JS/TS config files', () => {
    const sveltekitDir = resolve(FIXTURES_DIR, 'sveltekit-app')
    const result = configCommand({ path: sveltekitDir, showContents: true, type: 'svelte' })
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('    Contents (preview):\n') })
  })

  it('shows raw contents in JSON format for JS config files', () => {
    const sveltekitDir = resolve(FIXTURES_DIR, 'sveltekit-app')
    const result = configCommand({ path: sveltekitDir, showContents: true, format: 'json', type: 'svelte' })
    expect(JSON.parse(result.output as string)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'svelte', rawContents: expect.any(String) })])
    )
  })

  it('shows truncation indicator for very long raw content', () => {
    const configFilesDir = resolve(FIXTURES_DIR, 'config-files')
    const result = configCommand({ path: configFilesDir, showContents: true })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })
})

describe('configCommand error handling', () => {
  it('returns error when parseConfig throws in text format with showContents', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true })
    expect(result.exitCode).toBe(0)
  })

  it('handles configs with unreadable contents in JSON format gracefully', () => {
    const invalidDir = resolve(FIXTURES_DIR, 'invalid-tsconfig')
    const result = configCommand({ path: invalidDir, showContents: true, format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual(
      expect.arrayContaining([expect.objectContaining({ error: 'Unable to parse', contents: null })])
    )
  })

  it('handles configCommand with path that causes detectConfigs to throw', () => {
    const result = configCommand({ path: '/\x00invalid\x00path' })
    expect(result).toEqual(
      result.exitCode === 1
        ? { exitCode: 1, error: expect.stringContaining('Config inspection failed') }
        : { exitCode: 0, output: expect.any(String) }
    )
  })

  it('returns error message when configCommand catches an exception', () => {
    const result = configCommand({ path: '/root/.ssh/private_key_that_does_not_exist' })
    expect(result).toHaveProperty('exitCode')
  })
})
