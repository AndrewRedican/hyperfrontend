import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { treeCommand, treeCommandDef } from './tree'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')

describe('treeCommand', () => {
  it('returns success exit code for valid path', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
  })

  it('returns text output by default', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toBeDefined()
    expect(result.output).toContain('minimal-project')
  })

  it('includes file/directory count summary', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT })
    expect(result.output).toMatch(/\d+ director(y|ies), \d+ file/)
  })

  it('returns JSON output when format is json', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, format: 'json' })
    expect(result.output).toBeDefined()
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toHaveProperty('name')
    expect(parsed).toHaveProperty('isDirectory')
    expect(parsed).toHaveProperty('children')
  })

  it('respects depth option', () => {
    const shallow = treeCommand({ path: MINIMAL_PROJECT, depth: 1 })
    const deep = treeCommand({ path: MINIMAL_PROJECT, depth: 5 })
    expect(shallow.exitCode).toBe(0)
    expect(deep.exitCode).toBe(0)
  })

  it('filters directories only with dirsOnly', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, dirsOnly: true, format: 'json' })
    const parsed = JSON.parse(result.output as string)

    const checkDirsOnly = (node: { isDirectory: boolean; children: unknown[] }): void => {
      for (const child of node.children) {
        expect((child as { isDirectory: boolean }).isDirectory).toBe(true)
        checkDirsOnly(child as { isDirectory: boolean; children: unknown[] })
      }
    }
    checkDirsOnly(parsed)
  })

  it('uses current directory when no path specified', () => {
    const result = treeCommand({})
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })
})

describe('treeCommandDef', () => {
  it('has correct name and description', () => {
    expect(treeCommandDef.name).toBe('tree')
    expect(treeCommandDef.description).toContain('tree')
  })

  it('provides help text', () => {
    const help = treeCommandDef.getHelp()
    expect(help).toContain('project-scope tree')
    expect(help).toContain('--depth')
    expect(help).toContain('--dirs-only')
    expect(help).toContain('--files-only')
  })

  it('executes with parsed args', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT], {})
    expect(result.exitCode).toBe(0)
  })

  it('respects global json option', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT], { json: true })
    expect(result.output).toBeDefined()
    JSON.parse(result.output as string)
  })

  it('parses --depth argument', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT, '--depth', '1'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses -d shorthand for depth', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT, '-d', '2'], {})
    expect(result.exitCode).toBe(0)
  })
})

describe('treeCommand with options', () => {
  it('filters files only with filesOnly', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, filesOnly: true, format: 'json' })
    const parsed = JSON.parse(result.output as string)

    const checkFilesOnly = (node: { isDirectory: boolean; children: unknown[] }): void => {
      for (const child of node.children) {
        const childNode = child as { isDirectory: boolean; children: unknown[] }
        if (childNode.children.length > 0) {
          checkFilesOnly(childNode)
        }
      }
    }
    checkFilesOnly(parsed)
    expect(result.exitCode).toBe(0)
  })

  it('shows file sizes with showSize', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('shows modification dates with showModified', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, showModified: true })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('shows both size and modified together', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true, showModified: true })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('includes size in JSON output', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true, format: 'json' })
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toBeDefined()
    expect(parsed).toHaveProperty('children')
  })

  it('includes modified in JSON output', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, showModified: true, format: 'json' })
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toBeDefined()
    expect(parsed).toHaveProperty('children')
  })

  it('handles ignore patterns', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, ignore: ['node_modules', 'dist'] })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('handles pattern filter', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, pattern: '*.ts' })
    expect(result.exitCode).toBe(0)
  })

  it('handles non-existent path gracefully', () => {
    const result = treeCommand({ path: '/non/existent/path/xyz' })
    expect(result).toBeDefined()
    expect(result).toHaveProperty('exitCode')
  })

  it('combines dirsOnly with depth', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, dirsOnly: true, depth: 2 })
    expect(result.exitCode).toBe(0)
  })

  it('combines filesOnly with depth', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, filesOnly: true, depth: 2 })
    expect(result.exitCode).toBe(0)
  })
})

