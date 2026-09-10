import type { MediaProfile } from './profile'

/**
 * One instant on a stage's timeline.
 *
 * A stage is asked for a moment rather than told that time has passed, so
 * nothing it draws can depend on how long the recorder took to get there. That
 * is the whole of the determinism contract: the same instant asked for twice
 * produces the same markup, on any machine, at any speed.
 */
export interface StageInstant<TConfig> {
  /** What the scene configured this stage with. */
  config: TConfig
  /** The presentation target the scene is being composed for. */
  profile: MediaProfile
  /** Offset from the start of the timeline. */
  atMs: number
}

/**
 * A self-contained visual experience the recorder can play and capture.
 *
 * A stage owns its own look completely: it returns a stylesheet once and then
 * markup for each instant asked of it, and the harness does nothing with either
 * but mount them. So a stage is free to be as bespoke as it needs to be without
 * the harness growing a concept for whatever it happens to draw.
 *
 * What a stage must not do is animate itself. CSS animations, transitions and
 * page timers all measure real time, and real time is exactly what a recording
 * cannot reproduce: the same scene would land differently depending on how
 * quickly the machine got through it. Motion belongs in {@link frame} as a
 * function of {@link StageInstant.atMs}, which costs a stage very little and
 * buys an asset that can be regenerated rather than merely remade.
 */
export interface Stage<TConfig> {
  /** Name this stage is registered and reported under. */
  id: string
  /**
   * The stylesheet the stage's markup is drawn with.
   *
   * Mounted once, before the first frame, so a rule here is free to be as
   * expensive as it likes. Selectors should be scoped to the stage's own class
   * names; the harness owns the document around it.
   *
   * @param config - What the scene configured this stage with.
   * @param profile - The presentation target being composed for.
   * @returns CSS, inlined into the page.
   */
  styles: (config: TConfig, profile: MediaProfile) => string
  /**
   * How long this stage's timeline runs for.
   *
   * Derived from the configuration rather than declared beside it, so a scene
   * that adds a line to a script does not also have to work out what that did
   * to the running time.
   *
   * @param config - What the scene configured this stage with.
   * @param profile - The presentation target being composed for.
   * @returns Length of the timeline in milliseconds.
   */
  durationMs: (config: TConfig, profile: MediaProfile) => number
  /**
   * The markup for one instant.
   *
   * @param instant - The configuration, the profile, and the moment wanted.
   * @returns HTML placed inside the stage element.
   */
  frame: (instant: StageInstant<TConfig>) => string
}

/**
 * A stage paired with the configuration a scene handed it.
 *
 * The two travel together because the configuration's type is the stage's own,
 * and separating them loses the relationship that makes a scene file typecheck.
 */
export interface StagedContent<TConfig> {
  /** The stage that draws this scene. */
  stage: Stage<TConfig>
  /** What this scene configured it with. */
  config: TConfig
}
