import type { MediaProfile } from '../../src/models/profile'

/**
 * Width of the repository readme's column on GitHub, in CSS pixels.
 *
 * On a laptop or anything wider, GitHub lays the repository overview out in
 * a 1280 pixel container: 32 pixels of padding either side, a 296 pixel
 * sidebar and a 24 pixel gutter leave the main column at 896, and the readme
 * box pads its markdown by another 32 on each side. An image composed at 832
 * therefore fills the column edge to edge without being resampled, and on
 * anything narrower it scales down as one piece.
 */
const README_WIDTH = 832

/**
 * A profile for a visual embedded in the repository's root readme.
 *
 * The readme is a landing page rather than a package page, so its visuals
 * are composed a step wider than a package showcase and at whatever height
 * each one needs: a still is as tall as what it has to say, and the one
 * animation keeps sixteen by nine.
 *
 * @param height - Layout height in CSS pixels.
 * @returns The profile the scene is composed against.
 * @example The animated hero at sixteen by nine
 * ```ts
 * profile: readmeProfile(468)
 * ```
 */
export function readmeProfile(height: number): MediaProfile {
  return {
    id: 'readme',
    intent: "the repository readme on GitHub, at a laptop's width",
    width: README_WIDTH,
    height,
    scale: 2,
    fps: 12,
  }
}
