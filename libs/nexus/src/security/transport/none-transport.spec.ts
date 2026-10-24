import type { NoneTransportConfig } from './types'
import { describe, expect, it, jest } from '@hyperfrontend/testing'
import { createFakeWindow } from '@hyperfrontend/testing/browser'
import { createNoneTransport } from './none-transport'

describe('NoneTransport', () => {
  const createConfig = (overrides: Partial<NoneTransportConfig> = {}): NoneTransportConfig => ({
    target: createFakeWindow(),
    getOrigin: () => null,
    onAction: jest.fn(),
    ...overrides,
  })

  describe('send', () => {
    it('posts the action unchanged with a wildcard target before the origin is pinned', () => {
      const target = createFakeWindow()
      const transport = createNoneTransport(createConfig({ target }))

      transport.send({ type: 'TEST', data: 123 })

      expect(target.postMessage).toHaveBeenCalledWith({ type: 'TEST', data: 123 }, '*')
    })

    it('posts with a wildcard target for opaque origins', () => {
      const target = createFakeWindow()
      const transport = createNoneTransport(
        createConfig({
          target,
          getOrigin: () => 'null',
        })
      )

      transport.send({ type: 'TEST' })

      expect(target.postMessage).toHaveBeenCalledWith({ type: 'TEST' }, '*')
    })

    it('posts to the pinned origin once learned', () => {
      const target = createFakeWindow()
      const transport = createNoneTransport(
        createConfig({
          target,
          getOrigin: () => 'https://feature.example.com',
        })
      )

      transport.send({ type: 'TEST' })

      expect(target.postMessage).toHaveBeenCalledWith({ type: 'TEST' }, 'https://feature.example.com')
    })

    it('drops actions while stopped', () => {
      const target = createFakeWindow()
      const transport = createNoneTransport(createConfig({ target }))

      transport.stop()
      transport.send({ type: 'TEST' })

      expect(target.postMessage).not.toHaveBeenCalled()
    })

    it('sends again after resume', () => {
      const target = createFakeWindow()
      const transport = createNoneTransport(createConfig({ target }))

      transport.stop()
      transport.resume()
      transport.send({ type: 'TEST' })

      expect(target.postMessage).toHaveBeenCalledWith({ type: 'TEST' }, '*')
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

  describe('lifecycle', () => {
    it('posts nothing on start', () => {
      const target = createFakeWindow()
      const transport = createNoneTransport(createConfig({ target }))

      transport.start()

      expect(target.postMessage).not.toHaveBeenCalled()
    })

    it('keeps sending after dispose', () => {
      const target = createFakeWindow()
      const transport = createNoneTransport(createConfig({ target }))

      transport.dispose()
      transport.send({ type: 'TEST' })

      expect(target.postMessage).toHaveBeenCalledWith({ type: 'TEST' }, '*')
    })

    it('keeps delivering after dispose', () => {
      const onAction = jest.fn()
      const transport = createNoneTransport(createConfig({ onAction }))
      const payload = new Uint8Array([7, 8, 9])

      transport.dispose()
      transport.receive(payload)

      expect(onAction).toHaveBeenCalledWith(payload)
    })

    it('reports the none protocol', () => {
      const transport = createNoneTransport(createConfig())

      expect(transport.getProtocol()).toBe('none')
    })
  })
})
