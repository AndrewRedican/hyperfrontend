/**
 * FIFO message processing queues for the seal and open pipeline stages.
 *
 * @module @hyperfrontend/network-protocol/queue
 */
export type {
  Queue,
  MessageHandler,
  QueueFailureHandler,
  QueueOperation,
  QueueCreatorArguments,
  QueueCreatorValidity,
  SealQueueCreater,
  OpenQueueCreater,
} from './model'
export { createOpenQueue } from './creators/create-open-queue'
export { createQueue } from './creators/create-queue'
export { createSealQueue } from './creators/create-seal-queue'
