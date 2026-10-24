import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProjectTrees } from '../__test-utils__/project-trees.ts'
import { isPublishableLibrary } from './project-file.ts'

const projects = createProjectTrees()
const FIXTURES = projects.root

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

  it('answers the same for a directory asked twice', () => {
    expect([isPublishableLibrary(join(FIXTURES, 'publishable')), isPublishableLibrary(join(FIXTURES, 'publishable'))]).toEqual([true, true])
  })
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    projects.remove()
    expect(existsSync(projects.root)).toBe(false)
  })
})
