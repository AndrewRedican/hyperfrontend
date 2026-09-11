/** How a segment of the field is coloured. */
export type ByteTone = 'plain' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'

/**
 * One labelled run of bytes.
 *
 * A segment is the unit a byte layout is actually understood in: nobody reads
 * a fifty-eight byte buffer, they read a salt, an IV, a ciphertext and a tag.
 * The cells fill left to right so the reader watches the buffer being built
 * rather than being shown it finished.
 */
export interface ByteSegment {
  /** What this run is, set under it with a bracket. */
  label: string
  /** How many bytes it occupies. */
  count: number
  /** When it starts filling, measured from the start of the scene. */
  atMs: number
  /** How long it takes to fill; omitted, it appears whole. */
  fillMs?: number
  /** How the cells are coloured. */
  tone?: ByteTone
  /** A short note under the label, such as where the bytes came from. */
  note?: string
}

/** One line under the field, arriving at a stated moment. */
export interface ByteAnnotation {
  /** When it arrives. */
  atMs: number
  /** What it says. */
  text: string
  /** How it is coloured. */
  tone?: ByteTone
  /** When it leaves again; omitted, it stays. */
  untilMs?: number
}

/**
 * A byte stage's look, as a set of colours.
 *
 * The same shape of idea as the other stages' themes: the treatment is data,
 * so one implementation carries several looks.
 */
export interface ByteTheme {
  /** Name a scene selects this theme by. */
  id: string
  /** The surface the frame sits on. */
  backdrop: string
  /** A cell that has not been written yet. */
  empty: string
  /** The bracket drawn under a segment. */
  bracket: string
  /** Colour of a segment's label. */
  label: string
  /** Colour of the line under a label. */
  note: string
  /** Colour of the input the field was built from. */
  source: string
  /** Colour each tone fills its cells with. */
  tones: Readonly<Record<ByteTone, string>>
}

/** A theme as a scene states it: a built-in name, or one written out in full. */
export type ByteThemeRef = string | ByteTheme

/** Everything a scene tells the byte stage. */
export interface ByteConfig {
  /** The visual treatment, defaulting to the first built-in theme. */
  theme?: ByteThemeRef
  /** One line over the field, naming what the frame is about. */
  heading?: string
  /** The call or the value the field was built from, set above it. */
  source?: string
  /** The runs of bytes, left to right. */
  segments: readonly ByteSegment[]
  /** Lines under the field, each arriving at its own moment. */
  annotations?: readonly ByteAnnotation[]
  /** One line at the foot of the frame, arriving once the field is full. */
  caption?: string
  /** How long the frame holds after the last cell fills. */
  restMs?: number
}
