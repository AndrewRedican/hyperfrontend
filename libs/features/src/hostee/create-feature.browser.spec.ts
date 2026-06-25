import { createFeature } from './create-feature'

describe('createFeature', () => {
  afterEach(() => {
    document.head.innerHTML = ''
  })

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

  it('resets the feature body by default', () => {
    createFeature({ name: 'clock', contract: { emitted: [], accepted: [] } })
    expect(document.head.querySelector('style')?.textContent).toContain('margin:0')
  })

  it('skips the body reset when resetBody is false', () => {
    createFeature({ name: 'clock', contract: { emitted: [], accepted: [] }, resetBody: false })
    expect(document.head.querySelector('style')).toBeNull()
  })
})
