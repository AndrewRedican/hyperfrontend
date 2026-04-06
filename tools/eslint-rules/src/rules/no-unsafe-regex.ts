import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'
import safeRegex from 'safe-regex2'
import { parseInt } from '@hyperfrontend/immutable-api-utils/built-in-copy/number'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the no-unsafe-regex rule.
 */
export const RULE_NAME = 'no-unsafe-regex'

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message IDs for the no-unsafe-regex rule.
 */
type MessageIds = 'unsafeRegexPattern' | 'dynamicRegex' | 'dynamicCreateRegExp' | 'unsafeInterpolation' | 'exponentialBounds'

/**
 * Configuration options for the no-unsafe-regex rule.
 */
interface NoUnsafeRegexOptions {
  /**
   * Maximum allowed quantifier bound (default: 1000)
   */
  maxQuantifierBound?: number

  /**
   * Maximum allowed star-height / repetition limit for safe-regex2 (default: 25)
   */
  maxStarHeight?: number

  /**
   * Whether to flag dynamic RegExp construction (default: true)
   */
  flagDynamicConstruction?: boolean

  /**
   * Whether to flag template literal interpolation (default: 'warn')
   */
  flagTemplateInterpolation?: 'error' | 'warn' | 'off'

  /**
   * Additional function names to treat as RegExp constructors.
   * Default: ['createRegExp'] (to support \@hyperfrontend/immutable-api-utils)
   */
  regexpFactoryFunctions?: string[]

  /**
   * Patterns to ignore (useful for known-safe patterns)
   */
  ignorePatterns?: string[]
}

const DEFAULT_OPTIONS: Required<NoUnsafeRegexOptions> = {
  maxQuantifierBound: 1000,
  maxStarHeight: 25,
  flagDynamicConstruction: true,
  flagTemplateInterpolation: 'warn',
  regexpFactoryFunctions: ['createRegExp'],
  ignorePatterns: [],
}

/**
 * Checks if a regex pattern contains exponential bounded quantifiers.
 * Matches patterns like {1,100000} where the upper bound exceeds the threshold.
 *
 * @param pattern - The regex pattern string to analyze.
 * @param maxBound - The maximum allowed quantifier bound.
 * @returns An object indicating whether exponential bounds were found and the bound string if found.
 */
function hasExponentialBounds(
  pattern: string,
  maxBound: number
): {
  /** Whether exponential bounds were detected in the pattern. */
  found: boolean
  /** The bound string if found (e.g., "{1,100000}"). */
  bound?: string
} {
  // eslint-disable-next-line workspace/no-unsafe-regex -- This regex is safe and used for static analysis
  const quantifierRegex = /\{(\d+),(\d+)?\}/g
  let match: RegExpExecArray | null

  while ((match = quantifierRegex.exec(pattern)) !== null) {
    const upperBound = match[2]
    if (upperBound && parseInt(upperBound, 10) > maxBound) {
      return { found: true, bound: match[0] }
    }
  }

  return { found: false }
}

/**
 * Checks if a string is a safe regex pattern using safe-regex2.
 *
 * @param pattern - The regex pattern string to check.
 * @param limit - The star-height limit for safe-regex2.
 * @returns True if the pattern is potentially unsafe (ReDoS-vulnerable), false otherwise.
 */
function isUnsafePattern(pattern: string, limit: number): boolean {
  try {
    return !safeRegex(pattern, { limit })
  } catch {
    return true
  }
}

/**
 * Extracts the pattern string from a regex literal node.
 *
 * @param node - The AST literal node to extract the pattern from.
 * @returns The regex pattern string, or null if the node is not a regex literal.
 */
function getRegexPattern(node: TSESTree.Literal): string | null {
  if ('regex' in node && node.regex) {
    return node.regex.pattern
  }
  return null
}

/**
 * Checks if an argument is a string literal.
 *
 * @param node - The AST node to check.
 * @returns True if the node is a string literal.
 */
function isStringLiteral(node: TSESTree.Node): node is TSESTree.Literal {
  return node.type === AST_NODE_TYPES.Literal && typeof (<TSESTree.Literal>node).value === 'string'
}

/**
 * Checks if an argument is a template literal without expressions.
 *
 * @param node - The AST node to check.
 * @returns True if the node is a simple template literal without interpolation.
 */
function isSimpleTemplateLiteral(node: TSESTree.Node): node is TSESTree.TemplateLiteral {
  return node.type === AST_NODE_TYPES.TemplateLiteral && node.expressions.length === 0 && node.quasis.length === 1
}

/**
 * Checks if an argument is a template literal with expressions (interpolation).
 *
 * @param node - The AST node to check.
 * @returns True if the node is a template literal with interpolated expressions.
 */
function isInterpolatedTemplateLiteral(node: TSESTree.Node): node is TSESTree.TemplateLiteral {
  return node.type === AST_NODE_TYPES.TemplateLiteral && node.expressions.length > 0
}

/**
 * Gets the string value from a literal or simple template literal.
 *
 * @param node - The AST node to extract the string value from.
 * @returns The static string value, or null if the node is not a static string.
 */
function getStaticStringValue(node: TSESTree.Node): string | null {
  if (isStringLiteral(node)) {
    return String(node.value)
  }
  if (isSimpleTemplateLiteral(node)) {
    const firstQuasi = <TSESTree.TemplateElement>node.quasis[0]
    return firstQuasi.value.cooked ?? firstQuasi.value.raw
  }
  return null
}

