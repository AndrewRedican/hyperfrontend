import { after as afterAll, before as beforeAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { timestampToDateTime } from './timestamp-to-date-time'

describe('Timestamp Converter', () => {
  beforeAll(() => {
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    })
  })

  it('converts timestamp to "YYYY/MM/DD HH:MM:SS" format', () => {
    const timestamp = 1623376800000
    const convertedDateTime = timestampToDateTime(timestamp)
    expect(convertedDateTime).toEqual('Fri, 06/11/2021, 02:00:00 UTC')
  })

  it('uses userLanguage when language is not available', () => {
    const originalLanguage = Object.getOwnPropertyDescriptor(navigator, 'language')

    Object.defineProperty(navigator, 'language', {
      value: undefined,
      configurable: true,
    })

    Object.defineProperty(navigator, 'userLanguage', {
      value: 'en-GB',
      configurable: true,
      writable: true,
    })

    const timestamp = 1623376800000
    const convertedDateTime = timestampToDateTime(timestamp)
    expect(convertedDateTime).toBeDefined()

    if (originalLanguage) {
      Object.defineProperty(navigator, 'language', originalLanguage)
    }

    delete (navigator as unknown as { userLanguage?: unknown }).userLanguage
  })

  afterAll(() => {
    Object.defineProperty(navigator, 'language', {
      value: undefined,
      configurable: true,
    })
  })
})
