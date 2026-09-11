/** Props for {@link PageAccent}. */
export interface PageAccentProps {
  /** Hue, in degrees, the page is tinted with */
  hue: number
}

/**
 * The hue a page belongs to, published for everything on it that takes one.
 *
 * The atmosphere behind a page is drawn by the shell the page is read in, not
 * by the page, so a page cannot hand it a colour as a prop. What a page can do
 * is say what hue it is, once, at the root, and let every surface that reads
 * `--page-accent` pick it up from there: the wash behind the document, the
 * marks beside a package's capabilities, the rule down its architecture note.
 * They read one property rather than each being told, so a new tinted surface
 * needs no plumbing to join them.
 *
 * It is a style element rather than an effect so the hue is in the first
 * painted frame: a page that arrived grey and turned amber a moment later
 * would make the atmosphere something a reader notices, which is the one
 * thing it is not meant to be. It renders in place, and it leaves with the
 * page, so a document with no hue of its own gets the site's blue back.
 * @param props - See {@link PageAccentProps}.
 * @param props.hue - Hue the page is tinted with
 * @returns The declaration, and nothing visible.
 * @example Tinting a package's page with the package's own hue
 * ```tsx
 * <PageAccent hue={packageAccentHue('@hyperfrontend/nexus')} />
 * ```
 */
export function PageAccent({ hue }: PageAccentProps) {
  return <style>{`:root{--page-accent:${hue}}`}</style>
}
