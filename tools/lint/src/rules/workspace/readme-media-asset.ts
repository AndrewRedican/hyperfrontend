/**
 * README media is referenced by the absolute site URL and backed by a committed asset, since npm,
 * GitHub and the documentation site resolve relative paths three different ways. The root
 * README is never ingested by the site and is left alone, as are status badges and references
 * inside fenced code.
 *
 * @module rules/workspace/readme-media-asset
 */

import type { MarkdownNode, RuleContext } from '@hyperfrontend/linter'
import { existsSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { workspaceRootOf } from './shared/locate.ts'

/** The rule's options; the rule is inert until both are set. */
interface Options {
  /** The absolute URL prefix every media reference must start with. */
  readonly baseUrl?: string
  /** The directory, relative to the workspace root, the prefix serves. */
  readonly assetRoot?: string
}

/** A media reference as written. */
interface Reference {
  /** The URL. */
  readonly url: string
  /** The 1-based line. */
  readonly line: number
  /** The 0-based column of the URL's first occurrence on the line. */
  readonly column: number
  /** The offset of the line's first character. */
  readonly offset: number
}

/** The extensions that make a URL media. */
const MEDIA_EXTENSIONS = ['.gif', '.png', '.webp', '.jpg', '.jpeg', '.avif', '.mp4', '.webm']

/** The hosts that serve status badges, which are not project media. */
const BADGE_HOSTS = ['img.shields.io', 'shields.io', 'codecov.io', 'badgen.net']

/**
 * Whether a URL names a theme-specific variant, such as `hero.dark.gif`.
 *
 * @param url - The reference as written
 * @returns True for a dark or light variant
 */
function isThemedVariant(url: string): boolean {
  const segments = url.split('?')[0].split('/')
  const parts = segments[segments.length - 1].split('.')
  const suffix = parts.length >= 3 ? parts[parts.length - 2] : ''
  return suffix === 'dark' || suffix === 'light'
}

/**
 * The media references of a document, outside fenced code: Markdown images and HTML `src` or
 * `srcset` attributes.
 *
 * @param text - The document
 * @returns The references in document order
 */
function references(text: string): Reference[] {
  const found: Reference[] = []
  let inside = false
  let offset = 0
  text.split(/\r?\n/).forEach((line, index) => {
    if (line.trimStart().startsWith('```')) inside = !inside
    else if (!inside) {
      for (const match of [...line.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g), ...line.matchAll(/(?:src|srcset)=["']([^"']+)["']/g)]) {
        const url = match[1].trim()
        found.push({ url, line: index + 1, column: line.indexOf(url), offset })
      }
    }
    offset += line.length + 1
  })
  return found
}

export default defineRule<Options | undefined, MarkdownNode>({
  id: 'workspace/readme-media-asset',
  language: 'markdown',
  fixable: false,
  create(context: RuleContext<Options | undefined, MarkdownNode>) {
    const baseUrl = context.options?.baseUrl ?? ''
    const assetRoot = context.options?.assetRoot ?? ''
    const path = context.file.path
    const workspaceRoot = workspaceRootOf(dirname(path))
    if (baseUrl === '' || assetRoot === '' || basename(path) !== 'README.md' || workspaceRoot === null || dirname(path) === workspaceRoot)
      return {}
    return {
      root() {
        for (const reference of references(context.file.text)) {
          const { url } = reference
          const file = url.split('?')[0].toLowerCase()
          if (BADGE_HOSTS.some((host) => url.includes(host)) || !MEDIA_EXTENSIONS.some((extension) => file.endsWith(extension))) continue
          const where = {
            start: reference.offset + reference.column,
            at: { line: reference.line, column: reference.column, endLine: reference.line, endColumn: reference.column + url.length },
          }
          if (!url.startsWith(baseUrl)) {
            context.report({
              ...where,
              message: `README media must use the absolute ${baseUrl} URL so it renders on npm, on GitHub and on the docs site. Found: ${url}`,
            })
          } else if (isThemedVariant(url)) {
            context.report({
              ...where,
              message: `README media must reference the portable file; ${url} is a theme-specific variant the documentation site swaps in for itself.`,
            })
          } else {
            const asset = join(workspaceRoot, assetRoot, url.slice(baseUrl.length).split('?')[0])
            if (!existsSync(asset))
              context.report({ ...where, message: `No committed asset at ${asset}. Record it before referencing it, or correct the URL.` })
          }
        }
      },
    }
  },
})
