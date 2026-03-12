/**
 * Changelog Serialization to JSON
 *
 * Converts a Changelog object to JSON format.
 * Useful for storing changelogs in databases or APIs.
 */

import type { Changelog } from '../models/changelog'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'

/**
 * JSON serialization options.
 */
export interface JsonSerializeOptions {
  /** Pretty print with indentation */
  readonly pretty?: boolean

  /** Indentation size (for pretty printing) */
  readonly indent?: number

  /** Include source path in output */
  readonly includeSource?: boolean

  /** Include metadata in output */
  readonly includeMetadata?: boolean

  /** Include empty arrays */
  readonly includeEmptyArrays?: boolean
}

/**
 * Default JSON serialization options.
 */
export const DEFAULT_JSON_OPTIONS: Required<JsonSerializeOptions> = {
  pretty: false,
  indent: 2,
  includeSource: false,
  includeMetadata: true,
  includeEmptyArrays: true,
}

/**
 * Resolves JSON serialization options with defaults.
 *
 * @param options - User-provided options
 * @returns Complete options with defaults applied
 */
function resolveJsonOptions(options?: JsonSerializeOptions): Required<JsonSerializeOptions> {
  if (!options) {
    return DEFAULT_JSON_OPTIONS
  }

  return {
    pretty: options.pretty ?? DEFAULT_JSON_OPTIONS.pretty,
    indent: options.indent ?? DEFAULT_JSON_OPTIONS.indent,
    includeSource: options.includeSource ?? DEFAULT_JSON_OPTIONS.includeSource,
    includeMetadata: options.includeMetadata ?? DEFAULT_JSON_OPTIONS.includeMetadata,
    includeEmptyArrays: options.includeEmptyArrays ?? DEFAULT_JSON_OPTIONS.includeEmptyArrays,
  }
}

/**
 * Serializes a Changelog object to JSON string.
 *
 * @param changelog - The changelog object to convert to JSON
 * @param options - Optional JSON serialization options
 * @returns The JSON string representation
 *
 * @example
 * ```ts
 * const json = serializeChangelogToJson(changelog)
 * ```
 *
 * @example
 * ```ts
 * const json = serializeChangelogToJson(changelog, {
 *   pretty: true,
 *   indent: 4,
 * })
 * ```
 */
export function serializeChangelogToJson(changelog: Changelog, options?: JsonSerializeOptions): string {
  const opts = resolveJsonOptions(options)
  const data = toJsonObject(changelog, opts)

  if (opts.pretty) {
    return stringify(data, null, opts.indent)
  }

  return stringify(data)
}

/**
 * Converts a Changelog to a plain JSON-serializable object.
 * Useful when you need the object itself rather than a string.
 *
 * @param changelog - The changelog to convert
 * @param options - Optional JSON serialization options
 * @returns A plain object suitable for JSON serialization
 */
export function toJsonObject(changelog: Changelog, options?: JsonSerializeOptions): Record<string, unknown> {
  const opts = resolveJsonOptions(options)
  const result: Record<string, unknown> = {}

  // Source
  if (opts.includeSource && changelog.source) {
    result['source'] = changelog.source
  }

  // Header
  result['header'] = {
    title: changelog.header.title,
    description: filterEmpty(changelog.header.description, opts.includeEmptyArrays),
    links: filterEmpty(
      changelog.header.links.map((link) => ({
        label: link.label,
        url: link.url,
      })),
      opts.includeEmptyArrays
    ),
  }

  // Entries
  result['entries'] = changelog.entries.map((entry) => {
    const entryObj: Record<string, unknown> = {
      version: entry.version,
      date: entry.date,
      unreleased: entry.unreleased,
    }

    if (entry.compareUrl) {
      entryObj['compareUrl'] = entry.compareUrl
    }

    entryObj['sections'] = entry.sections.map((section) => ({
      type: section.type,
      heading: section.heading,
      items: section.items.map((item) => {
        const itemObj: Record<string, unknown> = {
          description: item.description,
          breaking: item.breaking,
        }

        if (item.scope) {
          itemObj['scope'] = item.scope
        }

        itemObj['commits'] = filterEmpty(
          item.commits.map((commit) => {
            const commitObj: Record<string, unknown> = {
              hash: commit.hash,
              shortHash: commit.shortHash,
            }
            if (commit.url) {
              commitObj['url'] = commit.url
            }
            return commitObj
          }),
          opts.includeEmptyArrays
        )

        itemObj['references'] = filterEmpty(
          item.references.map((ref) => {
            const refObj: Record<string, unknown> = {
              number: ref.number,
              type: ref.type,
            }
            if (ref.url) {
              refObj['url'] = ref.url
            }
            return refObj
          }),
          opts.includeEmptyArrays
        )

        return itemObj
      }),
    }))

    if (entry.rawContent) {
      entryObj['rawContent'] = entry.rawContent
    }

    return entryObj
  })

  // Metadata
  if (opts.includeMetadata) {
    const metadataObj: Record<string, unknown> = {
      format: changelog.metadata.format,
      isConventional: changelog.metadata.isConventional,
    }

    if (changelog.metadata.repositoryUrl) {
      metadataObj['repositoryUrl'] = changelog.metadata.repositoryUrl
    }

    if (changelog.metadata.packageName) {
      metadataObj['packageName'] = changelog.metadata.packageName
    }

    metadataObj['warnings'] = filterEmpty(changelog.metadata.warnings, opts.includeEmptyArrays)

    result['metadata'] = metadataObj
  }

  return result
}

/**
 * Filters out empty arrays if includeEmptyArrays is false.
 *
 * @param arr - The array to filter
 * @param includeEmpty - Whether to include empty arrays
 * @returns The array or undefined if empty and not including empty arrays
 */
function filterEmpty<T>(arr: readonly T[] | undefined, includeEmpty: boolean): readonly T[] | undefined {
  if (!arr) return includeEmpty ? [] : undefined
  if (arr.length === 0 && !includeEmpty) return undefined
  return arr
}
