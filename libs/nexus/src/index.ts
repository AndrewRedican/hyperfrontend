export { createBroker } from './broker/factory'
export { createChannel } from './channel/factory'
export { mergeContracts } from './setup/merge-contracts'
export { broker as defaultBroker, DEFAULT_CONTRACT } from './singleton'

export type { BrokerHandle, BrokerConfig, BrokerSettings, BrokerState, SecurityPolicy } from './broker/types'

export type { ChannelHandle, ChannelJSON, IChannelSettings, IChannelConfig } from './types/channel'

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

export { create as createEventFilter, type EventHandler } from './filters/events/create'
export { open as openFilter } from './filters/events/open'
export { close as closeFilter } from './filters/events/close'
export { cancel as cancelFilter } from './filters/events/cancel'
export { deny as denyFilter } from './filters/events/deny'
export { invalid as invalidFilter } from './filters/events/invalid'

export { create as createMessageFilter, type MessageHandler, type MessagePredicate } from './filters/messages/create'
export { byType } from './filters/messages/by-type'
export { compose, type MessageFilter } from './filters/messages/compose'

export { createLogger, type NexusLoggerOptions } from './utils/logging/create-logger'
export type { Logger, LogLevel } from '@hyperfrontend/logging'
export { logAction } from './utils/logging/log-action'
export { logEvent } from './utils/logging/log-event'
