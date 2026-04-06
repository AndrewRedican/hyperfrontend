/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Channel } from '../channel/model'
import type { UnencryptedPacket } from '../packet/model'
import type { Topic } from '../topic/model'

/**
 * A packet routed to a specific topic.
 */
export interface RoutedPacket {
  /** Topic identifier for routing */
  topicId: string
  /** The packet payload */
  packet: unknown
}

/**
 * A routed packet with obfuscated (binary) payload.
 */
export interface RoutedObfuscatedPacket extends RoutedPacket {
  /** Binary obfuscated packet data */
  packet: Uint8Array
}

/**
 * A routed packet with unencrypted payload.
 */
export interface RoutedUnencryptedPacket<T = any> extends RoutedPacket {
  /** Unencrypted packet with typed payload */
  packet: UnencryptedPacket<T>
}

/** Maps channels to their subscribed topics */
export type Subscriptions = WeakMap<Channel, Topic[]>

/**
 * Configuration options for message routing.
 */
export interface RoutingOptions {
  /**
   * Controls subscription fetching behavior:
   * - `true`: Fetches subscriptions anew for each message, useful for dynamic subscription setups.
   * - `false`: Fetches subscriptions once and caches them, ideal for stable setups.
   */
  isDynamic: boolean

  /**
   * Maps channels to subscribed topics, determining message routing based on topic.
   */
  subscriptions: Subscriptions
}

/**
 * Defines a function type that configures routing based on channels and topics.
 *
 * This function is invoked to determine routing configurations, including whether
 * subscriptions are fetched dynamically for each message, and how messages are routed
 * based on topics to specific channels.
 *
 * @param channels An array of channels that may receive messages.
 * @param topics An array of topics messages can belong to.
 * @returns RoutingOptions The configuration for routing messages, including dynamic subscription behavior and topic-to-channel mapping.
 */
export type Router = (channels: Channel[], topics: Topic[]) => RoutingOptions
