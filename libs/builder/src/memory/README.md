# memory

Opt-in memory monitor and the always-on `recover()` event-loop yield.

`createMemoryMonitor(options?)` instruments long-running build phases with snapshot history, threshold-based warnings (high heap, critical heap, step-over-step growth), and a summary line covering peak heap, peak RSS, snapshot count, and elapsed wall-clock time. The companion `recover()` utility yields control to the event loop and triggers a manual GC cycle when the host process is started with `--expose-gc`; call it between memory-heavy phases to drain pending I/O microtasks and reclaim transient allocations before the next phase begins.
