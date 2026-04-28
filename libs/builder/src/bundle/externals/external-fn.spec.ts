import { createBundleExternalFn, createExternalFn } from './external-fn'

describe('createExternalFn', () => {
  it('returns true for ids in the external list', () => {
    expect(createExternalFn(['react', 'react-dom'])('react')).toBe(true)
  })

  it('returns false for ids absent from the external list', () => {
    expect(createExternalFn(['react'])('lodash')).toBe(false)
  })
})

describe('createBundleExternalFn', () => {
  it('inlines every dependency when external is undefined', () => {
    expect(createBundleExternalFn(undefined)('react')).toBe(false)
  })

  it('inlines every dependency when external is empty', () => {
    expect(createBundleExternalFn([])('react')).toBe(false)
  })

  it('marks listed dependencies external when external has entries', () => {
    expect(createBundleExternalFn(['react'])('react')).toBe(true)
  })

  it('inlines unlisted dependencies when external has entries', () => {
    expect(createBundleExternalFn(['react'])('lodash')).toBe(false)
  })
})
