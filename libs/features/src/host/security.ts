import type { BrokerHandle } from '@hyperfrontend/nexus'
import type { SecurityProtocol } from '../shared/types'
import { createProtocol as createV1Protocol } from '@hyperfrontend/network-protocol/browser/v1'
import { createProtocol as createV2Protocol } from '@hyperfrontend/network-protocol/browser/v2'

// note: 'none' is the local default; v1/v2 register a network-protocol provider on the broker and return per-channel security settings for nexus.

/**
 * Registers the selected security protocol on the broker and builds channel settings.
 *
 * @param broker - The shell's nexus broker.
 * @param protocol - The selected protocol, or `undefined`/`none` for no security.
 * @param sharedKey - The pre-shared key used by the `v2` protocol.
 * @returns The nexus channel settings to apply, or `undefined` when unsecured.
 *
 * @example Enabling the v2 envelope
 * ```typescript
 * const settings = registerSecurity(broker, 'v2', 'pre-shared-key')
 * broker.addChannel('feature', target, settings)
 * ```
 */
export function registerSecurity(
  broker: BrokerHandle,
  protocol: SecurityProtocol | undefined,
  sharedKey: string | undefined
): Record<string, unknown> | undefined {
  if (protocol === 'v1') {
    broker.registerProtocol('v1', createV1Protocol(broker.logger))
    return { security: { protocol: 'v1' } }
  }
  if (protocol === 'v2') {
    broker.registerProtocol('v2', createV2Protocol(broker.logger, sharedKey ?? ''))
    return { security: { protocol: 'v2', sharedKey } }
  }
  return undefined
}
