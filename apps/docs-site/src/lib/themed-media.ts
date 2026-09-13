import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/** The class the pair of images is wrapped in. */
export const THEMED_MEDIA_CLASS = 'themed-media'

/** The class on the image drawn in the light theme. */
export const THEMED_MEDIA_LIGHT_CLASS = 'themed-media__light'

/** The class on the image drawn in the dark theme. */
export const THEMED_MEDIA_DARK_CLASS = 'themed-media__dark'

/** The absolute prefix every committed media asset is published under. */
const PUBLIC_MEDIA_URL = 'https://www.hyperfrontend.dev/media/'

/** The site-relative prefix the same assets are served from. */
const LOCAL_MEDIA_PATH = '/media/'

/**
 * The committed media tree, read where it is committed rather than from the
 * copy the build mirrors under `public/`, so the swap works in development
 * before that copy exists.
 */
const MEDIA_ROOT = resolve(process.cwd(), '../..', 'assets', 'media')

/** Where a media reference points, taken apart. */
export interface MediaReference {
  /** The scene directory. */
  slug: string
  /** The filename within it, `hero.gif` for the portable animation. */
  file: string
}

/** What is known about a scene's themed variants and its drawn size. */
export interface ThemedVariants {
  /** Site-relative URL of the light variant. */
  light: string
  /** Site-relative URL of the dark variant. */
  dark: string
  /** Width the asset is displayed at, or undefined when the record does not say. */
  width: number | undefined
  /** Height the asset is displayed at, or undefined when the record does not say. */
  height: number | undefined
}

/** A drawn size, as the recorder's audit record states it. */
interface RecordedSize {
  /** Width in CSS pixels. */
  width: number
  /** Height in CSS pixels. */
  height: number
}

/** One still a variant produced, as the record names it. */
interface StillRecord {
  /** The still's filename. */
  asset: string
}

/** One theme's recording, as the record lists it. */
interface VariantRecord {
  /** The theme it was drawn in: `portable`, `dark` or `light`. */
  theme: string
  /** The animation's filename, absent for a scene that emits only stills. */
  asset?: string
  /** The stills, in the order every variant shares. */
  stills?: StillRecord[]
}

/** The fields of the recorder's audit record the site reads. */
interface AuditRecord {
  /** The presentation target a drawn scene was composed for. */
  profile?: RecordedSize
  /** The viewport a recorded application was captured at. */
  viewport?: RecordedSize
  /** Every theme the scene was recorded in. */
  variants?: VariantRecord[]
}

/** The two themed filenames that stand in for one portable file. */
interface ThemedFiles {
  /** The light theme's filename. */
  light: string
  /** The dark theme's filename. */
  dark: string
}

/**
 * Take a media URL apart, when it is one of ours.
 *
 * Both the absolute form a readme uses (so it renders on npm and GitHub) and
 * the site-relative form a guide might use are recognised; anything else is
 * somebody else's image and is left alone.
 *
 * @param src - The image's `src` as written
 * @returns The reference, or null when the URL is not a committed media asset
 *
 * @example A readme's hero
 * ```ts
 * parseMediaReference('https://www.hyperfrontend.dev/media/nexus-handshake/hero.gif')
 * // { slug: 'nexus-handshake', file: 'hero.gif' }
 * ```
 */
export function parseMediaReference(src: string): MediaReference | null {
  const path = src.startsWith(PUBLIC_MEDIA_URL)
    ? src.slice(PUBLIC_MEDIA_URL.length)
    : src.startsWith(LOCAL_MEDIA_PATH)
      ? src.slice(LOCAL_MEDIA_PATH.length)
      : null
  if (path === null) return null
  const match = /^([a-z0-9-]+)\/([a-z0-9.-]+)$/.exec(path)
  if (match === null) return null
  const [, slug = '', file = ''] = match
  return { slug, file }
}

/**
 * The themed filenames a record lists for one portable file.
 *
 * A record names the portable animation and its stills once per theme, in
 * the same order, so the light and dark counterparts of a file are the
 * entries at its position in the other two variants. A scene recorded in the
 * portable theme alone lists no other variants and offers nothing.
 *
 * @param record - The audit record beside the scene's assets
 * @param file - The portable filename as referenced
 * @returns The light and dark filenames, or null when the record has no pair for it
 */
function themedFiles(record: AuditRecord, file: string): ThemedFiles | null {
  const variants = record.variants ?? []
  const portable = variants.find((variant) => variant.theme === 'portable')
  const light = variants.find((variant) => variant.theme === 'light')
  const dark = variants.find((variant) => variant.theme === 'dark')
  if (portable === undefined || light === undefined || dark === undefined) return null
  if (portable.asset === file) {
    return light.asset !== undefined && dark.asset !== undefined ? { light: light.asset, dark: dark.asset } : null
  }
  const index = (portable.stills ?? []).findIndex((still) => still.asset === file)
  const lightStill = light.stills?.[index]?.asset
  const darkStill = dark.stills?.[index]?.asset
  return index !== -1 && lightStill !== undefined && darkStill !== undefined ? { light: lightStill, dark: darkStill } : null
}

/**
 * Look up the themed variants of a referenced asset in the scene's audit
 * record.
 *
 * The recorder writes a scene's dark and light variants beside its portable
 * one and lists all three in the record it leaves with them, so the record
 * rather than the directory says whether a file has a themed pair. A page
 * therefore never shows a themed file the recorder did not declare, and a
 * scene recorded in the portable theme alone is left as it is.
 *
 * @param reference - The asset as referenced
 * @param mediaRoot - Absolute directory the committed media tree sits in
 * @returns The variants and the drawn size, or null when the scene has no themed pair for the file
 */
export function findThemedVariants(reference: MediaReference, mediaRoot: string = MEDIA_ROOT): ThemedVariants | null {
  const sceneDir = join(mediaRoot, reference.slug)
  if (!existsSync(sceneDir)) return null
  for (const name of readdirSync(sceneDir).filter((entry) => entry.endsWith('.json'))) {
    const record = parse(readFileSync(join(sceneDir, name), 'utf8')) as AuditRecord
    const files = themedFiles(record, reference.file)
    if (files === null) continue
    const size = record.profile ?? record.viewport
    return {
      light: `${LOCAL_MEDIA_PATH}${reference.slug}/${files.light}`,
      dark: `${LOCAL_MEDIA_PATH}${reference.slug}/${files.dark}`,
      width: size?.width,
      height: size?.height,
    }
  }
  return null
}
