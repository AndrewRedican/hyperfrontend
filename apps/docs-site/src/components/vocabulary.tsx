import type { PackageMark } from '@/components/package/package-marks'
import type { ReactNode } from 'react'
import { MarkGlyph } from '@/components/package/package-icon'
import { box, dot, line, slab } from '@/components/package/package-marks'
import Link from 'next/link'

/** One term in the vocabulary. */
export interface VocabularyEntry {
  /** The word, as the docs use it */
  term: string
  /** Where the term is taken further, omitted when nothing deeper exists yet */
  href?: string
  /** What the word means, in a sentence or two */
  definition: ReactNode
  /** The term's identity, drawn in the package-mark family */
  mark: PackageMark
}

/** Props for {@link Vocabulary}. */
export interface VocabularyProps {
  /** The terms, in the order they should be read */
  entries: readonly VocabularyEntry[]
}

/**
 * The frame every concept mark is drawn from: a product surface with a
 * header, and a seat inside it where another team's app goes. It is the
 * features package's own mark with the accent left off, so each term below
 * can put the accent on the one part of that picture it names.
 */
const SURFACE: PackageMark = [box(4, 5.5, 24, 21, 3), line('M4 11.5h24')]

/** The seat inside the surface, stroked: where a feature appears. */
const SEAT = box(16.5, 15, 8.5, 8.5, 2)

/**
 * Concept marks, one per term.
 *
 * Read as a set: the host is the surface, the hostee is what sits in it, the
 * feature is that same occupant seen with the contract it speaks, and the shell
 * is the parcel it travels in. A reader who has met the features package mark
 * has met three of them already.
 */
export const CONCEPT_MARKS = {
  /* The surface itself: the accent sits in its header, where the host draws its own chrome. */
  host: [...SURFACE, dot(7.6, 8.5, 1.15), SEAT],
  /* The occupant: the seat is the one solid thing, the surface a stroked context around it. */
  hostee: [...SURFACE, slab(16.5, 15, 8.5, 8.5, 2)],
  /* The occupant as a product unit: the seat, and the contract line that says what it sends and accepts, ending in the accent. */
  feature: [...SURFACE, SEAT, line('M8.5 19.25h5'), dot(8.5, 19.25, 1.15)],
  /* The parcel: a box with its lid, and the label that names what is inside. */
  shell: [box(5, 9, 22, 17, 2.5), line('M5 14.5h22'), line('M16 9v5.5'), slab(11.5, 18.5, 9, 3, 1.5)],
} as const satisfies Record<string, PackageMark>

/**
 * A glossary drawn as one column: the term set apart on the left, its
 * definition beside it, and a rail running down between the marks.
 *
 * The rail and the marks are the same construction the package pages use for
 * their capability run, so the two read as one family, and the term column is
 * what makes this a glossary rather than a list: the eye can run down the
 * words alone, then stop and read. On a narrow screen the column folds and
 * the term sits above its definition with the mark still on the rail.
 * @param props - See {@link VocabularyProps}.
 * @param props.entries - The terms to lay out
 * @returns The glossary.
 * @example
 * ```tsx
 * <Vocabulary entries={[{ term: 'Host', href: '/docs/libraries/features/host', definition: 'The containing application.', mark: CONCEPT_MARKS.host }]} />
 * ```
 */
export function Vocabulary({ entries }: VocabularyProps) {
  return (
    <dl className="vocabulary">
      {entries.map((entry) => (
        <div key={entry.term} className="vocabulary__entry">
          <MarkGlyph mark={entry.mark} className="vocabulary__mark" />
          <dt className="vocabulary__term">
            {entry.href ? (
              <Link href={entry.href} className="vocabulary__link">
                {entry.term}
              </Link>
            ) : (
              entry.term
            )}
          </dt>
          <dd className="vocabulary__definition">{entry.definition}</dd>
        </div>
      ))}
    </dl>
  )
}
