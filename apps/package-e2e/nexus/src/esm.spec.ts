/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/nexus`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node
 * with no loader hooks, so the entries resolve and behave as a consumer's `import` sees them.
 */

import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL })

describe('@hyperfrontend/nexus ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('exposes the documented surface of the main entry', () => {
    const surface = consumer.run(async () => {
      const entry = await import('@hyperfrontend/nexus')
      return Object.fromEntries(Object.keys(entry).map((name) => [name, typeof (entry as Record<string, unknown>)[name]]))
    })
    expect(surface).toEqual(
      expect.objectContaining({
        createBroker: 'function',
        createChannel: 'function',
        mergeContracts: 'function',
        byType: 'function',
        defaultBroker: 'object',
        DEFAULT_CONTRACT: 'object',
      })
    )
  })

  it('loads under plain Node without a window global', () => {
    const windowType = consumer.run(async () => {
      const { DEFAULT_CONTRACT } = await import('@hyperfrontend/nexus')
      return [typeof window, typeof DEFAULT_CONTRACT]
    })
    expect(windowType).toEqual(['undefined', 'object'])
  })

  it('names the missing window when a broker is created outside a browser', () => {
    const message = consumer.run(async () => {
      const { DEFAULT_CONTRACT, createBroker } = await import('@hyperfrontend/nexus')
      try {
        createBroker({ name: 'host', contract: DEFAULT_CONTRACT })
        return 'created'
      } catch (error) {
        return (error as Error).message
      }
    })
    expect(message).toBe(
      'Cannot create broker: no window is available. Pass an explicit `window` in the broker config when running outside a browser environment.'
    )
  })

  it('merges contracts without repeating a type', () => {
    const merged = consumer.run(async () => {
      const { mergeContracts } = await import('@hyperfrontend/nexus')
      const merged = mergeContracts({ accepted: [{ type: 'A' }], emitted: [] }, { accepted: [{ type: 'A' }], emitted: [{ type: 'B' }] })
      return { accepted: merged.accepted.map((action) => action.type), emitted: merged.emitted.map((action) => action.type) }
    })
    expect(merged).toEqual({
      accepted: ['A'],
      emitted: ['B'],
    })
  })

  it('passes only messages of the filtered type through byType', () => {
    const seen = consumer.run(async () => {
      const { byType } = await import('@hyperfrontend/nexus')
      const seen: string[] = []
      const onlyPing = byType('PING')((message) => seen.push(message.type))
      onlyPing({ type: 'PING' })
      onlyPing({ type: 'PONG' })
      return seen
    })
    expect(seen).toEqual(['PING'])
  })
})
