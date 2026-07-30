/**
 * Cross-window communication library for micro-frontends with broker/channel patterns and contract validation.
 *
 * @module @hyperfrontend/nexus
 */
export type { Logger, LogLevel } from '@hyperfrontend/logging'
export type { BrokerHandle, BrokerConfig, BrokerSettings, BrokerState, SecurityPolicy } from './broker/types'
export type { EventHandler } from './filters/events/create'
export type { MessageFilter } from './filters/messages/compose'
export type { MessageHandler, MessagePredicate } from './filters/messages/create'
export type { IAction, ActionType } from './types/action'
export type { ChannelHandle, ChannelJSON, IChannelSettings, IChannelConfig } from './types/channel'
export type {
  IChannelContract,
  IActionDescription,
  ContractCompat,
  ContractCompatibility,
  ContractCompatible,
  ContractIncompatible,
} from './types/contract'
export type {
  ChannelEvent,
  EventData,
  OpenEventData,
  CloseEventData,
  CloseReason,
  CancelEventData,
  DenyEventData,
  InvalidEventData,
  OpenEventHandler,
  CloseEventHandler,
  CancelEventHandler,
  DenyEventHandler,
  InvalidEventHandler,
} from './types/events'
export type { IMessage, MessageEnvelope } from './types/message'
export type {
  SecurityProtocolVersion,
  SecurityPacket,
  SecurityPacketData,
  SecurityEncryptedPacket,
  SecuritySerializedPacket,
  SecuritySendPacket,
  SecurityReceivePacket,
  SecurityWireProtocol,
  SecurityProtocolProvider,
  SecurityWireChannel,
  SecurityChannelFactory,
  SecurityProvider,
  SecurityTransport,
  SecurityTransportConfig,
  SecurityTransportError,
} from './types/security'
export type { NexusLoggerOptions } from './utils/logging/create-logger'
export { createBroker } from './broker/factory'
export { createChannel } from './channel/factory'
export { DEFAULT_CONTRACT } from './constants/default-contract'
export { cancel as cancelFilter } from './filters/events/cancel'
export { close as closeFilter } from './filters/events/close'
export { create as createEventFilter } from './filters/events/create'
export { deny as denyFilter } from './filters/events/deny'
export { invalid as invalidFilter } from './filters/events/invalid'
export { open as openFilter } from './filters/events/open'
export { byType } from './filters/messages/by-type'
export { compose } from './filters/messages/compose'
export { create as createMessageFilter } from './filters/messages/create'
export { createSecurityTransport } from './security/transport/factory'
export { mergeContracts } from './setup/merge-contracts'
export { broker as defaultBroker } from './singleton'
export { createLogger } from './utils/logging/create-logger'
export { logAction } from './utils/logging/log-action'
export { logEvent } from './utils/logging/log-event'
