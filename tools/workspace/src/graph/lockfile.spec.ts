import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createGraphWorkspace } from './__test-utils__/workspace'
import { installedPackages } from './lockfile'

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

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(root, { recursive: true, force: true })
    expect(existsSync(root)).toBe(false)
  })
})
