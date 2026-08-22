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
 * a handle for messaging and lifecycle whose `hosted` flag reports synchronously
 * whether a host window exists at all. When `protocol` selects the `v1` or
 * `v2` envelope, the feature negotiates it with the host during the connection
 * handshake and messages travel encrypted once it opens. A `version` announces
 * the contract cut this feature holds (overriding any `contract.version`), so
 * the handshake can deny hosts built against an incompatible cut.
 *
 * @param options - Feature name, contract, and optional version, root-element, and security settings.
 * @returns A handle exposing `send`, `on`, `ready`, and `close`.
 *
 * @example Initializing a clock feature
 * ```typescript
 * const feature = createFeature({ name: 'clock', contract, version: '1.2.0', protocol: 'v2', sharedKey: 'pre-shared-key' })
 * feature.ready().then(() => feature.send('timeUpdated', { time: Date.now() }))
 * feature.on('setTimezone', (data) => console.log(data))
 * ```
 */
export function createFeature(options: FeatureOptions): FeatureHandle {
  const contract = withControlContract(
    validateContract(options.version === undefined ? options.contract : { ...options.contract, version: options.version })
  )
  const emitter = createEventEmitter()
  const broker = createBroker({ name: options.name, contract })
  if (options.resetBody !== false) {
    applyBodyReset()
  }
  return createFeatureHandle(broker, resolveHostWindow(window), emitter, {
    readyTimeoutMs: options.readyTimeoutMs,
    protocol: options.protocol,
    sharedKey: options.sharedKey,
    root: options.root,
    contract,
  })
}
