import type { Page } from 'playwright-core'
import type { Determinism, ReadyGate, RecordWindow, ServeSpec, Viewport } from './capture'
import type { GifOptions, StillFormat } from './encode'
import type { MediaProfile, ProfileRef } from './profile'
import type { Stage } from './stage'
import type { MediaTheme, ThemeId, ThemeOverrides } from './theme'

/** Kinds of artefact a scene can emit. */
export type SceneOutput = 'gif' | 'still'

/**
 * Interaction driven against a ready page while it is being recorded.
 *
 * Runs after the readiness gate passes and before the record window closes,
 * so anything it does is in shot.
 *
 * @param page - The page under recording.
 * @returns A promise that settles when the interaction is finished.
 */
export type Choreography = (page: Page) => Promise<void>

/**
 * Which document a scene opens.
 *
 * A scene with a `serve` block gives a `path` against the server the recorder
 * started; a scene against something already running gives an absolute `url`.
 */
export interface PageSpec {
  /** Path appended to the origin of the server this scene starts. */
  path?: string
  /** Absolute URL, for a scene that starts no server of its own. */
  url?: string
}

/**
 * One still image captured at a point inside the record window.
 *
 * Offsets are measured from the first kept frame, so a still and the GIF
 * frame at the same offset show the same moment.
 */
export interface StillSpec {
  /** Filename stem the image is written under. */
  name: string
  /** Offset from the first kept frame at which to capture. */
  atMs: number
  /** Element to capture instead of the viewport. */
  selector?: string
  /** Whether to capture the full scrollable page rather than the viewport. */
  fullPage?: boolean
  /**
   * Whether to keep the page's own transparency instead of compositing it onto
   * white.
   *
   * A page that paints no background of its own is transparent by design, and
   * the browser's default white is not part of what it renders. Capturing that
   * white bakes a colour into the image that the page never drew, which shows
   * the moment the still is laid over anything but white. Only `png` and
   * `webp` carry the alpha through; `jpeg` discards it.
   */
  omitBackground?: boolean
  /** Container and codec to write. */
  format?: StillFormat
  /** Quality from 1 to 100. Ignored for PNG. */
  quality?: number
  /** Output width in pixels, or omitted to keep the captured size. */
  width?: number
  /** Size ceiling for the written file, or omitted to leave it unbudgeted. */
  maxBytes?: number
}

/** How many elements a selector is expected to match once the page is ready. */
export interface SelectorCount {
  /** Selector to count. */
  selector: string
  /** How many matches the page must have. */
  count: number
}

/**
 * Conditions that must hold before a recording is allowed to become an asset.
 *
 * A page can reach its readiness gate and still be visibly wrong, most often
 * when something failed to load and the layout closed over the gap. Checking
 * afterwards is what stops a broken frame from being committed.
 */
export interface SceneAssertions {
  /** Console errors tolerated before the run fails. */
  maxConsoleErrors?: number
  /** Element counts the ready page must satisfy. */
  expect?: readonly SelectorCount[]
}

/**
 * What every scene declares, whichever lane runs it.
 *
 * These are the fields the parts of the pipeline outside a lane read: where an
 * asset is written, what it is called, what it is worth budgeting, and what
 * `check` should look for once it exists.
 */
export interface SceneCommon {
  /** Directory name the scene's assets are written under. */
  slug: string
  /** Filename stem the scene's assets are written under. */
  asset?: string
  /**
   * Artefacts this scene emits.
   *
   * A scene that does not list `gif` records nothing and encodes nothing: it
   * reaches the moment it is meant to show, writes its {@link stills} and
   * stops. A scene that does not list `still` may still declare stills; the
   * list says what the scene is *for*, and the GIF is what the budget and the
   * freshness check are applied to.
   */
  outputs: readonly SceneOutput[]
  /** Encoding parameters that differ from the workspace defaults. */
  gif?: Partial<GifOptions>
  /** Stills to capture from the scene. */
  stills?: readonly StillSpec[]
}

/**
 * A browser scene as authored.
 *
 * Optional fields fall back to the workspace defaults, so a scene file states
 * only what makes it different from every other scene.
 */
export interface BrowserSceneInput extends SceneCommon {
  /** Viewport the session is recorded at. */
  viewport: Viewport
  /** Server to start and stop around this scene. */
  serve?: ServeSpec
  /** Document to open. */
  page?: PageSpec
  /** Overrides that make the page render identically on every machine. */
  determinism?: Determinism
  /** Condition that says the page is worth recording. */
  ready: ReadyGate
  /** The slice of the session that reaches the asset. */
  record: RecordWindow
  /** Conditions the ready page must satisfy before it is encoded. */
  assert?: SceneAssertions
  /** Interaction driven against the ready page. */
  choreograph?: Choreography
}

