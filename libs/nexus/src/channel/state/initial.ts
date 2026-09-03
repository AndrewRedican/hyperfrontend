import type { ChannelState, IChannelSettings } from '../../types/channel'
import { freeze } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { DEFAULT_CLOSE_TIMEOUT_MS, DEFAULT_CONNECT_TIMEOUT_MS, DEFAULT_REQUEST_RETRY_MS } from '../../constants/defaults'

/**
 * Creates the initial state for a new channel.
 * All collections are empty, all optional fields are null.
 *
 * @param name - Channel name/identifier
 * @param target - Target window for communication
 * @param settings - Channel settings (queueMessages, debug, logger, etc.)
 * @returns Fresh channel state object
 *
 * @example Creating initial channel state
 * ```typescript
 * const state = createInitialState('my-channel', targetWindow, { queueMessages: true })
 * // => { id: '...', name: 'my-channel', active: false, queuedMessages: [], ... }
 * ```
 */
export function createInitialState(name: string, target: Window, settings: Partial<IChannelSettings>): ChannelState {
  return freeze({
    id: uuidV4(),
    name,
    target,
    // why: '*' means no expected origin, modeled as null (unpinned); a concrete settings origin pre-pins the channel before the first send.
    origin: settings.origin && settings.origin !== '*' ? settings.origin : null,
    active: false,
    connectTimestamp: null,
    contract: settings.contract ?? null,
    acceptedActions: freeze([]),
    queuedMessages: freeze([]),
    eventSubscriptions: freeze([]),
    messageSubscriptions: freeze([]),
    scheduledActivation: null,
    peerContract: null,
    peerId: null,
    pendingProcessId: null,
    pendingAccept: null,
    retryTimer: null,
    deadlineTimer: null,
    connectTimeoutMs: settings.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    requestRetryMs: settings.requestRetryMs ?? DEFAULT_REQUEST_RETRY_MS,
    closingProcessId: null,
    closeTimer: null,
    closeTimeoutMs: settings.closeTimeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS,
    queueMessages: settings.queueMessages ?? true,
    logger: settings.logger ?? null,
    brokerManaged: ((settings as Record<string, unknown>)['brokerManaged'] as boolean) ?? false,
    security: settings.security ?? null,
    contractCompat: settings.contractCompat ?? null,
    readyToConnect: false,
    negotiatedProtocol: null,
    securityReady: false,
    securityTransport: null,
    pendingSecurityRequest: null,
    notifiedDenyProcessId: null,
  } as ChannelState)
}
