/**
 * A presentation target a scene is composed for.
 *
 * Media that has to work in more than one place is usually made once at the
 * largest size and scaled down for the rest, and the result is a capture whose
 * text is unreadable everywhere except where it was authored. A profile is the
 * other approach: it is handed to the scene before anything is drawn, so a
 * stage sizes its type, chooses how much to show and picks its density for the
 * surface the asset is actually going to be embedded in.
 *
 * The dimensions are CSS pixels the stage lays out against. What reaches the
 * file is {@link scale} times larger, and the animated output is resampled back
 * down to {@link width} by exactly that factor, which is the one resize that
 * costs a text-heavy frame nothing.
 */
export interface MediaProfile {
  /** Name a scene selects this profile by. */
  id: string
  /** Where an asset made at this size is meant to be embedded. */
  intent: string
  /** Layout width in CSS pixels. */
  width: number
  /** Layout height in CSS pixels. */
  height: number
  /** Device pixel ratio the session renders at. */
  scale: number
  /** Frames per second the animated output runs at. */
  fps: number
}

/**
 * Profiles built into the recorder.
 *
 * A scene may name one of these or hand over a {@link MediaProfile} of its own,
 * so a workspace with an embedding constraint that is genuinely its own is not
 * blocked on this list growing.
 */
export type ProfileId = 'compact' | 'docs-wide'

/** A profile as a scene states it: a built-in name, or one written out in full. */
export type ProfileRef = ProfileId | MediaProfile
