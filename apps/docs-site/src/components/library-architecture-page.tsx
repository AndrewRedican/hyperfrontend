import { Breadcrumb } from '@/components/breadcrumb'
import { MarkdownDocPage } from '@/components/document/markdown-doc-page'
import { getLibraryArchitecture } from '@/lib/docs-loader'
import { documentSubject } from '@/lib/document-model'
import Link from 'next/link'
import { notFound } from 'next/navigation'

/** Props for {@link LibraryArchitecturePage}. */
export interface LibraryArchitecturePageProps {
  /** Library URL slug (e.g. 'features') */
  slug: string
  /** Full npm package name (e.g. '@hyperfrontend/features') */
  packageName: string
}

/**
 * One library's ARCHITECTURE.md, published under its package.
 *
 * The seven library architecture routes differ only in which document they
 * load and which package they link back to, so they share this component
 * rather than each repeating the loader, the renderer, and the index wiring.
 * @param props - See {@link LibraryArchitecturePageProps}.
 * @param props.slug - Library URL slug
 * @param props.packageName - Full npm package name
 * @returns The rendered architecture document.
 * @example
 * ```tsx
 * <LibraryArchitecturePage slug="features" packageName="@hyperfrontend/features" />
 * ```
 */
export function LibraryArchitecturePage({ slug, packageName }: LibraryArchitecturePageProps) {
  const markdown = getLibraryArchitecture(slug)

  if (!markdown) {
    notFound()
  }

  return (
    <MarkdownDocPage
      markdown={markdown}
      descriptor={{
        route: `/docs/libraries/${slug}/architecture`,
        title: `${packageName} architecture`,
        subject: documentSubject('architecture', packageName),
        kind: 'architecture',
      }}
      before={
        <>
          <Breadcrumb />
          <div className="mb-6">
            <Link href={`/docs/libraries/${slug}`} className="text-sm text-primary-600 hover:underline dark:text-primary-400">
              ← Back to {packageName}
            </Link>
          </div>
        </>
      }
    />
  )
}
