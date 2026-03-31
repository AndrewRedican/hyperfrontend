import type { Rule } from 'eslint'
import { dirname } from 'node:path'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { isPublishableLibrary } from '../utils/nx-project'

/**
 * The expected base URL for documentation links.
 */
const DOCS_BASE_URL = createURL('https://www.hyperfrontend.dev/docs/')

/**
 * Checks if a line contains a URL that starts with the expected documentation base URL.
 * This properly parses URLs to avoid incomplete substring matching vulnerabilities.
 *
 * @param line - The line to check.
 * @returns True if the line contains a valid documentation URL.
 */
function containsValidDocumentationUrl(line: string): boolean {
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

  if (urls.length === 0) {
    return false
  }

  return urls.some((url) => {
    try {
      const parsed = createURL(url)
      return parsed.origin === DOCS_BASE_URL.origin && parsed.pathname.startsWith(DOCS_BASE_URL.pathname)
    } catch {
      return false
    }
  })
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
  level: number
  title: string
  startLine: number
  endLine: number
  content: string
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
    const line = lines[i]
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
    const currentLevel = sections[i].level
    const startLine = sections[i].startLine

    let endLine = lines.length
    for (let j = i + 1; j < sections.length; j++) {
      if (sections[j].level <= currentLevel) {
        endLine = sections[j].startLine - 1
        break
      }
    }

    sections[i].endLine = endLine
    sections[i].content = lines.slice(startLine, endLine).join('\n').trim()
  }

  return sections
}

/**
 * Extracts the badges block from the README content.
 *
 * @param content - The markdown content.
 * @returns The badges block content, or null if not found.
 */
export function extractBadgesBlock(content: string): { block: string; startLine: number; endLine: number } | null {
  const lines = content.split('\n')
  let inBadgesBlock = false
  let startLine = -1
  let endLine = -1
  const blockLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const trimmedLine = line.trim().toLowerCase()
    if (!inBadgesBlock && trimmedLine.startsWith('<p') && trimmedLine.includes('align="center"')) {
      inBadgesBlock = true
      startLine = i + 1
    }

    if (inBadgesBlock) {
      blockLines.push(line)
      if (trimmedLine.includes('</p>')) {
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim().toLowerCase()
          if (nextLine.startsWith('<p') && nextLine.includes('align="center"')) {
            continue
          }
        }
        endLine = i + 1
        break
      }
    }
  }

  if (startLine === -1) {
    return null
  }

  return { block: blockLines.join('\n'), startLine, endLine }
}

/**
 * Extracts the title from the README content.
 *
 * @param content - The markdown content.
 * @returns The title and its line number, or null if not found.
 */
export function extractTitle(content: string): { title: string; line: number } | null {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      return { title: line.slice(2).trim(), line: i + 1 }
    }
  }

  return null
}

/**
 * Extracts the short description paragraph after badges block.
 *
 * @param content - The markdown content.
 * @param badgesEndLine - The ending line of the badges block.
 * @returns The description and its line number, or null if not found.
 */
export function extractShortDescription(content: string, badgesEndLine: number): { text: string; line: number } | null {
  const lines = content.split('\n')

  for (let i = badgesEndLine; i < lines.length; i++) {
    const line = lines[i].trim()

    if (!line) {
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
 * Extracts the documentation link from the content.
 *
 * @param content - The markdown content.
 * @returns The documentation link info, or null if not found.
 */
export function extractDocumentationLink(content: string): { line: number } | null {
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.includes('•') && line.includes('👉') && line.includes('**documentation**') && containsValidDocumentationUrl(line)) {
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

        const sections = parseMarkdownSections(content)
        const level2Sections = sections.filter((s) => s.level === 2)

        const foundSections: Array<{ name: string; index: number }> = []

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
          const current = foundSections[i]
          const next = foundSections[i + 1]

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
