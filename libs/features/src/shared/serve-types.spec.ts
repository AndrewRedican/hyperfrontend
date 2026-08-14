import { defineServeConfig } from './serve-types'

describe('defineServeConfig', () => {
  it('returns the given config unchanged', () => {
    const config = { root: 'dist/site', headers: [{ headers: { 'X-Content-Type-Options': 'nosniff' } }] }
    expect(defineServeConfig(config)).toBe(config)
  })
})
