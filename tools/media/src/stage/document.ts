import type { MediaProfile } from '../models/profile'

/**
 * The element a stage's markup is mounted into.
 *
 * Exported because the playback loop addresses the same element every frame and
 * the two must not be able to disagree about which one it is.
 */
export const STAGE_ELEMENT_ID = 'stage'

/**
 * Build the document a stage is mounted into.
 *
 * Everything here is the harness rather than the stage: a reset that removes
 * the margins a screenshot would otherwise include, a box that is exactly the
 * profile's size so capturing the viewport captures the stage and nothing else,
 * and the stage's own stylesheet after both so it can override either.
 *
 * The document is loaded through `setContent` rather than served over HTTP,
 * which is what lets a scripted scene run with no server, no port and no build:
 * there is nothing to serve, because the recorder is what draws it.
 *
 * @param css - The stage's stylesheet.
 * @param profile - The presentation target being composed for.
 * @returns A complete HTML document.
 */
export function stageDocument(css: string, profile: MediaProfile): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>stage</title>
<style>
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; width: ${profile.width}px; height: ${profile.height}px; overflow: hidden; }
#${STAGE_ELEMENT_ID} { width: ${profile.width}px; height: ${profile.height}px; overflow: hidden; position: relative; }
</style>
<style>
${css}
</style>
</head>
<body><div id="${STAGE_ELEMENT_ID}"></div></body>
</html>`
}
