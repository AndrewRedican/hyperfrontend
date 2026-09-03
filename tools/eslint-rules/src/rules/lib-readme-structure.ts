import type { Rule } from 'eslint'
import { dirname } from 'node:path'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { isPublishableLibrary, readPackageJson } from '../utils/nx-project'

/**
 * The expected base URL for documentation links.
 */
const DOCS_BASE_URL = createURL('https://www.hyperfrontend.dev/docs/')

/**
 * The canonical package-filtered guides destination, without its query string.
 * One route serves every entry point into guides, so a README link and the
 * site's own filter controls resolve to the same view.
 */
const GUIDES_PATHNAME = '/docs/guides/'

/**
 * The query parameter naming the package a guides view is filtered to. Its
 * value is the npm package name, which the guide corpus already carries in
 * each unit's metadata, so no package-to-guide mapping is written by hand.
 */
const GUIDES_PACKAGE_PARAM = 'package'

/**
 * Collects the target URLs of every markdown link on a line.
 *
 * @param line - The line to scan.
 * @returns The link targets, in order of appearance.
 */
function extractMarkdownUrls(line: string): string[] {
  const urls: string[] = []
  let searchStart = 0

  while (true) {
    const linkStart = line.indexOf('](', searchStart)
    if (linkStart === -1) break

    const urlStart = linkStart + 2
    const urlEnd = line.indexOf(')', urlStart)
    if (urlEnd === -1) break

    urls.push(line.slice(urlStart, urlEnd))
    searchStart = urlEnd + 1
  }

  return urls
}

/**
 * Tests every markdown link on a line against a predicate, parsing each target
 * as a URL so an unparseable one is rejected rather than substring-matched.
 *
 * @param line - The line to check.
 * @param matches - Predicate applied to each parsed link target.
 * @returns True when at least one link on the line satisfies the predicate.
 */
function hasLinkMatching(line: string, matches: (url: URL) => boolean): boolean {
  return extractMarkdownUrls(line).some((url) => {
    try {
      return matches(createURL(url))
    } catch {
      return false
    }
  })
}

/**
 * Checks if a line contains a URL that starts with the expected documentation base URL.
 * This properly parses URLs to avoid incomplete substring matching vulnerabilities.
 *
 * @param line - The line to check.
 * @returns True if the line contains a valid documentation URL.
 */
function containsValidDocumentationUrl(line: string): boolean {
  return hasLinkMatching(line, (parsed) => parsed.origin === DOCS_BASE_URL.origin && parsed.pathname.startsWith(DOCS_BASE_URL.pathname))
}

/**
 * Checks if a line links to the canonical guides destination filtered to a
 * specific package.
 *
 * @param line - The line to check.
 * @param packageName - The npm package the README documents.
 * @returns True if the line carries the package-filtered guides URL.
 */
function containsPackageGuidesUrl(line: string, packageName: string): boolean {
  return hasLinkMatching(
    line,
    (parsed) =>
      parsed.origin === DOCS_BASE_URL.origin &&
      parsed.pathname === GUIDES_PATHNAME &&
      parsed.searchParams.get(GUIDES_PACKAGE_PARAM) === packageName
  )
}

/**
 * Rule identifier for the lib-readme-structure rule.
 */
export const RULE_NAME = 'lib-readme-structure'

/**
 * Required sections in order for a library README.
 */
