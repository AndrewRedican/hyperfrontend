import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { isPublishableLibrary, readPackageFile } from './project-file'

/** One project directory per verdict the reader gives. */
const projects = createTempDir({
  prefix: 'lint-project-file-',
  tree: {
    'publishable/project.json': stringify({ projectType: 'library', targets: { build: {}, publish: {} } }),
    'publishable/package.json': stringify({ name: '@ws/publishable' }),
    'application/project.json': stringify({ projectType: 'application', targets: { build: {}, publish: {} } }),
    'internal/project.json': stringify({ projectType: 'library', targets: { build: {} } }),
    'plain/.keep': '',
    'broken/project.json': '[1]',
    'broken/package.json': 'not json',
  },
})
const FIXTURES = projects.path

describe('isPublishableLibrary', () => {
  it('accepts a library with build and publish targets', () => {
    expect(isPublishableLibrary(join(FIXTURES, 'publishable'))).toBe(true)
  })

  it('rejects an application', () => {
    expect(isPublishableLibrary(join(FIXTURES, 'application'))).toBe(false)
  })

  it('rejects a library without a publish target', () => {
    expect(isPublishableLibrary(join(FIXTURES, 'internal'))).toBe(false)
  })

  it('rejects a directory without a project file', () => {
    expect(isPublishableLibrary(join(FIXTURES, 'plain'))).toBe(false)
  })

  it('rejects a project file that holds no object', () => {
    expect(isPublishableLibrary(join(FIXTURES, 'broken'))).toBe(false)
  })

  it('answers the same for a directory asked twice', () => {
    expect([isPublishableLibrary(join(FIXTURES, 'publishable')), isPublishableLibrary(join(FIXTURES, 'publishable'))]).toEqual([true, true])
  })
})

describe('readPackageFile', () => {
  it('reads a manifest once per directory', () => {
    expect([readPackageFile(join(FIXTURES, 'publishable'))?.name, readPackageFile(join(FIXTURES, 'publishable'))?.name]).toEqual([
      '@ws/publishable',
      '@ws/publishable',
    ])
  })

  it('answers null for a manifest that does not parse', () => {
    expect(readPackageFile(join(FIXTURES, 'broken'))).toBe(null)
  })
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    projects.remove()
    expect(existsSync(FIXTURES)).toBe(false)
  })
})
