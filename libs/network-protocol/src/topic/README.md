# topic

Topic-based pub/sub registry: store and lookup primitives for managing topics across channels.

`Topic` is the structured shape carrying a label, optional metadata, and the set of subscribers. `TopicStore` is the registry that holds `Topic[]`, exposing add/remove/lookup operations with stable identity. `createTopicStore` is the factory; consumers compose the store with channels and routers to drive topic-based message delivery.
