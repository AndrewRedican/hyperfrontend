import type { Tree } from '../../model'
import type { DevkitApi } from '../../shared/devkit'
import { execFileSync } from 'node:child_process'
import { resolveSdkManifest, resolveSdkVersion } from '../../../generators/metadata/sdk-version'
import { loadDevkit } from '../../shared/devkit'
import { initGenerator } from './generator'

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }))
jest.mock('../../../generators/metadata/sdk-version', () => ({ resolveSdkVersion: jest.fn(), resolveSdkManifest: jest.fn() }))
jest.mock('../../shared/devkit', () => ({ loadDevkit: jest.fn() }))

const execFileSyncMock = jest.mocked(execFileSync)
const resolveSdkVersionMock = jest.mocked(resolveSdkVersion)
const resolveSdkManifestMock = jest.mocked(resolveSdkManifest)
const loadDevkitMock = jest.mocked(loadDevkit)

const UNDECLARED_MANIFEST = '{ "name": "consumer" }'
const DECLARED_MANIFEST = '{ "dependencies": { "@hyperfrontend/features": "^0.4.0" } }'
const CANDIDATE = `@rollup/rollup-${process.platform}-${process.arch}-test`

function createTree(packageJson: string, extraFiles: readonly string[] = []): Tree {
  const files: Record<string, string> = { 'package.json': packageJson }
  for (const file of extraFiles) {
    files[file] = ''
  }
  return {
    root: '/ws',
    read: (filePath) => files[filePath] ?? null,
    exists: (filePath) => filePath in files,
    write: (filePath, content) => {
      files[filePath] = content
    },
  }
}

function createDevkit(): DevkitApi {
  return { formatFiles: jest.fn(async () => undefined), installPackagesTask: jest.fn() }
}

describe('initGenerator', () => {
  let stderrSpy: jest.SpyInstance

  beforeEach(() => {
    execFileSyncMock.mockReset()
    resolveSdkVersionMock.mockReset()
    resolveSdkVersionMock.mockReturnValue('0.4.0')
    resolveSdkManifestMock.mockReset()
    resolveSdkManifestMock.mockReturnValue({})
    loadDevkitMock.mockReset()
    loadDevkitMock.mockReturnValue(null)
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stderrSpy.mockRestore()
  })

  it('returns a callback that installs with the lockfile-detected package manager when devkit is absent', async () => {
    const tree = createTree(UNDECLARED_MANIFEST, ['yarn.lock'])
    const callback = await initGenerator(tree, {})
    expect(execFileSyncMock).not.toHaveBeenCalled()
    await callback()
    expect(execFileSyncMock).toHaveBeenCalledWith('yarn', ['install'], { cwd: '/ws', stdio: 'inherit' })
  })

  it('awaits devkit formatFiles in the generator body and installs through installPackagesTask', async () => {
    const devkit = createDevkit()
    loadDevkitMock.mockReturnValue(devkit)
    const tree = createTree(UNDECLARED_MANIFEST)
    const callback = await initGenerator(tree, {})
    expect(devkit.formatFiles).toHaveBeenCalledWith(tree)
    expect(devkit.installPackagesTask).not.toHaveBeenCalled()
    await callback()
    expect(devkit.installPackagesTask).toHaveBeenCalledWith(tree)
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('skips formatting when the resolved devkit lacks formatFiles', async () => {
    const installPackagesTask = jest.fn()
    loadDevkitMock.mockReturnValue({ installPackagesTask })
    const callback = await initGenerator(createTree(UNDECLARED_MANIFEST), {})
    await callback()
    expect(installPackagesTask).toHaveBeenCalledTimes(1)
  })

  it('falls back to the built-in installer when the resolved devkit lacks installPackagesTask', async () => {
    loadDevkitMock.mockReturnValue({})
    const callback = await initGenerator(createTree(UNDECLARED_MANIFEST), {})
    await callback()
    expect(execFileSyncMock).toHaveBeenCalledWith('npm', ['install'], { cwd: '/ws', stdio: 'inherit' })
  })

  it('returns a callback that installs nothing when the manifest already declares the SDK', async () => {
    const devkit = createDevkit()
    loadDevkitMock.mockReturnValue(devkit)
    const callback = await initGenerator(createTree(DECLARED_MANIFEST), {})
    await callback()
    expect(devkit.installPackagesTask).not.toHaveBeenCalled()
    expect(execFileSyncMock).not.toHaveBeenCalled()
    // why: the advisory must still run on no-op callbacks; the mocked manifest has no candidates, so it stays silent.
    expect(resolveSdkManifestMock).toHaveBeenCalled()
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('installs when keepExistingVersions is false re-pins an existing declaration', async () => {
    const callback = await initGenerator(createTree(DECLARED_MANIFEST), { keepExistingVersions: false })
    await callback()
    expect(execFileSyncMock).toHaveBeenCalledWith('npm', ['install'], { cwd: '/ws', stdio: 'inherit' })
  })

  it('warns with the exact remediation when the platform binding candidates cannot resolve', async () => {
    resolveSdkManifestMock.mockReturnValue({ optionalDependencies: { [CANDIDATE]: '9.9.9' } })
    const callback = await initGenerator(createTree(DECLARED_MANIFEST), {})
    await callback()
    expect(stderrSpy).toHaveBeenCalledTimes(1)
    expect(stderrSpy).toHaveBeenCalledWith(
      `Rollup's native binding for this platform is not installed (expected one of: ${CANDIDATE}@9.9.9). \`hf build\` and the @hyperfrontend/features build executor need it to bundle. Run \`npm install --include=optional\` to install it.\n`
    )
  })
})
