import type { TSESTree } from '@typescript-eslint/utils'
import type { PackageJson } from '../utils/nx-project'
import { dirname, join, resolve } from 'node:path'
import { ESLintUtils } from '@typescript-eslint/utils'
import { values } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { readJsonFileIfExists } from '../utils/fs'
import { isPublishableLibrary } from '../utils/nx-project'
import { findProjectRoot } from '../utils/workspace'

/**
 * Rule identifier for the lib-require-module-header rule.
 */
export const RULE_NAME = 'lib-require-module-header'

/**
 * Resolves an export value to a source path.
 *
 * @param exportValue - The export value from package.json (string or object).
 * @returns The resolved source path, or null if not resolvable.
 */
function resolveExportValue(exportValue: string | Record<string, string>): string | null {
  if (typeof exportValue === 'string') {
    return exportValue
  }

  if (typeof exportValue === 'object' && exportValue !== null) {
    return exportValue['import'] ?? exportValue['require'] ?? exportValue['default'] ?? null
  }

  // why: defensive: unreachable for typed string | Record input
  return null
}

/**
 * Extracts allowed entry point paths from package.json exports.
 *
 * @param projectRoot - The root directory of the project.
 * @param packageJson - The parsed package.json content.
 * @returns An array of entry point file paths.
 */
