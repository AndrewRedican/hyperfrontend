import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { installedEngineVersion } from './engine-version'

describe('installedEngineVersion', () => {
  it('reads the version of the nearest manifest above the module that names the engine', () => {
    const installed = createTempDir({
      prefix: 'engine-',
      tree: {
        'node_modules/@hyperfrontend/workspace/package.json': '{ "name": "@hyperfrontend/workspace", "version": "1.4.0" }',
        'node_modules/@hyperfrontend/workspace/graph/package.json': '{ "name": "other" }',
      },
    })
    try {
      expect(installedEngineVersion(join(installed.path, 'node_modules/@hyperfrontend/workspace/graph/_shared'))).toBe('1.4.0')
    } finally {
      installed.remove()
    }
  })

  it('answers unknown where the engine manifest states no version', () => {
    const unversioned = createTempDir({ prefix: 'engine-', tree: { 'package.json': '{ "name": "@hyperfrontend/workspace" }' } })
    try {
      expect(installedEngineVersion(join(unversioned.path, 'graph'))).toBe('unknown')
    } finally {
      unversioned.remove()
    }
  })

  it('answers unknown where no manifest above the module names the engine', () => {
    const stray = createTempDir({ prefix: 'engine-', tree: { 'package.json': '{ "name": "@acme/monorepo", "version": "9.9.9" }' } })
    try {
      expect(installedEngineVersion(stray.path)).toBe('unknown')
    } finally {
      stray.remove()
    }
  })

  it('reads its own package when run from source', () => {
    expect(installedEngineVersion()).toMatch(/^\d+\.\d+\.\d+/)
  })
})
