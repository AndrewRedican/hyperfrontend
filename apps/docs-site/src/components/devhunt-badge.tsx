/** The DevHunt listing the badge links to. */
const DEVHUNT_TOOL_URL = 'https://devhunt.org/tool/hyperfrontend'

/** DevHunt's hosted badge, which renders the listing's current Dev Tool of the Week rank. */
const DEVHUNT_BADGE_SRC = 'https://devhunt.org/badge/hyperfrontend.svg'

/** Classes shared by both badge variants; the badge is drawn at DevHunt's native 220×54. */
const BADGE_CLASSES = 'h-[54px] w-[220px]'

/**
 * DevHunt's badge for HyperFrontend, ranked #1 Dev Tool of the Week, linking
 * to the HyperFrontend listing. Renders DevHunt's light or dark variant to
 * match the site theme.
 * @returns The linked badge
 */
export function DevHuntBadge() {
  return (
    <a
      href={DEVHUNT_TOOL_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="HyperFrontend on DevHunt"
      className="inline-block shrink-0 rounded-[10px] transition-opacity hover:opacity-90"
    >
      <img
        src={`${DEVHUNT_BADGE_SRC}?theme=light`}
        alt="HyperFrontend: #1 Dev Tool of the Week on DevHunt"
        width={220}
        height={54}
        className={`${BADGE_CLASSES} block dark:hidden`}
      />
      <img src={DEVHUNT_BADGE_SRC} alt="" aria-hidden="true" width={220} height={54} className={`${BADGE_CLASSES} hidden dark:block`} />
    </a>
  )
}
