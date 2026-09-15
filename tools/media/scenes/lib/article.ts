import type { MediaProfile } from '../../src/models/profile'

/**
 * Width of the documentation site's article column, in CSS pixels.
 *
 * An article is read in a narrower frame than the documentation shell: the
 * column is 896 pixels wide at a laptop's width and carries 32 pixels of
 * padding on each side, so a figure composed at 832 fills it edge to edge
 * without being resampled on the way in.
 */
const ARTICLE_WIDTH = 832

/**
 * A profile for a figure embedded in an article on the documentation site.
 *
 * The built-in profiles are sixteen by nine because a package showcase is one
 * moving picture; an article figure is a diagram, and a diagram is as tall as
 * what it has to say. The width is the article column's, so a figure is drawn
 * once at the size it is displayed at, and the height is the scene's own.
 *
 * @param height - Layout height in CSS pixels.
 * @returns The profile the scene is composed against.
 * @example A figure a little taller than sixteen by nine
 * ```ts
 * profile: articleProfile(520)
 * ```
 */
export function articleProfile(height: number): MediaProfile {
  return {
    id: 'article',
    intent: "the documentation site's article column",
    width: ARTICLE_WIDTH,
    height,
    scale: 2,
    fps: 12,
  }
}
