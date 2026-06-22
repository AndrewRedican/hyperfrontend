/**
 * Serializable inject-worker job descriptor: the contract between
 * {@link dispatchInjectWorker} and the forked child. Every field must round-trip
 * through `JSON.stringify` / `JSON.parse` — no functions, no class instances.
 */
export interface InjectWorkerJob {
  /** Absolute path to the Node host binary the worker clones as the injection target. */
  hostBinary: string
  /** Absolute path the cloned + injected binary lands at. */
  outputBinary: string
  /** Absolute path to the SEA preparation blob produced by `node --experimental-sea-config`. */
  blobPath: string
  /** SEA resource name for the embedded blob (always `NODE_SEA_BLOB` at runtime). */
  resourceName: string
  /** Mach-O segment name used by macOS injection (always `NODE_SEA` at runtime). */
  machoSegmentName: string
  /** Sentinel fuse string postject scans for in the host binary. Constructed in-parent to avoid collision. */
  sentinelFuse: string
  /** Absolute path the worker writes its JSON report to. */
  reportPath: string
}

/**
 * Memory + size summary written to `reportPath` when the worker exits cleanly.
 *
 * Captured from the worker process — the parent never observes the ~138 MB
 * postject buffer because the entire load lives and dies in the child.
 */
export interface InjectWorkerReport {
  /** On-disk size of `outputBinary` after injection, in bytes. */
  outputSize: number
  /** Worker `process.memoryUsage().heapUsed` in MB at end of inject. */
  endHeapMB: number
  /** Worker `process.memoryUsage().rss` in MB at end of inject. */
  endRssMB: number
  /** Worker wall-clock duration in ms. */
  durationMs: number
}
