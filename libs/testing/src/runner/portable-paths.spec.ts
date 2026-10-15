import assert from 'node:assert/strict'
import { join, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { normalizePath, relativePath, workspaceRelativePath } from './portable-paths'

describe('normalizePath', () => {
  it('spells a native path with forward slashes', () => {
    assert.equal(normalizePath(join('repo', 'libs', 'nexus')), 'repo/libs/nexus')
  })
})

describe('relativePath', () => {
  it('renders the portable path between two locations', () => {
    assert.equal(relativePath(resolve('/repo/libs'), resolve('/repo/apps/site')), '../apps/site')
  })
})

describe('workspaceRelativePath', () => {
  it('makes an absolute path relative to the workspace root', () => {
    assert.equal(workspaceRelativePath('/repo', resolve('/repo/libs/nexus')), 'libs/nexus')
  })

  it('keeps a path that is already relative to the workspace root', () => {
    assert.equal(workspaceRelativePath('/repo', 'libs/nexus'), 'libs/nexus')
  })

  it('is empty for the workspace root itself', () => {
    assert.equal(workspaceRelativePath('/repo', '/repo'), '')
  })
})
