import type { Determinism, RecordWindow, Viewport } from './capture'
import type { EncoderName, GifOptions, ToolVersion } from './encode'

/** Identity of the browser build that produced a recording. */
export interface BrowserRecord {
  /** Browser family that was launched. */
  name: string
  /** Version string the browser reported. */
  version: string
  /** Executable that was launched. */
  executablePath: string
}

/** One line the page printed, kept verbatim for a person to read. */
export interface ConsoleMessageRecord {
  /** Level the page logged at, or `pageerror` for an uncaught throw. */
  type: string
  /** The message as the page wrote it. */
  text: string
}

/** What the page said for itself while it was being recorded. */
export interface ConsoleRecord {
  /** Console messages at error level. */
  errors: number
  /** Console messages at warning level. */
  warnings: number
  /** Uncaught page errors. */
  pageErrors: number
}

/**
 * The audit record written beside every asset.
 *
 * Identical scenes produce different bytes on every run, so an asset cannot be
 * verified by regenerating it and diffing. This record is what makes it
 * checkable instead: it says which scene produced the file, at what settings,
 * with which encoder, and how large the result was allowed to be.
 */
export interface AssetSidecar {
  /** Directory name the asset was written under. */
  slug: string
  /** Filename of the asset this record describes. */
  asset: string
  /** When the asset was produced, as an ISO 8601 string. */
  generatedAt: string
  /** Digest of the scene file, so a stale asset can be detected. */
  sceneHash: string
  /** Document that was recorded. */
  sourceUrl: string
  /** Viewport the session was recorded at. */
  viewport: Viewport
  /** The slice of the session that reached the asset. */
  record: RecordWindow
  /** Offset into the recording where the kept animation started. */
  startMs: number
  /** Encoding parameters that were applied. */
  gif: GifOptions
  /** Backend that produced the file. */
  encoder: EncoderName
  /** Versions of every binary the encode invoked. */
  toolVersions: readonly ToolVersion[]
  /** Size of the written file. */
  bytes: number
  /** Number of frames the animation contains. */
  frames: number
  /** Browser build that produced the recording. */
  browser: BrowserRecord
  /** Overrides that were applied before the page ran. */
  determinism: Determinism
  /** What the page reported while it was being recorded. */
  console: ConsoleRecord
}

/** One finished scene, as reported in the run summary. */
export interface RunSummaryRow {
  /** Directory name the scene's assets were written under. */
  slug: string
  /** Filename of the asset. */
  asset: string
  /** Size of the written file. */
  bytes: number
  /** Size ceiling the scene declared. */
  maxBytes: number
  /** Number of frames the animation contains. */
  frames: number
  /** Backend that produced the file. */
  encoder: EncoderName
  /** Wall time the whole scene took. */
  elapsedMs: number
}

/** One reason a committed asset failed verification. */
export interface CheckIssue {
  /** Directory name of the scene the asset belongs to. */
  slug: string
  /** What is wrong, phrased as the action that fixes it. */
  reason: string
}

/** The outcome of verifying every committed asset against its scene. */
export interface CheckOutcome {
  /** How many scenes were examined. */
  checked: number
  /** Every problem found, empty when the assets are current. */
  issues: readonly CheckIssue[]
}
