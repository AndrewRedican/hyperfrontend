import type { Mock } from '@hyperfrontend/testing'
import type { Tree } from '../../model'
import type { DevkitApi } from '../../shared/devkit'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
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
  let stderrSpy: Mock

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

  it('defers the built-in install until the returned callback runs', async () => {
    await initGenerator(createTree(UNDECLARED_MANIFEST, ['yarn.lock']), {})
    expect(execFileSyncMock).not.toHaveBeenCalled()
  })

  it('returns a callback that installs with the lockfile-detected package manager when devkit is absent', async () => {
    const tree = createTree(UNDECLARED_MANIFEST, ['yarn.lock'])
    const callback = await initGenerator(tree, {})
    await callback()
    expect(execFileSyncMock).toHaveBeenCalledWith('yarn', ['install'], {
      cwd: '/ws',
      stdio: 'inherit',
      shell: process.platform === 'win32',
    })
  })

  it('awaits devkit formatFiles in the generator body', async () => {
    const devkit = createDevkit()
    loadDevkitMock.mockReturnValue(devkit)
    const tree = createTree(UNDECLARED_MANIFEST)
    await initGenerator(tree, {})
    expect(devkit.formatFiles).toHaveBeenCalledWith(tree)
  })

  it('defers the devkit install until the returned callback runs', async () => {
    const devkit = createDevkit()
    loadDevkitMock.mockReturnValue(devkit)
    await initGenerator(createTree(UNDECLARED_MANIFEST), {})
    expect(devkit.installPackagesTask).not.toHaveBeenCalled()
  })

  it('installs through installPackagesTask when the returned callback runs', async () => {
    const devkit = createDevkit()
    loadDevkitMock.mockReturnValue(devkit)
    const tree = createTree(UNDECLARED_MANIFEST)
    const callback = await initGenerator(tree, {})
    await callback()
    expect(devkit.installPackagesTask).toHaveBeenCalledWith(tree)
  })

  it('skips the built-in installer when devkit installs', async () => {
    loadDevkitMock.mockReturnValue(createDevkit())
    const callback = await initGenerator(createTree(UNDECLARED_MANIFEST), {})
    await callback()
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
    expect(execFileSyncMock).toHaveBeenCalledWith('npm', ['install'], { cwd: '/ws', stdio: 'inherit', shell: process.platform === 'win32' })
  })

  it('returns a callback that installs nothing when the manifest already declares the SDK', async () => {
    const installPackagesTask = jest.fn()
    loadDevkitMock.mockReturnValue({ ...createDevkit(), installPackagesTask })
    const callback = await initGenerator(createTree(DECLARED_MANIFEST), {})
    await callback()
    expect({ devkitInstalls: installPackagesTask.mock.calls, builtInInstalls: execFileSyncMock.mock.calls }).toEqual({
      devkitInstalls: [],
      builtInInstalls: [],
    })
  })

  it('still runs the binding advisory from a callback that installs nothing', async () => {
    loadDevkitMock.mockReturnValue(createDevkit())
    const callback = await initGenerator(createTree(DECLARED_MANIFEST), {})
    await callback()
    // why: the advisory must still run on no-op callbacks.
    expect(resolveSdkManifestMock).toHaveBeenCalled()
  })

  it('keeps the advisory silent when the SDK manifest names no binding candidates', async () => {
    loadDevkitMock.mockReturnValue(createDevkit())
    const callback = await initGenerator(createTree(DECLARED_MANIFEST), {})
    await callback()
    // why: the mocked manifest has no candidates, so the advisory stays silent.
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  it('installs when keepExistingVersions is false re-pins an existing declaration', async () => {
    const callback = await initGenerator(createTree(DECLARED_MANIFEST), { keepExistingVersions: false })
    await callback()
    expect(execFileSyncMock).toHaveBeenCalledWith('npm', ['install'], { cwd: '/ws', stdio: 'inherit', shell: process.platform === 'win32' })
  })

  it('warns with the exact remediation when the platform binding candidates cannot resolve', async () => {
    resolveSdkManifestMock.mockReturnValue({ optionalDependencies: { [CANDIDATE]: '9.9.9' } })
    const callback = await initGenerator(createTree(DECLARED_MANIFEST), {})
    await callback()
    expect(stderrSpy.mock.calls).toEqual([
      [
        `Rollup's native binding for this platform is not installed (expected one of: ${CANDIDATE}@9.9.9). \`hf build\` and the @hyperfrontend/features build executor need it to bundle. Run \`npm install --include=optional\` to install it.\n`,
      ],
    ])
  })
})
