/**
 * The Preact koi: the canvas the 3D fish renders into, and its identity card.
 *
 * The component itself is deliberately almost static. Its markup is the two
 * nodes the koi lives on — the canvas its body is drawn to, and the card a
 * visitor's hold reveals — and its one effect hands both to the renderer
 * that animates them. Everything that moves per frame is written through the
 * imperative stage, outside the diff; this component renders exactly once in
 * a koi's life.
 *
 * Nothing is painted on `body` or on the app root — the hostee SDK resets both
 * to transparent, and anything painted there would blank the pond behind this
 * frame for every koi below it. The canvas clears to transparent; only the
 * fish itself has colour.
 *
 * This is the one browser-facing part of the app. The other seven koi replace it
 * with their own framework's idiom, and share everything else.
 */
import type { KoiProfile } from '@hyperfrontend/demo-koi-lib'
import type { VNode } from 'preact'
import { FRAMEWORK_SITES } from '@hyperfrontend/demo-koi-lib'
import { useLayoutEffect, useRef } from 'preact/hooks'

/** The card's committed nodes, handed to the imperative renderer as one piece. */
export interface KoiCardHandles {
  /** The card element the renderer reveals and parks. */
  card: HTMLDivElement
  /** The app URL anchor, whose rectangle the outline reports. */
  app: HTMLAnchorElement
  /** The framework-site anchor, whose rectangle the outline reports. */
  site: HTMLAnchorElement
  /** The behaviour row. */
  state: HTMLElement
  /** The runtime row. */
  runtime: HTMLElement
  /** The memory row. */
  memory: HTMLElement
  /** The last-event row, hidden until an event exists. */
  event: HTMLElement
}

/** Everything the koi component draws from. */
export interface KoiFishProps {
  /** Everything about this koi that never changes. */
  profile: KoiProfile
  /** The URL of the app rendering it, shown on the card. */
  url: string
  /**
   * Hands the mounted nodes to the imperative renderer.
   *
   * @param canvas - The canvas the koi's body renders into.
   * @param handles - The identity card's nodes the renderer writes through.
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
export function KoiFish({ profile, url, mount }: KoiFishProps): VNode {
  const canvas = useRef<HTMLCanvasElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const app = useRef<HTMLAnchorElement>(null)
  const site = useRef<HTMLAnchorElement>(null)
  const state = useRef<HTMLSpanElement>(null)
  const runtime = useRef<HTMLSpanElement>(null)
  const memory = useRef<HTMLSpanElement>(null)
  const event = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    if (
      canvas.current === null ||
      card.current === null ||
      app.current === null ||
      site.current === null ||
      state.current === null ||
      runtime.current === null ||
      memory.current === null ||
      event.current === null
    ) {
      return
    }
    // why: The GPU scene needs a real canvas node, so it is built here — after Preact has committed one — and torn down by whatever cleanup the renderer hands back.
    return mount(canvas.current, {
      card: card.current,
      app: app.current,
      site: site.current,
      state: state.current,
      runtime: runtime.current,
      memory: memory.current,
      event: event.current,
    })
  }, [mount])

  return (
    <>
      <canvas class="koi-canvas" aria-hidden="true" ref={canvas} />
      <div class="koi-card" hidden ref={card}>
        <span class="koi-card-name">
          <span class="koi-card-title" style={{ color: profile.palette.accent }}>
            {profile.label}
          </span>
          {/* why: The variety rides beside the framework name — the pattern is the koi's own identity, and it costs one word to say this asagi is the React app. */}
          <span class="koi-card-variety">{profile.palette.pattern}</span>
        </span>
        <span class="koi-card-line koi-card-state" ref={state} />
        {/* why: The links are real anchors for semantics and styling, but this frame never receives the pointer — the host reads their rectangles off the outline report and floats the anchors that actually open them. */}
        <a class="koi-card-url" href={url} target="_blank" rel="noopener noreferrer" ref={app}>
          {url}
        </a>
        <span class="koi-card-line koi-card-runtime" ref={runtime} />
        <span class="koi-card-line koi-card-memory" ref={memory} />
        <span class="koi-card-line koi-card-event" hidden ref={event} />
        <a class="koi-card-site" href={FRAMEWORK_SITES[profile.framework]} target="_blank" rel="noopener noreferrer" ref={site}>
          {profile.label} website ↗
        </a>
      </div>
    </>
  )
}
