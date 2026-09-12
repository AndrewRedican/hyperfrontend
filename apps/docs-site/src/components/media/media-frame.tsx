import type { ReactNode } from 'react'

/** Props for {@link MediaFrame}. */
export interface MediaFrameProps {
  /** The width-to-height ratio the stage holds, `16 / 9`; the stage sizes itself from it before any media arrives */
  aspectRatio: string
  /** A caption under the stage, drawn as the figure's own */
  caption?: ReactNode
  /** Extra classes on the figure, for a margin or a width */
  className?: string
  /** What the stage holds */
  children: ReactNode
}

/**
 * The box every embedded medium sits in: a stage of a stated aspect ratio,
 * and a caption under it.
 *
 * The stage's size comes from the ratio, not from the medium, which is what
 * keeps a page from jumping: a video that has not loaded, an image still on
 * its way and a chart drawn a frame later all occupy exactly the space they
 * will end up in. The medium fills the stage, so the one rule about size is
 * written once here rather than once per kind of medium.
 * @param props - See {@link MediaFrameProps}.
 * @param props.aspectRatio - The width-to-height ratio the stage holds
 * @param props.caption - A caption under the stage
 * @param props.className - Extra classes on the figure
 * @param props.children - What the stage holds
 * @returns The figure.
 * @example A captioned stage
 * ```tsx
 * <MediaFrame aspectRatio="16 / 9" caption="The host console mid-session">
 *   <video src="/media/console.mp4" controls />
 * </MediaFrame>
 * ```
 */
export function MediaFrame({ aspectRatio, caption, className = '', children }: MediaFrameProps) {
  return (
    <figure className={`media-frame ${className}`}>
      <div className="media-frame__stage" style={{ aspectRatio }}>
        {children}
      </div>
      {caption === undefined ? null : <figcaption className="media-frame__caption">{caption}</figcaption>}
    </figure>
  )
}
