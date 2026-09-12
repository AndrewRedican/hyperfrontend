import { isArray } from '@hyperfrontend/immutable-api-utils/built-in-copy/array'
import { floor } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** One encoding of a file the browser may pick from. */
export interface VideoFile {
  /** The file's URL: a path under the site, or an absolute URL on a CDN or object store */
  src: string
  /** Its MIME type, `video/mp4` or `video/webm`, so the browser can choose without fetching */
  type?: string
}

/** A video the site or a CDN serves directly. */
export interface FileVideoSource {
  /** Discriminator */
  kind: 'file'
  /** The file, or several encodings of it in order of preference */
  files: VideoFile | VideoFile[]
  /** A still shown before playback, which is also what a lazy video costs until it is played */
  poster?: string
}

/** A video hosted on YouTube. */
export interface YouTubeVideoSource {
  /** Discriminator */
  kind: 'youtube'
  /** The video id, the eleven characters after `v=` */
  id: string
  /** Where to begin, in seconds */
  start?: number
}

/** Where a documentation video comes from. */
export type VideoSource = FileVideoSource | YouTubeVideoSource

/** Where a YouTube video is embedded from: the cookieless host, so an embed sets nothing until it is played. */
const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'

/** Where YouTube serves a video's poster from. */
const YOUTUBE_IMAGE_ORIGIN = 'https://i.ytimg.com'

/** The shapes a YouTube link comes in. */
const YOUTUBE_ID_PATTERNS = [
  /[?&]v=([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
  /\/embed\/([A-Za-z0-9_-]{11})/,
  /^([A-Za-z0-9_-]{11})$/,
]

/**
 * Read a YouTube video id out of an id or any of the usual links.
 *
 * @param reference - An id, a watch URL, a short URL or an embed URL
 * @returns The id, or null when nothing recognisable is there
 *
 * @example
 * ```typescript
 * parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 * parseYouTubeId('https://youtu.be/dQw4w9WgXcQ') // 'dQw4w9WgXcQ'
 * ```
 */
export function parseYouTubeId(reference: string): string | null {
  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = pattern.exec(reference.trim())
    if (match !== null) return match[1]
  }
  return null
}

/**
 * The URL a YouTube video plays from once a reader has asked for it.
 *
 * @param source - The video being embedded
 * @param autoplay - Whether to start at once, which is right when the reader has just pressed play on the poster
 * @returns The URL the player is loaded from
 *
 * @example
 * ```typescript
 * youtubeEmbedUrl({ kind: 'youtube', id: 'dQw4w9WgXcQ', start: 30 }, true)
 * // 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&start=30'
 * ```
 */
export function youtubeEmbedUrl(source: YouTubeVideoSource, autoplay: boolean): string {
  const params = [`autoplay=${autoplay ? 1 : 0}`, 'rel=0']
  if (source.start !== undefined && source.start > 0) params.push(`start=${floor(source.start)}`)
  return `${YOUTUBE_EMBED_ORIGIN}/embed/${source.id}?${params.join('&')}`
}

/**
 * The poster YouTube serves for a video, at the largest size every video has.
 *
 * @param id - The video's id
 * @returns Where its poster is served from
 *
 * @example
 * ```typescript
 * youtubePosterUrl('dQw4w9WgXcQ') // 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
 * ```
 */
export function youtubePosterUrl(id: string): string {
  return `${YOUTUBE_IMAGE_ORIGIN}/vi/${id}/hqdefault.jpg`
}

/**
 * The encodings of a file source, always as a list.
 *
 * @param source - A file-backed video
 * @returns Its encodings in order of preference
 */
export function videoFiles(source: FileVideoSource): VideoFile[] {
  return isArray(source.files) ? source.files : [source.files]
}
