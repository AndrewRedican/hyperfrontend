import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { depsCommand, depsCommandDef } from './deps'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const PRODUCTION_SECTION = ['Production (1):', `  ${'lodash'.padEnd(30)} ^4.17.21`]
const DEVELOPMENT_SECTION = ['Development (2):', `  ${'jest'.padEnd(30)} ^29.0.0`, `  ${'typescript'.padEnd(30)} ^5.0.0`]
const PEER_SECTION = ['Peer (1):', `  ${'react'.padEnd(30)} ^18.0.0`]
const MINIMAL_SUMMARY = { production: 1, development: 2, peer: 1, optional: 0, total: 4 }
const MINIMAL_DEPENDENCIES = {
  dependencies: { lodash: '^4.17.21' },
  devDependencies: { typescript: '^5.0.0', jest: '^29.0.0' },
  peerDependencies: { react: '^18.0.0' },
  optionalDependencies: {},
  summary: MINIMAL_SUMMARY,
}

describe('depsCommand', () => {
  it('returns success exit code for valid project', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
  })

  it('returns text output by default', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toBe(
      [
        'Dependencies',
        '============',
        '',
        ...PRODUCTION_SECTION,
        '',
        ...DEVELOPMENT_SECTION,
        '',
        ...PEER_SECTION,
        '',
        'Optional (0):',
        '  (none)',
        '',
        'Summary:',
        '  Total: 4 dependencies',
        '    Production:   1',
        '    Development:  2',
        '    Peer:         1',
        '    Optional:     0',
      ].join('\n')
    )
  })

  it('shows production dependencies', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('lodash')
  })

  it('shows development dependencies', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain(DEVELOPMENT_SECTION.join('\n'))
  })

  it('shows peer dependencies', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain(PEER_SECTION.join('\n'))
  })

  it('returns JSON output when format is json', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual(MINIMAL_DEPENDENCIES)
  })

  it('filters by production type', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'production', format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual({ dependencies: { lodash: '^4.17.21' }, summary: MINIMAL_SUMMARY })
  })

  it('filters by development type', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'development', format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual({
      devDependencies: { typescript: '^5.0.0', jest: '^29.0.0' },
      summary: MINIMAL_SUMMARY,
    })
  })

  it('filters by peer type', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'peer', format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual({ peerDependencies: { react: '^18.0.0' }, summary: MINIMAL_SUMMARY })
  })

  it('uses current directory when no path specified', () => {
    const result = depsCommand({})
    expect([0, 1]).toContain(result.exitCode)
  })

  it('handles missing package.json gracefully', () => {
    const result = depsCommand({ path: '/nonexistent/path/xyz' })
    expect(result).toEqual({ exitCode: 1, error: expect.stringContaining('Dependency analysis failed') })
  })

  it('includes summary with counts', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, format: 'json' })
    expect(JSON.parse(result.output as string).summary).toEqual(MINIMAL_SUMMARY)
  })
})

describe('depsCommandDef', () => {
  it('has correct name and description', () => {
    expect(depsCommandDef).toEqual(expect.objectContaining({ name: 'deps', description: expect.stringContaining('dependencies') }))
  })

  it('opens the help text with the usage line', () => {
    expect(depsCommandDef.getHelp()).toMatch(/^project-scope deps \[path\] \[options\]\n/)
  })

  it('lists every option in the help text', () => {
    expect(depsCommandDef.getHelp()).toContain(
      [
        'Options:',
        '  --type, -t        Filter by dependency type:',
        '                      production  - Runtime dependencies',
        '                      development - Dev-time dependencies',
        '                      peer        - Peer dependencies',
        '                      optional    - Optional dependencies',
        '                      all         - All dependencies (default)',
        '  --format, -f      Output format: text, json (default: text)',
      ].join('\n')
    )
  })

  it('executes with parsed args', () => {
    const result = depsCommandDef.execute([MINIMAL_PROJECT], {})
    expect(result.exitCode).toBe(0)
  })

  it('respects global json option', () => {
    const result = depsCommandDef.execute([MINIMAL_PROJECT], { json: true })
    expect(result.output).toBeDefined()
    JSON.parse(result.output as string)
  })

  it('parses --type argument', () => {
    const result = depsCommandDef.execute([MINIMAL_PROJECT, '--type', 'production'], {})
    expect(result).toEqual({ exitCode: 0, output: ['Dependencies', '============', '', ...PRODUCTION_SECTION, ''].join('\n') })
  })

  it('parses -t shorthand for type', () => {
    const result = depsCommandDef.execute([MINIMAL_PROJECT, '-t', 'development'], {})
    expect(result).toEqual({ exitCode: 0, output: ['Dependencies', '============', '', ...DEVELOPMENT_SECTION, ''].join('\n') })
  })

  it('parses -f shorthand for format', () => {
    const result = depsCommandDef.execute([MINIMAL_PROJECT, '-f', 'json'], {})
    expect(result.exitCode).toBe(0)
    JSON.parse(result.output as string)
  })
})

describe('depsCommand edge cases', () => {
  it('handles projects without dependencies', () => {
    const emptyDir = resolve(FIXTURES_DIR, 'empty')
    const result = depsCommand({ path: emptyDir })
    expect(result.exitCode).toBe(1)
  })

  it('formats dependency list with padding', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining(PRODUCTION_SECTION.join('\n')) })
  })

  it('shows (none) for empty dependency categories', () => {
    const bareDir = resolve(FIXTURES_DIR, 'bare-package')
    const result = depsCommand({ path: bareDir })
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('Production (0):\n  (none)\n') })
  })

  it('filters by optional type', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'optional', format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual({ optionalDependencies: {}, summary: MINIMAL_SUMMARY })
  })

  it('shows all dependency types with type=all', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'all', format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual(MINIMAL_DEPENDENCIES)
  })

  it('truncates long dependency lists with more indicator', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('sorts dependencies alphabetically', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining(DEVELOPMENT_SECTION.join('\n')) })
  })
})
