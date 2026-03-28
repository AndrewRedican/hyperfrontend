import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
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

    expect(existsSync(workspace.root)).toBe(true)
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
    const workspace = createTempWorkspace({
      files: {
        'src/index.ts': 'export const foo = 1',
        'src/utils/helper.ts': 'export function helper() {}',
      },
    })
    workspaces.push(workspace)

    expect(readFileSync(join(workspace.root, 'src/index.ts'), 'utf-8')).toBe('export const foo = 1')
    expect(readFileSync(join(workspace.root, 'src/utils/helper.ts'), 'utf-8')).toBe('export function helper() {}')
  })

  it('creates additional directories', () => {
    const workspace = createTempWorkspace({
      directories: ['dist', 'docs/api'],
    })
    workspaces.push(workspace)

    expect(existsSync(join(workspace.root, 'dist'))).toBe(true)
    expect(existsSync(join(workspace.root, 'docs/api'))).toBe(true)
  })

  it('returns correct paths via getPath()', () => {
    const workspace = createTempWorkspace()
    workspaces.push(workspace)

    expect(workspace.getPath('package.json')).toBe(join(workspace.root, 'package.json'))
    expect(workspace.getPath('src/index.ts')).toBe(join(workspace.root, 'src/index.ts'))
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
  it('creates workspaces and tracks them', () => {
    const manager = createTempWorkspaceManager()

    const ws1 = manager.create()
    const ws2 = manager.create()

    expect(manager.count).toBe(2)
    expect(existsSync(ws1.root)).toBe(true)
    expect(existsSync(ws2.root)).toBe(true)

    manager.cleanupAll()
  })

  it('cleans up all tracked workspaces', () => {
    const manager = createTempWorkspaceManager()

    const ws1 = manager.create()
    const ws2 = manager.create()
    const root1 = ws1.root
    const root2 = ws2.root

    manager.cleanupAll()

    expect(existsSync(root1)).toBe(false)
    expect(existsSync(root2)).toBe(false)
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
