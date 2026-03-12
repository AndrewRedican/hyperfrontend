import { discoverPackages, discoverProject, discoverProjectByName } from './packages'

jest.mock('@hyperfrontend/project-scope', () => ({
  exists: jest.fn(),
  findFiles: jest.fn(),
  readPackageJson: jest.fn(),
  findWorkspaceRoot: jest.fn(),
}))

const projectScope = require('@hyperfrontend/project-scope')

beforeEach(() => {
  jest.clearAllMocks()
})

describe('discoverProject', () => {
  it('discovers a project by path', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-package',
      version: '1.0.0',
    })

    const project = discoverProject('/workspace/libs/my-package')

    expect(project).not.toBeNull()
    expect(project?.name).toBe('my-package')
    expect(project?.version).toBe('1.0.0')
    expect(project?.path).toBe('/workspace/libs/my-package')
  })

  it('accepts package.json path directly', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-package',
      version: '2.0.0',
    })

    const project = discoverProject('/workspace/libs/my-package/package.json')

    expect(project).not.toBeNull()
    expect(project?.name).toBe('my-package')
    expect(project?.path).toBe('/workspace/libs/my-package')
  })

  it('returns null when package.json cannot be read', () => {
    projectScope.readPackageJson.mockImplementation(() => {
      throw new Error('File not found')
    })

    const project = discoverProject('/workspace/libs/missing')

    expect(project).toBeNull()
  })

  it('returns null when package has no name', () => {
    projectScope.readPackageJson.mockReturnValue({
      version: '1.0.0',
    })

    const project = discoverProject('/workspace/libs/nameless')

    expect(project).toBeNull()
  })

  it('uses 0.0.0 as default version', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'no-version-pkg',
    })

    const project = discoverProject('/workspace/libs/no-version')

    expect(project?.version).toBe('0.0.0')
  })
})

describe('discoverProjectByName', () => {
  it('finds project by name in workspace', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/my-lib/package.json'])
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-lib',
      version: '1.0.0',
    })
    projectScope.exists.mockReturnValue(false)

    const project = discoverProjectByName('my-lib')

    expect(project).not.toBeNull()
    expect(project?.name).toBe('my-lib')
  })

  it('returns null when project not found', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue([])

    const project = discoverProjectByName('nonexistent')

    expect(project).toBeNull()
  })

  it('throws when workspace root cannot be found', () => {
    projectScope.findWorkspaceRoot.mockReturnValue(null)

    expect(() => discoverProjectByName('my-lib')).toThrow(/workspace root/i)
  })
})

describe('discoverPackages', () => {
  it('throws when workspace root cannot be found', () => {
    projectScope.findWorkspaceRoot.mockReturnValue(null)

    expect(() => discoverPackages()).toThrow(/workspace root/i)
  })

  it('discovers packages with default options', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0', dependencies: { 'lib-a': '^1.0.0' } })
    projectScope.exists.mockReturnValue(true)

    const result = discoverPackages()

    expect(result.projects).toHaveLength(2)
    expect(result.packageNames.has('lib-a')).toBe(true)
    expect(result.packageNames.has('lib-b')).toBe(true)
  })

  it('discovers packages with custom workspace root', () => {
    projectScope.findFiles.mockReturnValue(['packages/pkg/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'pkg', version: '1.0.0' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({ workspaceRoot: '/custom/workspace' })

    expect(result.workspaceRoot).toBe('/custom/workspace')
    expect(result.projects).toHaveLength(1)
  })

  it('skips changelog discovery when includeChangelogs is false', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'lib-a', version: '1.0.0' })
    projectScope.exists.mockReturnValue(true)

    const result = discoverPackages({ includeChangelogs: false })

    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].changelogPath).toBeNull()
    expect(projectScope.exists).not.toHaveBeenCalled()
  })

  it('skips dependency tracking when trackDependencies is false', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0', dependencies: { 'lib-a': '^1.0.0' } })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({ trackDependencies: false })

    expect(result.projects).toHaveLength(2)
    expect(result.projects.every((p) => p.internalDependencies.length === 0)).toBe(true)
  })

  it('skips packages without a name', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/nameless/package.json'])
    projectScope.readPackageJson.mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' }).mockReturnValueOnce({ version: '1.0.0' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages()

    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].name).toBe('lib-a')
  })

  it('skips packages that fail to parse', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/broken/package.json'])
    projectScope.readPackageJson.mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' }).mockImplementationOnce(() => {
      throw new Error('Invalid JSON')
    })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages()

    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].name).toBe('lib-a')
  })

  it('uses default version 0.0.0 for packages without version', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'lib-a' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages()

    expect(result.projects).toHaveLength(1)
    expect(result.projects[0].version).toBe('0.0.0')
  })

  it('applies custom patterns and exclude', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['custom/pkg/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'pkg', version: '1.0.0' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({
      patterns: ['custom/*/package.json'],
      exclude: ['**/ignored/**'],
    })

    expect(result.projects).toHaveLength(1)
    expect(result.config.patterns).toEqual(['custom/*/package.json'])
    expect(result.config.exclude).toEqual(['**/ignored/**'])
  })
})
