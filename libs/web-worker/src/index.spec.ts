import { noop } from './index'

describe('web-worker', () => {
  it('exports noop', () => {
    expect(noop).toBeDefined()
  })
})
