import type { NoneTransportConfig } from './types'
import { createNoneTransport } from './none-transport'

describe('NoneTransport', () => {
  const createConfig = (overrides: Partial<NoneTransportConfig> = {}): NoneTransportConfig => ({
    target: { postMessage: jest.fn() } as unknown as Window,
    getOrigin: () => null,
    onAction: jest.fn(),
    ...overrides,
  })

  describe('send', () => {
    it('posts the action unchanged with a wildcard target before the origin is pinned', () => {
      const postMessage = jest.fn()
      const transport = createNoneTransport(createConfig({ target: { postMessage } as unknown as Window }))

      transport.send({ type: 'TEST', data: 123 })

      expect(postMessage).toHaveBeenCalledWith({ type: 'TEST', data: 123 }, '*')
    })

    it('posts with a wildcard target for opaque origins', () => {
      const postMessage = jest.fn()
      const transport = createNoneTransport(
        createConfig({
          target: { postMessage } as unknown as Window,
          getOrigin: () => 'null',
        })
      )

      transport.send({ type: 'TEST' })

      expect(postMessage).toHaveBeenCalledWith({ type: 'TEST' }, '*')
    })

    it('posts to the pinned origin once learned', () => {
      const postMessage = jest.fn()
      const transport = createNoneTransport(
        createConfig({
          target: { postMessage } as unknown as Window,
          getOrigin: () => 'https://feature.example.com',
        })
      )

      transport.send({ type: 'TEST' })

      expect(postMessage).toHaveBeenCalledWith({ type: 'TEST' }, 'https://feature.example.com')
    })

    it('drops actions while stopped', () => {
      const postMessage = jest.fn()
      const transport = createNoneTransport(createConfig({ target: { postMessage } as unknown as Window }))

      transport.stop()
      transport.send({ type: 'TEST' })

      expect(postMessage).not.toHaveBeenCalled()
    })

    it('sends again after resume', () => {
      const postMessage = jest.fn()
      const transport = createNoneTransport(createConfig({ target: { postMessage } as unknown as Window }))

      transport.stop()
      transport.resume()
      transport.send({ type: 'TEST' })

      expect(postMessage).toHaveBeenCalledWith({ type: 'TEST' }, '*')
    })
  })

  describe('receive', () => {
    it('delivers the payload unchanged to the action handler', () => {
      const onAction = jest.fn()
      const transport = createNoneTransport(createConfig({ onAction }))
      const payload = new Uint8Array([1, 2, 3])

      transport.receive(payload)

      expect(onAction).toHaveBeenCalledWith(payload)
    })

    it('drops payloads while stopped', () => {
      const onAction = jest.fn()
      const transport = createNoneTransport(createConfig({ onAction }))

      transport.stop()
      transport.receive(new Uint8Array([1, 2, 3]))

      expect(onAction).not.toHaveBeenCalled()
    })

    it('delivers again after resume', () => {
      const onAction = jest.fn()
      const transport = createNoneTransport(createConfig({ onAction }))
      const payload = new Uint8Array([4, 5, 6])

      transport.stop()
      transport.resume()
      transport.receive(payload)

      expect(onAction).toHaveBeenCalledWith(payload)
    })
  })

  describe('state', () => {
    it('is always ready', () => {
      const transport = createNoneTransport(createConfig())

      expect(transport.isReady()).toBe(true)
    })

    it('reports the none protocol', () => {
      const transport = createNoneTransport(createConfig())

      expect(transport.getProtocol()).toBe('none')
    })
  })
})
