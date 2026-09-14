import type { MediaCatalog, ResolvedMedia } from './transform'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * The formats a stem is looked for in, animation first: a scene that recorded
 * an animation is shown moving, and a scene that emitted only a still is
 * shown as that still.
 */
const EXTENSIONS: readonly string[] = ['gif', 'webp', 'png']

/** A drawn size, as the recorder's audit record states it. */
interface RecordedSize {
  /** Width in CSS pixels. */
  width: number
  /** Height in CSS pixels. */
  height: number
}

/** The fields of the recorder's audit record the catalog reads. */
interface AuditRecord {
  /** The presentation target a drawn scene was composed for. */
  profile?: RecordedSize
  /** The viewport a recorded application was captured at. */
  viewport?: RecordedSize
}

/**
 * Read the display size of a scene's assets from the audit record beside them.
 *
 * The record beside every asset says which profile the scene was composed
 * against, and a profile's width is the width the asset is meant to be
 * displayed at: the file itself is drawn at twice that so it stays sharp on a
 * dense screen, and a readme that embedded the file's own width would show it
 * twice as large as it was composed.
 *
 * @param sceneDir - Absolute directory the scene's assets sit in.
 * @param asset - The asset's filename stem, whose own record is preferred.
 * @returns The size to embed the asset at.
 * @throws {Error} When the scene has no readable record.
 */
function readSize(sceneDir: string, asset: string): RecordedSize {
  const records = readdirSync(sceneDir).filter((name) => name.endsWith('.json'))
  const preferred = records.includes(`${asset}.json`) ? `${asset}.json` : records[0]
  if (preferred === undefined) {
    throw createError(`no audit record (.json) beside the assets in ${sceneDir}; record the scene again`)
  }
  const record = parse(readFileSync(join(sceneDir, preferred), 'utf8')) as AuditRecord
  const size = record.profile ?? record.viewport
  if (size === undefined) {
    throw createError(`${join(sceneDir, preferred)} records neither a profile nor a viewport`)
  }
  return { width: size.width, height: size.height }
}

/**
 * A catalog over the committed media tree.
 *
 * Assets are addressed the way the recorder lays them out: one directory per
 * scene under the media root, holding the scene's animation, its stills and
 * the audit record that describes them. Only the portable file of a stem is
 * ever resolved, the bare `<stem>.<extension>` with no theme suffix, because
 * a distribution readme is read on pages whose theme nobody here controls.
 * The public URL of an asset is its path under that root, appended to the
 * base URL the site serves the root at.
 *
 * @param mediaRoot - Absolute directory the recorder writes assets to.
 * @param publicBaseUrl - The URL that serves that directory, with its trailing slash.
 * @returns A catalog the transform can ask.
 * @example Locating a package's hero animation
 * ```ts
 * createMediaCatalog('/repo/assets/media', 'https://www.hyperfrontend.dev/media/').resolve('builder-manifest', 'hero')
 * // { url: 'https://www.hyperfrontend.dev/media/builder-manifest/hero.gif', width: 640, height: 360 }
 * ```
 */
export function createMediaCatalog(mediaRoot: string, publicBaseUrl: string): MediaCatalog {
  return {
    resolve(scene: string, asset: string): ResolvedMedia {
      const sceneDir = join(mediaRoot, scene)
      if (!existsSync(sceneDir)) {
        throw createError(`no scene named "${scene}" under ${mediaRoot}; record it, or correct the scene attribute`)
      }
      const file = EXTENSIONS.map((extension) => `${asset}.${extension}`).find((name) => existsSync(join(sceneDir, name)))
      if (file === undefined) {
        const wanted = EXTENSIONS.map((extension) => `${asset}.${extension}`)
        throw createError(
          `scene "${scene}" has no ${wanted.slice(0, -1).join(', ')} or ${wanted.at(-1)}; record it, or correct the asset attribute`
        )
      }
      const size = readSize(sceneDir, asset)
      return { url: `${publicBaseUrl}${scene}/${file}`, width: size.width, height: size.height }
    },
  }
}
