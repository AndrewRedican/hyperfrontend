# routing

Packet routing primitives: subscription management and routed-packet creators that target specific topics or recipients.

`Router` is the runtime object that carries `Subscriptions` and dispatches incoming packets to handlers based on topic, channel, or label. `RoutedPacket`, `RoutedObfuscatedPacket`, and `RoutedUnencryptedPacket` are the structured envelopes carried over the wire. `createRoutedObfuscatedPacket` and `createRoutedUnencryptedPacket` produce those envelopes; `RoutingOptions` covers wildcard handling, subscription matching strategy, and dead-letter behavior.
