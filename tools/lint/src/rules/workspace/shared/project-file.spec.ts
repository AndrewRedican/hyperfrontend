import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isPublishableLibrary } from './project-file.ts'

const FIXTURES = join(import.meta.dirname, '..', '__fixtures__')

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
