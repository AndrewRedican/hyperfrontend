import { describe, expect, it } from '@hyperfrontend/testing'
import { typeToChoice } from './session-config'

describe('typeToChoice', () => {
  it('maps name-only type to a labeled choice', () => {
    expect(typeToChoice({ name: 'feat' })).toEqual({ label: 'feat', value: 'feat' })
  })

  it('includes description as hint when provided', () => {
    expect(typeToChoice({ name: 'fix', description: 'A bug fix' })).toEqual(expect.objectContaining({ hint: 'A bug fix' }))
  })
})
