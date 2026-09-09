import type { CSSProperties } from 'react'
import type { DemoTheme } from './demo-fallback-card'
import { cssTriple, demoPreviewFor } from '@/lib/demo-preview'

/** Props for {@link DemoPreviewFrame}. */
export interface DemoPreviewFrameProps {
  /** Slug of the demo the still belongs to. */
  slug: string
  /** The demo's accent theme, which the still is tinted toward. */
  theme: DemoTheme
  /** `true` while the live session is being opened, which is what the sheen reports. */
  connecting: boolean
}

/**
 * The demo itself, held still, filling the card its live frame will occupy.
 *
 * Renders nothing for a demo with no committed still, so a demo still in
 * planning falls through to the card's icon exactly as before.
 *
 * The still is `aria-hidden` and the card's own status pill is what a screen
 * reader is told: the image carries no information the pill does not, and
 * announcing a decorative photograph of a demo that is still connecting is
 * noise. Sizing comes from the intrinsic dimensions and `object-cover`, inside
 * a parent that already owns the aspect ratio, so nothing here can shift the
 * layout when the file arrives.
 * @param props - See {@link DemoPreviewFrameProps}.
 * @param props.slug - Slug of the demo
 * @param props.theme - The demo's accent theme
 * @param props.connecting - Whether the live session is being opened
 * @returns The treated still, or null when the demo has none.
 */
export function DemoPreviewFrame({ slug, theme, connecting }: DemoPreviewFrameProps) {
  const preview = demoPreviewFor(slug)
  if (!preview) {
    return null
  }

  return (
    <div
      aria-hidden
      className={`demo-preview pointer-events-none absolute inset-0 overflow-hidden rounded-2xl ${preview.transparent ? 'demo-preview--transparent' : ''}`}
      style={
        {
          '--demo-accent-light': cssTriple(theme.accent.light),
          '--demo-accent-dark': cssTriple(theme.accent.dark),
          // why: a still carrying its own alpha has no rectangle to treat, so the stylesheet masks the wash and the sheen to the picture itself, which it cannot reach without being handed it
          '--demo-preview-still': `url(${preview.src})`,
        } as CSSProperties
      }
    >
      <img
        src={preview.src}
        alt=""
        width={preview.width}
        height={preview.height}
        decoding="async"
        // why: the still is the loading state, so waiting for it to scroll into view would be waiting to show the thing that hides a wait
        loading="eager"
        className="demo-preview__image h-full w-full object-cover"
      />
      <div className="demo-preview__tint absolute inset-0" />
      {connecting ? (
        <div className="demo-preview__sheen-clip">
          <div className="demo-preview__sheen absolute inset-y-0 -inset-x-1/3 motion-reduce:inset-x-0" />
        </div>
      ) : null}
    </div>
  )
}
