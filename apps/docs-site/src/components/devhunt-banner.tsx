/** The DevHunt listing the launch banner links to. */
const DEVHUNT_TOOL_URL = 'https://devhunt.org/tool/hyperfrontend'

/** DevHunt's hosted banner script; it reads the listing URL from the `data-url` attribute of its own tag. */
const DEVHUNT_BANNER_SRC = 'https://cdn.jsdelivr.net/gh/sidiDev/devhunt-banner/indexV0.js'

/**
 * Loads DevHunt's launch banner: on `window.onload` the script prepends a
 * dark "We are live on DevHunt" bar to the body, above the sticky header,
 * linking to the HyperFrontend listing. The script locates its own tag with
 * `script[data-url]`, so that attribute is what carries the listing URL.
 * The banner is a launch-window fixture: remove this component from the root
 * layout once the contest is over.
 * @returns The deferred script element, placed in the document head as
 * DevHunt's embed instructions ask
 */
export function DevHuntBanner() {
  return <script defer data-url={DEVHUNT_TOOL_URL} src={DEVHUNT_BANNER_SRC} />
}
