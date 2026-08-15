/**
 * The Solid koi: the canvas the 3D fish renders into, and its identity card.
 *
 * The component itself is deliberately almost static. Its markup is the two
 * nodes the koi lives on — the canvas its body is drawn to, and the card a
 * visitor's hold reveals — and its `onMount` hands both to the renderer that
 * animates them. The reactive bindings are the card's visibility and its
 * inspector rows, because they change a handful of times a minute; everything
 * that moves per frame is written through the imperative stage, outside the
 * reactive graph, so this component's JSX re-evaluates nothing at sixty frames
 * a second.
 *
 * Nothing is painted on `body` or on the app root — the hostee SDK resets both
 * to transparent, and anything painted there would blank the pond behind this
 * frame for every koi below it. The canvas clears to transparent; only the
 * fish itself has colour.
 *
 * This is the one browser-facing part of the app. The other seven koi replace it
 * with their own framework's idiom, and share everything else.
 */
import type { KoiCardText, KoiProfile } from '@hyperfrontend/demo-koi-lib'
import type { Accessor, JSX } from 'solid-js'
import { FRAMEWORK_SITES, koiSourceUrl } from '@hyperfrontend/demo-koi-lib'
import { onCleanup, onMount } from 'solid-js'

/** The card's mounted nodes, handed to the imperative renderer as one piece. */
export interface KoiCardHandles {
  /** The card element the renderer parks and measures. */
  card: HTMLDivElement
  /** The app URL anchor, whose rectangle the outline reports. */
  app: HTMLAnchorElement
  /** The framework-site anchor, whose rectangle the outline reports. */
  site: HTMLAnchorElement
  /** The app-source anchor, whose rectangle the outline reports. */
  source: HTMLAnchorElement
}

/** Everything the koi component draws from. */
export interface KoiFishProps {
  /** Everything about this koi that never changes. */
  profile: KoiProfile
  /** The URL of the app rendering it, shown on the card. */
  url: string
  /** Whether a visitor is holding this koi, which is what shows its identity card. */
  selected: Accessor<boolean>
  /** The card's inspector rows, rewritten from the live facts while the koi is held. */
  rows: Accessor<KoiCardText | null>
  /**
   * Hands the mounted nodes to the imperative renderer.
   *
   * @param canvas - The canvas the koi's body renders into.
   * @param handles - The identity card's nodes the renderer parks and measures.
   * @returns The teardown that releases whatever the renderer built on them.
   */
  mount(canvas: HTMLCanvasElement, handles: KoiCardHandles): () => void
}

/**
 * One koi's canvas and identity card.
 *
 * @param props - The {@link KoiFishProps}.
 * @returns The canvas the 3D koi renders into and, hidden until a visitor holds the fish, its identity card.
 */
export function KoiFish(props: KoiFishProps): JSX.Element {
  let canvas: HTMLCanvasElement | undefined
  let card: HTMLDivElement | undefined
  let app: HTMLAnchorElement | undefined
  let site: HTMLAnchorElement | undefined
  let source: HTMLAnchorElement | undefined

  onMount(() => {
    if (canvas === undefined || card === undefined || app === undefined || site === undefined || source === undefined) {
      return
    }
    // why: The GPU scene needs a real canvas node, so it is built here — after Solid has created one — and torn down by whatever cleanup the renderer hands back.
    onCleanup(props.mount(canvas, { card, app, site, source }))
  })

  return (
    <>
      <canvas
        class="koi-canvas"
        aria-hidden="true"
        ref={(node) => {
          canvas = node
        }}
      />
      <div
        class="koi-card"
        hidden={!props.selected()}
        ref={(node) => {
          card = node
        }}
      >
        <span class="koi-card-name">
          <span class="koi-card-title" style={{ color: props.profile.palette.accent }}>
            {props.profile.label}
          </span>
          {/* why: The variety rides beside the framework name — the pattern is the koi's own identity, and it costs one word to say this asagi is the React app. */}
          <span class="koi-card-variety">{props.profile.palette.pattern}</span>
        </span>
        <span class="koi-card-line koi-card-state">{props.rows()?.state}</span>
        {/* why: The links are real anchors for semantics and styling, but this frame never receives the pointer — the host reads their rectangles off the outline report and floats the anchors that actually open them. */}
        <a
          class="koi-card-url"
          href={props.url}
          target="_blank"
          rel="noopener noreferrer"
          ref={(node) => {
            app = node
          }}
        >
          {props.url}
        </a>
        <span class="koi-card-line koi-card-runtime">{props.rows()?.runtime}</span>
        <span class="koi-card-line koi-card-memory">{props.rows()?.memory}</span>
        <span class="koi-card-line koi-card-event" hidden={(props.rows()?.event ?? null) === null}>
          {props.rows()?.event}
        </span>
        <a
          class="koi-card-site"
          href={FRAMEWORK_SITES[props.profile.framework]}
          target="_blank"
          rel="noopener noreferrer"
          ref={(node) => {
            site = node
          }}
        >
          {props.profile.label} website ↗
        </a>
        {/* why: The demo's claim is checkable — the card links straight to this very app's implementation in the repository. */}
        <a
          class="koi-card-source"
          href={koiSourceUrl(props.profile.framework)}
          target="_blank"
          rel="noopener noreferrer"
          ref={(node) => {
            source = node
          }}
        >
          App source ↗
        </a>
      </div>
    </>
  )
}
