/**
 * A frozen frame of a demo, standing in for it until the live session renders.
 *
 * The image is a real capture of the real feature app, taken by the workspace
 * media recorder from the same build the embed loads, at twice the widest card
 * it is shown in. Regenerate with:
 *
 * ```bash
 * npx nx media tool-media --scene=clock-preview
 * npx nx media tool-media --scene=heartbeat-preview
 * npx nx media tool-media --scene=koi-pond-preview
 * ```
 *
 * The scenes live in `tools/media/scenes/`, the assets are committed under
 * `assets/media/`, and the docs-site build mirrors them into `public/media/`.
 */
export interface DemoPreview {
  /** Site-absolute URL of the still. */
  src: string
  /** Intrinsic width, so the browser reserves the right box before it loads. */
  width: number
  /** Intrinsic height. */
  height: number
  /**
   * Whether the capture carries its own alpha.
   *
   * A feature that paints no background is transparent in the live embed too,
   * and the card's gradient shows through both. One that paints its own
   * surface is opaque in both.
   */
  transparent: boolean
}

/**
 * The still committed for each demo, keyed by slug.
 *
 * Only demos with a live origin have one: a demo still in planning has no
 * running app to photograph, and its card keeps the icon it always had.
 */
const PREVIEWS: Record<string, DemoPreview> = {
  clock: { src: '/media/clock-preview/preview.webp', width: 640, height: 640, transparent: true },
  heartbeat: { src: '/media/heartbeat-preview/preview.webp', width: 640, height: 640, transparent: false },
  'koi-pond': { src: '/media/koi-pond-preview/preview.webp', width: 640, height: 640, transparent: false },
}

/**
 * Resolves the committed still for a demo.
 *
 * @param slug - The demo slug to look up.
 * @returns The demo's still, or undefined when it has none.
 */
export function demoPreviewFor(slug: string): DemoPreview | undefined {
  return PREVIEWS[slug]
}

/**
 * Rewrites a comma-separated RGB triple into the space-separated form CSS
 * custom properties are consumed in.
 *
 * @param rgb - Channels as `'r, g, b'`.
 * @returns The same channels as `'r g b'`.
 */
export function cssTriple(rgb: string): string {
  return rgb
    .split(',')
    .map((channel) => channel.trim())
    .join(' ')
}
