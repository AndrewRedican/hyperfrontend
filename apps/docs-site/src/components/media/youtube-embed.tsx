'use client'

import type { YouTubeVideoSource } from '@/lib/media-sources'
import { youtubeEmbedUrl, youtubePosterUrl } from '@/lib/media-sources'
import { useState } from 'react'

/** Props for {@link YouTubeEmbed}. */
export interface YouTubeEmbedProps {
  /** The video */
  source: YouTubeVideoSource
  /** What the video shows, for the play button and the player's name */
  title: string
}

/**
 * A YouTube video that costs nothing until it is played.
 *
 * The player is a third-party page with its own scripts, cookies and
 * weight, and a documentation page that embeds three of them at load
 * fetches three players for videos most readers will not press. So what
 * is drawn is the video's own poster and a play button; pressing it loads
 * the player, from the cookieless host, already playing. The adapter is
 * the whole of what the site knows about YouTube.
 * @param props - See {@link YouTubeEmbedProps}.
 * @param props.source - The video
 * @param props.title - What the video shows
 * @returns The poster with a play button, or the player once asked for.
 */
export function YouTubeEmbed({ source, title }: YouTubeEmbedProps) {
  const [playing, setPlaying] = useState(false)

  if (playing) {
    return (
      <iframe
        className="media-frame__media"
        src={youtubeEmbedUrl(source, true)}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    )
  }

  return (
    <button type="button" className="media-frame__media media-facade" onClick={() => setPlaying(true)} aria-label={`Play video: ${title}`}>
      <img src={youtubePosterUrl(source.id)} alt="" className="media-facade__poster" loading="lazy" decoding="async" />
      <span className="media-facade__play" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5.5v13l11-6.5z" />
        </svg>
      </span>
    </button>
  )
}
