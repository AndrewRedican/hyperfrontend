import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { greet } from './greeting'
import { label, untouched } from './label'

jest.mock('./label', () => {
  const actual = jest.requireActual('./label') as typeof import('./label')
  return { label: () => `mocked(${actual.label()})` }
})

describe('jest.mock with a factory', () => {
  it('replaces the export the factory names, wrapping the actual one', () => {
    expect(label()).toBe('mocked(real)')
  })

  it('keeps the export the factory leaves out real', () => {
    expect(untouched()).toBe('kept')
  })

  it('reaches a consumer of the replaced module', () => {
    expect(greet()).toBe('mocked(real)/kept')
  })
})
