import type { GuideIndexEntry } from '@/lib/guides'

/** The five things a visitor can reach from the discovery arc, in arc order. */
export type DiscoveryId = 'tutorials' | 'how-to' | 'film' | 'demos' | 'articles'

/** A guide as the arc's shelf shows it: enough to choose it, nothing to render it. */
export interface DiscoveryGuide {
  /** Stable slug */
  slug: string
  /** Site-relative route of the guide */
  route: string
  /** Guide title */
  title: string
  /** The problem the guide starts from */
  problem: string
  /** Diátaxis type, for the badge */
  type: GuideIndexEntry['type']
  /** Estimated minutes to complete, when the guide states one */
  estMinutes?: number
}

/** An article as the arc's shelf shows it. */
export interface DiscoveryArticle {
  /** URL slug */
  slug: string
  /** Article title */
  title: string
  /** Short summary */
  description: string
  /** Publication date, YYYY-MM-DD */
  date: string
  /** Human-readable reading time */
  readingTime: string
}

/** A demo as the arc's shelf shows it. */
export interface DiscoveryDemo {
  /** Stable slug, which is also its accent key */
  slug: string
  /** Display title */
  title: string
  /** One-line description */
  description: string
  /** Frameworks on each side of the boundary */
  stack: string
  /** Human-readable boundary label */
  boundary: string
}

/** A handful of entries from a larger corpus, with the way to the rest of it. */
export interface DiscoveryShelf<T> {
  /** The featured entries, in presentation order */
  items: T[]
  /** How many the corpus holds in all */
  total: number
  /** Where the whole corpus is */
  href: string
}

/** The demos as the arc's shelf shows them: the live ones and the planned ones, with the way to the gallery. */
export interface DiscoveryDemoShelf {
  /** The demos running on their own origins */
  live: DiscoveryDemo[]
  /** The demos still in planning */
  planned: DiscoveryDemo[]
  /** Where the gallery is */
  href: string
}

/** Everything the arc's panels draw from, loaded once on the server. */
export interface DiscoveryContent {
  /** The tutorials, highest altitude first */
  tutorials: DiscoveryShelf<DiscoveryGuide>
  /** The how-to guides, highest altitude first */
  howTos: DiscoveryShelf<DiscoveryGuide>
  /** The demos: those running on their own origins, and those still in planning */
  demos: DiscoveryDemoShelf
  /** The articles, newest first */
  articles: DiscoveryShelf<DiscoveryArticle>
}

/** One tile on the arc. */
export interface DiscoveryItem {
  /** Which panel the tile opens */
  id: DiscoveryId
  /** The tile's title */
  title: string
  /** The one-sentence promise under the title */
  description: string
  /** Where the category lives, or null for the film, which opens in place */
  href: string | null
}

/** The hosted launch film: the one asset the film tile and its player share. */
export const LAUNCH_FILM = {
  /** The video file, served beside the site */
  src: '/video/hyperfrontend.mp4',
  /** The still shown before playback */
  poster: '/video/hyperfrontend.webp',
  /** What the film is, as its accessible name */
  title: 'HyperFrontend, the launch film',
  /** How long it runs, as a clock reading */
  duration: '1:18',
} as const
