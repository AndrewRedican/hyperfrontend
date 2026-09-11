import type { KeyFeature } from '@/lib/key-features'

/** Props for {@link KeyFeatures}. */
export interface KeyFeaturesProps {
  /** The capabilities, in the order the README lists them */
  features: readonly KeyFeature[]
}

/**
 * What a package can do, laid out as a run rather than as a grid.
 *
 * A card per capability is the obvious move and the wrong one: it turns eight
 * short facts into eight rectangles a reader has to enter and leave, and a page
 * that already carries a metadata strip, a capability chip row and a related
 * reading section does not need a fourth arrangement of boxes. What a list of
 * capabilities actually needs is rhythm, so this is one column with a hairline
 * running down it, a mark on the line at each capability, and the name set
 * apart from the sentence that says why it matters.
 *
 * The rail is what carries the eye between items, and it is the reason the
 * marks can be bare strokes instead of sitting inside something: the structure
 * is already drawn, so each mark only has to be a point on it. The rail fades
 * out at both ends rather than stopping, so the section has no top edge and no
 * bottom edge to read as a container.
 *
 * Marks take the package's own hue, the same one behind the page, so a reader
 * moving between packages sees the accent in the two places a page has room for
 * it and nowhere else.
 * @param props - See {@link KeyFeaturesProps}.
 * @param props.features - The capabilities to lay out
 * @returns The capability run.
 */
export function KeyFeatures({ features }: KeyFeaturesProps) {
  return (
    <ul className="key-features not-prose mt-5">
      {features.map((feature) => (
        <li key={feature.label} className="key-features__item">
          <CheckMark />
          <p className="key-features__label">
            <span dangerouslySetInnerHTML={{ __html: feature.label }} />
            {feature.detail !== '' && <span className="key-features__detail" dangerouslySetInnerHTML={{ __html: feature.detail }} />}
          </p>
          <p className="key-features__body" dangerouslySetInnerHTML={{ __html: feature.description }} />
        </li>
      ))}
    </ul>
  )
}

/**
 * The mark on the rail.
 *
 * A bare check with a short lead-in stroke rather than a tick inside a circle:
 * the circle would be the box this layout exists to avoid, and the lead-in is
 * what makes the mark meet the rail instead of floating beside it.
 * @returns The mark.
 */
function CheckMark() {
  return (
    <svg viewBox="0 0 16 16" className="key-features__mark" fill="none" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.2 8.4 6.4 11.6 12.8 4.6" />
    </svg>
  )
}
