import type { PackageJson } from '../../project/package'
import { describe, expect, it } from '@hyperfrontend/testing'
import { expressDetector } from './express'

describe('expressDetector', () => {
  it('returns null when express is not installed', () => {
    const pkg: PackageJson = { name: 'test', version: '1.0.0' }
    expect(expressDetector('/some/path', pkg)).toBeNull()
  })

  it('detects express dependency', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: { express: '^4.18.0' },
    }
    const result = expressDetector('/some/path', pkg)
    expect(result).not.toBeNull()
    expect(result?.id).toBe('express')
    expect(result?.version).toBe('4.18.0')
    expect(result?.confidence).toBeGreaterThanOrEqual(60)
  })

  it('detects express with body-parser middleware', () => {
    const pkg: PackageJson = {
      name: 'test',
      version: '1.0.0',
      dependencies: {
        express: '^4.18.0',
        'body-parser': '^1.20.0',
      },
    }
    const result = expressDetector('/some/path', pkg)
    expect(result?.confidence).toBeGreaterThan(60)
  })
})
