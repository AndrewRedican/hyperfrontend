/**
 * GIF encoder backends the recorder can drive.
 *
 * `ffmpeg` produces markedly smaller files on full-frame motion; `sharp`
 * needs no system binaries at all. Both are always present in the build.
 */
export type EncoderName = 'ffmpeg' | 'sharp'

/**
 * Which backend a run prefers.
 *
 * `auto` picks ffmpeg when both of its binaries answer and falls back to
 * sharp otherwise, so a machine without them still produces an asset.
 */
export type EncoderPreference = 'auto' | EncoderName

/** Still image formats the recorder can write. */
export type StillFormat = 'png' | 'webp' | 'jpeg'

/**
 * Commands the ffmpeg backend invokes.
 *
 * Bare names resolve through `PATH`; absolute paths pin a specific build.
 */
export interface EncoderBinaries {
  /** Command used to invoke ffmpeg. */
  ffmpeg: string
  /** Command used to invoke gifsicle. */
  gifsicle: string
}

/**
 * How one scene's GIF is encoded.
 *
 * Every field trades size against fidelity, and the scene rather than the
 * encoder owns that trade because the content decides which knob is cheap.
 */
export interface GifOptions {
  /** Output width in pixels. Height follows the source aspect ratio. */
  width: number
  /** Frames kept per second of source. */
  fps: number
  /** Size of the colour palette, from 2 to 256. */
  colours: number
  /**
   * Lossy compression strength passed to gifsicle, from 0 to 200.
   *
   * Ignored by the sharp backend, which has no equivalent knob.
   */
  lossy: number
  /** Whether to dither when quantising to the palette. */
  dither: boolean
  /** Repeat count, where 0 repeats forever. */
  loop: number
  /** Size ceiling. A finished encode above it fails the run instead of landing. */
  maxBytes: number
}

/**
 * How one still image is encoded.
 *
 * PNG keeps every pixel and is the right default for reading a render back;
 * webp is roughly an order of magnitude smaller for the same frame.
 */
export interface StillOptions {
  /** Container and codec to write. */
  format: StillFormat
  /** Quality from 1 to 100. Ignored for PNG. */
  quality: number
  /** Output width in pixels, or 0 to keep the captured size. */
  width: number
}

/**
 * A binary the encode depended on, recorded so an asset can be explained.
 */
export interface ToolVersion {
  /** Command that was invoked. */
  name: string
  /** Version string the command reported. */
  version: string
}

/**
 * One unit of work handed to a GIF backend.
 *
 * The backend owns everything between a recorded video and a finished file,
 * including frame extraction, so that the two backends can disagree about how
 * to get there without the pipeline knowing.
 */
export interface GifEncodeRequest {
  /** Absolute path of the recorded video. */
  sourcePath: string
  /** Absolute path the finished GIF is written to. */
  outputPath: string
  /** Absolute path of a scratch directory the backend may fill and leave behind. */
  scratchDir: string
  /** Offset into the source where the emitted animation starts. */
  startMs: number
  /** Length of the emitted animation. */
  durationMs: number
  /** Encoding parameters for this scene. */
  gif: GifOptions
}

/** What a backend reports about a finished GIF. */
export interface GifEncodeOutcome {
  /** Size of the written file. */
  bytes: number
  /** Number of frames the animation contains. */
  frames: number
  /** Backend that produced it. */
  encoder: EncoderName
  /** Versions of every binary the encode invoked. */
  toolVersions: readonly ToolVersion[]
}

/**
 * A GIF encoder implementation.
 *
 * Keeping this an interface rather than a branch is what lets a workspace add
 * a backend without the pipeline growing a case for it.
 */
export interface GifBackend {
  /** Name reported in logs and in the audit sidecar. */
  name: EncoderName
  /**
   * Report whether this backend can run here.
   *
   * @param binaries - Commands the backend would invoke.
   * @returns True when every prerequisite answers.
   */
  isAvailable(binaries: EncoderBinaries): boolean
  /**
   * Turn a recorded video into a finished GIF.
   *
   * @param request - Source, destination and encoding parameters.
   * @param binaries - Commands the backend may invoke.
   * @returns What the finished file contains.
   */
  encode(request: GifEncodeRequest, binaries: EncoderBinaries): Promise<GifEncodeOutcome>
}
