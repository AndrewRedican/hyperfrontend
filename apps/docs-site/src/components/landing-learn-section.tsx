import { GuideTypeBadge } from '@/components/guides/guide-badges'
import { buildGuidesHref } from '@/lib/guide-filters'
import { getGuideIndex } from '@/lib/guides'
import { selectFeaturedGuides } from '@/lib/landing-highlights'
import Link from 'next/link'

/** How many guides the landing page features before sending readers to the index. */
const FEATURED_COUNT = 4

/**
 * The four ways into the documentation, kept distinct on purpose: a tutorial
 * and a how-to guide are different promises, and neither is a demo or an
 * essay. Each destination is the canonical URL for that kind of content.
 */
const LEARNING_PATHS = [
  {
    title: 'Tutorials',
    description: 'Learn by building something real, one step at a time, ending with a working result.',
    href: buildGuidesHref({ type: 'tutorial' }),
    icon: <TutorialIcon />,
  },
  {
    title: 'How-to guides',
    description: 'Have a job to do? Follow a direct route from the problem you have to the outcome you want.',
    href: buildGuidesHref({ type: 'how-to' }),
    icon: <HowToIcon />,
  },
  {
    title: 'Live demos',
    description: 'Real feature apps on their own origins, composed here and running in your browser right now.',
    href: '/demos',
    icon: <DemoIcon />,
  },
  {
    title: 'Articles',
    description: 'Long-form writing on the architecture: the pressures that produce it and the reasoning behind it.',
    href: '/articles',
    icon: <ArticleIcon />,
  },
]

/**
 * The landing page's learning band: the four kinds of documentation as
 * distinct destinations, followed by the guides and tutorials themselves so a
 * first-time reader can start one without knowing the site's shape.
 * @returns The rendered section.
 */
export function LandingLearnSection() {
  const guides = getGuideIndex()
  const featured = selectFeaturedGuides(guides, FEATURED_COUNT)

  return (
    <section id="learn" className="py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">Start from what you want to do</h2>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-400">
            Every code example in a guide is either extracted from source that ships and runs, or was executed against a named package
            version on a named date. The badge on each one tells you which.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {LEARNING_PATHS.map((path) => (
            <Link
              key={path.title}
              href={path.href}
              className="block rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-primary-600 dark:hover:bg-slate-800"
            >
              <div className="mb-4 inline-flex rounded-lg bg-primary-50 p-2.5 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                {path.icon}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{path.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{path.description}</p>
            </Link>
          ))}
        </div>

        {featured.length > 0 ? (
          <div className="mt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Where we would start you</h3>
              <Link
                href={buildGuidesHref()}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300"
              >
                All {guides.length} guides and tutorials
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {featured.map((guide) => (
                <Link
                  key={guide.slug}
                  href={guide.route}
                  className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <GuideTypeBadge type={guide.type} />
                    {guide.estMinutes ? <span className="text-xs text-slate-500 dark:text-slate-400">~{guide.estMinutes} min</span> : null}
                  </div>
                  <h4 className="mt-2 font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                    {guide.title}
                  </h4>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{guide.problem}</p>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}

/** Common props for landing-section icons */
type IconProps = { className?: string }

function TutorialIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
      />
    </svg>
  )
}

function HowToIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
      />
    </svg>
  )
}

function DemoIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 7.5V18M15 7.5V18M3 16.811V8.69c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 010 1.954l-7.108 4.061A1.125 1.125 0 013 16.811z"
      />
    </svg>
  )
}

function ArticleIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  )
}

function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  )
}