export default createRule<[NoUnsafeRegexOptions], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow potentially dangerous regular expressions that could cause ReDoS (Regular Expression Denial of Service)',
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxQuantifierBound: {
            type: 'number',
            minimum: 1,
            description: 'Maximum allowed quantifier bound (default: 1000)',
          },
          maxStarHeight: {
            type: 'number',
            minimum: 1,
            description: 'Maximum allowed star-height / repetition limit (default: 25)',
          },
          flagDynamicConstruction: {
            type: 'boolean',
            description: 'Whether to flag dynamic RegExp construction (default: true)',
          },
          flagTemplateInterpolation: {
            type: 'string',
            enum: ['error', 'warn', 'off'],
            description: "Whether to flag template literal interpolation (default: 'warn')",
          },
          regexpFactoryFunctions: {
            type: 'array',
            items: { type: 'string' },
            description: "Additional function names to treat as RegExp constructors (default: ['createRegExp'])",
          },
          ignorePatterns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Patterns to ignore (useful for known-safe patterns)',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      unsafeRegexPattern:
        'Regex pattern may cause catastrophic backtracking (ReDoS). ' +
        'Refactor to use non-nested quantifiers, avoid overlapping alternations, or use atomic groups.',

      dynamicRegex:
        'RegExp constructed from non-literal value may be vulnerable to ReDoS if input is untrusted. ' +
        'Validate and sanitize input, or use a safe-regex library.',

      dynamicCreateRegExp:
        'createRegExp() called with non-literal value may be vulnerable to ReDoS if input is untrusted. ' +
        'Validate and sanitize input before constructing the regex pattern.',

      unsafeInterpolation:
        'Template literal in RegExp may inject unsafe patterns. ' + 'Escape special regex characters or use literal patterns.',

      exponentialBounds:
        'Quantifier bound `{{bound}}` exceeds safe threshold ({{maxBound}}). ' + 'Use smaller bounds or process input in chunks.',
    },
  },
  defaultOptions: [{}],
  create(context) {
    const options: Required<NoUnsafeRegexOptions> = {
      ...DEFAULT_OPTIONS,
      ...context.options[0],
    }

    const {
      maxQuantifierBound,
      maxStarHeight,
      flagDynamicConstruction,
      flagTemplateInterpolation,
      regexpFactoryFunctions,
      ignorePatterns,
    } = options

    const factoryFunctions = createSet(['RegExp', ...regexpFactoryFunctions])

    /**
     * Checks if a pattern should be ignored based on ignorePatterns config.
     *
     * @param pattern - The regex pattern string to check.
     * @returns True if the pattern should be ignored.
     */
    function shouldIgnore(pattern: string): boolean {
      return ignorePatterns.some((ignored) => pattern === ignored || pattern.includes(ignored))
    }

    /**
     * Analyzes a regex pattern for safety issues.
     *
     * @param pattern - The regex pattern string to analyze.
     * @param node - The AST node for error reporting.
     */
    function analyzePattern(pattern: string, node: TSESTree.Node): void {
      if (shouldIgnore(pattern)) {
        return
      }

      const boundsCheck = hasExponentialBounds(pattern, maxQuantifierBound)
      if (boundsCheck.found) {
        context.report({
          node,
          messageId: 'exponentialBounds',
          data: {
            bound: boundsCheck.bound,
            maxBound: String(maxQuantifierBound),
          },
        })
        return
      }

      if (isUnsafePattern(pattern, maxStarHeight)) {
        context.report({
          node,
          messageId: 'unsafeRegexPattern',
        })
      }
    }

    /**
     * Handles RegExp constructor or factory function calls.
     *
     * @param node - The call or new expression AST node.
     * @param isCreateRegExp - Whether this is a createRegExp factory call vs RegExp constructor.
     */
    function handleRegExpConstruction(node: TSESTree.CallExpression | TSESTree.NewExpression, isCreateRegExp: boolean): void {
      const args = node.arguments
      if (args.length === 0) {
        return
      }

      const patternArg = <TSESTree.Node>args[0]

      const staticValue = getStaticStringValue(patternArg)
      if (staticValue !== null) {
        analyzePattern(staticValue, node)
        return
      }

      if (isInterpolatedTemplateLiteral(patternArg)) {
        if (flagTemplateInterpolation !== 'off') {
          context.report({
            node,
            messageId: 'unsafeInterpolation',
          })
        }
        return
      }

      if (flagDynamicConstruction) {
        context.report({
          node,
          messageId: isCreateRegExp ? 'dynamicCreateRegExp' : 'dynamicRegex',
        })
      }
    }

    return {
      Literal(node) {
        const pattern = getRegexPattern(node)
        if (pattern !== null) {
          analyzePattern(pattern, node)
        }
      },

      CallExpression(node) {
        const callee = node.callee

        if (callee.type === AST_NODE_TYPES.Identifier && factoryFunctions.has(callee.name)) {
          const isCreateRegExp = callee.name !== 'RegExp'
          handleRegExpConstruction(node, isCreateRegExp)
        }
      },

      NewExpression(node) {
        const callee = node.callee

        if (callee.type === AST_NODE_TYPES.Identifier && callee.name === 'RegExp') {
          handleRegExpConstruction(node, false)
        }
      },
    }
  },
})
