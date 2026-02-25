/**
 * \@hyperfrontend/nexus
 *
 * Cross-window communication with contracts, lifecycle management, and security.
 * Provides a TCP-like handshake protocol for establishing reliable communication
 * channels between browser windows, iframes, and web workers.
 */

// Core factory functions
export { createBroker } from './broker/factory'
export { createChannel } from './channel/factory'
export { mergeContracts } from './setup/merge-contracts'
export { broker as defaultBroker, DEFAULT_CONTRACT } from './singleton'

// Broker types
export type { BrokerHandle, BrokerConfig, BrokerSettings, BrokerState, SecurityPolicy } from './broker/types'

// Channel types
export type { ChannelHandle, ChannelJSON, IChannelSettings, IChannelConfig } from './types/channel'

// Contract types
export type { IChannelContract, IActionDescription } from './types/contract'

// Message types
export type { IMessage, MessageEnvelope } from './types/message'

// Event types
export type {
  ChannelEvent,
  EventData,
  OpenEventData,
  CloseEventData,
  CancelEventData,
  DenyEventData,
  InvalidEventData,
  OpenEventHandler,
  CloseEventHandler,
  CancelEventHandler,
  DenyEventHandler,
  InvalidEventHandler,
} from './types/events'

// Action types
export type { IAction, ActionType } from './types/action'

// Filter utilities - event filters
export { create as createEventFilter, type EventHandler } from './filters/events/create'
export { open as openFilter } from './filters/events/open'
export { close as closeFilter } from './filters/events/close'
export { cancel as cancelFilter } from './filters/events/cancel'
export { deny as denyFilter } from './filters/events/deny'
export { invalid as invalidFilter } from './filters/events/invalid'

// Filter utilities - message filters
export { create as createMessageFilter, type MessageHandler, type MessagePredicate } from './filters/messages/create'
export { byType } from './filters/messages/by-type'
export { compose, type MessageFilter } from './filters/messages/compose'
