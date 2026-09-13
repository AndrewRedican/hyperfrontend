/**
 * The script the page runs before anything is painted: it reads the theme the
 * reader chose last time, or the operating system's preference when they never
 * chose, and stamps the matching class on the root element. The class is what
 * the stylesheet keys every dark-mode rule on, and the theme provider sets the
 * same class again once it mounts, so a reader who prefers dark never sees a
 * light page flash first. Anything that goes wrong (storage denied, no
 * `matchMedia`) leaves the page light, which is what the provider assumes too.
 */
const THEME_SCRIPT =
  "(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||((t===null||t==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'dark':'light')}catch(e){}})()"

/**
 * Renders the inline script that applies the stored theme before first paint.
 *
 * @returns The script element, placed first in the body so it runs before any
 * of the page is laid out
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
}
