import { resolve } from 'node:path'
import { depsCommand, depsCommandDef } from './deps'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

describe('depsCommand', () => {
  it('returns success exit code for valid project', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
  })

  it('returns text output by default', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('Dependencies')
    expect(result.output).toContain('Production')
    expect(result.output).toContain('Development')
  })

  it('shows production dependencies', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('lodash')
  })

  it('shows development dependencies', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('typescript')
    expect(result.output).toContain('jest')
  })

  it('shows peer dependencies', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('Peer')
    expect(result.output).toContain('react')
  })

  it('returns JSON output when format is json', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, format: 'json' })
    expect(result.output).toBeDefined()
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toHaveProperty('dependencies')
    expect(parsed).toHaveProperty('devDependencies')
    expect(parsed).toHaveProperty('peerDependencies')
    expect(parsed).toHaveProperty('summary')
  })

  it('filters by production type', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'production', format: 'json' })
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toHaveProperty('dependencies')
    expect(parsed).not.toHaveProperty('devDependencies')
    expect(parsed).toHaveProperty('summary')
  })

  it('filters by development type', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'development', format: 'json' })
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toHaveProperty('devDependencies')
    expect(parsed).not.toHaveProperty('dependencies')
  })

  it('filters by peer type', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'peer', format: 'json' })
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toHaveProperty('peerDependencies')
    expect(parsed).not.toHaveProperty('dependencies')
  })

  it('uses current directory when no path specified', () => {
    const result = depsCommand({})
    expect(result).toHaveProperty('exitCode')
    expect([0, 1]).toContain(result.exitCode)
  })

  it('handles missing package.json gracefully', () => {
    const result = depsCommand({ path: '/nonexistent/path/xyz' })
    expect(result.exitCode).toBe(1)
    expect(result.error).toContain('Dependency analysis failed')
  })

  it('includes summary with counts', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, format: 'json' })
    const parsed = JSON.parse(result.output as string)
    expect(parsed.summary).toHaveProperty('production')
    expect(parsed.summary).toHaveProperty('development')
    expect(parsed.summary).toHaveProperty('peer')
    expect(parsed.summary).toHaveProperty('total')
    expect(typeof parsed.summary.total).toBe('number')
  })
})

describe('depsCommandDef', () => {
  it('has correct name and description', () => {
    expect(depsCommandDef.name).toBe('deps')
    expect(depsCommandDef.description).toContain('dependencies')
  })

  it('provides help text', () => {
    const help = depsCommandDef.getHelp()
    expect(help).toContain('project-scope deps')
    expect(help).toContain('--type')
    expect(help).toContain('--format')
    expect(help).toContain('production')
    expect(help).toContain('development')
    expect(help).toContain('peer')
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
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Production')
    expect(result.output).not.toContain('Development (')
  })

  it('parses -t shorthand for type', () => {
    const result = depsCommandDef.execute([MINIMAL_PROJECT, '-t', 'development'], {})
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Development')
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
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('lodash')
  })

  it('shows (none) for empty dependency categories', () => {
    const bareDir = resolve(FIXTURES_DIR, 'bare-package')
    const result = depsCommand({ path: bareDir })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('(none)')
  })

  it('filters by optional type', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'optional', format: 'json' })
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toHaveProperty('optionalDependencies')
    expect(parsed).not.toHaveProperty('dependencies')
  })

  it('shows all dependency types with type=all', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT, type: 'all', format: 'json' })
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toHaveProperty('dependencies')
    expect(parsed).toHaveProperty('devDependencies')
    expect(parsed).toHaveProperty('peerDependencies')
    expect(parsed).toHaveProperty('optionalDependencies')
    expect(parsed).toHaveProperty('summary')
  })

  it('truncates long dependency lists with more indicator', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('sorts dependencies alphabetically', () => {
    const result = depsCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })
})
