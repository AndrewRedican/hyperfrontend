/**
 * The Solid koi: the canvas the 3D fish renders into, and its hover identity.
 *
 * The component itself is deliberately almost static. Its markup is the two
 * nodes the koi lives on — the canvas its body is drawn to, and the card the
 * host's hover notices reveal — and its `onMount` hands both to the renderer
 * that animates them. The one reactive binding is the card's visibility,
 * because hover arrives at pointer cadence; everything that moves per frame is
 * written through the imperative stage, outside the reactive graph, so this
 * component's JSX re-evaluates nothing at sixty frames a second.
 *
 * Nothing is painted on `body` or on the app root — the hostee SDK resets both
 * to transparent, and anything painted there would blank the pond behind this
 * frame for every koi below it. The canvas clears to transparent; only the
 * fish itself has colour.
 *
 * This is the one browser-facing part of the app. The other six koi replace it
 * with their own framework's idiom, and share everything else.
 */
import type { KoiProfile } from '@hyperfrontend/demo-koi-lib'
import type { Accessor, JSX } from 'solid-js'
import { onCleanup, onMount } from 'solid-js'

/** Everything the koi component draws from. */
export interface KoiFishProps {
  /** Everything about this koi that never changes. */
  profile: KoiProfile
  /** The URL of the app rendering it, revealed on hover. */
  url: string
  /** Whether the host's pointer is over this koi. */
  hovered: Accessor<boolean>
  /**
   * Hands the mounted nodes to the imperative renderer.
   *
   * @param canvas - The canvas the koi's body renders into.
   * @param card - The hover identity card the renderer parks each frame.
   * @param link - The card's URL anchor, whose rectangle the outline reports.
   * @returns The teardown that releases whatever the renderer built on them.
   */
  mount(canvas: HTMLCanvasElement, card: HTMLDivElement, link: HTMLAnchorElement): () => void
}

/**
 * One koi's canvas and hover identity card.
 *
 * @param props - The {@link KoiFishProps}.
 * @returns The canvas the 3D koi renders into and, hidden until the host says the pointer arrived, its identity card.
 */
export function KoiFish(props: KoiFishProps): JSX.Element {
  let canvas: HTMLCanvasElement | undefined
  let card: HTMLDivElement | undefined
  let link: HTMLAnchorElement | undefined

  onMount(() => {
    if (canvas === undefined || card === undefined || link === undefined) {
      return
    }
    // why: The GPU scene needs a real canvas node, so it is built here — after Solid has created one — and torn down by whatever cleanup the renderer hands back.
    onCleanup(props.mount(canvas, card, link))
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
        hidden={!props.hovered()}
        ref={(node) => {
          card = node
        }}
      >
        <span class="koi-card-name" style={{ color: props.profile.palette.accent }}>
          {props.profile.label}
        </span>
        {/* why: The URL is a real anchor for semantics and link styling, but this frame never receives the pointer — the host reads its rectangle off the outline report and floats the anchor that actually opens it. */}
        <a
          class="koi-card-url"
          href={props.url}
          target="_blank"
          rel="noopener noreferrer"
          ref={(node) => {
            link = node
          }}
        >
          {props.url}
        </a>
      </div>
    </>
  )
}
