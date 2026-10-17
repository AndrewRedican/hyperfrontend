import type { DiscoveryId } from './discovery-model'

/** Props for {@link DiscoveryIcon}. */
interface DiscoveryIconProps {
  /** Which category's glyph to draw */
  id: DiscoveryId
  /** Classes for the svg element, which sizes it */
  className?: string
}

/** Outline paths per category, on a 24-unit grid. */
const PATHS: Record<DiscoveryId, string> = {
  tutorials:
    'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25',
  'how-to':
    'M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z',
  film: 'M3 6.75A2.25 2.25 0 015.25 4.5h13.5A2.25 2.25 0 0121 6.75v10.5a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 17.25V6.75zM3 9.25h3M3 12h3M3 14.75h3M18 9.25h3M18 12h3M18 14.75h3M10.25 9.5v5l4-2.5-4-2.5z',
  demos:
    'M21 7.5V18M15 7.5V18M3 16.811V8.69c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811z',
  articles:
    'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
}

/**
 * The outline glyph for one of the arc's categories, drawn in the current
 * text colour so the chip around it decides the hue.
 * @param props - See {@link DiscoveryIconProps}.
 * @param props.id - Which category's glyph to draw
 * @param props.className - Classes for the svg element
 * @returns The glyph.
 */
export function DiscoveryIcon({ id, className }: DiscoveryIconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={PATHS[id]} />
    </svg>
  )
}

/** Props for {@link PlayGlyph}. */
interface PlayGlyphProps {
  /** Classes for the svg element, which sizes it */
  className?: string
}

/**
 * A solid play triangle, for the film tile and its player.
 * @param props - See {@link PlayGlyphProps}.
 * @param props.className - Classes for the svg element
 * @returns The glyph.
 */
export function PlayGlyph({ className }: PlayGlyphProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.14v13.72a1 1 0 001.5.86l11.02-6.86a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z" />
    </svg>
  )
}

/** Props for {@link ArrowGlyph}. */
interface ArrowGlyphProps {
  /** Classes for the svg element, which sizes it */
  className?: string
}

/**
 * The rightward arrow every onward link ends with.
 * @param props - See {@link ArrowGlyphProps}.
 * @param props.className - Classes for the svg element
 * @returns The glyph.
 */
export function ArrowGlyph({ className }: ArrowGlyphProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
