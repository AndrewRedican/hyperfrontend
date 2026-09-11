import { H2 } from '@/components/heading-with-anchor'

/** Props for {@link ArchitectureNote}. */
export interface ArchitectureNoteProps {
  /** The section's own markdown, already rendered to HTML */
  html: string
  /** Heading the section is announced and linked by */
  title: string
  /** Anchor id the heading keeps, so links written against it still resolve */
  anchor: string
}

/**
 * How a package is built, set apart from what it does.
 *
 * This used to be the second thing on a package page, directly under the
 * capability list and above everything a reader arrived for. That is the wrong
 * order for the question a package page answers: what this is, what it does,
 * whether it is relevant, and how to start. How it was built is worth knowing
 * afterwards and almost never before, so the section moved to the end of the
 * page proper, after the reader has the package and before they are offered
 * somewhere else to go.
 *
 * The treatment says the same thing the placement does. A hairline down the
 * left and a quieter colour make it read as a margin note rather than as
 * another section competing with the ones above it. It is deliberately not a
 * card: a card would give it a border, a fill, and back the weight the move was
 * meant to take away.
 *
 * The heading keeps the anchor the README gave it, so a link written against
 * `#architecture-highlights` still lands on this content wherever it now sits.
 * @param props - See {@link ArchitectureNoteProps}.
 * @param props.html - The section's rendered HTML
 * @param props.title - Heading the section is announced by
 * @param props.anchor - Anchor id the heading keeps
 * @returns The section, set as a margin note.
 */
export function ArchitectureNote({ html, title, anchor }: ArchitectureNoteProps) {
  return (
    <section className="architecture-note mt-12">
      <H2 id={anchor} className="architecture-note__title">
        {title}
      </H2>
      <div className="architecture-note__body" dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  )
}
