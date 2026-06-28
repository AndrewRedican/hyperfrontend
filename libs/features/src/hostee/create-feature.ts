import type { FeatureOptions } from '../shared/types'
import type { FeatureHandle } from './types'
import { createBroker } from '@hyperfrontend/nexus'
import { validateContract } from '../shared/contract'
import { withControlContract } from '../shared/control'
import { createEventEmitter } from '../shared/event-emitter'
import { createFeatureHandle, resolveHostWindow } from './lifecycle'
import { applyBodyReset } from './sizing'

/**
 * Initializes a feature app on the hostee side and waits for the host connection.
 *
 * Creates a nexus broker for the feature, resolves the host window, and returns
 * a handle for messaging and lifecycle.
 *
 * @param options - Feature name and contract.
 * @returns A handle exposing `send`, `on`, `ready`, and `close`.
 *
 * @example Initializing a clock feature
 * ```typescript
 * const feature = createFeature({ name: 'clock', contract })
 * feature.ready().then(() => feature.send('timeUpdated', { time: Date.now() }))
 * feature.on('setTimezone', (data) => console.log(data))
 * ```
 */
export function createFeature(options: FeatureOptions): FeatureHandle {
  const contract = withControlContract(validateContract(options.contract))
  const emitter = createEventEmitter()
  const broker = createBroker({ name: options.name, contract })
  if (options.resetBody !== false) {
    applyBodyReset()
  }
  return createFeatureHandle(broker, resolveHostWindow(window), emitter)
}
