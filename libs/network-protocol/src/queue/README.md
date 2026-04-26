# queue

Message-queue factories for the encryption, serialization, and obfuscation pipelines that connect senders, receivers, and channels.

The queue family wraps a `MessageHandler` callback into a typed `Queue<T>` whose `enqueue` operation runs the configured pipeline (encrypt → serialize → obfuscate, or the inverse). `EncryptionQueueCreater`, `SerializationQueueCreater`, `ObfuscationQueueCreater`, and `DeobfuscationQueueCreater` are the factory shapes that bind the per-step transforms to a queue. `QueueCreatorArguments` and `QueueCreatorValidity` cover the validation surface so misconfigured pipelines fail loudly at construction rather than mid-stream.
