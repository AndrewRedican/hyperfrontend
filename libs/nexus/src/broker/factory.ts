import type { IAction } from '../types/action'
import type { IChannelSettings } from '../types/channel'
import type { IChannelContract } from '../types/contract'
import type { SecurityProtocolVersion } from '../types/security'
import type { RoutingContext } from './routing/types'
import type { BrokerConfig, BrokerState, BrokerHandle, SecurityPolicy } from './types'
import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import { ACTION_TYPES } from '../constants/action-types'
import { createActionCreators } from '../core/actions/factory'
import { createProcessManager } from '../core/processes/factory'
import { createRegistry } from '../core/registry/factory'
import { validateContract } from '../core/validation/contract'
import { validateName } from '../core/validation/name'
import { createProtocolRegistry } from '../security/registry/factory'
import { mergeContracts } from '../setup/merge-contracts'
import { createLogger } from '../utils/logging/create-logger'
import { assertNoCircularRef } from '../utils/validation/assert-no-circular-ref'
import { addChannel } from './channels/add'
import { getChannel } from './channels/get'
import { listChannels } from './channels/list'
import { removeChannel } from './channels/remove'
import { defaultBrokerSettings } from './defaults'
import { createRouter } from './routing/create-router'
import { handleAccept } from './routing/handle-accept'
import { handleCancel } from './routing/handle-cancel'
import { handleCancelAcknowledged } from './routing/handle-cancel-acknowledged'
import { handleClose } from './routing/handle-close'
import { handleCloseAcknowledged } from './routing/handle-close-acknowledged'
import { handleDeny } from './routing/handle-deny'
import { handleDestroy } from './routing/handle-destroy'
import { handleInvalid } from './routing/handle-invalid'
import { handleMessage } from './routing/handle-message'
import { handleOpen } from './routing/handle-open'
import { handleRequest } from './routing/handle-request'
import { routeEncryptedMessage } from './routing/route-encrypted-message'
import { routeMessage } from './routing/route-message'
import { filterOrigin } from './security/filter-origin'
import { validatePolicy } from './security/validate-policy'

/**
 * Creates a message broker instance
 *
 * @param config - Broker configuration
 * @param config.name - Unique name for the broker instance
 * @param config.contract - Channel contract defining message protocols
 * @param config.settings - Optional configuration overrides for broker behavior
 * @returns Broker handle with public API
 */
