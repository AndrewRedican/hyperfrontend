# queue

FIFO processing queues for the seal and open pipeline stages that connect senders, receivers, and channels.

`createQueue` wraps a `MessageHandler` callback into a typed `Queue<T>` that processes messages strictly one at a time in arrival order, with `stop`, `resume`, `size`, `isRunning`, and `currentMessage`. `createSealQueue` and `createOpenQueue` (the `SealQueueCreater` and `OpenQueueCreater` shapes) bind a session's `PacketSealer` or `PacketOpener` to a queue: plaintext packets in and sealed frames out, or frames in and plaintext packets out. Each rejected input is reported through a `QueueFailureHandler` with the reason and the thrown error, and the queue moves on. `QueueCreatorArguments` and `QueueCreatorValidity` cover the argument validation, so a misconfigured stage fails at construction rather than mid-stream.
