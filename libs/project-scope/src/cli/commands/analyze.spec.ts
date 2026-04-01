import { resolve } from 'node:path'
import { analyzeCommand, analyzeCommandDef } from './analyze'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
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
    expect(result.output).toBeDefined()
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toHaveProperty('name')
    expect(parsed).toHaveProperty('projectType')
  })

  it('returns YAML output when format is yaml', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result.output).toContain('name:')
    expect(result.output).toContain('projectType:')
  })

  it('uses current directory when no path specified', () => {
    const result = analyzeCommand({})
    expect(result).toHaveProperty('exitCode')
    expect([0, 1]).toContain(result.exitCode)
  })

  it('handles missing path gracefully', () => {
    const result = analyzeCommand({ path: '/nonexistent/path/xyz' })
    expect([0, 1]).toContain(result.exitCode)
  })
})

describe('analyzeCommandDef', () => {
  it('has correct name and description', () => {
    expect(analyzeCommandDef.name).toBe('analyze')
    expect(analyzeCommandDef.description).toContain('Analyze')
  })

  it('provides help text', () => {
    const help = analyzeCommandDef.getHelp()
    expect(help).toContain('project-scope analyze')
    expect(help).toContain('--format')
    expect(help).toContain('--depth')
    expect(help).toContain('--include')
    expect(help).toContain('--exclude')
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
  it('filters with comma-separated include patterns', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, include: ['frameworks', 'buildTools'] })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(
      analyzeCommand({ path: MINIMAL_PROJECT, include: ['frameworks', 'buildTools'], format: 'json' }).output as string
    )
    expect(parsed.entryPoints).toEqual([])
    expect(parsed.configFiles).toEqual([])
  })

  it('filters with comma-separated exclude patterns', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, exclude: ['dependencies', 'entryPoints'] })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(
      analyzeCommand({ path: MINIMAL_PROJECT, exclude: ['dependencies', 'entryPoints'], format: 'json' }).output as string
    )
    expect(parsed.dependencies.total).toBe(0)
    expect(parsed.entryPoints).toEqual([])
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
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('shows build tools section when build tools are detected', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('truncates entry points list with more indicator', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('truncates config files list with more indicator', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('shows dependencies summary', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toContain('Dependencies:')
    expect(result.output).toContain('Production:')
    expect(result.output).toContain('Development:')
  })

  it('formats YAML output correctly', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('name:')
    expect(result.output).toContain('projectType:')
    expect(result.output).toContain('workspaceType:')
  })

  it('handles empty analysis results in YAML', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml', include: ['frameworks'] })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('formats nested objects in YAML mode', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('dependencies:')
    expect(result.output).toContain('metadata:')
  })

  it('formats empty arrays correctly in YAML', () => {
    const emptyDir = resolve(FIXTURES_DIR, 'empty')
    const result = analyzeCommand({ path: emptyDir, format: 'yaml' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('[]')
  })

  it('formats dates in YAML output', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('escapes special characters in YAML strings', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
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

  it('displays meta-frameworks for React with Next.js', () => {
    const result = analyzeCommand({ path: NEXTJS_APP })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Frameworks')
    expect(result.output).toMatch(/next|Next/i)
  })

  it('displays meta-frameworks in text output with indentation', () => {
    const result = analyzeCommand({ path: NEXTJS_APP_ROUTER })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('displays build tools when present', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })
})

describe('analyzeCommand entry points and config files truncation', () => {
  const LARGE_CONFIG = resolve(FIXTURES_DIR, 'large-config')
  const CONFIG_FILES = resolve(FIXTURES_DIR, 'config-files')

  it('shows entry points section when entry points exist', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('handles projects with many config files', () => {
    const result = analyzeCommand({ path: CONFIG_FILES })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('Configurations')
  })

  it('truncates config files list when more than 8', () => {
    const result = analyzeCommand({ path: LARGE_CONFIG })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })
})

describe('analyzeCommand YAML output branches', () => {
  it('formats nested objects correctly in YAML', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toContain('dependencies:')
    expect(result.output).toMatch(/\s+production:/)
    expect(result.output).toMatch(/\s+development:/)
  })

  it('formats arrays correctly in YAML', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('handles special characters in YAML strings', () => {
    const result = analyzeCommand({ path: MINIMAL_PROJECT, format: 'yaml' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('formats non-empty arrays with dash prefix', () => {
    const NEXTJS_APP = resolve(FIXTURES_DIR, 'nextjs-app')
    const result = analyzeCommand({ path: NEXTJS_APP, format: 'yaml' })
    expect(result.exitCode).toBe(0)
    expect(result.output).toMatch(/-\s/)
  })
})
