import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createConsumerWorkspace, REGISTRY_PACKAGES } from './__test-utils__/consumer-workspace'
import { createGraphWorkspace } from './__test-utils__/workspace'
import { installedPackages, registryInstalls } from './lockfile'

const root = createGraphWorkspace()

describe('installedPackages', () => {
  it('reads the top-level versions', () => {
    expect([...installedPackages(root).hoisted]).toEqual([['left-pad', '1.3.0']])
  })

  it('reads the nested versions', () => {
    expect([...installedPackages(root).nested]).toEqual(['inner@0.0.1'])
  })

  it('answers nothing without a lock file', () => {
    expect(installedPackages(tmpdir()).hoisted.size).toBe(0)
  })
})

describe('registryInstalls', () => {
  it('names what a lock file takes from a registry at its top level, leaving out tarballs, links and nested installs', () => {
    const consumer = createConsumerWorkspace()
    expect([...registryInstalls(join(consumer, 'package-lock.json'))]).toEqual(REGISTRY_PACKAGES)
  })

  it('names nothing without a lock file', () => {
    expect(registryInstalls(join(tmpdir(), 'no-such-package-lock.json')).size).toBe(0)
  })
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