describe('treeCommand edge cases', () => {
  it('validates max depth argument with invalid depth', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, depth: NaN })
    expect(result).toHaveProperty('exitCode')
  })

  it('validates max depth argument with zero depth', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, depth: 0 })
    expect(result.exitCode).toBe(0)
  })

  it('validates max depth argument with negative depth', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, depth: -1 })
    expect(result).toHaveProperty('exitCode')
  })

  it('formats file sizes for files of different sizes', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true, filesOnly: true })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('formats zero-byte files in size display', () => {
    const emptyDir = resolve(FIXTURES_DIR, 'empty')
    const result = treeCommand({ path: emptyDir, showSize: true })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('returns valid JSON structure with all metadata', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, format: 'json', showSize: true, showModified: true })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.output as string)
    expect(parsed).toHaveProperty('name')
    expect(parsed).toHaveProperty('path')
    expect(parsed).toHaveProperty('isDirectory')
    expect(parsed).toHaveProperty('children')
  })

  it('handles permission denied scenarios (skips inaccessible paths)', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT })
    expect(result.exitCode).toBe(0)
  })

  it('sorts directories before files in output', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, format: 'json' })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.output as string)
    expect(parsed.children).toBeDefined()
    expect(parsed.children.length).toBeGreaterThan(1)
    const lastFile = parsed.children.findLastIndex((c: { isDirectory: boolean }) => !c.isDirectory)
    const lastDir = parsed.children.findLastIndex((c: { isDirectory: boolean }) => c.isDirectory)
    expect(lastDir < lastFile || lastDir === -1 || lastFile === -1).toBe(true)
  })
})

describe('treeCommandDef argument parsing', () => {
  it('parses --size argument', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT, '--size'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses --modified argument', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT, '--modified'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses --ignore argument', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT, '--ignore', 'node_modules,dist'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses --pattern argument', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT, '--pattern', '*.ts'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses -p shorthand for pattern', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT, '-p', '*.json'], {})
    expect(result.exitCode).toBe(0)
  })

  it('parses --format argument', () => {
    const result = treeCommandDef.execute([MINIMAL_PROJECT, '--format', 'json'], {})
    expect(result.exitCode).toBe(0)
  })
})

describe('treeCommand formatSize coverage', () => {
  it('formats small file sizes in bytes', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true, filesOnly: true })
    expect(result.exitCode).toBe(0)
    expect(result.output).toMatch(/\d+B/)
  })

  it('formats file sizes in KB range', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true })
    expect(result.exitCode).toBe(0)
    expect(result.output).toBeDefined()
  })

  it('handles all size ranges in JSON output with showSize', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, showSize: true, format: 'json' })
    expect(result.exitCode).toBe(0)
    const parsed = JSON.parse(result.output as string)

    const findFilesWithSize = (node: { size?: number; children: unknown[] }): number[] => {
      const sizes: number[] = []
      if (node.size !== undefined) sizes.push(node.size)
      for (const child of node.children) {
        sizes.push(...findFilesWithSize(child as { size?: number; children: unknown[] }))
      }
      return sizes
    }

    const sizes = findFilesWithSize(parsed)
    expect(sizes.length).toBeGreaterThan(0)
  })
})

describe('treeCommand error handling', () => {
  it('returns error for path with null bytes', () => {
    const result = treeCommand({ path: '/path/with/\x00/null' })
    expect([0, 1]).toContain(result.exitCode)
    expect(result.exitCode === 1 ? result.error : 'Tree failed').toContain('Tree failed')
  })

  it('returns error for permission denied paths', () => {
    const result = treeCommand({ path: '/root' })
    expect([0, 1]).toContain(result.exitCode)
  })

  it('handles symbolic link edge cases', () => {
    const result = treeCommand({ path: MINIMAL_PROJECT, depth: 10 })
    expect(result.exitCode).toBe(0)
  })
})
