import type { BrokerHandle } from '@hyperfrontend/nexus'
import { createEventEmitter } from '../shared/event-emitter'
import { createFeatureHandle } from './lifecycle'

// why: The suite-wide freeze passthrough (jest.setup.ts) would make these immutability assertions meaningless; this suite needs the real freeze.
jest.unmock('@hyperfrontend/immutable-api-utils/built-in-copy/object')

function createUnhostedHandle() {
  return createFeatureHandle(<BrokerHandle>(<unknown>{}), null, createEventEmitter(), { contract: { emitted: [], accepted: [] } })
}

describe('the frozen feature handle', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(createUnhostedHandle())).toBe(true)
  })

  it('keeps hosted unchanged when assignment is attempted', () => {
    const handle = createUnhostedHandle()
    expect(() => {
      ;(<{ hosted: boolean }>(<unknown>handle)).hosted = true
    }).toThrow(TypeError)
    expect(handle.hosted).toBe(false)
  })
})
