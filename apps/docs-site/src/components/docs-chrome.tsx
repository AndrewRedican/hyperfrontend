import type { ReactNode } from 'react'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { PageAtmosphere } from '@/components/page-atmosphere'
import { Sidebar } from '@/components/sidebar'
import { DOC_COLUMN_CLASS, DOC_MEASURE_CLASS, docLayout } from '@/lib/doc-layout'
import { navVisibility } from '@/lib/nav-visibility'

/** Props for {@link DocsChrome}. */
export interface DocsChromeProps {
  /** The page, rendered as the document column of the shell. */
  children: ReactNode
}

/**
 * The frame every documentation page is read in: the site header, the
 * navigation column beside the page, the footer, and the atmosphere behind all
 * of it.
 *
 * It exists as a component rather than only as a route layout because the
 * documentation is not all under one route segment. `/architecture` is a
 * sibling of `/docs`, so the App Router composes no docs layout around it, and
 * a page that is reached from the navigation and then loses that navigation is
 * a dead end the reader has to use the back button to escape. Anything the
 * navigation offers is wrapped in this, wherever its route happens to sit.
 *
 * The atmosphere is rendered here for the same reason: it is the environment
 * a page is read in, and a page that had to remember to ask for it is a page
 * that would one day be read on a flat ground beside pages that were not. A
 * page tints it by declaring its hue with {@link PageAccent}; it never draws
 * its own.
 *
 * The navigation column itself is hidden below {@link navVisibility.sidebar};
 * the drawer in the header covers those widths, so a narrow screen renders
 * this as header, page, footer and nothing else changes.
 * @param props - See {@link DocsChromeProps}.
 * @param props.children - The page, rendered as the document column
 * @returns The page inside the documentation frame.
 * @example
 * ```tsx
 * export default function ArchitecturePage() {
 *   return <DocsChrome>{content}</DocsChrome>
 * }
 * ```
 */
export function DocsChrome({ children }: DocsChromeProps) {
  return (
    <>
      <Header width={docLayout.shell} />
      <PageAtmosphere />
      <div className={`flex ${docLayout.shell} ${docLayout.gutter}`}>
        {/* Sidebar - the mobile drawer covers every width below this one, sticky on desktop */}
        <aside className={`sticky top-16 h-[calc(100vh-4rem)] self-start dark:border-slate-700 ${navVisibility.sidebar}`}>
          <Sidebar />
        </aside>

        {/* Main Content */}
        <main id="main-content" className={`min-w-0 flex-1 py-10 lg:pl-8 ${DOC_MEASURE_CLASS} ${DOC_COLUMN_CLASS}`}>
          {children}
        </main>
      </div>
      <Footer width={docLayout.shell} />
    </>
  )
}
