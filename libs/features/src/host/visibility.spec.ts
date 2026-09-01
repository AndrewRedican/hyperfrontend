import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { observePageVisibility } from './visibility'

// note: This spec runs in the node project, where no document exists — the observer must be inert instead of throwing.
describe('observePageVisibility without a document', () => {
  it('reports nothing and returns a callable no-op teardown', () => {
    const onChange = jest.fn()
    const stop = observePageVisibility(onChange)
    expect(onChange).not.toHaveBeenCalled()
    expect(() => stop()).not.toThrow()
  })
})
