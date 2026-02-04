/**
 * TEMPORARY COMPATIBILITY LAYER
 *
 * This file re-exports everything from the legacy _src/ directory
 * to maintain backward compatibility during the refactoring process.
 *
 * This will be replaced with the new functional API once the refactoring is complete.
 */

// Legacy exports (from _src)
export type { IAction } from '../_src/message-channel'
export type {
  IChannelSettings,
  TOpenEventHandler,
  TCloseEventHandler,
  TCancelEventHandler,
  TDenyEventHandler,
  TInvalidEventHandler,
  TMessageHandler,
  IMessage,
} from '../_src/message-channel'
export type { IBrokerSettings } from '../_src/message-broker'
export type { IChannelContract, IActionDescription } from '../_src/models'
export { actionSchema } from '../_src/action-schema'
export { MessageBroker } from '../_src/message-broker'
export { MessageChannel, ChannelEvent } from '../_src/message-channel'
export { open, close, cancel, deny, invalid } from '../_src/event-filters'
export { filter } from '../_src/message-filters'
export { broker, mergeContracts } from '../_src/setup'

// New functional API exports
export { createBroker } from './broker'
export { createChannel } from './channel'
export { mergeContracts as mergeContractsV2 } from './setup'
export { broker as defaultBroker, DEFAULT_CONTRACT } from './singleton'

// Core types
export type { BrokerHandle, BrokerConfig } from './broker/types'
export type { ChannelHandle, ChannelJSON } from './types/channel'
export type { IChannelContract, IActionDescription } from './types/contract'
export type { IMessage, MessageEnvelope } from './types/message'
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
export type { IAction, ActionType } from './types/action'
export type { SecurityPolicy } from './types/broker'

// Filter utilities
export { byType, compose } from './filters/messages'
export {
  open as openFilter,
  close as closeFilter,
  cancel as cancelFilter,
  deny as denyFilter,
  invalid as invalidFilter,
} from './filters/events'
