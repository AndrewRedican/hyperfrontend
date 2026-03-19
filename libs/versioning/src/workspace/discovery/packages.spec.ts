import { discoverPackages, discoverProject, discoverProjectByName } from './packages'

jest.mock('@hyperfrontend/project-scope/project/package', () => ({
  readPackageJson: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope/project/root', () => ({
  findWorkspaceRoot: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope/project/traversal', () => ({
  findFiles: jest.fn(),
}))

jest.mock('@hyperfrontend/project-scope', () => ({
  exists: jest.fn(),
}))

const projectScopePackage = require('@hyperfrontend/project-scope/project/package')
const projectScopeRoot = require('@hyperfrontend/project-scope/project/root')
const projectScopeTraversal = require('@hyperfrontend/project-scope/project/traversal')
const projectScopeMain = require('@hyperfrontend/project-scope')

const projectScope = {
  readPackageJson: projectScopePackage.readPackageJson,
  findWorkspaceRoot: projectScopeRoot.findWorkspaceRoot,
  findFiles: projectScopeTraversal.findFiles,
  exists: projectScopeMain.exists,
}

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

  it('sets packageJsonPath correctly', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-package',
      version: '1.0.0',
    })

    const project = discoverProject('/workspace/libs/my-package')

    expect(project?.packageJsonPath).toBe('/workspace/libs/my-package/package.json')
  })

  it('preserves packageJson object', () => {
    const packageJson = {
      name: 'my-package',
      version: '1.0.0',
      dependencies: { lodash: '^4.0.0' },
    }
    projectScope.readPackageJson.mockReturnValue(packageJson)

    const project = discoverProject('/workspace/libs/my-package')

    expect(project?.packageJson).toEqual(packageJson)
  })

  it('sets changelogPath to null', () => {
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-package',
      version: '1.0.0',
    })

    const project = discoverProject('/workspace/libs/my-package')

    expect(project?.changelogPath).toBeNull()
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

  it('passes custom options to discoverPackages', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['custom/my-lib/package.json'])
    projectScope.readPackageJson.mockReturnValue({
      name: 'my-lib',
      version: '1.0.0',
    })
    projectScope.exists.mockReturnValue(false)

    const project = discoverProjectByName('my-lib', {
      patterns: ['custom/*/package.json'],
      exclude: ['**/ignored/**'],
    })

    expect(project).not.toBeNull()
    expect(projectScope.findFiles).toHaveBeenCalledWith('/workspace', ['custom/*/package.json'], expect.any(Object))
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

  it('indexes projects by name in projectMap', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0' })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages()

    expect(result.projectMap.get('lib-a')).toBeDefined()
    expect(result.projectMap.get('lib-a')?.version).toBe('1.0.0')
    expect(result.projectMap.get('lib-b')).toBeDefined()
    expect(result.projectMap.get('lib-b')?.version).toBe('2.0.0')
    expect(result.projectMap.get('nonexistent')).toBeUndefined()
  })

  it('sets changelogPath when changelog exists', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json'])
    projectScope.readPackageJson.mockReturnValue({ name: 'lib-a', version: '1.0.0' })
    projectScope.exists.mockReturnValue(true)

    const result = discoverPackages({ includeChangelogs: true })

    expect(result.projects[0].changelogPath).toBe('/workspace/libs/lib-a/CHANGELOG.md')
  })

  it('tracks internalDependencies correctly', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0', dependencies: { 'lib-a': '^1.0.0' } })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({ trackDependencies: true })

    const libB = result.projectMap.get('lib-b')
    expect(libB?.internalDependencies).toContain('lib-a')
  })

  it('tracks internalDependents correctly', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue(['libs/lib-a/package.json', 'libs/lib-b/package.json'])
    projectScope.readPackageJson
      .mockReturnValueOnce({ name: 'lib-a', version: '1.0.0' })
      .mockReturnValueOnce({ name: 'lib-b', version: '2.0.0', dependencies: { 'lib-a': '^1.0.0' } })
    projectScope.exists.mockReturnValue(false)

    const result = discoverPackages({ trackDependencies: true })

    const libA = result.projectMap.get('lib-a')
    expect(libA?.internalDependents).toContain('lib-b')
  })

  it('returns config with all fields', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue([])

    const result = discoverPackages({
      patterns: ['libs/*/package.json'],
      exclude: ['**/test/**'],
      includeChangelogs: true,
      trackDependencies: false,
    })

    expect(result.config).toEqual({
      patterns: ['libs/*/package.json'],
      exclude: ['**/test/**'],
      includeChangelogs: true,
      trackDependencies: false,
    })
  })

  it('uses default config values when options not provided', () => {
    projectScope.findWorkspaceRoot.mockReturnValue('/workspace')
    projectScope.findFiles.mockReturnValue([])

    const result = discoverPackages()

    expect(result.config.includeChangelogs).toBe(true)
    expect(result.config.trackDependencies).toBe(true)
    expect(result.config.patterns).toBeDefined()
    expect(result.config.exclude).toBeDefined()
  })
})