export const REQUIRED_SECTIONS = [
  { level: 2, pattern: /^what is @hyperfrontend\//i, name: 'What is @hyperfrontend/<name>?' },
  { level: 2, pattern: /^why use @hyperfrontend\//i, name: 'Why Use @hyperfrontend/<name>?' },
  { level: 2, pattern: /^installation$/i, name: 'Installation' },
  { level: 2, pattern: /^quick start$/i, name: 'Quick Start' },
  { level: 2, pattern: /^api overview$/i, name: 'API Overview' },
  { level: 2, pattern: /^compatibility$/i, name: 'Compatibility' },
] as const

/**
 * Required subsections that should appear under specific parent sections.
 */
export const REQUIRED_SUBSECTIONS = [
  { level: 3, pattern: /^key features$/i, name: 'Key Features', parent: /^what is/i },
  { level: 3, pattern: /^architecture highlights$/i, name: 'Architecture Highlights', parent: /^what is/i },
] as const

/**
 * Required badges in the badges block.
 * Patterns are anchored to ensure they match at expected URL locations:
 * - Domain patterns match after protocol ://
 * - Path patterns match after a forward slash /
 */
export const REQUIRED_BADGES = [
  { pattern: /\/github\/actions\/workflow\/status/i, name: 'Build badge' },
  { pattern: /:\/\/codecov\.io/i, name: 'Coverage badge' },
  { pattern: /\/npm\/v\//i, name: 'npm version badge' },
  { pattern: /:\/\/bundlephobia\.com/i, name: 'Bundle size badge' },
  { pattern: /\/all-contributors/i, name: 'Contributors badge' },
  { pattern: /\/license-MIT/i, name: 'License badge' },
  { pattern: /\/npm\/dm\//i, name: 'npm downloads badge' },
  { pattern: /\/github\/stars/i, name: 'GitHub stars badge' },
  { pattern: /[/=]node-%3E%3D/i, name: 'Node version badge' },
  { pattern: /[/=]tree%20shakeable/i, name: 'Tree-shakeable badge' },
] as const

/**
 * Represents a parsed section from the README.
 */
export interface ParsedSection {
  /** Heading level (1-6) */
  level: number
  /** Section title text */
  title: string
  /** Line number where section starts (1-based) */
  startLine: number
  /** Line number where section ends (1-based) */
  endLine: number
  /** Section content excluding the heading */
  content: string
}

/**
 * Extracted badges block information.
 */
export interface BadgesBlockInfo {
  /** The badges block content */
  block: string
  /** Line number where badges start (1-based) */
  startLine: number
  /** Line number where badges end (1-based) */
  endLine: number
}

/**
 * Parses markdown content into sections.
 *
 * @param content - The markdown content to parse.
 * @returns An array of parsed sections.
 */
export function parseMarkdownSections(content: string): ParsedSection[] {
  const lines = content.split('\n')
  const sections: ParsedSection[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (line.startsWith('#')) {
      let level = 0
      while (level < line.length && level < 6 && line[level] === '#') {
        level++
      }
      if (level > 0 && level < line.length && line[level] === ' ') {
        const title = line.slice(level + 1).trim()
        sections.push({
          level,
          title,
          startLine: i + 1,
          endLine: -1,
          content: '',
        })
      }
    }
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i] as ParsedSection
    const currentLevel = section.level
    const startLine = section.startLine

    let endLine = lines.length
    for (let j = i + 1; j < sections.length; j++) {
      if ((sections[j] as ParsedSection).level <= currentLevel) {
        endLine = (sections[j] as ParsedSection).startLine - 1
        break
      }
    }

    section.endLine = endLine
    section.content = lines.slice(startLine, endLine).join('\n').trim()
  }

  return sections
}

/**
 * Reports whether a centered block holds at least one of the required badges.
 *
 * @param block - The centered paragraph's text.
 * @returns True if the block looks like the badges block.
 */
function containsAnyBadge(block: string): boolean {
  return REQUIRED_BADGES.some(({ pattern }) => pattern.test(block))
}

/**
 * Collects every centered paragraph in the README, merging adjacent ones.
 *
 * @param content - The markdown content.
 * @returns Each centered block, in document order.
 */
export function collectCenteredBlocks(content: string): BadgesBlockInfo[] {
  const lines = content.split('\n')
  const blocks: BadgesBlockInfo[] = []
  let inBlock = false
  let startLine = -1
  let blockLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string

    const trimmedLine = line.trim().toLowerCase()
    if (!inBlock && trimmedLine.startsWith('<p') && trimmedLine.includes('align="center"')) {
      inBlock = true
      startLine = i + 1
      blockLines = []
    }

    if (inBlock) {
      blockLines.push(line)
      if (trimmedLine.includes('</p>')) {
        if (i + 1 < lines.length) {
          const nextLine = (lines[i + 1] as string).trim().toLowerCase()
          if (nextLine.startsWith('<p') && nextLine.includes('align="center"')) {
            continue
          }
        }
        blocks.push({ block: blockLines.join('\n'), startLine, endLine: i + 1 })
        inBlock = false
      }
    }
  }

  return blocks
}

/**
 * Extracts the badges block from the README content.
 *
 * A README may centre other things than badges, most often a demo capture near
 * the top. Taking the first centered paragraph of any kind would treat such an
 * image as the badges block and report all ten badges as missing, so the first
 * paragraph that actually carries a badge wins. When nothing in the file looks
 * like a badge, the first centered paragraph is still returned so that a README
 * with no badges at all is reported as missing them rather than as having none.
 *
 * @param content - The markdown content.
 * @returns The badges block content, or null if not found.
 */
export function extractBadgesBlock(content: string): BadgesBlockInfo | null {
  const blocks = collectCenteredBlocks(content)
  return blocks.find((candidate) => containsAnyBadge(candidate.block)) ?? blocks[0] ?? null
}

/**
 * Extracted title information.
 */
export interface TitleInfo {
  /** The title text */
  title: string
  /** Line number where title appears (1-based) */
  line: number
}

/**
 * Extracts the title from the README content.
 *
 * @param content - The markdown content.
 * @returns The title and its line number, or null if not found.
 */
export function extractTitle(content: string): TitleInfo | null {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      return { title: line.slice(2).trim(), line: i + 1 }
    }
  }

  return null
}

