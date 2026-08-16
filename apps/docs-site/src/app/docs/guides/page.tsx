import type { Metadata } from 'next'
import { Breadcrumb } from '@/components/breadcrumb'
import { GuidesIndexList } from '@/components/guides/guides-index-list'
import { getGuideIndex } from '@/lib/guides'

export const metadata: Metadata = {
  title: 'Guides',
  description:
    'Task-focused tutorials and how-to guides for the HyperFrontend packages. Every code example is extracted from a spec or shipped demo that actually executes.',
  alternates: {
    canonical: '/docs/guides/',
  },
}

export default function GuidesPage() {
  const guides = getGuideIndex()

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumb />
      <h1 className="font-display text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Guides</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Start from the problem you are trying to solve. Tutorials teach by building something real; how-to guides get a specific job done.
        Code you see here is extracted from tests and shipped demos, never hand-typed into the page.
      </p>
      <div className="mt-8">
        {guides.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">No guides published yet. Check back soon.</p>
        ) : (
          <GuidesIndexList guides={guides} />
        )}
      </div>
    </div>
  )
}