export function createBroker(config: {
  name: string
  contract: IChannelContract
  settings?: Partial<BrokerConfig['settings']>
}): BrokerHandle {
  assertNoCircularRef(config.contract, 'config.contract')
  assertNoCircularRef(config.settings, 'config.settings')
  validateName(config.name)
  validateContract(config.contract)

  // Merge settings with defaults
  const mergedSettings = {
    ...defaultBrokerSettings,
    ...config.settings,
    contract: config.contract,
  }

  // Create logger - use provided logger, or create one based on logLevel setting
  const logLevel = mergedSettings.logLevel ?? 'error'
  const logger = createLogger({
    level: logLevel,
    customLogger: mergedSettings.logger,
  })

  // Create broker state
  const state: BrokerState = {
    id: uuidV4(),
    name: config.name,
    window: window,
    contract: config.contract,
    settings: mergedSettings,
    logger,
  }

  // Create infrastructure
  const registry = createRegistry()
  const processManager = createProcessManager()
  const protocolRegistry = createProtocolRegistry()

  // Register pre-configured protocol providers from settings
  if (config.settings?.security?.protocols) {
    const protocols = config.settings.security.protocols

    if (protocols.v1) {
      protocolRegistry.register('v1', protocols.v1)
    }

    if (protocols.v2) {
      protocolRegistry.register('v2', protocols.v2)
    }
  }

  // Create action creators
  const actions = createActionCreators({
    getBrokerId: () => state.id,
    getContract: () => state.contract,
  })

  // Create message router with all handlers
  const router = createRouter({
    [ACTION_TYPES.REQUEST_CONNECTION]: handleRequest,
    [ACTION_TYPES.ACCEPT_CONNECTION]: handleAccept,
    [ACTION_TYPES.DENY_CONNECTION]: handleDeny,
    [ACTION_TYPES.CANCEL_CONNECTION]: handleCancel,
    [ACTION_TYPES.CANCEL_CONNECTION_ACKNOWLEDGED]: handleCancelAcknowledged,
    [ACTION_TYPES.CLOSE_CONNECTION]: handleClose,
    [ACTION_TYPES.CLOSE_CONNECTION_ACKNOWLEDGED]: handleCloseAcknowledged,
    [ACTION_TYPES.OPEN_CONNECTION]: handleOpen,
    [ACTION_TYPES.DESTROY_CONNECTION]: handleDestroy,
    [ACTION_TYPES.NEW_MESSAGE]: handleMessage,
    [ACTION_TYPES.INVALID_REQUEST]: handleInvalid,
  })

  // Create routing context for message handlers
  const routingContext: RoutingContext = {
    state,
    registry,
    processManager,
    actions,
    logger,
  }

  // Message handler
  const onMessage = (event: MessageEvent<IAction | Uint8Array>) => {
    const origin = event?.origin

    // Apply origin filtering
    if (!filterOrigin(origin, state.settings.whitelist, state.settings.blacklist)) {
      logger.info(`${state.name} ignored message from ${origin}`)
      return
    }

    // Check if message is encrypted (Uint8Array)
    if (event.data instanceof Uint8Array) {
      routeEncryptedMessage(routingContext, router, <MessageEvent<Uint8Array>>event)
      return
    }

    // Route plain object messages through existing handlers
    routeMessage(router, routingContext, <MessageEvent<IAction>>event)
  }

  // Attach message listener
  /* istanbul ignore next -- environment detection for non-browser contexts */
  if (typeof window !== 'undefined') {
    window.addEventListener('message', <EventListener>onMessage)
  }

  // Create broker handle
  const broker: BrokerHandle = {
    id: state.id,
    name: state.name,
    settings: state.settings,

    get contract() {
      return state.contract
    },

    get channels() {
      return listChannels(registry)
    },

    get acceptedActionTypes() {
      return state.contract.accepted.map((a) => a.type)
    },

    addChannel(name: string, target: Window, settings?: Partial<IChannelSettings>) {
      return addChannel(state, registry, processManager, actions, name, target, settings ?? {})
    },

    getChannel(reference: string | Window) {
      return getChannel(registry, reference)
    },

    removeChannel(reference: string | Window) {
      const channel = getChannel(registry, reference)
      if (channel) {
        removeChannel(registry, channel)
      }
    },

    setSecurityPolicy(policy: SecurityPolicy) {
      validatePolicy(policy)
      // Use bracket notation to set the property
      ;(<Record<string, unknown>>(<unknown>state.settings))['securityPolicy'] = policy
      return broker // Enable chaining
    },

    extendContract(contract: IChannelContract) {
      if (!state.settings.contractExtension) {
        throw new Error('Original contract cannot be extended.')
      }
      validateContract(contract)
      ;(<{ contract: unknown }>state).contract = mergeContracts(state.contract, contract)
      return broker // Enable chaining
    },

    toJSON() {
      return {
        id: state.id,
        name: state.name,
        settings: state.settings,
        acceptedActionTypes: state.contract.accepted.map((a) => a.type),
        channels: listChannels(registry),
      }
    },

    registerProtocol(version: 'v1' | 'v2', provider: unknown) {
      protocolRegistry.register(version, provider)
      return broker
    },

    unregisterProtocol(version: 'v1' | 'v2') {
      protocolRegistry.unregister(version)
      return broker
    },

    hasProtocol(version: SecurityProtocolVersion) {
      return protocolRegistry.has(version)
    },

    getSupportedProtocols() {
      return protocolRegistry.getSupportedVersions()
    },

    get logger() {
      return state.logger
    },
  }

  return broker
}
