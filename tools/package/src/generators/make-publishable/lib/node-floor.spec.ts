import { describe, expect, it } from '@hyperfrontend/testing'
import { DEFAULT_NODE_ENGINE, DEFAULT_NPM_ENGINE, compactVersion, nodeFloorOf } from './node-floor'

describe('nodeFloorOf', () => {
  it('reads the version out of a lower bound', () => {
    expect(nodeFloorOf('>=22.18.0')).toBe('22.18.0')
  })

  it('reads the first version when the range names several', () => {
    expect(nodeFloorOf('^20.10 || >=22')).toBe('20.10')
  })

  it('drops a trailing dot that is not part of the version', () => {
    expect(nodeFloorOf('18. || 20')).toBe('18')
  })

  it('refuses a range that names no version', () => {
    expect(() => nodeFloorOf('*')).toThrow('engines.node "*" names no version, so no floor can be read from it')
  })

  it('reads the default engines the generator writes', () => {
    expect([nodeFloorOf(DEFAULT_NODE_ENGINE), nodeFloorOf(DEFAULT_NPM_ENGINE)]).toEqual(['18.0.0', '8.0.0'])
  })
})

describe('compactVersion', () => {
  it('drops every trailing zero segment', () => {
    expect(compactVersion('18.0.0')).toBe('18')
  })

  it('keeps a trailing zero that follows a non-zero segment', () => {
    expect(compactVersion('22.18.0')).toBe('22.18')
  })

  it('leaves a version with no trailing zeros alone', () => {
    expect(compactVersion('20.10.5')).toBe('20.10.5')
  })

  it('leaves a lone zero alone', () => {
    expect(compactVersion('0')).toBe('0')
  })
})
