import { describe, expect, it } from '@hyperfrontend/testing'
import { structureOf } from './tag-structure'

describe('structureOf', () => {
  it('opens a tag nothing restricts', () => {
    expect(structureOf('param')).toEqual({ type: 'yes', name: 'yes', typeRequired: 'no', nameRequired: 'no', either: 'no' })
  })

  it('restricts a tag the table names', () => {
    expect(structureOf('this')).toEqual({ type: 'yes', name: 'other', typeRequired: 'mode', nameRequired: 'no', either: 'no' })
  })
})
