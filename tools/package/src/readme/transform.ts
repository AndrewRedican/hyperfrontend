import type { MediaDirective } from './markers'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { parseMarkers } from './markers'

/** What every package's banner scene is named after, before the package's short name. */
const BANNER_SCENE_PREFIX = 'banner-'

/** The filename stem of the banner within its scene. */
const BANNER_ASSET = 'banner'

/** A media file, located and measured. */
export interface ResolvedMedia {
  /** Absolute URL the readme embeds. */
  url: string
  /** Width the image is displayed at, in CSS pixels. */
  width: number
  /** Height the image is displayed at, in CSS pixels. */
  height: number
}

/**
 * Where the transform finds the media a directive names.
 *
 * Kept behind an interface so the transform itself reads no files: what it
 * knows about an asset is what the catalog tells it, which is what makes it a
 * pure function of its inputs and testable without a media tree on disk.
 */
export interface MediaCatalog {
  /**
   * Locate the portable file of one asset of one scene.
   *
   * @param scene - The scene's slug.
   * @param asset - The asset's filename stem.
   * @returns The asset's URL and display size.
   * @throws {Error} When the scene or asset does not exist, saying which.
   */
  resolve(scene: string, asset: string): ResolvedMedia
}

/** The visual that opens a distribution readme in place of its title. */
export interface PackageBanner {
  /** The scene holding the banner. */
  scene: string
  /** The banner's filename stem within the scene. */
  asset: string
  /** The banner's alternative text. */
  alt: string
}

/** Everything the transform needs beyond the markdown itself. */
export interface TransformOptions {
  /** Absolute URL of the package's documentation landing page, with its trailing slash. */
  docsLanding: string
  /** Where the transform finds media. */
  catalog: MediaCatalog
  /** The banner that replaces the level-1 heading, or undefined to leave the heading as it is. */
  banner?: PackageBanner
}

/** A replacement, keyed by the line it starts on while the document is rebuilt. */
interface PendingBlock {
  /** Index of the last line the replacement covers. */
  endLine: number
  /** The markdown that replaces those lines. */
  block: string
}

/** What one region became. */
export interface Replacement {
  /** The region's identifier. */
  id: string
  /** The markdown the region held. */
  before: string
  /** The markdown it was replaced with. */
  after: string
  /** The asset the region now shows. */
  media: ResolvedMedia
  /** Where the visual links to. */
  docs: string
}

/** The transformed document and an account of what changed. */
export interface TransformOutcome {
  /** The distribution readme. */
  markdown: string
  /** Each replacement, in document order. */
  replacements: readonly Replacement[]
}

/**
 * The banner a package is opened with, named by convention from the package.
 *
 * Every publishable package has one banner scene, named after the package's
 * short name, holding one animation under the same stem everywhere. Nothing
 * about it is written down per package: the name is the package's own, and
 * the rest follows from it.
 *
 * @param packageName - The package's registry name.
 * @param scope - The scope the package is published under, with its trailing slash.
 * @returns The scene, stem and alternative text of the package's banner.
 * @example The banner of a scoped package
 * ```ts
 * packageBanner('@hyperfrontend/data-utils', '@hyperfrontend/')
 * // { scene: 'banner-data-utils', asset: 'banner', alt: '@hyperfrontend/data-utils' }
 * ```
 */
export function packageBanner(packageName: string, scope: string): PackageBanner {
  const short = packageName.startsWith(scope) ? packageName.slice(scope.length) : packageName
  return { scene: `${BANNER_SCENE_PREFIX}${short}`, asset: BANNER_ASSET, alt: packageName }
}

/**
 * Resolve where a region's visual links to.
 *
 * @param docs - The directive's `docs` attribute.
 * @param landing - The package's documentation landing page, with its trailing slash.
 * @returns An absolute URL.
 * @example An anchor on the landing page
 * ```ts
 * resolveDocs('#compatibility', 'https://www.hyperfrontend.dev/docs/libraries/logging/')
 * // 'https://www.hyperfrontend.dev/docs/libraries/logging/#compatibility'
 * ```
 */
export function resolveDocs(docs: string | undefined, landing: string): string {
  if (docs === undefined) {
    return landing
  }
  if (/^https?:\/\//.test(docs)) {
    return docs
  }
  if (docs.startsWith('#')) {
    return `${landing}${docs}`
  }
  return `${landing}${docs.replace(/^\/+/, '')}`
}

/**
 * Escape text for an HTML attribute.
 *
 * @param text - The text as written.
 * @returns The text with the characters HTML would misread replaced.
 */
