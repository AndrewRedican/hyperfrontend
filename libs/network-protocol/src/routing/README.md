# routing

Packet routing primitives: subscription types and routed-packet creators that pair a packet with a topic.

`Router` is the function that turns the available channels and topics into `RoutingOptions`: `isDynamic` (whether subscriptions are fetched anew for each message or once and cached) and `subscriptions`, a `WeakMap` from channel to its subscribed topics. `RoutedPacket`, `RoutedWirePacket`, and `RoutedUnencryptedPacket` are the envelopes that carry a topic id beside a sealed frame or a plaintext packet; `createRoutedWirePacket` and `createRoutedUnencryptedPacket` produce them and throw for a topic id that is not a UUID v4.