/**
 * A browser scene after `defineBrowserScene` has stamped it.
 *
 * The discriminant is added by the constructor rather than written by hand so
 * a scene file cannot claim to be something the pipeline will not run.
 */
export interface BrowserScene extends BrowserSceneInput {
  /** Discriminant identifying the lane that runs this scene. */
  kind: 'browser'
}

/**
 * A scripted scene as authored.
 *
 * Where a browser scene points at something already built and records whatever
 * it does, a scripted scene *is* the thing being recorded: a stage draws it,
 * and the recorder walks a timeline rather than watching a clock. Nothing here
 * describes a server, a URL or a readiness gate, because there is no separate
 * application to wait for.
 */
export interface ScriptedSceneInput<TConfig> extends SceneCommon {
  /** The presentation target the scene is composed for. */
  profile: ProfileRef
  /** The stage that draws it. */
  stage: Stage<TConfig>
  /** What this scene configures that stage with. */
  config: TConfig
  /**
   * The variants this scene is rendered in.
   *
   * Every variant the workspace configures, when omitted. A scene names a
   * subset only when one of the looks genuinely cannot carry it, which should
   * be rare: the point of a theme is that the same composition reads in all
   * of them.
   */
  themes?: readonly ThemeId[]
  /**
   * The hue the ground behind this scene is tinted with, in degrees.
   *
   * The documentation site tints each package's pages with a hue of that
   * package's own; a scene handed the same number takes the same tint, so an
   * asset reads as belonging to the page it is embedded in.
   */
  hue?: number
  /** Tokens this scene changes, for every variant or for one. */
  themeOverrides?: ThemeOverrides
  /** Frames per second, when this scene wants a rate other than its profile's. */
  fps?: number
  /**
   * Time held on the closing frame before the animation loops.
   *
   * A looping GIF with no hold snaps from its last moment back to its first,
   * which reads as a glitch rather than a repeat. A beat of stillness at the
   * end is what turns the loop into a rest.
   */
  holdMs?: number
}

/**
 * A scripted scene after `defineScriptedScene` has stamped it.
 *
 * The stage and its configuration arrive here already bound together. Their
 * relationship is checked where the scene is written, which is the only place
 * that knows what the configuration is meant to be; carrying the type any
 * further would put a type parameter through every part of the pipeline in
 * exchange for nothing it could use.
 */
export interface ScriptedScene extends SceneCommon {
  /** Discriminant identifying the lane that runs this scene. */
  kind: 'scripted'
  /** The presentation target the scene is composed for. */
  profile: ProfileRef
  /** Name of the stage that draws it, recorded in the audit record. */
  stageId: string
  /** The variants this scene is rendered in, or undefined for every configured one. */
  themes?: readonly ThemeId[]
  /** The hue the ground is tinted with, or undefined for the theme's own. */
  hue?: number
  /** Tokens this scene changes, for every variant or for one. */
  themeOverrides?: ThemeOverrides
  /** Frames per second, when this scene wants a rate other than its profile's. */
  fps?: number
  /** Time held on the closing frame before the animation loops. */
  holdMs?: number
  /**
   * The stage's stylesheet, with this scene's configuration already bound.
   *
   * @param profile - The presentation target being composed for.
   * @param theme - The visual tokens this variant is drawn with.
   * @returns CSS, inlined into the page.
   */
  styles: (profile: MediaProfile, theme: MediaTheme) => string
  /**
   * How long the timeline runs, with this scene's configuration already bound.
   *
   * @param profile - The presentation target being composed for.
   * @returns Length of the timeline in milliseconds, before any hold.
   */
  durationMs: (profile: MediaProfile) => number
  /**
   * Markup for one instant, with this scene's configuration already bound.
   *
   * @param profile - The presentation target being composed for.
   * @param theme - The visual tokens this variant is drawn with.
   * @param atMs - Offset from the start of the timeline.
   * @returns HTML placed inside the stage element.
   */
  frame: (profile: MediaProfile, theme: MediaTheme, atMs: number) => string
}

/** Any scene the recorder knows how to run. */
export type MediaScene = BrowserScene | ScriptedScene

/** A scene file paired with the path it was loaded from. */
export interface LoadedScene {
  /** Absolute path of the file the scene was loaded from. */
  filePath: string
  /** The scene the file exported. */
  scene: MediaScene
}
