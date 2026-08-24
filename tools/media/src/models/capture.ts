/**
 * Pixel dimensions of the browser viewport a scene is recorded at.
 *
 * The recorded frame is this size before any encoder-side downscale, so it
 * also decides how much of a responsive layout is in shot.
 */
export interface Viewport {
  /** Viewport width in CSS pixels. */
  width: number
  /** Viewport height in CSS pixels. */
  height: number
}

/**
 * Fixed wall-clock instant installed into the page before its scripts run.
 *
 * Pages that branch on the hour or the date otherwise render differently
 * depending on when the recording happened.
 */
export interface ClockOverride {
  /** Instant to install, as an ISO 8601 string. */
  time: string
  /**
   * Whether the clock resumes ticking after installation.
   *
   * Leaving it paused freezes `Date.now()`, which stalls any animation whose
   * frame delta comes from the clock, and blocks screenshots on pages that
   * wait for web fonts. Resuming keeps the pinned date while letting time run.
   */
  resume: boolean
}

/**
 * Values written over `navigator` before any page script runs.
 *
 * Pages that size themselves to the reported device capability need these
 * pinned, or the same scene yields a different shape on every machine.
 */
export interface NavigatorOverride {
  /** Core count reported to the page. */
  hardwareConcurrency?: number
  /** Memory in gigabytes reported to the page. */
  deviceMemory?: number
  /** User agent string reported to the page. */
  userAgent?: string
}

/**
 * Everything that makes a page render the same way on every machine.
 *
 * A scene that omits this records whatever the host happened to report, which
 * is the difference between an asset that can be regenerated and one that
 * merely happens to exist.
 */
export interface Determinism {
  /** Clock pinning, applied before navigation. */
  clock?: ClockOverride
  /** Device capability pinning, applied before navigation. */
  navigator?: NavigatorOverride
}

/**
 * The condition that says a page is worth recording.
 *
 * Always a selector rather than a delay: a delay that is long enough on one
 * machine is short on another, and the failure is a silently empty recording.
 */
export interface ReadyGate {
  /** Selector that appears only once the page has finished settling. */
  selector: string
  /** How long to wait for it before failing the run. */
  timeoutMs?: number
}

/**
 * The slice of the session that ends up in the asset.
 *
 * Video capture starts when the browser context opens, so a page with a long
 * boot always has that boot in the recorded file. Both values are measured
 * from the moment the readiness gate passes, and the encoder trims to them.
 */
export interface RecordWindow {
  /** Quiet period between the readiness gate passing and the first kept frame. */
  settleMs: number
  /** Length of the animation that reaches the asset. */
  durationMs: number
}

/**
 * A server the recorder starts and stops around one scene.
 *
 * Both `build` and `command` are argument vectors rather than shell strings so
 * that no argument needs quoting and nothing is interpreted by a shell. Two
 * placeholders are substituted into `command` at run time: `{root}` becomes the
 * absolute served directory and `{port}` becomes a port allocated for this run.
 */
export interface ServeSpec {
  /** Command run once before the server starts, typically a build. */
  build?: readonly string[]
  /** Working directory for both commands, relative to the configured root. */
  cwd?: string
  /** Command that starts the server. */
  command: readonly string[]
  /** Directory the server serves, relative to the configured root. */
  root?: string
  /** Path polled until the server answers. */
  readyPath?: string
  /** How long to wait for the server to answer before failing the run. */
  readyTimeoutMs?: number
  /** Extra environment variables for both commands. */
  env?: Record<string, string>
}