/**
 * Extracted short description information.
 */
export interface DescriptionInfo {
  /** The description text */
  text: string
  /** Line number where description appears (1-based) */
  line: number
}

/**
 * Extracts the short description paragraph after badges block.
 *
 * A bare markdown image is skipped rather than adopted as the description.
 * Taking one would silently stop validating the real one-line description
 * underneath it, which is the sentence npm and the docs site both lead with.
 *
 * @param content - The markdown content.
 * @param badgesEndLine - The ending line of the badges block.
 * @returns The description and its line number, or null if not found.
 */
export function extractShortDescription(content: string, badgesEndLine: number): DescriptionInfo | null {
  const lines = content.split('\n')

  for (let i = badgesEndLine; i < lines.length; i++) {
    const line = (lines[i] as string).trim()

    if (!line) {
      continue
    }

    if (line.startsWith('![')) {
      continue
    }

    if (line.startsWith('<') && !line.startsWith('<a')) {
      continue
    }

    if (line.startsWith('#')) {
      return null
    }

    return { text: line, line: i + 1 }
  }

  return null
}

/**
 * Extracted documentation link information.
 */
export interface DocLinkInfo {
  /** Line number where link appears (1-based) */
  line: number
}

/**
 * Represents a found section entry with name and position.
 */
interface FoundSectionEntry {
  /** Section name */
  name: string
  /** Index in the sections array */
  index: number
}

/**
 * Extracts the documentation link from the content.
 *
 * @param content - The markdown content.
 * @returns The documentation link info, or null if not found.
 */
export function extractDocumentationLink(content: string): DocLinkInfo | null {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (line.includes('•') && line.includes('👉') && line.includes('**documentation**') && containsValidDocumentationUrl(line)) {
      return { line: i + 1 }
    }
  }

  return null
}

/**
 * Extracts the package-filtered guides link from the content.
 *
 * The link must survive a package having no guides yet: it points at a filter,
 * not at a list of slugs, so guides written later surface from the published
 * README without another release.
 *
 * @param content - The markdown content.
 * @param packageName - The npm package the README documents.
 * @returns The guides link info, or null if not found.
 */
