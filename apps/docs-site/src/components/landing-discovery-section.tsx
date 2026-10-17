import type { GuideIndexEntry } from '@/lib/guides'
import type { DiscoveryContent, DiscoveryGuide } from './landing/discovery-model'
import { getAllArticles } from '@/lib/articles'
import { BOUNDARY_LABELS, DEMO_MANIFEST } from '@/lib/demo-manifest'
import { buildGuidesHref } from '@/lib/guide-filters'
import { getGuideIndex } from '@/lib/guides'
import { rankGuidesByAltitude, selectFeaturedGuides } from '@/lib/landing-highlights'
import { DiscoveryArc } from './landing/discovery-arc'

/** How many entries a shelf holds before sending readers to its index. */
const SHELF_SIZE = 4

/**
 * The guides a shelf shows: the featured selection when the corpus is bigger
 * than the shelf, and the whole corpus in altitude order when it is not, so a
 * small corpus is never thinned by the per-package cap meant for a large one.
 * @param guides - The corpus the shelf draws from
 * @returns The shelf's guides
 */
function shelfGuides(guides: GuideIndexEntry[]): DiscoveryGuide[] {
  const picked = guides.length > SHELF_SIZE ? selectFeaturedGuides(guides, SHELF_SIZE) : rankGuidesByAltitude(guides)
  return picked.map(({ slug, route, title, problem, type, estMinutes }) => ({ slug, route, title, problem, type, estMinutes }))
}

/**
 * The landing page's discovery band: the arc of the four kinds of
 * documentation and the launch film, with whichever one is in focus opened
 * beneath it, so a first-time reader can start a tutorial, pick a job, watch
 * a demo, or open an essay without knowing the site's shape.
 *
 * The content is read here, on the server, from the same sources the index
 * pages read, and handed to the arc already shaped for its shelves.
 * @returns The rendered section.
 */
export function LandingDiscoverySection() {
  const guides = getGuideIndex()
  const tutorials = guides.filter((guide) => guide.type === 'tutorial')
  const howTos = guides.filter((guide) => guide.type === 'how-to')
  const articles = getAllArticles()

  const content: DiscoveryContent = {
    tutorials: { items: shelfGuides(tutorials), total: tutorials.length, href: buildGuidesHref({ type: 'tutorial' }) },
    howTos: { items: shelfGuides(howTos), total: howTos.length, href: buildGuidesHref({ type: 'how-to' }) },
    demos: {
      live: DEMO_MANIFEST.filter((entry) => entry.featureUrl !== undefined).map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        description: entry.description,
        stack: entry.stack,
        boundary: BOUNDARY_LABELS[entry.boundary],
      })),
      planned: DEMO_MANIFEST.filter((entry) => entry.featureUrl === undefined).map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        description: entry.description,
        stack: entry.stack,
        boundary: BOUNDARY_LABELS[entry.boundary],
      })),
      href: '/demos',
    },
    articles: {
      items: articles
        .slice(0, SHELF_SIZE)
        .map(({ slug, title, description, date, readingTime }) => ({ slug, title, description, date, readingTime })),
      total: articles.length,
      href: '/articles',
    },
  }

  return (
    <section id="learn" aria-label="Explore the documentation" className="py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <DiscoveryArc content={content} />
      </div>
    </section>
  )
}
