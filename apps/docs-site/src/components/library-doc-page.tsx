import type { TypeDocOutput } from '@/components/api-reference'
import type { PackageFacts } from '@/lib/package-facts'
import { TrackedLink } from '@/components/analytics/tracked-link'
import { ApiLinkProvider, ApiReference } from '@/components/api-reference'
import { Breadcrumb } from '@/components/breadcrumb'
import { CodeBlock } from '@/components/code-block'
import { DocumentShell } from '@/components/document/document-shell'
import { H1, H2 } from '@/components/heading-with-anchor'
import { ArchitectureNote } from '@/components/package/architecture-note'
import { KeyFeatures } from '@/components/package/key-features'
import { packageAccentHue } from '@/components/package/package-accents'
import { PackageCapabilities } from '@/components/package/package-capabilities'
import { PackageMetadata } from '@/components/package/package-metadata'
import { packageTitle } from '@/components/package/package-name'
import { RelatedReading } from '@/components/package/related-reading'
import { PageAccent } from '@/components/page-accent'
import { changelogPathFor, changelogRouteFor } from '@/lib/changelog'
import { removeBadges, transformLinks } from '@/lib/content'
import { getLibraryReadme, getLibraryApi, getApiLinkIndex } from '@/lib/docs-loader'
import { documentSubject } from '@/lib/document-model'
import { getPackageDownloads } from '@/lib/downloads'
import { buildGuidesHref } from '@/lib/guide-filters'
import { getGuidesForPackage } from '@/lib/guides'
import { readKeyFeatures } from '@/lib/key-features'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import { npmPackageUrl } from '@/lib/npm-url'
import { getPackageFacts } from '@/lib/package-facts'
import {
  ARCHITECTURE_LEVEL,
  ARCHITECTURE_SLUG,
  CAPABILITIES_SLOT,
  centreLede,
  KEY_FEATURES_SLOT,
  preparePackageReadme,
} from '@/lib/package-readme'
import { readSection, readSectionLink } from '@/lib/readme-sections'
import { buildRelatedReading } from '@/lib/related-reading'
import { extractMarkdownSections } from '@/lib/slug'
import Link from 'next/link'
import { ReadmeContent } from './readme-content'

interface LibraryPageProps {
  title: string
  packageName: string
  slug: string
  category: 'core' | 'supporting' | 'utils' | 'plugin'
  fallbackDescription?: string
  fallbackFeatures?: string[]
}

/**
 * Heading of the one section a library page ends on, and the id the document
 * index addresses it by. Held together because the index entry is pushed from
 * one place and the heading is rendered in another, and a page whose index
 * names a section that is not there is worse than a page with no index.
 */
const RELATED_READING_TITLE = 'Related reading'

/** @see {@link RELATED_READING_TITLE} */
const RELATED_READING_ANCHOR = 'related-reading'

/** Heading the moved architecture note keeps, matching the README's own. */
const ARCHITECTURE_TITLE = 'Architecture Highlights'

/** What a page assumes about a package the manifest has not covered yet. */
const NO_FACTS: PackageFacts = { license: '', version: '', isPrivate: false, compatibility: null, outputs: [] }