export function extractGuidesLink(content: string, packageName: string): DocLinkInfo | null {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string
    if (line.includes('•') && line.includes('👉') && containsPackageGuidesUrl(line, packageName)) {
      return { line: i + 1 }
    }
  }

  return null
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure publishable library README.md files have required structure and sections',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-readme-structure.md',
    },
    schema: [],
    messages: {
      missingTitle: 'README must start with a title in format: # @hyperfrontend/<package-name>',
      invalidTitleFormat: "README title must be in format '# @hyperfrontend/<package-name>'. Found: '{{ title }}'",
      missingBadgesBlock: 'README must have a badges block with centered paragraphs (<p align="center">)',
      missingBadge: 'Missing required badge: {{ badge }}',
      missingShortDescription: 'README must have a short description paragraph after the badges block',
      emptyShortDescription: 'README short description must not be empty',
      missingDocumentationLink:
        'README must have a documentation link in format: • 👉 See [**documentation**](https://www.hyperfrontend.dev/docs/libraries/<name>/)',
      missingGuidesLink:
        'README must link its guides and tutorials in format: • 👉 See [**guides & tutorials**](https://www.hyperfrontend.dev/docs/guides/?package={{ encodedPackageName }}). The link stays valid while the package has no guides: it addresses the filter, so guides written later surface without another README change.',
      missingSection: "README must have section: '{{ section }}'",
      emptySectionContent: "README section '{{ section }}' must have content",
      sectionOutOfOrder:
        "README section '{{ section }}' should appear before '{{ before }}' (expected order: What is, Why Use, Installation, Quick Start, API Overview, Compatibility)",
      missingSubsection: "README must have subsection '{{ subsection }}' under '{{ parent }}'",
      missingKeyFeaturesList: "Key Features section must have a bullet list (lines starting with '- **')",
    },
  },

  create(context) {
    const filePath = context.filename
    const fileName = filePath.split('/').pop()

    if (fileName !== 'README.md') {
      return {}
    }

    const projectRoot = dirname(filePath)

    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    return {
      root(node: Rule.Node) {
        const sourceCode = context.sourceCode
        const content = sourceCode.getText()

        const titleInfo = extractTitle(content)
        if (!titleInfo) {
          context.report({
            node,
            messageId: 'missingTitle',
          })
        } else if (!titleInfo.title.startsWith('@hyperfrontend/') || titleInfo.title.length <= '@hyperfrontend/'.length) {
          context.report({
            node,
            messageId: 'invalidTitleFormat',
            data: { title: titleInfo.title },
          })
        }

        const badgesBlock = extractBadgesBlock(content)
        if (!badgesBlock) {
          context.report({
            node,
            messageId: 'missingBadgesBlock',
          })
        } else {
          for (const badge of REQUIRED_BADGES) {
            if (!badge.pattern.test(badgesBlock.block)) {
              context.report({
                node,
                messageId: 'missingBadge',
                data: { badge: badge.name },
              })
            }
          }
        }

        const badgesEndLine = badgesBlock?.endLine ?? 0
        const shortDescription = extractShortDescription(content, badgesEndLine)
        if (!shortDescription) {
          context.report({
            node,
            messageId: 'missingShortDescription',
          })
        } else if (!shortDescription.text.trim()) {
          context.report({
            node,
            messageId: 'emptyShortDescription',
          })
        }

        const docLink = extractDocumentationLink(content)
        if (!docLink) {
          context.report({
            node,
            messageId: 'missingDocumentationLink',
          })
        }

        // why: The package name is authoritative in package.json; the README title is prose that can drift from it
        const packageName = readPackageJson(projectRoot)?.name
        if (packageName && !extractGuidesLink(content, packageName)) {
          context.report({
            node,
            messageId: 'missingGuidesLink',
            data: { encodedPackageName: encodeURIComponent(packageName) },
          })
        }

        const sections = parseMarkdownSections(content)
        const level2Sections = sections.filter((s) => s.level === 2)

        const foundSections: FoundSectionEntry[] = []

        for (const required of REQUIRED_SECTIONS) {
          const found = level2Sections.find((s) => required.pattern.test(s.title))

          if (!found) {
            context.report({
              node,
              messageId: 'missingSection',
              data: { section: required.name },
            })
          } else {
            const index = level2Sections.indexOf(found)
            foundSections.push({ name: required.name, index })

            if (!found.content.trim()) {
              context.report({
                node,
                messageId: 'emptySectionContent',
                data: { section: required.name },
              })
            }
          }
        }

        for (let i = 0; i < foundSections.length - 1; i++) {
          const current = foundSections[i] as FoundSectionEntry
          const next = foundSections[i + 1] as FoundSectionEntry

          if (current.index > next.index) {
            context.report({
              node,
              messageId: 'sectionOutOfOrder',
              data: { section: current.name, before: next.name },
            })
          }
        }

        for (const requiredSub of REQUIRED_SUBSECTIONS) {
          const parentSection = level2Sections.find((s) => requiredSub.parent.test(s.title))

          if (parentSection) {
            const subsectionsInParent = sections.filter(
              (s) => s.level === requiredSub.level && s.startLine > parentSection.startLine && s.startLine < parentSection.endLine
            )

            const found = subsectionsInParent.some((s) => requiredSub.pattern.test(s.title))

            if (!found) {
              context.report({
                node,
                messageId: 'missingSubsection',
                data: {
                  subsection: requiredSub.name,
                  parent: parentSection.title,
                },
              })
            }

            if (requiredSub.name === 'Key Features') {
              const keyFeaturesSection = subsectionsInParent.find((s) => requiredSub.pattern.test(s.title))

              if (keyFeaturesSection) {
                const hasKeyFeaturesBullets = keyFeaturesSection.content.split('\n').some((line) => line.trimStart().startsWith('- **'))
                if (!hasKeyFeaturesBullets) {
                  context.report({
                    node,
                    messageId: 'missingKeyFeaturesList',
                  })
                }
              }
            }
          }
        }
      },
    }
  },
}

export default rule
