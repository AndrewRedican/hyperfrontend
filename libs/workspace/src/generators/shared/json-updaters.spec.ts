import { describe, expect, it } from '@hyperfrontend/testing'
import { replaceDescriptionPackageName } from './json-updaters'

describe('replaceDescriptionPackageName', () => {
  it('rewrites every mention of the package in the description', () => {
    const json = { description: 'E2E tests for @acme/a, the @acme/a package' }
    replaceDescriptionPackageName(json, '@acme/a', '@acme/b')
    expect(json).toEqual({ description: 'E2E tests for @acme/b, the @acme/b package' })
  })

  it('leaves a description that is not a string alone', () => {
    const json = { description: 3 }
    replaceDescriptionPackageName(json, '@acme/a', '@acme/b')
    expect(json).toEqual({ description: 3 })
  })
})
