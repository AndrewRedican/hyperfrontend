import type { Mock } from '@hyperfrontend/testing'
import { afterEach } from 'node:test'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFeature } from './create-feature'

describe('createFeature', () => {
  afterEach(() => {
    document.head.innerHTML = ''
    Object.defineProperty(window, 'opener', { value: null, configurable: true, writable: true })
  })

  function stubHostOpener(): { postMessage: Mock } {
    const opener = { postMessage: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() }
    Object.defineProperty(window, 'opener', { value: opener, configurable: true, writable: true })
    return opener
  }

  it('returns a feature handle exposing the public surface', () => {
    const feature = createFeature({
      name: 'clock',
      contract: { emitted: [{ type: 'timeUpdated' }], accepted: [{ type: 'setTimezone' }] },
    })
    expect(feature).toEqual(
      expect.objectContaining({
        send: expect.any(Function),
        on: expect.any(Function),
        ready: expect.any(Function),
        close: expect.any(Function),
      })
    )
  })

  it('reports hosted when an opener window exists', () => {
    stubHostOpener()
    const feature = createFeature({ name: 'clock', contract: { emitted: [], accepted: [] } })
    expect(feature.hosted).toBe(true)
  })

  it('reports unhosted on a direct top-level visit', () => {
    const feature = createFeature({ name: 'clock', contract: { emitted: [], accepted: [] } })
    expect(feature.hosted).toBe(false)
  })

  it('resets the feature body by default', () => {
    createFeature({ name: 'clock', contract: { emitted: [], accepted: [] } })
    expect(document.head.querySelector('style')?.textContent).toContain('margin:0')
  })

  it('skips the body reset when resetBody is false', () => {
    createFeature({ name: 'clock', contract: { emitted: [], accepted: [] }, resetBody: false })
    expect(document.head.querySelector('style')).toBeNull()
  })

  it('throws when the v2 protocol is selected without a shared key', () => {
    stubHostOpener()
    expect(() => createFeature({ name: 'clock', contract: { emitted: [], accepted: [] }, protocol: 'v2' })).toThrow(
      'Security protocol \'v2\' requires a pre-shared key: set the "sharedKey" option to a non-empty string.'
    )
  })

  it('advertises the selected protocol to the host in the connection request', () => {
    const opener = stubHostOpener()
    createFeature({ name: 'clock', contract: { emitted: [], accepted: [] }, protocol: 'v2', sharedKey: 'pre-shared-key' })
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ security: { supported: ['v2', 'none'], preferred: 'v2' } }),
      expect.any(String)
    )
  })

  it('keeps the connection request plain when no protocol is selected', () => {
    const opener = stubHostOpener()
    createFeature({ name: 'clock', contract: { emitted: [], accepted: [] } })
    expect(opener.postMessage).toHaveBeenCalledWith(expect.not.objectContaining({ security: expect.anything() }), expect.any(String))
  })

  it('announces the options version in the connection-request contract', () => {
    const opener = stubHostOpener()
    createFeature({ name: 'clock', contract: { emitted: [], accepted: [] }, version: '1.2.0' })
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ contract: expect.objectContaining({ version: '1.2.0' }) }),
      expect.any(String)
    )
  })

  it('gives the options version precedence over the contract version', () => {
    const opener = stubHostOpener()
    createFeature({ name: 'clock', contract: { emitted: [], accepted: [], version: '1.0.0' }, version: '1.2.0' })
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ contract: expect.objectContaining({ version: '1.2.0' }) }),
      expect.any(String)
    )
  })

  it('announces the contract version when no options version is given', () => {
    const opener = stubHostOpener()
    createFeature({ name: 'clock', contract: { emitted: [], accepted: [], version: '1.0.0' } })
    expect(opener.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ contract: expect.objectContaining({ version: '1.0.0' }) }),
      expect.any(String)
    )
  })

  it('validates the options version like a contract-authored one', () => {
    expect(() => createFeature({ name: 'clock', contract: { emitted: [], accepted: [] }, version: 'latest' })).toThrow(
      '"version" must be a valid semver version (e.g. "1.2.0"), but got "latest".'
    )
  })

  it('enforces the contract schemas on send in the feature frame', () => {
    stubHostOpener()
    const feature = createFeature({
      name: 'clock',
      contract: {
        emitted: [{ type: 'timeUpdated', schema: { type: 'object', properties: { iso: { type: 'string' } }, required: ['iso'] } }],
        accepted: [],
      },
    })
    expect(() => feature.send('timeUpdated', {})).toThrow("Invalid payload for action 'timeUpdated'")
  })
})
