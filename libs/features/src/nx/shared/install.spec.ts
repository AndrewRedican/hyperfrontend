import type { Tree } from '../model'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach } from 'node:test'
import { shimCommand } from '@hyperfrontend/project-scope/core/process'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { detectPackageManager, installPackages } from './install'

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }))

const execFileSyncMock = jest.mocked(execFileSync)

/**
 * The arguments an install with a package manager is started with on this platform.
 *
 * @param manager - The package manager
 * @returns The program, arguments and options `execFileSync` receives
 */
function installCall(manager: string): [string, readonly string[], { cwd: string; stdio: string; shell: boolean }] {
  const command = shimCommand(manager, ['install'])
  return [command.file, command.args, { cwd: '/ws', stdio: 'inherit', shell: command.shell }]
}

function createTree(lockfiles: readonly string[]): Tree {
  return {
    root: '/ws',
    read: () => null,
    exists: (filePath) => lockfiles.includes(filePath),
    write: () => undefined,
  }
}

describe('detectPackageManager', () => {
  it.each([
    [['package-lock.json'], 'npm'],
    [['yarn.lock'], 'yarn'],
    [['pnpm-lock.yaml'], 'pnpm'],
    [['bun.lock'], 'bun'],
    [['bun.lockb'], 'bun'],
    [[], 'npm'],
  ] satisfies [string[], string][])('detects %j as %s', (lockfiles: string[], expected: string) => {
    expect(detectPackageManager((relativePath) => lockfiles.includes(relativePath))).toBe(expected)
  })

  it('prefers package-lock.json when several lockfiles coexist', () => {
    expect(detectPackageManager(() => true)).toBe('npm')
  })
})

describe('installPackages', () => {
  beforeEach(() => {
    execFileSyncMock.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('starts the install as one shell command line on Windows', () => {
    jest.replaceProperty(process, 'platform', 'win32')
    installPackages(createTree(['pnpm-lock.yaml']))
    expect(execFileSyncMock).toHaveBeenCalledWith('pnpm install', [], { cwd: '/ws', stdio: 'inherit', shell: true })
  })

  it('runs the detected package manager install at the tree root with inherited stdio', () => {
    installPackages(createTree(['yarn.lock']))
    expect(execFileSyncMock).toHaveBeenCalledWith(...installCall('yarn'))
  })

  it('defaults to npm when no lockfile is present', () => {
    installPackages(createTree([]))
    expect(execFileSyncMock).toHaveBeenCalledWith(...installCall('npm'))
  })

  it('names the manual command and the already-written declaration when the install fails', () => {
    execFileSyncMock.mockImplementation(() => {
      throw new Error('spawn failed')
    })
    expect(() => installPackages(createTree(['pnpm-lock.yaml']))).toThrow(
      'The @hyperfrontend/features declaration was already written to package.json, but the automatic install failed. Run `pnpm install` in /ws to finish installing it.'
    )
  })
})
