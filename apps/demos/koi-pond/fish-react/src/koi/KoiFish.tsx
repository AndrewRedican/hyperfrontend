/**
 * The React koi: the canvas the 3D fish renders into, and its hover identity.
 *
 * The component itself is deliberately almost static. Its markup is the two
 * nodes the koi lives on — the canvas its body is drawn to, and the card the
 * host's hover notices reveal — and its one effect hands both to the renderer
 * that animates them. Everything that moves per frame is written through the
 * imperative stage, outside the reconciler; this component renders exactly
 * once in a koi's life.
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
import type { ReactElement } from 'react'
import { useLayoutEffect, useRef } from 'react'

/** Everything the koi component draws from. */
export interface KoiFishProps {
  /** Everything about this koi that never changes. */
  profile: KoiProfile
  /** The URL of the app rendering it, revealed on hover. */
  url: string
  /**
   * Hands the mounted nodes to the imperative renderer.
   *
   * @param canvas - The canvas the koi's body renders into.
   * @param card - The hover identity card the renderer reveals and parks.
   * @returns The teardown that releases whatever the renderer built on them.
   */
  mount(canvas: HTMLCanvasElement, card: HTMLDivElement): () => void
}

/**
 * One koi's canvas and hover identity card.
 *
 * @param props - The {@link KoiFishProps}.
 * @returns The canvas the 3D koi renders into and, hidden until the host says the pointer arrived, its identity card.
 */
export function KoiFish({ profile, url, mount }: KoiFishProps): ReactElement {
  const canvas = useRef<HTMLCanvasElement>(null)
  const card = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (canvas.current === null || card.current === null) {
      return
    }
    // why: The GPU scene needs a real canvas node, so it is built here — after React has committed one — and torn down by whatever cleanup the renderer hands back.
    return mount(canvas.current, card.current)
  }, [mount])

  return (
    <>
      <canvas className="koi-canvas" aria-hidden="true" ref={canvas} />
      <div className="koi-card" hidden ref={card}>
        <span className="koi-card-name" style={{ color: profile.palette.accent }}>
          {profile.label}
        </span>
        <span className="koi-card-url">{url}</span>
      </div>
    </>
  )
}
