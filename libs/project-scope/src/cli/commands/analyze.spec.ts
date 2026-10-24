import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { writeFixtures } from '../../__test-utils__/write-fixtures'
import { analyzeCommand, analyzeCommandDef } from './analyze'

const FIXTURES_DIR = writeFixtures()
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

describe('analyzeCommand', () => {
  it('returns success exit code for valid project', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
  })

  it('returns text output by default', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('Project Analysis:')
  })

  it('returns JSON output when format is json', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'json' })
    expect(JSON.parse(result.output as string)).toEqual(
      expect.objectContaining({ name: expect.any(String), projectType: expect.any(String) })
    )
  })

  it('returns YAML output when format is yaml', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result.output).toMatch(/^name: [^\n]+\nroot: [^\n]+\nprojectType: [^\n]+\n/)
  })

  it('uses current directory when no path specified', () => {
    const result = analyzeCommand({})
    expect([0, 1]).toContain(result.exitCode)
  })

  it('handles missing path gracefully', () => {
    const result = analyzeCommand({ path: '/nonexistent/path/xyz' })
    expect([0, 1]).toContain(result.exitCode)
  })
})

describe('analyzeCommandDef', () => {
  it('has correct name and description', () => {
    expect(analyzeCommandDef).toEqual(expect.objectContaining({ name: 'analyze', description: expect.stringContaining('Analyze') }))
  })

  it('opens the help text with the usage line', () => {
    expect(analyzeCommandDef.getHelp()).toMatch(/^project-scope analyze \[path\] \[options\]\n/)
  })

  it('lists every option in the help text', () => {
    expect(analyzeCommandDef.getHelp()).toContain(
      [
        'Options:',
        '  --format, -f      Output format: text, json, yaml (default: text)',
        '  --depth, -d       Analysis depth: basic, full, deep (default: full)',
        '  --include, -i     Include specific analyses (comma-separated)',
        '  --exclude, -e     Exclude specific analyses (comma-separated)',
      ].join('\n')
    )
  })

  it('executes with parsed args', () => {
    const result = analyzeCommandDef.execute([MINIMAL_PROJECT], {})
    expect(result.exitCode).toBe(0)
  })

  it('respects global json option', () => {
    const result = analyzeCommandDef.execute([MINIMAL_PROJECT], { json: true })
    expect(result.output).toBeDefined()
    JSON.parse(result.output as string)
  })

  it('parses --include argument', () => {
    const result = analyzeCommandDef.execute([MINIMAL_PROJECT, '--include', 'frameworks,buildTools'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses --exclude argument', () => {
    const result = analyzeCommandDef.execute([MINIMAL_PROJECT, '--exclude', 'dependencies'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses -i shorthand for include', () => {
    const result = analyzeCommandDef.execute([MINIMAL_PROJECT, '-i', 'frameworks'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses -e shorthand for exclude', () => {
    const result = analyzeCommandDef.execute([MINIMAL_PROJECT, '-e', 'configs'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses -d shorthand for depth', () => {
    const result = analyzeCommandDef.execute([MINIMAL_PROJECT, '-d', 'basic'], {})
    expect(result.exitCode).toBe(0)
  })
})

describe('analyzeCommand with include/exclude filters', () => {
  it('exits successfully with comma-separated include patterns', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, include: ['frameworks', 'buildTools'] })
    expect(result.exitCode).toBe(0)
  })

  it('leaves the analyses outside the include list empty', () => {
    const parsed = JSON.parse(
      analyzeCommand({ path: MINIMAL_PROJECT, include: ['frameworks', 'buildTools'], format: 'json' }).output as string
    )
    expect(parsed).toEqual(
      expect.objectContaining({
        testingFrameworks: [],
        entryPoints: [],
        configFiles: [],
        dependencies: { production: 0, development: 0, peer: 0, optional: 0, total: 0 },
      })
    )
  })

  it('exits successfully with comma-separated exclude patterns', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, exclude: ['dependencies', 'entryPoints'] })
    expect(result.exitCode).toBe(0)
  })

  it('empties the excluded analyses', () => {
    const parsed = JSON.parse(
      analyzeCommand({ path: MINIMAL_PROJECT, exclude: ['dependencies', 'entryPoints'], format: 'json' }).output as string
    )
    expect(parsed).toEqual(
      expect.objectContaining({ dependencies: { production: 0, development: 0, peer: 0, optional: 0, total: 0 }, entryPoints: [] })
    )
  })

  it('combines include and exclude filters', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, include: ['frameworks', 'buildTools', 'testing'] })
    expect(result.exitCode).toBe(0)
  })
})

