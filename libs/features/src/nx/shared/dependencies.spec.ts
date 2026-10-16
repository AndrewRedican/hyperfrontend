import type { Mock } from '@hyperfrontend/testing'
import type { Tree } from '../model'
import { beforeEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { resolveSdkVersion } from '../../generators/metadata/sdk-version'
import { ensureSdkDependency } from './dependencies'

jest.mock('../../generators/metadata/sdk-version', () => ({ resolveSdkVersion: jest.fn() }))

const resolveSdkVersionMock = jest.mocked(resolveSdkVersion)

/** Structural tree fake exposing the staged writes for assertions. */
interface TreeFake extends Tree {
  /** Spy capturing every staged write. */
  write: Mock
}

function createTree(packageJson?: string): TreeFake {
  const files: Record<string, string> = {}
  if (packageJson !== undefined) {
    files['package.json'] = packageJson
  }
  return {
    root: '/ws',
    read: (filePath) => files[filePath] ?? null,
    exists: (filePath) => filePath in files,
    write: jest.fn((filePath: string, content: string) => {
      files[filePath] = content
    }),
  }
}

function writtenManifest(tree: TreeFake): Record<string, unknown> {
  return JSON.parse(tree.write.mock.calls[0]?.[1])
}

describe('ensureSdkDependency', () => {
  beforeEach(() => {
    resolveSdkVersionMock.mockReset()
    resolveSdkVersionMock.mockReturnValue('0.4.0')
  })

  it('reports a change when the package is undeclared', () => {
    expect(ensureSdkDependency(createTree('{ "name": "consumer", "dependencies": { "react": "19.0.0" } }'), {})).toBe(true)
  })

  it('adds the package to dependencies with a caret range on the plugin version when undeclared', () => {
    const tree = createTree('{ "name": "consumer", "dependencies": { "react": "19.0.0" } }')
    ensureSdkDependency(tree, {})
    expect(writtenManifest(tree)).toEqual(
      expect.objectContaining({
        name: 'consumer',
        dependencies: { react: '19.0.0', '@hyperfrontend/features': '^0.4.0' },
      })
    )
  })

  it('reports a change when the manifest has no dependencies section', () => {
    expect(ensureSdkDependency(createTree('{ "name": "consumer" }'), {})).toBe(true)
  })

  it('creates the dependencies section when the manifest has none', () => {
    const tree = createTree('{ "name": "consumer" }')
    ensureSdkDependency(tree, {})
    expect(writtenManifest(tree)).toEqual(expect.objectContaining({ dependencies: { '@hyperfrontend/features': '^0.4.0' } }))
  })

  it('writes with 2-space indentation and a trailing newline', () => {
    const tree = createTree('{}')
    ensureSdkDependency(tree, {})
    expect(tree.write.mock.calls[0]?.[1]).toBe('{\n  "dependencies": {\n    "@hyperfrontend/features": "^0.4.0"\n  }\n}\n')
  })

  it('reports no change for an existing dependencies declaration', () => {
    expect(ensureSdkDependency(createTree('{ "dependencies": { "@hyperfrontend/features": "0.1.0" } }'), {})).toBe(false)
  })

  it('leaves an existing dependencies declaration untouched', () => {
    const tree = createTree('{ "dependencies": { "@hyperfrontend/features": "0.1.0" } }')
    ensureSdkDependency(tree, {})
    expect(tree.write).not.toHaveBeenCalled()
  })

  it('reports no change for a devDependencies declaration', () => {
    expect(
      ensureSdkDependency(createTree('{ "devDependencies": { "@hyperfrontend/features": "^0.3.0" } }'), { keepExistingVersions: true })
    ).toBe(false)
  })

  it('leaves a devDependencies declaration in its section untouched', () => {
    const tree = createTree('{ "devDependencies": { "@hyperfrontend/features": "^0.3.0" } }')
    ensureSdkDependency(tree, { keepExistingVersions: true })
    expect(tree.write).not.toHaveBeenCalled()
  })

  it('reports a change when keepExistingVersions is false re-pins an existing declaration', () => {
    expect(
      ensureSdkDependency(createTree('{ "devDependencies": { "@hyperfrontend/features": "^0.3.0", "jest": "30.0.0" } }'), {
        keepExistingVersions: false,
      })
    ).toBe(true)
  })

  it('re-pins an existing declaration in its own section when keepExistingVersions is false', () => {
    const tree = createTree('{ "devDependencies": { "@hyperfrontend/features": "^0.3.0", "jest": "30.0.0" } }')
    ensureSdkDependency(tree, { keepExistingVersions: false })
    expect(writtenManifest(tree)).toEqual({ devDependencies: { '@hyperfrontend/features': '^0.4.0', jest: '30.0.0' } })
  })

  it('reports a change when it falls back to latest', () => {
    resolveSdkVersionMock.mockImplementation(() => {
      throw new Error('not found')
    })
    expect(ensureSdkDependency(createTree('{}'), {})).toBe(true)
  })

  it('declares latest when the plugin version cannot be resolved', () => {
    resolveSdkVersionMock.mockImplementation(() => {
      throw new Error('not found')
    })
    const tree = createTree('{}')
    ensureSdkDependency(tree, {})
    expect(writtenManifest(tree)).toEqual({ dependencies: { '@hyperfrontend/features': 'latest' } })
  })

  it('throws when the workspace root has no package.json', () => {
    expect(() => ensureSdkDependency(createTree(), {})).toThrow('Could not find a package.json at the workspace root.')
  })

  it('throws when package.json is not valid JSON', () => {
    expect(() => ensureSdkDependency(createTree('{ not json'), {})).toThrow('The workspace root package.json is not valid JSON.')
  })

  it('throws when package.json holds a non-object value', () => {
    expect(() => ensureSdkDependency(createTree('"text"'), {})).toThrow('The workspace root package.json must contain a JSON object.')
  })

  it('throws when package.json holds null', () => {
    expect(() => ensureSdkDependency(createTree('null'), {})).toThrow('The workspace root package.json must contain a JSON object.')
  })

  it('throws when package.json holds an array', () => {
    expect(() => ensureSdkDependency(createTree('[]'), {})).toThrow('The workspace root package.json must contain a JSON object.')
  })
})
