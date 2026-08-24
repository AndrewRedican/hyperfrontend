import type { Page } from 'playwright-core'
import type { Determinism, ReadyGate, RecordWindow, ServeSpec, Viewport } from './capture'
import type { GifOptions, StillFormat } from './encode'

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
  /** Container and codec to write. */
  format?: StillFormat
  /** Quality from 1 to 100. Ignored for PNG. */
  quality?: number
  /** Output width in pixels, or omitted to keep the captured size. */
  width?: number
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
 * A browser scene as authored.
 *
 * Optional fields fall back to the workspace defaults, so a scene file states
 * only what makes it different from every other scene.
 */
export interface BrowserSceneInput {
  /** Directory name the scene's assets are written under. */
  slug: string
  /** Filename stem the scene's assets are written under. */
  asset?: string
  /** Artefacts this scene emits. */
  outputs: readonly SceneOutput[]
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
  /** Encoding parameters that differ from the workspace defaults. */
  gif?: Partial<GifOptions>
  /** Stills to capture inside the record window. */
  stills?: readonly StillSpec[]
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

/** A scene file paired with the path it was loaded from. */
export interface LoadedScene {
  /** Absolute path of the file the scene was loaded from. */
  filePath: string
  /** The scene the file exported. */
  scene: BrowserScene
}
