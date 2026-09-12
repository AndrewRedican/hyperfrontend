import type { VideoSource } from '@/lib/media-sources'
import type { ReactNode } from 'react'
import { videoFiles } from '@/lib/media-sources'
import { MediaFrame } from './media-frame'
import { YouTubeEmbed } from './youtube-embed'

/** Props for {@link DocVideo}. */
export interface DocVideoProps {
  /** Where the video comes from */
  source: VideoSource
  /** What the video shows, in a sentence: the accessible name, and the caption unless one is given */
  title: string
  /** A caption under the video; the title when omitted */
  caption?: ReactNode
  /** The width-to-height ratio the frame holds before the video arrives; `16 / 9` when omitted */
  aspectRatio?: string
  /** Start playing as soon as the video is on screen, silently and on a loop, the way a demo clip does */
  autoplay?: boolean
  /** Start again when the end is reached */
  loop?: boolean
  /** Show the browser's own playback controls; on unless the video plays itself */
  controls?: boolean
  /** Extra classes on the figure, for a margin */
  className?: string
}

/**
 * A video in the documentation, from wherever it is hosted.
 *
 * One component for the writer, whatever the source: a file under the
 * site, a file on a CDN or object store, or a video on YouTube. What the
 * writer states is what the page needs to know, the source, a title, a
 * ratio, whether it plays itself; how each host is embedded is the
 * component's business, kept behind the source's kind.
 *
 * The defaults are the bandwidth-conscious ones. A file video loads nothing
 * until it is played: only its poster, when it has one, is fetched with the
 * page. A YouTube video is a still with a play button until it is pressed,
 * and only then is the player loaded, from the cookieless host. A video that
 * plays itself is always muted, because a page must never make sound
 * unasked, and it plays inline on a phone rather than taking it over.
 * @param props - See {@link DocVideoProps}.
 * @param props.source - Where the video comes from
 * @param props.title - What the video shows
 * @param props.caption - A caption under the video
 * @param props.aspectRatio - The width-to-height ratio the frame holds
 * @param props.autoplay - Whether it plays itself
 * @param props.loop - Whether it starts again at the end
 * @param props.controls - Whether the browser's controls are shown
 * @param props.className - Extra classes on the figure
 * @returns The framed video.
 * @example A silent looping clip served from the site
 * ```tsx
 * <DocVideo source={{ kind: 'file', files: { src: '/media/koi-pond.mp4', type: 'video/mp4' }, poster: '/media/koi-pond.jpg' }} title="The koi pond with eight fish" autoplay loop />
 * ```
 * @example A talk on YouTube
 * ```tsx
 * <DocVideo source={{ kind: 'youtube', id: 'dQw4w9WgXcQ' }} title="HyperFrontend in twenty minutes" />
 * ```
 */
export function DocVideo({
  source,
  title,
  caption,
  aspectRatio = '16 / 9',
  autoplay = false,
  loop = autoplay,
  controls = !autoplay,
  className,
}: DocVideoProps) {
  const shownCaption = caption ?? title

  if (source.kind === 'youtube') {
    return (
      <MediaFrame aspectRatio={aspectRatio} caption={shownCaption} className={className}>
        <YouTubeEmbed source={source} title={title} />
      </MediaFrame>
    )
  }

  return (
    <MediaFrame aspectRatio={aspectRatio} caption={shownCaption} className={className}>
      <video
        className="media-frame__media"
        // why: a video that plays itself has to be silent to be allowed to, and is silent because a page must not make sound unasked
        muted={autoplay}
        autoPlay={autoplay}
        loop={loop}
        controls={controls}
        playsInline
        preload={autoplay ? 'auto' : source.poster === undefined ? 'metadata' : 'none'}
        poster={source.poster}
        aria-label={title}
      >
        {videoFiles(source).map((file) => (
          <source key={file.src} src={file.src} type={file.type} />
        ))}
        Your browser cannot play this video. {title}
      </video>
    </MediaFrame>
  )
}