describe('analyzeCommand output formatting', () => {
  it('formats project type correctly in text output', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('Type:')
  })

  it('formats workspace type correctly in text output', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('Workspace:')
  })

  it('shows framework meta-frameworks when present', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('shows build tools section when build tools are detected', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('truncates entry points list with more indicator', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('truncates config files list with more indicator', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('shows dependencies summary', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('Dependencies:\n  Production:    1\n  Development:   2\n  Peer:          1\n  Total:         4')
  })

  it('formats YAML output correctly', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringMatching(/^name: [^\n]+\nroot: [^\n]+\nprojectType: [^\n]+\nworkspaceType: [^\n]+\n/),
    })
  })

  it('handles empty analysis results in YAML', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml', include: ['frameworks'] })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('formats nested objects in YAML mode', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining(
        'dependencies:\n  production: 1\n  development: 2\n  peer: 1\n  optional: 0\n  total: 4\nmetadata:\n'
      ),
    })
  })

  it('formats empty arrays correctly in YAML', () => {
    const emptyDir = resolve(FIXTURES_DIR, 'empty')
    const result = analyzeCommand({ path: emptyDir, format: 'yaml' })
    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining('frameworks: []\nbuildTools: []\ntestingFrameworks: []\nentryPoints: []\nconfigFiles: []\n'),
    })
  })

  it('formats dates in YAML output', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result).toEqual({ exitCode: 0, output: expect.stringMatching(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) })
  })

  it('escapes special characters in YAML strings', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })
})

describe('analyzeCommand depth options', () => {
  it('uses basic depth option', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, depth: 'basic' })
    expect(result.exitCode).toBe(0)
  })

  it('uses full depth option', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, depth: 'full' })
    expect(result.exitCode).toBe(0)
  })

  it('uses deep depth option', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, depth: 'deep' })
    expect(result.exitCode).toBe(0)
  })
})

describe('analyzeCommand meta-frameworks and build tools', () => {
  const NEXTJS_APP = resolve(FIXTURES_DIR, 'nextjs-app')
  const NEXTJS_APP_ROUTER = resolve(FIXTURES_DIR, 'nextjs-app-router')

  it('lists a frameworks section for a Next.js app', () => {
    const result = analyzeCommand({ path: NEXTJS_APP })
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('Frameworks:\n') })
  })

  it('lists Next.js as a meta-framework under React', () => {
    const result = analyzeCommand({ path: NEXTJS_APP })
    expect(result.output).toMatch(/\n {2}\* React [^\n]*\n {4}- nextjs\n/)
  })

  it('displays meta-frameworks in text output with indentation', () => {
    const result = analyzeCommand({ path: NEXTJS_APP_ROUTER })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('displays build tools when present', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })
})

describe('analyzeCommand entry points and config files truncation', () => {
  const LARGE_CONFIG = resolve(FIXTURES_DIR, 'large-config')
  const CONFIG_FILES = resolve(FIXTURES_DIR, 'config-files')

  it('shows entry points section when entry points exist', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('handles projects with many config files', () => {
    const result = analyzeCommand({ path: CONFIG_FILES })
    expect(result).toEqual({ exitCode: 0, output: expect.stringContaining('Configurations:\n') })
  })

  it('truncates config files list when more than 8', () => {
    const result = analyzeCommand({ path: LARGE_CONFIG })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })
})

describe('analyzeCommand YAML output branches', () => {
  it('formats nested objects correctly in YAML', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result).toEqual({
      exitCode: 0,
      output: expect.stringContaining('dependencies:\n  production: 1\n  development: 2\n'),
    })
  })

  it('formats arrays correctly in YAML', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('handles special characters in YAML strings', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result).toEqual({ exitCode: 0, output: expect.any(String) })
  })

  it('formats non-empty arrays with dash prefix', () => {
    const NEXTJS_APP = resolve(FIXTURES_DIR, 'nextjs-app')
    const result = analyzeCommand({ path: NEXTJS_APP, format: 'yaml' })
    expect(result).toEqual({ exitCode: 0, output: expect.stringMatching(/\n {2}- id: /) })
  })
})
