import type { MediaProfile } from './profile'
import type { MediaTheme } from './theme'

/**
 * One chapter of a sequence, with its stage and configuration already bound.
 *
 * Bound here for the same reason a scene binds them: the relationship between
 * a stage and its configuration is checked where the two are named, and what
 * travels on is three closures that need only a profile, a theme and a moment.
 */
export interface SequenceSegment {
  /** A few words naming the capability this chapter shows, set on the rail. */
  label: string
  /**
   * The stylesheet the chapter's markup is drawn with.
   *
   * @param profile - The presentation target the chapter is composed for.
   * @param theme - The visual tokens this variant is drawn with.
   * @returns CSS, scoped to this chapter by the sequence stage.
   */
  styles: (profile: MediaProfile, theme: MediaTheme) => string
  /**
   * How long the chapter's own timeline runs.
   *
   * @param profile - The presentation target the chapter is composed for.
   * @returns Length of the timeline in milliseconds.
   */
  durationMs: (profile: MediaProfile) => number
  /**
   * The chapter's markup for one instant of its own timeline.
   *
   * @param profile - The presentation target the chapter is composed for.
   * @param theme - The visual tokens this variant is drawn with.
   * @param atMs - Offset from the start of the chapter.
   * @returns HTML placed inside the chapter's element.
   */
  frame: (profile: MediaProfile, theme: MediaTheme, atMs: number) => string
  /** Time held on the chapter's last frame before the next one arrives. */
  holdMs?: number
}

/** Everything a scene tells the sequence stage. */
export interface SequenceConfig {
  /** The chapters, in order. Two or three is the intended count. */
  segments: readonly SequenceSegment[]
  /** How long the move from one chapter to the next takes. */
  transitionMs?: number
  /** Whether the rail naming each chapter is drawn along the top. */
  rail?: boolean
}

/** Where one chapter sits on the whole timeline. */
export interface SequencePlacement {
  /** The chapter. */
  segment: SequenceSegment
  /** When the chapter's own timeline starts. */
  startMs: number
  /** How long the chapter's own timeline runs. */
  durationMs: number
  /** When the chapter stops being shown on its own, hold included. */
  endMs: number
}

/**
 * One chapter as it is drawn at one instant.
 *
 * Between chapters two of these exist at once: the one leaving, displaced and
 * fading, and the one arriving from the other side.
 */
export interface ChapterFrame {
  /** The chapter's position in the sequence, which names its scope. */
  index: number
  /** The chapter being drawn. */
  segment: SequenceSegment
  /** Offset from the start of the chapter's own timeline, clamped to its duration. */
  localMs: number
  /** How far across the frame the chapter is displaced, as a fraction of its width. */
  shift: number
  /** How visible the chapter is, from 0 to 1. */
  opacity: number
}

/** Where the rail stands at one instant. */
export interface RailPosition {
  /** Index of the chapter the rail points at. */
  current: number
  /** How far through that chapter the sequence is, from 0 to 1. */
  progress: number
}
