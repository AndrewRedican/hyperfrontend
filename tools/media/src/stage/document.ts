import type { MediaProfile } from '../models/profile'
import type { MediaTheme } from '../models/theme'

/**
 * The element a stage's markup is mounted into.
 *
 * Exported because the playback loop addresses the same element every frame and
 * the two must not be able to disagree about which one it is.
 */
export const STAGE_ELEMENT_ID = 'stage'

/** Corner radius of the plate a portable frame is drawn on. */
const PLATE_RADIUS_PX = 14

/**
 * The ground a variant is drawn on.
 *
 * A themed frame paints its backdrop edge to edge, because the page it is
 * embedded in has the same theme and the join should not show. A portable
 * frame paints nothing outside a rounded plate with an edge of its own, so
 * that whatever page it lands on shows through around it; the plate is the
 * stage element itself, which keeps every stage's insets meaningful without
 * any stage knowing the difference.
 *
 * @param theme - The visual tokens this variant is drawn with.
 * @returns CSS for the stage element's ground.
 */
function ground(theme: MediaTheme): string {
  if (!theme.transparent) {
    return `#${STAGE_ELEMENT_ID} { background: ${theme.backdrop}; }`
  }
  return `
html, body { background: transparent; }
#${STAGE_ELEMENT_ID} {
  background: ${theme.plate};
  border: 1px solid ${theme.plateBorder};
  border-radius: ${PLATE_RADIUS_PX}px;
}`
}

/**
 * Build the document a stage is mounted into.
 *
 * Everything here is the harness rather than the stage: a reset that removes
 * the margins a screenshot would otherwise include, a box that is exactly the
 * profile's size so capturing the viewport captures the stage and nothing else,
 * the ground the theme asks for, and the stage's own stylesheet after all of
 * it so the stage can override any of it.
 *
 * The document is loaded through `setContent` rather than served over HTTP,
 * which is what lets a scripted scene run with no server, no port and no build:
 * there is nothing to serve, because the recorder is what draws it.
 *
 * @param css - The stage's stylesheet.
 * @param profile - The presentation target being composed for.
 * @param theme - The visual tokens this variant is drawn with.
 * @returns A complete HTML document.
 */
export function stageDocument(css: string, profile: MediaProfile, theme: MediaTheme): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>stage</title>
<style>
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: hidden; }
#${STAGE_ELEMENT_ID} {
  width: ${profile.width}px;
  height: ${profile.height}px;
  overflow: hidden;
  position: relative;
  font-family: ${theme.fonts.sans};
  color: ${theme.text.plain};
  -webkit-font-smoothing: antialiased;
}
${ground(theme)}
</style>
<style>
${css}
</style>
</head>
<body><div id="${STAGE_ELEMENT_ID}"></div></body>
</html>`
}
