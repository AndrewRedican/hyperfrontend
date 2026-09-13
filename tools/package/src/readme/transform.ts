import type { MediaDirective } from './markers'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { parseMarkers } from './markers'

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

/** Everything the transform needs beyond the markdown itself. */
export interface TransformOptions {
  /** Absolute URL of the package's documentation landing page, with its trailing slash. */
  docsLanding: string
  /** Where the transform finds media. */
  catalog: MediaCatalog
}

/** A region's replacement, keyed by the line its start marker sits on while the document is rebuilt. */
interface PendingBlock {
  /** The region being replaced. */
  directive: MediaDirective
  /** The markdown that replaces it. */
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
  /** Each region, in document order. */
  replacements: readonly Replacement[]
}

/**
 * Resolve where a region's visual links to.
 *
 * @param docs - The directive's `docs` attribute.
 * @param landing - The package's documentation landing page.
 * @returns An absolute URL.
 */
function resolveDocs(docs: string | undefined, landing: string): string {
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
 * Produce the distribution readme from the source readme.
 *
 * The source is never changed. Every region the source marks is replaced by
 * the visual its directive names, linked to the documentation it names.
 * Everything else is copied through untouched, so the searchable text of the
 * package, its installation command and every code sample a reader might
 * copy stay exactly as the author wrote them.
 *
 * The result is a function of the source, the options and what the catalog
 * answers: the same three produce the same document, byte for byte.
 *
 * @param source - The readme as the package maintains it.
 * @param options - Where media comes from and where visuals link.
 * @returns The distribution readme and an account of what changed.
 * @throws {Error} When a directive cannot be read, or names media the catalog cannot find; nothing is produced in that case.
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
  for (const directive of directives) {
    let media: ResolvedMedia
    try {
      media = options.catalog.resolve(directive.scene, directive.asset)
    } catch (cause) {
      throw createError(
        `Region "${directive.id}" (line ${directive.startLine + 1}): ${cause instanceof Error ? cause.message : `${cause}`}`
      )
    }
    const docs = resolveDocs(directive.docs, options.docsLanding)
    const block = figure(media, docs, directive.alt)
    blocks.set(directive.startLine, { directive, block })
    replacements.push({
      id: directive.id,
      before: lines.slice(directive.startLine + 1, directive.endLine).join('\n'),
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
      index = found.directive.endLine + 1
      continue
    }
    // why: the index is bounded by the loop, so the fallback is for the type and never taken
    /* node:coverage ignore next 1 */
    output.push(lines[index] ?? '')
    index += 1
  }

  return { markdown: output.join('\n'), replacements }
}
