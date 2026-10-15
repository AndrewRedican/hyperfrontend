import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempWorkspace, createTempWorkspaceManager } from './temp-workspace'

describe('createTempWorkspace', () => {
  const workspaces: ReturnType<typeof createTempWorkspace>[] = []

  afterAll(() => {
    for (const ws of workspaces) {
      ws.cleanup()
    }
  })

  it('creates a temporary directory', () => {
    const workspace = createTempWorkspace()
    workspaces.push(workspace)

    expect(statSync(workspace.root).isDirectory()).toBe(true)
  })

  it('creates src directory by default', () => {
    const workspace = createTempWorkspace()
    workspaces.push(workspace)

    expect(existsSync(join(workspace.root, 'src'))).toBe(true)
  })

  it('writes project.json when provided', () => {
    const projectJson = { projectType: 'library', targets: {} }
    const workspace = createTempWorkspace({ projectJson })
    workspaces.push(workspace)

    const content = JSON.parse(readFileSync(join(workspace.root, 'project.json'), 'utf-8'))
    expect(content).toEqual(projectJson)
  })

  it('writes package.json when provided', () => {
    const packageJson = { name: '@test/lib', version: '1.0.0' }
    const workspace = createTempWorkspace({ packageJson })
    workspaces.push(workspace)

    const content = JSON.parse(readFileSync(join(workspace.root, 'package.json'), 'utf-8'))
    expect(content).toEqual(packageJson)
  })

  it('writes README.md when provided', () => {
    const readme = '# Test Library\n\nDescription here.'
    const workspace = createTempWorkspace({ readme })
    workspaces.push(workspace)

    const content = readFileSync(join(workspace.root, 'README.md'), 'utf-8')
    expect(content).toBe(readme)
  })

  it('writes additional files with nested directories', () => {
    const files = {
      'src/index.ts': 'export const foo = 1',
      'src/utils/helper.ts': 'export function helper() {}',
    }
    const workspace = createTempWorkspace({ files })
    workspaces.push(workspace)

    expect({
      'src/index.ts': readFileSync(join(workspace.root, 'src/index.ts'), 'utf-8'),
      'src/utils/helper.ts': readFileSync(join(workspace.root, 'src/utils/helper.ts'), 'utf-8'),
    }).toEqual(files)
  })

  it('creates additional directories', () => {
    const directories = ['dist', 'docs/api']
    const workspace = createTempWorkspace({ directories })
    workspaces.push(workspace)

    expect(directories.filter((directory) => !existsSync(join(workspace.root, directory)))).toEqual([])
  })

  it.each(['package.json', 'src/index.ts'])('resolves %s under the root via getPath()', (relativePath: string) => {
    const workspace = createTempWorkspace()
    workspaces.push(workspace)

    expect(workspace.getPath(relativePath)).toBe(join(workspace.root, relativePath))
  })

  it('allows writing files after creation', () => {
    const workspace = createTempWorkspace()
    workspaces.push(workspace)

    workspace.writeFile('extra.txt', 'content')
    expect(readFileSync(join(workspace.root, 'extra.txt'), 'utf-8')).toBe('content')
  })

  it('allows writing JSON files after creation', () => {
    const workspace = createTempWorkspace()
    workspaces.push(workspace)

    workspace.writeJsonFile('config.json', { key: 'value' })
    const content = JSON.parse(readFileSync(join(workspace.root, 'config.json'), 'utf-8'))
    expect(content).toEqual({ key: 'value' })
  })

  it('removes the workspace when cleanup() is called', () => {
    const workspace = createTempWorkspace()
    const rootPath = workspace.root

    workspace.cleanup()

    expect(existsSync(rootPath)).toBe(false)
  })

  it('handles multiple cleanup() calls safely', () => {
    const workspace = createTempWorkspace()

    expect(() => {
      workspace.cleanup()
      workspace.cleanup()
      workspace.cleanup()
    }).not.toThrow()
  })

  it('uses custom prefix when provided', () => {
    const workspace = createTempWorkspace({ prefix: 'my-custom-test-' })
    workspaces.push(workspace)

    expect(workspace.root).toContain('my-custom-test-')
  })
})

describe('createTempWorkspaceManager', () => {
  it('tracks every workspace it creates', () => {
    const manager = createTempWorkspaceManager()

    manager.create()
    manager.create()

    expect(manager.count).toBe(2)

    manager.cleanupAll()
  })

  it('creates each tracked workspace on disk', () => {
    const manager = createTempWorkspaceManager()

    const created = [manager.create(), manager.create()]

    expect(created.filter((workspace) => !existsSync(workspace.root))).toEqual([])

    manager.cleanupAll()
  })

  it('removes every tracked workspace from disk on cleanupAll()', () => {
    const manager = createTempWorkspaceManager()

    const roots = [manager.create().root, manager.create().root]

    manager.cleanupAll()

    expect(roots.filter((root) => existsSync(root))).toEqual([])
  })

  it('tracks nothing once cleanupAll() has run', () => {
    const manager = createTempWorkspaceManager()

    manager.create()
    manager.create()

    manager.cleanupAll()

    expect(manager.count).toBe(0)
  })

  it('passes config through to created workspaces', () => {
    const manager = createTempWorkspaceManager()

    const workspace = manager.create({
      projectJson: { projectType: 'library' },
    })

    const content = JSON.parse(readFileSync(join(workspace.root, 'project.json'), 'utf-8'))
    expect(content.projectType).toBe('library')

    manager.cleanupAll()
  })
})
