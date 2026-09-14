import type { Mark } from './banner'

/**
 * The five levels the scale shows, named as the logger names them.
 *
 * Listed from the level that always prints to the level that prints last, which
 * is the order the scale lays them out in and the order the lines sit in.
 */
export type LevelName = 'error' | 'warn' | 'log' | 'info' | 'debug'

/** One line the program logs, at one level. */
export interface LevelLine {
  /** The level the line is logged at. */
  level: LevelName
  /** The channel tag the logger prepends, such as `[release]` or `[release:npm]`. */
  prefix: string
  /** What the program logged after the tag. */
  message: string
}

/** One turn of the knob. */
export interface LevelMove {
  /** The level the knob slides to. */
  to: LevelName
  /** When the knob sets off. */
  atMs: number
  /** How long the slide takes. */
  durationMs: number
}

/** The package API the knob stands for. */
export interface LevelsApi {
  /** The setter's name, as a reader would call it on the logger. */
  name: string
  /** The package's mark, drawn beside the name. */
  mark: Mark
}

/** Everything a scene tells the levels stage. */
export interface LevelsConfig {
  /** Title in the window's bar. */
  title: string
  /** The call the knob stands for. */
  api: LevelsApi
  /** The level the knob rests on before the first move. */
  start: LevelName
  /** One line per level; a level with no line leaves its row empty. */
  lines: readonly LevelLine[]
  /** The turns of the knob, in order. */
  moves: readonly LevelMove[]
  /** How long the frame rests after the knob's last landing. */
  restMs: number
}
