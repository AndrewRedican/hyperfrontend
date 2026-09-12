import type { MediaProfile, ProfileRef } from '../models/profile'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'

/**
 * The presentation targets a scene can be composed for.
 *
 * Both are sixteen by nine so that one scene reads the same way at either
 * size and only its density changes, and both are stated at the width the
 * asset is displayed at rather than something larger that would have to be
 * resampled to arrive. A GIF holds 256 colours and no subpixel information, so
 * a frame that is scaled by anything other than a whole number arrives as
 * dithered mush wherever it carries text, which is most of what this records.
 *
 * The widths themselves come from where the assets are embedded rather than
 * from a preference. npm renders a package readme in a column a little over
 * 640 pixels wide, and every readme here embeds its showcase at exactly that
 * width, on GitHub and on the documentation site as well as on npm. So a
 * package scene is composed at 640 and never resampled anywhere it appears,
 * and a stage's type is sized for being read at that width. The wide profile
 * remains for a scene embedded somewhere that gives it the room, such as a
 * guide whose column peaks a little over 900.
 */
const BUILT_IN: readonly MediaProfile[] = [
  {
    id: 'compact',
    intent: 'the width every package readme is displayed at: npm, GitHub and the documentation site alike',
    width: 640,
    height: 360,
    scale: 2,
    fps: 12,
  },
  {
    id: 'docs-wide',
    intent: "the documentation site's content column on a laptop or desktop",
    width: 928,
    height: 522,
    scale: 2,
    fps: 12,
  },
]

/**
 * Resolve what a scene said about its size into a profile.
 *
 * @param ref - A built-in profile name, or a profile written out in full.
 * @returns The profile the scene will be composed against.
 * @throws {Error} When the name matches no built-in profile.
 */
export function resolveProfile(ref: ProfileRef): MediaProfile {
  if (typeof ref !== 'string') {
    return ref
  }
  const found = BUILT_IN.find((profile) => profile.id === ref)
  if (found === undefined) {
    throw createError(`No media profile named "${ref}". Built-in profiles: ${BUILT_IN.map((profile) => profile.id).join(', ')}`)
  }
  return found
}

/**
 * Every built-in profile, for a command that lists them.
 *
 * @returns The built-in profiles, in the order they are documented.
 */
export function listProfiles(): readonly MediaProfile[] {
  return BUILT_IN
}