function getEntryPointPaths(projectRoot: string, packageJson: PackageJson): string[] {
  const entryPoints: string[] = []

  entryPoints.push(join(projectRoot, 'src', 'index.ts'))

  if (packageJson.exports) {
    for (const exportValue of values(packageJson.exports)) {
      const resolvedPath = resolveExportValue(exportValue)
      if (resolvedPath && !resolvedPath.endsWith('package.json')) {
        const sourcePath = resolvedPath.replace(/^\.\//, '').replace(/\.(js|cjs|mjs)$/, '.ts')
        entryPoints.push(join(projectRoot, sourcePath))
      }
    }
  }

  return entryPoints
}

/**
 * The module tag to detect in JSDoc comments.
 */
const MODULE_TAG = '@module'

/**
 * Checks if a JSDoc comment contains a module tag.
 *
 * @param comment - The comment text to check.
 * @returns True if the comment contains a module tag.
 */
function hasModuleTag(comment: string): boolean {
  const lowerComment = comment.toLowerCase()
  const index = lowerComment.indexOf(MODULE_TAG)
  if (index === -1) return false

  const charAfter = comment[index + MODULE_TAG.length]
  return charAfter === undefined || charAfter === ' ' || charAfter === '\t' || charAfter === '\n' || charAfter === '\r'
}

/**
 * Longest description that still reads as a summary rather than a document.
 *
 * Nine out of ten module headers in this workspace already sit under it, and
 * the ones that do not are the ones that stopped summarising and started
 * explaining how the module works.
 */
const DEFAULT_MAX_DESCRIPTION_LENGTH = 200

/**
 * Shortest description that can say anything. It is a floor rather than a
 * target: the substantive-word check below is what actually judges whether a
 * short description said something.
 */
const DEFAULT_MIN_DESCRIPTION_LENGTH = 24

/**
 * How many words a description must contribute beyond the module path and the
 * filler that surrounds it.
 */
const DEFAULT_MIN_SUBSTANTIVE_WORDS = 3

/**
 * Reduces a word to a form that compares equal to its plural, so a description
 * of `nx/executors` is not credited for the word `executor`.
 *
 * @param word - A raw word from a description or a module path.
 * @returns The word lowercased, stripped of punctuation, and singularised.
 */
function stem(word: string): string {
  const bare = word.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (bare.endsWith('ies') && bare.length > 4) return `${bare.slice(0, -3)}y`
  if (bare.endsWith('es') && bare.length > 4) return bare.slice(0, -2)
  if (bare.endsWith('s') && bare.length > 3) return bare.slice(0, -1)
  return bare
}

/**
 * Words that say only that something is a module, and are therefore not
 * evidence that a description described anything. Stemmed on the way in so
 * they compare against description words the same way path words do.
 */
const FILLER_WORDS = createSet(
  [
    'a',
    'an',
    'and',
    'api',
    'entry',
    'entrypoint',
    'export',
    'for',
    'from',
    'in',
    'index',
    'into',
    'it',
    'its',
    'library',
    'module',
    'of',
    'or',
    'package',
    'plus',
    'point',
    'the',
    'their',
    'this',
    'to',
    'with',
  ].map(stem)
)

/**
 * Where a JSDoc description ends and the block tags begin: the first `@tag`
 * that opens a word. An inline `{@link}` is preceded by a brace rather than by
 * whitespace, so it never matches and stays part of the description.
 */
const BLOCK_TAG = /(^|\s)@[a-zA-Z]/

/**
 * Splits text into comparable word stems.
 *
 * @param text - A description or a module path.
 * @returns Every word in it, stemmed, in order.
 */
function stemmedWords(text: string): string[] {
  return text
    .split(/[^A-Za-z0-9]+/)
    .map(stem)
    .filter((word) => word.length > 0)
}

/**
 * Extracts the human-readable description from a module header: everything
 * before the first block tag, with the comment's leading asterisks, inline
 * link syntax and line breaks removed.
 *
 * @param comment - The JSDoc comment's raw value.
 * @returns The description as one line, empty when the header opens on a tag.
 */
function moduleDescription(comment: string): string {
  const text = comment
    .split('\n')
    .map((line) => line.replace(/^\s*\*+\s?/, ''))
    .join('\n')
  const tag = BLOCK_TAG.exec(text)
  const body = tag ? text.slice(0, tag.index) : text
  return body
    .replace(/\{@link\s+([^}]+)\}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Reads the path the `@module` tag names.
 *
 * @param comment - The JSDoc comment's raw value.
 * @returns The path, or an empty string when the tag carries none.
 */
function moduleTagPath(comment: string): string {
  return /@module[ \t]+(\S+)/.exec(comment)?.[1] ?? ''
}

/**
 * Counts the words a description contributes over and above its own module
 * path and the filler every module description shares.
 *
 * @param description - The header's description.
 * @param modulePath - The path named by the `@module` tag.
 * @returns How many distinct substantive words the description carries.
 */
function substantiveWordCount(description: string, modulePath: string): number {
  const fromPath = createSet(stemmedWords(modulePath))
  const substantive = createSet(stemmedWords(description).filter((word) => !fromPath.has(word) && !FILLER_WORDS.has(word)))
  return substantive.size
}

/**
 * Configuration options for the lib-require-module-header rule.
 */
export interface RuleOptions {
  /**
   * Longest permitted description, in characters.
   *
   * @default 200
   */
  maxDescriptionLength?: number
  /**
   * Shortest permitted description, in characters.
   *
   * @default 24
   */
  minDescriptionLength?: number
  /**
   * How many words the description must carry beyond its own module path and
   * the shared filler vocabulary.
   *
   * @default 3
   */
  minSubstantiveWords?: number
}

/**
 * Message identifiers for the lib-require-module-header rule.
 */
type MessageIds =
  | 'missingModuleHeader'
  | 'missingModuleDescription'
  | 'moduleDescriptionTooLong'
  | 'moduleDescriptionTooShort'
  | 'moduleDescriptionRestatesPath'

/**
 * Creates the lib-require-module-header ESLint rule.
 */
const rule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)<[RuleOptions?], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require a short, substantive @module header at the top of entry point files in publishable libraries',
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxDescriptionLength: {
            type: 'integer',
            minimum: 1,
            description: 'Longest permitted @module description, in characters.',
          },
          minDescriptionLength: {
            type: 'integer',
            minimum: 1,
            description: 'Shortest permitted @module description, in characters.',
          },
          minSubstantiveWords: {
            type: 'integer',
            minimum: 1,
            description: 'How many words the description must carry beyond its own module path and the shared filler vocabulary.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingModuleHeader:
        'Entry point files in publishable libraries must have a @module header comment at the top of the file. Add a JSDoc comment with @module tag followed by the package path.',
      missingModuleDescription:
        'The @module header must open with a description before its tags. Say in one or two sentences what capability this module exposes.',
      moduleDescriptionTooLong:
        'The @module description is {{ actual }} characters; keep it to {{ max }}. It names what the module is responsible for, not how it works: move the walkthrough to the README or to the symbols it belongs to.',
      moduleDescriptionTooShort:
        'The @module description is {{ actual }} characters; give it at least {{ min }}. Say what capability this module exposes.',
      moduleDescriptionRestatesPath:
        'The @module description adds nothing to the module path. Say what capability "{{ module }}" exposes instead of restating its name.',
    },
  },
  defaultOptions: [
    {
      maxDescriptionLength: DEFAULT_MAX_DESCRIPTION_LENGTH,
      minDescriptionLength: DEFAULT_MIN_DESCRIPTION_LENGTH,
      minSubstantiveWords: DEFAULT_MIN_SUBSTANTIVE_WORDS,
    },
  ],
  create(context, [options]) {
    const maxDescriptionLength = options?.maxDescriptionLength ?? DEFAULT_MAX_DESCRIPTION_LENGTH
    const minDescriptionLength = options?.minDescriptionLength ?? DEFAULT_MIN_DESCRIPTION_LENGTH
    const minSubstantiveWords = options?.minSubstantiveWords ?? DEFAULT_MIN_SUBSTANTIVE_WORDS
    const filename = context.filename

    if (!filename.endsWith('/index.ts') && !filename.endsWith('\\index.ts')) {
      return {}
    }

    const fileDir = dirname(filename)
    const projectRoot = findProjectRoot(fileDir)

    if (!projectRoot || !isPublishableLibrary(projectRoot)) {
      return {}
    }

    const packageJsonPath = join(projectRoot, 'package.json')
    const packageJson = readJsonFileIfExists<PackageJson>(packageJsonPath)

    if (!packageJson) {
      return {}
    }

    const entryPointPaths = getEntryPointPaths(projectRoot, packageJson)
    const normalizedFilename = resolve(filename)

    const isEntryPoint = entryPointPaths.some((entryPath) => resolve(entryPath) === normalizedFilename)

    if (!isEntryPoint) {
      return {}
    }

    return {
      Program(node: TSESTree.Program) {
        const sourceCode = context.sourceCode
        const comments = sourceCode.getAllComments()

        if (comments.length === 0) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: { line: 1, column: 0 },
          })
          return
        }

        const firstComment = comments[0]

        // why: defensive check: unreachable when comments.length > 0
        if (!firstComment) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: { line: 1, column: 0 },
          })
          return
        }

        if (firstComment.type !== 'Block' || !firstComment.value.startsWith('*')) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: { line: 1, column: 0 },
          })
          return
        }

        if (firstComment.loc.start.line !== 1) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: { line: 1, column: 0 },
          })
          return
        }

        if (!hasModuleTag(firstComment.value)) {
          context.report({
            node,
            messageId: 'missingModuleHeader',
            loc: firstComment.loc,
          })
          return
        }

        const description = moduleDescription(firstComment.value)

        if (description.length === 0) {
          context.report({ node, messageId: 'missingModuleDescription', loc: firstComment.loc })
          return
        }

        if (description.length > maxDescriptionLength) {
          context.report({
            node,
            messageId: 'moduleDescriptionTooLong',
            loc: firstComment.loc,
            data: { actual: String(description.length), max: String(maxDescriptionLength) },
          })
          return
        }

        if (description.length < minDescriptionLength) {
          context.report({
            node,
            messageId: 'moduleDescriptionTooShort',
            loc: firstComment.loc,
            data: { actual: String(description.length), min: String(minDescriptionLength) },
          })
          return
        }

        const modulePath = moduleTagPath(firstComment.value)

        if (substantiveWordCount(description, modulePath) < minSubstantiveWords) {
          context.report({
            node,
            messageId: 'moduleDescriptionRestatesPath',
            loc: firstComment.loc,
            data: { module: modulePath },
          })
        }
      },
    }
  },
})

export default rule
