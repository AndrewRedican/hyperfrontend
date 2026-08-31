import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { MarkdownDocPage } from '@/components/document/markdown-doc-page'
import { GuideTypeBadge, VerificationBadge } from '@/components/guides/guide-badges'
import { PackagePill } from '@/components/guides/package-pill'
import { ShareMenu } from '@/components/share/share-menu'
import { documentSubject } from '@/lib/document-model'
import { buildGuidesHref } from '@/lib/guide-filters'
import { getAllGuideSlugs, getGuide, getGuideIndex } from '@/lib/guides'
import { markdownToInlineHtml } from '@/lib/markdown'
import { getGuideMetadata } from '@/lib/metadata'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { promiseAll } from '@hyperfrontend/immutable-api-utils/built-in-copy/promise'

/**
 * Route parameters for a guide page.
 */
interface GuideRouteParams {
  /** Guide slug from the URL */
  slug: string
}

type GuidePageProps = { params: Promise<GuideRouteParams> }

export function generateStaticParams() {
  return getAllGuideSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params
  return getGuideMetadata(slug)
}

/**
 * Turn a site route into readable link text.
 * @param route - Site-relative route such as `/docs/libraries/features/architecture`
 * @returns Human-readable label, e.g. `features architecture`
 */
function routeLabel(route: string): string {
  return route.replace('/docs/libraries/', '').replace(/^\//, '').split('/').join(' ')
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params
  const guide = getGuide(slug)

  if (!guide) {
    notFound()
  }

  const index = getGuideIndex()
  const prerequisiteGuides = (guide.prerequisites?.guides ?? []).flatMap((ref) => index.filter((entry) => entry.slug === ref))
  const relatedGuides = (guide.related?.guides ?? []).flatMap((ref) => index.filter((entry) => entry.slug === ref))
  // why: Prerequisites are authored sentences, so an API they name can carry its own reference link instead of going bare
  const prerequisiteKnowledge: string[] = await promiseAll((guide.prerequisites?.knowledge ?? []).map(markdownToInlineHtml))

  return (
    <div className="mx-auto max-w-4xl">
      <MarkdownDocPage
        markdown={guide.content}
        descriptor={{
          route: guide.route,
          title: guide.title,
          subject: documentSubject('guide', guide.title),
          kind: 'guide',
        }}
        before={
          <>
            <Breadcrumb />

            <div className="mb-6 flex flex-wrap items-center gap-2">
              <GuideTypeBadge type={guide.type} />
              <VerificationBadge verification={guide.verification} />
              {guide.complexity ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {guide.complexity}
                </span>
              ) : null}
              {guide.estMinutes ? <span className="text-xs text-slate-500 dark:text-slate-400">~{guide.estMinutes} min</span> : null}
              {guide.demo ? (
                <Link href="/demos" className="text-xs text-primary-600 hover:underline dark:text-primary-400">
                  Built on the {guide.demo} demo →
                </Link>
              ) : null}
              <span className="ml-auto">
                <ShareMenu path={`/docs/guides/${guide.slug}/`} title={guide.title} pageLine={guide.problem} />
              </span>
            </div>

            <div className="mb-6 flex flex-wrap gap-1.5">
              {guide.packages.map((packageName) => (
                <PackagePill key={packageName} packageName={packageName} href={buildGuidesHref({ package: packageName })} />
              ))}
            </div>

            {prerequisiteGuides.length > 0 || prerequisiteKnowledge.length > 0 ? (
              <aside className="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/50">
                <p className="font-semibold text-slate-900 dark:text-white">Before you start</p>
                <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-400">
                  {prerequisiteGuides.map((prerequisite) => (
                    <li key={prerequisite.slug}>
                      <Link href={prerequisite.route} className="text-primary-600 hover:underline dark:text-primary-400">
                        {prerequisite.title}
                      </Link>
                    </li>
                  ))}
                  {prerequisiteKnowledge.map((item) => (
                    <li
                      key={item}
                      className="[&_a:hover]:underline [&_a]:text-primary-600 dark:[&_a]:text-primary-400 [&_code]:rounded [&_code]:bg-slate-200/70 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs dark:[&_code]:bg-slate-700/70"
                      dangerouslySetInnerHTML={{ __html: item }}
                    />
                  ))}
                </ul>
              </aside>
            ) : null}
          </>
        }
        after={
          <>
            {(guide.related?.reference?.length ?? 0) + (guide.related?.explanation?.length ?? 0) > 0 ? (
              <section className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Reference and background</h2>
                <ul className="mt-4 space-y-1 text-sm">
                  {[...(guide.related?.reference ?? []), ...(guide.related?.explanation ?? [])].map((route) => (
                    <li key={route}>
                      <Link href={route} className="text-primary-600 hover:underline dark:text-primary-400">
                        {routeLabel(route)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {relatedGuides.length > 0 ? (
              <section className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Next steps</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {relatedGuides.map((related) => (
                    <Link
                      key={related.slug}
                      href={related.route}
                      className="group rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-primary-700 dark:hover:bg-primary-950/30"
                    >
                      <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 dark:text-white dark:group-hover:text-primary-400">
                        {related.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{related.problem}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        }
      />
    </div>
  )
}