function attribute(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * The markdown that shows one visual, linked to its documentation.
 *
 * Raw HTML rather than markdown image syntax because a centred, sized image is
 * something markdown cannot say, and every renderer a readme meets (npm,
 * GitHub, the documentation site) allows exactly this much HTML. The size is
 * stated so a page does not jump when the image arrives.
 *
 * @param media - The asset's URL and display size.
 * @param href - Where the visual links to.
 * @param alt - The visual's alternative text.
 * @returns Markdown.
 */
function figure(media: ResolvedMedia, href: string, alt: string): string {
  return [
    '<p align="center">',
    `  <a href="${attribute(href)}">`,
    `    <img width="${media.width}" height="${media.height}" src="${attribute(media.url)}" alt="${attribute(alt)}">`,
    '  </a>',
    '</p>',
  ].join('\n')
}

/**
 * Find the level-1 heading a document opens with.
 *
 * Fenced code blocks are skipped, so a `#` comment in a shell sample is never
 * mistaken for the title.
 *
 * @param lines - The document's lines.
 * @returns Index of the heading line, or -1 when the document has none.
 */
function findTitle(lines: readonly string[]): number {
  let inFence = false
  for (const [index, line] of lines.entries()) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (!inFence && line.startsWith('# ')) {
      return index
    }
  }
  return -1
}

/**
 * Locate a visual, saying which one could not be found.
 *
 * @param catalog - Where media is looked up.
 * @param scene - The scene's slug.
 * @param asset - The asset's filename stem.
 * @param subject - How the visual is named in a report.
 * @returns The asset's URL and display size.
 * @throws {Error} When the catalog cannot find it, naming the subject.
 */
function locate(catalog: MediaCatalog, scene: string, asset: string, subject: string): ResolvedMedia {
  try {
    return catalog.resolve(scene, asset)
  } catch (cause) {
    throw createError(`${subject}: ${cause instanceof Error ? cause.message : `${cause}`}`)
  }
}

/**
 * Produce the distribution readme from the source readme.
 *
 * The source is never changed. The level-1 heading becomes the package banner
 * when one is given, linked to the documentation landing page, so the readme
 * opens with the package's visual identity where a registry page would
 * otherwise repeat the name it already shows. Every region the source marks
 * is replaced by the visual its directive names, linked to the documentation
 * it names. Everything else is copied through untouched, so the searchable
 * text of the package, its installation command and every code sample a
 * reader might copy stay exactly as the author wrote them.
 *
 * The result is a function of the source, the options and what the catalog
 * answers: the same three produce the same document, byte for byte.
 *
 * @param source - The readme as the package maintains it.
 * @param options - Where media comes from, where visuals link, and the banner if any.
 * @returns The distribution readme and an account of what changed.
 * @throws {Error} When a directive cannot be read, a banner is given but the source has no level-1 heading, or a visual names media the catalog cannot find; nothing is produced in that case.
 * @example Replacing one region
 * ```ts
 * const { markdown } = transformReadme(source, { docsLanding: 'https://www.hyperfrontend.dev/docs/libraries/builder/', catalog })
 * ```
 */
export function transformReadme(source: string, options: TransformOptions): TransformOutcome {
  const { directives, problems } = parseMarkers(source)
  if (problems.length > 0) {
    const listed = problems.map((problem) => `  line ${problem.line + 1}: ${problem.reason}`).join('\n')
    throw createError(`The readme's media directives could not be read:\n${listed}`)
  }

  const lines = source.split('\n')
  const replacements: Replacement[] = []
  const blocks = createMap<number, PendingBlock>()
  if (options.banner !== undefined) {
    const title = findTitle(lines)
    if (title === -1) {
      throw createError(
        'The readme has no level-1 heading for the banner to replace; a distribution readme opens with the package banner in its place'
      )
    }
    const media = locate(options.catalog, options.banner.scene, options.banner.asset, `The banner "${options.banner.scene}"`)
    const block = figure(media, options.docsLanding, options.banner.alt)
    blocks.set(title, { endLine: title, block })
    // why: the title index was just found among the lines, so the fallback is for the type and never taken
    /* node:coverage ignore next 1 */
    const before = lines[title] ?? ''
    replacements.push({ id: BANNER_ASSET, before, after: block, media, docs: options.docsLanding })
  }
  for (const directive of directives) {
    const media = locate(options.catalog, directive.scene, directive.asset, `Region "${directive.id}" (line ${directive.startLine + 1})`)
    const docs = resolveDocs(directive.docs, options.docsLanding)
    const block = figure(media, docs, directive.alt)
    blocks.set(directive.startLine, { endLine: directive.endLine, block })
    replacements.push({
      id: directive.id,
      before: regionBody(lines, directive),
      after: block,
      media,
      docs,
    })
  }

  const output: string[] = []
  let index = 0
  while (index < lines.length) {
    const found = blocks.get(index)
    if (found !== undefined) {
      output.push(found.block)
      index = found.endLine + 1
      continue
    }
    // why: the index is bounded by the loop, so the fallback is for the type and never taken
    /* node:coverage ignore next 1 */
    output.push(lines[index] ?? '')
    index += 1
  }

  return { markdown: output.join('\n'), replacements }
}

/**
 * The markdown between a region's two markers.
 *
 * @param lines - The document's lines.
 * @param directive - The region.
 * @returns The region's own content.
 */
function regionBody(lines: readonly string[], directive: MediaDirective): string {
  return lines.slice(directive.startLine + 1, directive.endLine).join('\n')
}
