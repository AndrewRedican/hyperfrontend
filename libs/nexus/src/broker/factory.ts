import { uuidV4 } from '@hyperfrontend/random-generator-utils'
import type { IChannelContract } from '../types/contract'
import type { IChannelSettings } from '../types/channel'
import type { SecurityProtocolVersion } from '../types/security'
import type { BrokerConfig, BrokerState, BrokerHandle, SecurityPolicy } from './types'
import { defaultBrokerSettings } from './defaults'
import { createRegistry } from '../core/registry/factory'
import { createProcessManager } from '../core/processes/factory'
import { createActionCreators } from '../core/actions/factory'
import { createProtocolRegistry } from '../security/registry'
import { createRouter } from './routing/create-router'
import { routeMessage } from './routing/route-message'
import { routeEncryptedMessage } from './routing/route-encrypted-message'
import { filterOrigin } from './security/filter-origin'
import { validatePolicy } from './security/validate-policy'
import { addChannel, getChannel, listChannels, removeChannel } from './channels'
import {
  handleRequest,
  handleAccept,
  handleDeny,
  handleCancel,
  handleCancelAcknowledged,
  handleClose,
  handleCloseAcknowledged,
  handleOpen,
  handleDestroy,
  handleMessage,
  handleInvalid,
} from './routing'
import { ACTION_TYPES } from '../constants/action-types'
import { validateName } from '../core/validation/name'
import { validateContract } from '../core/validation/contract'
import type { IAction } from '../types/action'
import { mergeContracts } from '../setup/merge-contracts'

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
  // Validate inputs
  validateName(config.name)
  validateContract(config.contract)

  // Create broker state
  const state: BrokerState = {
    id: uuidV4(),
    name: config.name,
    window: window,
    contract: config.contract,
    settings: {
      ...defaultBrokerSettings,
      ...config.settings,
      contract: config.contract,
    },
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

  // Message handler
  const onMessage = (event: MessageEvent<IAction | Uint8Array>) => {
    const origin = event?.origin

    // Apply origin filtering
    if (!filterOrigin(origin, state.settings.whitelist, state.settings.blacklist)) {
      if (state.settings.debug) {
        console.info(`[nexus] ${state.name} ignored message from ${origin}`)
      }
      return
    }

    // Check if message is encrypted (Uint8Array)
    if (event.data instanceof Uint8Array) {
      routeEncryptedMessage(state, registry, processManager, actions, router, <MessageEvent<Uint8Array>>event)
      return
    }

    // Route plain object messages through existing handlers
    routeMessage(router, state, registry, processManager, actions, <MessageEvent<IAction>>event)
  }

  // Attach message listener
  if (typeof window !== 'undefined') {
    window.addEventListener('message', <EventListener>onMessage)
  }

  // Create broker handle
  const broker: BrokerHandle = {
    id: state.id,
    name: state.name,
    settings: state.settings,
    debugMode: state.settings.debug ?? false,

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
      ;(state.settings as unknown as Record<string, unknown>)['securityPolicy'] = policy
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
        debugMode: state.settings.debug ?? false,
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
  }

  return broker
}
