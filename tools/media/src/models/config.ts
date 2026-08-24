import type { EncoderBinaries, EncoderPreference, GifOptions, StillOptions } from './encode'

/** Chromium settings shared by every browser scene in a workspace. */
export interface BrowserConfig {
  /** Explicit browser executable, or an empty string to resolve one automatically. */
  executablePath: string
  /** Flags appended to every launch, after the ones the recorder always passes. */
  args: readonly string[]
  /** Fallback ceiling for a scene whose readiness gate names no timeout. */
  readyTimeoutMs: number
}

/** Chromium settings as authored, with every field optional. */
export interface BrowserConfigInput {
  /** Explicit browser executable, or an empty string to resolve one automatically. */
  executablePath?: string
  /** Flags appended to every launch, after the ones the recorder always passes. */
  args?: readonly string[]
  /** Fallback ceiling for a scene whose readiness gate names no timeout. */
  readyTimeoutMs?: number
}

/** Encoder selection for a workspace. */
export interface EncoderConfig {
  /** Backend to try first. */
  prefer: EncoderPreference
  /** Commands the ffmpeg backend invokes. */
  binaries: EncoderBinaries
}

/** Encoder selection as authored, with every field optional. */
export interface EncoderConfigInput {
  /** Backend to try first. */
  prefer?: EncoderPreference
  /** Commands the ffmpeg backend invokes. */
  binaries?: Partial<EncoderBinaries>
}

/** Encoding parameters every scene inherits unless it says otherwise. */
export interface MediaDefaults {
  /** GIF parameters a scene falls back to. */
  gif: GifOptions
  /** Still parameters a scene falls back to. */
  still: StillOptions
}

/** Encoding defaults as authored, with every field optional. */
export interface MediaDefaultsInput {
  /** GIF parameters a scene falls back to. */
  gif?: Partial<GifOptions>
  /** Still parameters a scene falls back to. */
  still?: Partial<StillOptions>
}

/**
 * A workspace's configuration file, as authored.
 *
 * Every path is relative to `rootDir`, and `rootDir` itself is relative to the
 * configuration file. One rule, applied everywhere, so a scene never has to
 * know where the configuration file happens to live.
 */
export interface MediaConfigInput {
  /** The directory every other path is resolved against, relative to this file. */
  rootDir: string
  /** Directory holding scene files. */
  sceneDir?: string
  /** Directory finished assets are written to. */
  outputDir?: string
  /** Directory intermediates are written to. */
  tmpDir?: string
  /** Public URL prefix that serves `outputDir`, used when reporting an asset. */
  publicBaseUrl?: string
  /** Encoder selection. */
  encoder?: EncoderConfigInput
  /** Chromium settings. */
  browser?: BrowserConfigInput
  /** Encoding parameters every scene inherits. */
  defaults?: MediaDefaultsInput
}

/** Absolute directories derived from the configuration file's own location. */
export interface ResolvedRoots {
  /** Directory the configuration file sits in. */
  configDir: string
  /** The directory every configured path was resolved against. */
  rootDir: string
  /** Absolute directory holding scene files. */
  sceneDir: string
  /** Absolute directory finished assets are written to. */
  outputDir: string
  /** Absolute directory intermediates are written to. */
  tmpDir: string
}

/** A workspace's configuration after defaults are applied and paths are absolute. */
export interface ResolvedMediaConfig {
  /** Absolute directories for this run. */
  roots: ResolvedRoots
  /** Public URL prefix that serves the output directory. */
  publicBaseUrl: string
  /** Encoder selection. */
  encoder: EncoderConfig
  /** Chromium settings. */
  browser: BrowserConfig
  /** Encoding parameters every scene inherits. */
  defaults: MediaDefaults
}