export async function LibraryDocPage({ title, packageName, slug, category, fallbackDescription, fallbackFeatures }: LibraryPageProps) {
  const readme = getLibraryReadme(slug)
  const apiData = getLibraryApi(slug) as TypeDocOutput | null
  const guides = getGuidesForPackage(packageName)
  // why: The same canonical destination the package README points at, so both entry points land on one filtered view
  const guidesHref = buildGuidesHref({ package: packageName })

  if (readme) {
    let processed = removeBadges(readme)
    processed = transformLinks(processed, { librarySlug: slug })

    const facts = getPackageFacts(packageName) ?? NO_FACTS
    const licenseHref = readSectionLink(processed, 'license')
    // why: a package withheld from the registry has no releases to list and no downloads to count, so neither pill is offered for one
    const changelogHref =
      facts.isPrivate || changelogPathFor(packageName) === null ? null : changelogRouteFor(libraryDocRoute(slug, category))
    const downloads = facts.isPrivate ? null : (getPackageDownloads(packageName)?.total ?? null)
    const related = buildRelatedReading({ packageName, slug, readme: processed })

    // why: the run is drawn only for a section the parser could read, so a README stating its features some other way keeps the rendering it already had
    const features = await readKeyFeatures(processed)
    const architecture = readSection(processed, ARCHITECTURE_SLUG, ARCHITECTURE_LEVEL)
    const architectureHtml = architecture === null ? null : await markdownToHtml(architecture)
    const { title: readmeTitle, body } = preparePackageReadme(processed, {
      keyFeatures: features !== null,
      architecture: architectureHtml !== null,
    })

    // why: the one sentence between the showcase and the first section is centred like the visuals around it, on the page alone; the README and the search index keep it as written
    const { processedContent, diagrams } = extractMermaidBlocks(centreLede(body))

    const html = await markdownToHtml(processedContent)

    const sections = extractMarkdownSections(processedContent)
    if (architectureHtml !== null) {
      // why: the note moved to the end of the page, so its index entry moves with it rather than pointing back into the opening section it left
      sections.push({ title: ARCHITECTURE_TITLE, anchor: ARCHITECTURE_SLUG, level: 2 })
    }
    if (apiData) {
      // why: the reference is a section of this page with a server-rendered anchor, but its symbols are not; there are hundreds per package and they have their own filter, so the index offers the way in and stops there
      sections.push({ title: 'API Reference', anchor: 'api-reference', level: 2 })
    }
    // why: the last section of the page is a section of it, and a reader who has reached the reference and wants somewhere to go next should be able to jump there from the index rather than scrolling past every symbol to find out whether there is anything after them
    sections.push({ title: RELATED_READING_TITLE, anchor: RELATED_READING_ANCHOR, level: 2 })

    return (
      <>
        {/* why: a package's own hue tints the atmosphere behind its documentation, so moving between packages feels like moving between places rather than reloading one */}
        <PageAccent hue={packageAccentHue(packageName)} />
        <DocumentShell
          descriptor={{ route: libraryDocRoute(slug, category), title, subject: documentSubject('package', packageName), kind: 'package' }}
          sections={sections}
        >
          <Breadcrumb />

          <H1 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
            {packageTitle(readmeTitle ?? packageName)}
          </H1>

          <PackageMetadata
            packageName={packageName}
            facts={facts}
            licenseHref={licenseHref}
            changelogHref={changelogHref}
            downloads={downloads}
          />

          <div className="mt-6">
            <ReadmeContent
              html={html}
              mermaidDiagrams={diagrams}
              slots={{
                [CAPABILITIES_SLOT]: <PackageCapabilities compatibility={facts.compatibility} outputs={facts.outputs} />,
                ...(features === null ? {} : { [KEY_FEATURES_SLOT]: <KeyFeatures features={features} /> }),
              }}
            />
          </div>

          {architectureHtml !== null && <ArchitectureNote html={architectureHtml} title={ARCHITECTURE_TITLE} anchor={ARCHITECTURE_SLUG} />}

          {/* API Reference */}
          {apiData && (
            <section className="mt-12 border-t border-slate-200 pt-8 dark:border-slate-700">
              <H2 id="api-reference" className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
                API Reference
              </H2>
              <ApiLinkProvider index={getApiLinkIndex(slug, packageName)} currentPackage={packageName}>
                <ApiReference data={apiData} />
              </ApiLinkProvider>
            </section>
          )}

          <RelatedReading
            anchor={RELATED_READING_ANCHOR}
            title={RELATED_READING_TITLE}
            entries={related}
            packageName={packageName}
            guidesHref={guidesHref}
            hasGuides={guides.length > 0}
          />
        </DocumentShell>
      </>
    )
  }

  return (
    <>
      <Breadcrumb />

      <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
        <DocumentationIcon className="h-4 w-4" />
        Documentation coming soon
      </div>

      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <code className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {packageName}
        </code>
        <TrackedLink
          href={npmPackageUrl(packageName)}
          event={{ kind: 'npm', packageName }}
          external
          className="text-sm text-primary-600 hover:underline dark:text-primary-400"
        >
          View on npm →
        </TrackedLink>
        <Link href={guidesHref} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
          Guides &amp; tutorials →
        </Link>
      </div>

      {fallbackDescription && <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">{fallbackDescription}</p>}

      {fallbackFeatures && fallbackFeatures.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Key Features</h2>
          <ul className="mt-4 space-y-2">
            {fallbackFeatures.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-green-500" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-800/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quick Install</h2>
        <CodeBlock code={`npm install ${packageName}`} />
      </section>
    </>
  )
}

/**
 * Route a library's documentation page is published at.
 *
 * Utility packages are namespaced under a shared umbrella and their pages
 * address them by the short slug, which is the same slug this component is
 * given.
 * @param slug - The library's URL slug as the page passes it
 * @param category - The library's category
 * @returns Site-relative route without a trailing slash
 */
function libraryDocRoute(slug: string, category: LibraryPageProps['category']): string {
  return category === 'utils' ? `/docs/libraries/utils/${slug}` : `/docs/libraries/${slug}`
}

type IconProps = { className?: string }

function DocumentationIcon({ className }: IconProps) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  )
}
