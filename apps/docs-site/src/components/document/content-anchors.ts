/**
 * Window event announcing that a document's heading anchors are in the DOM.
 *
 * Prose rendered from markdown arrives as HTML without ids, and the anchors
 * are attached in a client effect once it has mounted. Anything that resolves
 * headings by id therefore has nothing to find on its first pass. The
 * component that attaches them says so when it is done, which is cheaper and
 * more honest than polling until the ids appear.
 *
 * Pages whose headings are server-rendered never fire it, and never need to:
 * their anchors exist before any listener runs.
 */
export const CONTENT_ANCHORS_EVENT = 'hyperfrontend:content-anchors'
