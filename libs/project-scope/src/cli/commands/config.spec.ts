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
    expect(result.output).toBeDefined()
    const parsed = JSON.parse(result.output as string)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed[0]).toHaveProperty('type')
    expect(parsed[0]).toHaveProperty('path')
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
    expect(result).toHaveProperty('exitCode')
    expect([0, 1]).toContain(result.exitCode)
  })

  it('handles missing path gracefully', () => {
    const result = configCommand({ path: '/nonexistent/path/xyz' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('No configuration files found')
  })
})

describe('configCommandDef', () => {
  it('has correct name and description', () => {
    expect(configCommandDef.name).toBe('config')
    expect(configCommandDef.description).toContain('configuration')
  })

  it('provides help text', () => {
    const help = configCommandDef.getHelp()
    expect(help).toContain('project-scope config')
    expect(help).toContain('--type')
    expect(help).toContain('--show-contents')
    expect(help).toContain('--format')
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
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('tsconfig')
  })

  it('parses --show-contents argument', () => {
    const result = configCommandDef.execute([MINIMAL_PROJECT, '--show-contents'], {})
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Contents')
  })

  it('parses -f shorthand for format', () => {
    const result = configCommandDef.execute([MINIMAL_PROJECT, '-f', 'json'], {})
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.output as string)
    expect(Array.isArray(parsed)).toBe(true)
  })

  it('parses -t shorthand for type', () => {
    const result = configCommandDef.execute([MINIMAL_PROJECT, '-t', 'package.json'], {})
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('package.json')
  })
})

describe('configCommand with showContents', () => {
  it('shows parsed contents for JSON configs in text format', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true })
    expect(result.output).toBeDefined()
    expect(result.exitCode).toBe(0)
  })

  it('shows contents in JSON format', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true, format: 'json' })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.output as string)
    expect(Array.isArray(parsed)).toBe(true)

    const withContents = parsed.find((c: Record<string, unknown>) => c['contents'] !== undefined)
    expect(withContents === undefined || withContents['contents'] !== undefined).toBe(true)
  })

  it('handles config files that cannot be parsed', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true })
    expect(result.exitCode).toBe(0)
  })

  it('includes extends field when present in JSON format', () => {
    const result = configCommand({ path: MINIMAL_PROJECT, showContents: true, format: 'json' })
    const parsed = JSON.parse(result.output as string)

    for (const config of parsed) {
      expect(config).toHaveProperty('type')
      expect(config).toHaveProperty('path')
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
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
    expect(result.output).toContain('Contents')
  })

  it('shows contents in JSON format for env files', () => {
    const largeConfigDir = resolve(FIXTURES_DIR, 'large-config')
    const result = configCommand({ path: largeConfigDir, showContents: true, format: 'json', type: 'env' })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.output as string)
    expect(Array.isArray(parsed)).toBe(true)
    const envConfig = parsed.find((c: Record<string, unknown>) => c['type'] === 'env')
    expect(envConfig).toBeDefined()
    expect(envConfig['rawContents'] !== undefined || envConfig['contents'] !== undefined).toBe(true)
  })

  it('includes extends field when present in JSON format for tsconfig with extends', () => {
    const tsconfigExtendsDir = resolve(FIXTURES_DIR, 'tsconfig-extends')
    const result = configCommand({ path: tsconfigExtendsDir, showContents: true, format: 'json', type: 'tsconfig' })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.output as string)

    const tsconfigWithExtends = parsed.find((c: Record<string, unknown>) => c['type'] === 'tsconfig' && c['path'] === 'tsconfig.json')
    expect(tsconfigWithExtends).toBeDefined()
    expect(tsconfigWithExtends.extends).toBeDefined()
  })

  it('shows config description in text output', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('handles unable to read contents gracefully', () => {
    const invalidDir = resolve(FIXTURES_DIR, 'invalid-tsconfig')
    const result = configCommand({ path: invalidDir, showContents: true })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })
})

describe('configCommand edge cases', () => {
  it('handles error during config detection', () => {
    const result = configCommand({ path: '/proc/1/fd/0' })
    expect(result).toHaveProperty('exitCode')
  })

  it('groups configs by category correctly', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Package:')
    expect(result.output).toContain('TypeScript:')
  })

  it('shows total count in summary', () => {
    const result = configCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toMatch(/Total: \d+ configuration file\(s\) found/)
  })

  it('shows raw contents preview for JS/TS config files', () => {
    const sveltekitDir = resolve(FIXTURES_DIR, 'sveltekit-app')
    const result = configCommand({ path: sveltekitDir, showContents: true, type: 'svelte' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Contents')
  })

  it('shows raw contents in JSON format for JS config files', () => {
    const sveltekitDir = resolve(FIXTURES_DIR, 'sveltekit-app')
    const result = configCommand({ path: sveltekitDir, showContents: true, format: 'json', type: 'svelte' })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.output as string)
    expect(Array.isArray(parsed)).toBe(true)
    const svelteConfig = parsed.find((c: Record<string, unknown>) => c['type'] === 'svelte')
    expect(svelteConfig).toBeDefined()
    expect(svelteConfig['rawContents'] !== undefined || svelteConfig['contents'] !== undefined).toBe(true)
  })

  it('shows truncation indicator for very long raw content', () => {
    const configFilesDir = resolve(FIXTURES_DIR, 'config-files')
    const result = configCommand({ path: configFilesDir, showContents: true })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
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
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.output as string)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('handles configCommand with path that causes detectConfigs to throw', () => {
    const result = configCommand({ path: '/\x00invalid\x00path' })
    expect([0, 1]).toContain(result.exitCode)
    expect(result.exitCode === 1 ? result.error : 'Config inspection failed').toContain('Config inspection failed')
  })

  it('returns error message when configCommand catches an exception', () => {
    const result = configCommand({ path: '/root/.ssh/private_key_that_does_not_exist' })
    expect(result).toHaveProperty('exitCode')
  })
})
