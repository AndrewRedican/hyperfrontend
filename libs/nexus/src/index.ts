/**
 * \@hyperfrontend/nexus
 *
 * Cross-window communication with contracts, lifecycle management, and security.
 * Provides a TCP-like handshake protocol for establishing reliable communication
 * channels between browser windows, iframes, and web workers.
 */

// Core factory functions
export { createBroker } from './broker'
export { createChannel } from './channel'
export { mergeContracts } from './setup'
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
export {
  open as openFilter,
  close as closeFilter,
  cancel as cancelFilter,
  deny as denyFilter,
  invalid as invalidFilter,
  createEventFilter,
} from './filters'

// Filter utilities - message filters
export { byType, compose, createMessageFilter } from './filters'
export type { MessageFilter, MessagePredicate, MessageHandler, EventHandler } from './filters'
