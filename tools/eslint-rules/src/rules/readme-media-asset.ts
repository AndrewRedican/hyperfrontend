import type { Rule } from 'eslint'
import { basename, dirname, join } from 'node:path'
import { exists } from '../utils/fs'
import { findWorkspaceRoot } from '../utils/workspace'

/**
 * Rule identifier for the readme-media-asset rule.
 */
export const RULE_NAME = 'readme-media-asset'

/**
 * File extensions treated as media rather than as an ordinary link.
 */
export const MEDIA_EXTENSIONS = ['.gif', '.png', '.webp', '.jpg', '.jpeg', '.avif', '.mp4', '.webm'] as const

/**
 * Hosts that serve status badges, which are not project media.
 */
export const BADGE_HOSTS = ['img.shields.io', 'shields.io', 'codecov.io', 'badgen.net'] as const

/**
 * Options accepted by the rule.
 */
export interface ReadmeMediaAssetOptions {
  /** Absolute URL prefix every media reference must use. */
  baseUrl?: string
  /** Directory, relative to the workspace root, that the prefix serves. */
  assetRoot?: string
}

/**
 * A media reference found in a README.
 */
export interface MediaReference {
  /** The URL as written. */
  url: string
  /** Line number the reference sits on (1-based). */
  line: number
  /** Column the URL starts at (0-based). */
  column: number
}

/**
 * Checks whether a URL points at a status badge rather than project media.
 *
 * @param url - The URL as written.
 * @returns True if the URL is served by a known badge host.
 */
export function isBadgeUrl(url: string): boolean {
  return BADGE_HOSTS.some((host) => url.includes(host))
}

/**
 * Checks whether a URL names a media file.
 *
 * @param url - The URL as written.
 * @returns True if the path ends in a known media extension.
 */
export function isMediaUrl(url: string): boolean {
  const path = url.split('?')[0] ?? ''
  return MEDIA_EXTENSIONS.some((extension) => path.toLowerCase().endsWith(extension))
}

/**
 * Finds every media reference in a README, ignoring fenced code blocks.
 *
 * Both markdown images and raw `img`/`source` tags are collected, because a
 * centered hero has to be written as HTML and an inline illustration is
 * usually written as markdown.
 *
 * @param content - The markdown content to scan.
 * @returns Every media reference, in document order.
 */
export function detectMediaReferences(content: string): MediaReference[] {
  const references: MediaReference[] = []
  const lines = content.split('\n')
  let inCodeBlock = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string

    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }

    if (inCodeBlock) {
      continue
    }

    const markdown = /!\[[^\]]*\]\(([^)]+)\)/g
    let match = markdown.exec(line)
    while (match !== null) {
      const url = (match[1] ?? '').trim()
      references.push({ url, line: i + 1, column: line.indexOf(url) })
      match = markdown.exec(line)
    }

    const html = /(?:src|srcset)=["']([^"']+)["']/g
    match = html.exec(line)
    while (match !== null) {
      const url = (match[1] ?? '').trim()
      references.push({ url, line: i + 1, column: line.indexOf(url) })
      match = html.exec(line)
    }
  }

  return references
}

/**
 * Determines if the rule should apply to this file.
 *
 * Applies to any README that is not the workspace root README. The root README
 * is never ingested by the documentation site, so its media has no second
 * surface to satisfy and it is free to reference files however it likes.
 *
 * @param filePath - The file path to check.
 * @returns True if the rule should apply.
 */
export function shouldApplyRule(filePath: string): boolean {
  if (basename(filePath) !== 'README.md') {
    return false
  }

  const workspaceRoot = findWorkspaceRoot(filePath)
  if (!workspaceRoot) {
    return false
  }

  return dirname(filePath) !== workspaceRoot
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require README media to be referenced by an absolute site URL backed by a committed asset',
      url: `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${RULE_NAME}.md`,
    },
    schema: [
      {
        type: 'object',
        properties: {
          baseUrl: { type: 'string' },
          assetRoot: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      notSiteUrl: 'README media must use the absolute {{baseUrl}} URL so it renders on npm, on GitHub and on the docs site. Found: {{url}}',
      missingAsset: 'No committed asset at {{path}}. Record it before referencing it, or correct the URL.',
    },
  },

  create(context) {
    const options = (context.options[0] ?? {}) as ReadmeMediaAssetOptions
    const baseUrl = options.baseUrl ?? ''
    const assetRoot = options.assetRoot ?? ''

    if (baseUrl === '' || assetRoot === '' || !shouldApplyRule(context.filename)) {
      return {}
    }

    const workspaceRoot = findWorkspaceRoot(context.filename)
    if (!workspaceRoot) {
      return {}
    }

    return {
      root(node: Rule.Node) {
        for (const reference of detectMediaReferences(context.sourceCode.getText())) {
          if (isBadgeUrl(reference.url) || !isMediaUrl(reference.url)) {
            continue
          }

          const loc = {
            start: { line: reference.line, column: reference.column },
            end: { line: reference.line, column: reference.column + reference.url.length },
          }

          if (!reference.url.startsWith(baseUrl)) {
            context.report({ node, loc, messageId: 'notSiteUrl', data: { baseUrl, url: reference.url } })
            continue
          }

          const relativePath = reference.url.slice(baseUrl.length).split('?')[0] ?? ''
          const assetPath = join(workspaceRoot, assetRoot, relativePath)
          if (!exists(assetPath)) {
            context.report({ node, loc, messageId: 'missingAsset', data: { path: assetPath } })
          }
        }
      },
    }
  },
}

export default rule
