import type { Tree } from '../model'
import { execFileSync } from 'node:child_process'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { detectPackageManager, installPackages } from './install'

jest.mock('node:child_process', () => ({ execFileSync: jest.fn() }))

const execFileSyncMock = jest.mocked(execFileSync)

function createTree(lockfiles: readonly string[]): Tree {
  return {
    root: '/ws',
    read: () => null,
    exists: (filePath) => lockfiles.includes(filePath),
    write: () => undefined,
  }
}

describe('detectPackageManager', () => {
  it.each<[string[], string]>([
    [['package-lock.json'], 'npm'],
    [['yarn.lock'], 'yarn'],
    [['pnpm-lock.yaml'], 'pnpm'],
    [['bun.lock'], 'bun'],
    [['bun.lockb'], 'bun'],
    [[], 'npm'],
  ])('detects %j as %s', (lockfiles, expected) => {
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

  it('runs the detected package manager install at the tree root with inherited stdio', () => {
    installPackages(createTree(['yarn.lock']))
    expect(execFileSyncMock).toHaveBeenCalledWith('yarn', ['install'], { cwd: '/ws', stdio: 'inherit' })
  })

  it('defaults to npm when no lockfile is present', () => {
    installPackages(createTree([]))
    expect(execFileSyncMock).toHaveBeenCalledWith('npm', ['install'], { cwd: '/ws', stdio: 'inherit' })
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
