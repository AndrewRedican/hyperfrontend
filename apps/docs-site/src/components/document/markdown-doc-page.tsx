import type { DocumentDescriptor } from '@/lib/document-model'
import type { MarkdownSection } from '@/lib/slug'
import type { ReactNode } from 'react'
import { ReadmeContent } from '@/components/readme-content'
import { markdownToHtml } from '@/lib/markdown'
import { extractMermaidBlocks } from '@/lib/mermaid-utils'
import { extractMarkdownSections } from '@/lib/slug'
import { DocumentShell } from './document-shell'

/** Props for {@link MarkdownDocPage}. */
export interface MarkdownDocPageProps {
  /** The document's markdown, already carrying whatever link rewriting its loader applies */
  markdown: string
  /** How the document is addressed and described */
  descriptor: DocumentDescriptor
  /** Page furniture rendered above the document: breadcrumbs, badges, back links */
  before?: ReactNode
  /** Page furniture rendered below the document: related reading, next steps */
  after?: ReactNode
  /** Classes wrapping the rendered prose, for the few pages that style it further */
  proseClassName?: string
  /** Sections appended to the index for content the page renders after the markdown */
  extraSections?: MarkdownSection[]
}

/**
 * A document rendered from one markdown source, with its index and its
 * document-level actions beside it.
 *
 * Every page whose body is a markdown file goes through here, so the HTML a
 * reader sees and the Markdown the pipeline publishes are produced from the
 * same string. Section extraction runs on that same string too, which is what
 * keeps the index pointing at anchors that exist: the ids come from one
 * slugging rule applied to one document.
 * @param props - See {@link MarkdownDocPageProps}.
 * @param props.markdown - The document's markdown
 * @param props.descriptor - How the document is addressed and described
 * @param props.before - Page furniture rendered above the document
 * @param props.after - Page furniture rendered below the document
 * @param props.proseClassName - Classes wrapping the rendered prose
 * @param props.extraSections - Sections appended to the index
 * @returns The rendered document.
 * @example
 * ```tsx
 * <MarkdownDocPage
 *   markdown={getManifesto() ?? ''}
 *   descriptor={{ route: '/docs/manifesto', title: 'Manifesto', subject: 'the HyperFrontend manifesto', kind: 'page' }}
 *   before={<Breadcrumb />}
 * />
 * ```
 */
export async function MarkdownDocPage({ markdown, descriptor, before, after, proseClassName, extraSections = [] }: MarkdownDocPageProps) {
  const { processedContent, diagrams } = extractMermaidBlocks(markdown)
  const html = await markdownToHtml(processedContent)
  const sections = [...extractMarkdownSections(processedContent), ...extraSections]

  const prose = <ReadmeContent html={html} mermaidDiagrams={diagrams} />

  return (
    <DocumentShell descriptor={descriptor} sections={sections}>
      {before}
      {proseClassName ? <div className={proseClassName}>{prose}</div> : prose}
      {after}
    </DocumentShell>
  )
}
