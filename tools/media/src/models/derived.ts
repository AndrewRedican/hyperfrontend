import type { Mark } from './banner'

/**
 * A base flag paired with a boolean.
 *
 * The same shape serves both sides of the store: what a selector expects a
 * flag to be, and what an action writes to it.
 */
export interface FlagValue {
  /** The flag's name, as the store keys it. */
  flag: string
  /** The boolean expected of the flag, or written to it. */
  value: boolean
}

/** Which of the theme's tones a lamp lights in. */
export type LampTone = 'accent' | 'success' | 'danger' | 'warning'

/** One base flag of the store, drawn as a lamp. */
export interface DerivedLamp {
  /** The flag's name, as the store keys it and the selectors read it. */
  flag: string
  /** The tone the lamp lights in. */
  tone: LampTone
}

/**
 * One derived name: a selector over the base flags.
 *
 * The name holds when every flag in `all` has its stated value and, when
 * `any` is given, at least one flag in `any` has its stated value too. Every
 * flag named in either list is a flag the selector reads, and gets a wire
 * from that flag's lamp.
 */
export interface DerivedName {
  /** The selector's name, as the package exports it. */
  name: string
  /** Flags that must all hold their stated value. */
  all: readonly FlagValue[]
  /** Flags of which at least one must hold its stated value; omitted when `all` is the whole condition. */
  any?: readonly FlagValue[]
}

/** One action dispatched to the store. */
export interface DerivedAction {
  /** The action creator, as it is drawn on the chip. */
  name: string
  /** What the reducer writes to the flags; a flag not named keeps whatever it held. */
  writes: readonly FlagValue[]
  /** When the chip fires and the token sets off. */
  atMs: number
}

/** Everything a scene tells the derived stage. */
export interface DerivedConfig {
  /** The package's mark, drawn on the action chips and on the header of the names column. */
  mark: Mark
  /** The package function that derives every name at once, drawn as the header of the names column. */
  api: string
  /** The word to the left of the action rail. */
  railLabel: string
  /** The base flags, top to bottom; every one starts unlit. */
  lamps: readonly DerivedLamp[]
  /** The derived names, top to bottom. */
  names: readonly DerivedName[]
  /** The actions, in dispatch order. */
  actions: readonly DerivedAction[]
  /** How long the frame holds after the last name has lit. */
  restMs?: number
}
