import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { GuidesIndexList } from '@/components/guides/guides-index-list'
import { JsonLd } from '@/components/json-ld'
import { getGuideIndex, getGuidePackageOptions } from '@/lib/guides'
import { getGuidesIndexMetadata } from '@/lib/metadata'
import { SITE_URL } from '@/lib/site'
import { Suspense } from 'react'

export const metadata: Metadata = getGuidesIndexMetadata()

export default function GuidesPage() {
  const guides = getGuideIndex()
  const packageOptions = getGuidePackageOptions()

  return (
    <div className="mx-auto max-w-5xl">
      <Breadcrumb />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'HyperFrontend guides and tutorials',
          numberOfItems: guides.length,
          itemListElement: guides.map((guide, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: guide.title,
            url: `${SITE_URL}${guide.route}/`,
          })),
        }}
      />
      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Guides &amp; Tutorials</h1>
      <div className="mt-6">
        {/* why: The facets live in the query string, and useSearchParams needs a boundary to stream past during the static build */}
        <Suspense fallback={<p className="text-slate-600 dark:text-slate-400">Loading guides…</p>}>
          <GuidesIndexList guides={guides} packageOptions={packageOptions} />
        </Suspense>
      </div>
    </div>
  )
}
