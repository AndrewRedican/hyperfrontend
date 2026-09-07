# topic

Topic registry: a store for the named topics that channels subscribe to.

`Topic` is a name paired with a generated UUID v4 `id`. `TopicStore` holds topics with `create` (by name, ids generated), `add` (existing objects), lookups by name or id, `list`, and removal by name or id. `createTopicStore` is the factory; consumers compose the store with channels and a `Router` from `/routing` to drive topic-based message delivery.
