import { describe, expect, it } from '@hyperfrontend/testing'
import { messageEntryStyle, palette, statusDotStyle } from './styles'

describe('statusDotStyle', () => {
  it('colours a connected dot online', () => {
    expect(statusDotStyle(true).background).toBe(palette.online)
  })

  it('colours a disconnected dot offline', () => {
    expect(statusDotStyle(false).background).toBe(palette.offline)
  })
})

describe('messageEntryStyle', () => {
  it('accents incoming entries', () => {
    expect(messageEntryStyle('incoming').borderLeft).toEqual(expect.stringContaining(palette.incoming))
  })

  it('accents outgoing entries', () => {
    expect(messageEntryStyle('outgoing').borderLeft).toEqual(expect.stringContaining(palette.outgoing))
  })
})
