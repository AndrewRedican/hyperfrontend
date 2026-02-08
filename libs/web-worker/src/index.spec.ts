import { noop } from './index'

describe('web-worker', () => {
  it('should export noop', () => {
    expect(noop).toBeDefined()
  })
})
