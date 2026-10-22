import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { describe, expect, it } from '@hyperfrontend/testing'
import { errorText } from './error-text.ts'

describe('errorText', () => {
  it("takes an error's message", () => {
    expect(errorText(createError('broken'))).toBe('broken')
  })

  it('renders another thrown value as text', () => {
    expect(errorText(42)).toBe('42')
  })
})
