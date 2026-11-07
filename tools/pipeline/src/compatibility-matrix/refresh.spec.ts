import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { cleanupWorkspaces, createWorkspace, publishableProject } from './__test-utils__/fixtures'
import { buildCompatibilityDocument, COMPATIBILITY_DOCUMENT_NAME, refreshCompatibilityDocument } from './refresh'

afterAll(() => {
  cleanupWorkspaces()
})

const workspaceWithOneLibrary = (): string =>
  createWorkspace([
    {
      path: 'libs/logging',
      projectJson: publishableProject({ name: 'lib-logging' }),
      packageJson: { name: '@hyperfrontend/logging', version: '1.0.0' },
    },
  ])

describe('refreshCompatibilityDocument', () => {
  it('writes the document when the workspace holds none', () => {
    const root = workspaceWithOneLibrary()
    refreshCompatibilityDocument(root)
    expect(readFileSync(join(root, COMPATIBILITY_DOCUMENT_NAME), 'utf-8')).toBe(buildCompatibilityDocument(root))
  })

  it('reports the document path when it wrote it', () => {
    expect(refreshCompatibilityDocument(workspaceWithOneLibrary())).toBe(COMPATIBILITY_DOCUMENT_NAME)
  })

  it('rewrites a document that fell behind a version bump', () => {
    const root = workspaceWithOneLibrary()
    refreshCompatibilityDocument(root)
    writeFileSync(join(root, 'libs', 'logging', 'package.json'), '{ "name": "@hyperfrontend/logging", "version": "1.1.0" }')
    refreshCompatibilityDocument(root)
    expect(readFileSync(join(root, COMPATIBILITY_DOCUMENT_NAME), 'utf-8')).toEqual(expect.stringContaining('`1.1.0`'))
  })

  it('reports nothing when the document is already current', () => {
    const root = workspaceWithOneLibrary()
    refreshCompatibilityDocument(root)
    expect(refreshCompatibilityDocument(root)).toBeNull()
  })

  it('leaves a current document untouched', () => {
    const root = workspaceWithOneLibrary()
    refreshCompatibilityDocument(root)
    const path = join(root, COMPATIBILITY_DOCUMENT_NAME)
    const before = readFileSync(path, 'utf-8')
    refreshCompatibilityDocument(root)
    expect({ exists: existsSync(path), content: readFileSync(path, 'utf-8') }).toEqual({ exists: true, content: before })
  })
})
