import type { Rule } from 'eslint'
import type { JSONNode } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname, join } from 'node:path'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { readJsonFileIfExists, readProjectJson } from '../utils'

/**
 * Rule identifier for the deploy-static-headers rule.
 */
export const RULE_NAME = 'deploy-static-headers'

/** Directory a bundler copies verbatim to the served root. */
const PUBLIC_DIRECTORY = 'public'

/** Filename a served artifact carries its own header policy in. */
const SERVE_CONFIG_FILENAME = 'hf-serve.config.json'

/** Deploy kind whose artifact answers requests through `hf serve`. */
const STATIC_KIND = 'static'

/** Header the framing policy is declared in, lowercased for comparison. */
const CSP_HEADER = 'content-security-policy'

/** Directive naming who may embed the artifact. */
const FRAME_ANCESTORS = 'frame-ancestors'

/** Source expression that would let any origin frame the artifact. */
const ANY_SOURCE = '*'

/** One ordered header rule from an `hf-serve.config.json`. */
interface ServeHeaderRule {
  /** Path prefix the rule applies under; matches everything when omitted. */
  prefix?: string
  /** Path suffix the rule applies to; matches everything when omitted. */
  suffix?: string
  /** Header names mapped to the values the rule sets. */
  headers?: Record<string, string>
}

/** The subset of an `hf-serve.config.json` this rule reads. */
interface ServeConfig {
  /** Ordered header rules, later rules overriding earlier ones per header. */
  headers?: ServeHeaderRule[]
}

/**
 * Reads a project's declared deploy kind.
 *
 * @param projectJson - The parsed project.json.
 * @returns The deploy kind, or `null` when the project declares no deployment.
 */
function deployKind(projectJson: Record<string, unknown>): string | null {
  const metadata = projectJson['metadata']
  if (typeof metadata !== 'object' || metadata === null) {
    return null
  }
  const deploy = (metadata as Record<string, unknown>)['deploy']
  if (typeof deploy !== 'object' || deploy === null) {
    return null
  }
  const kind = (deploy as Record<string, unknown>)['kind']
  return typeof kind === 'string' ? kind : null
}

/**
 * Finds the header rule that applies to every path, which is the one that has
 * to carry the artifact's framing policy: a rule bounded by a prefix or suffix
 * leaves the rest of the origin uncovered.
 *
 * @param config - The parsed serve config.
 * @returns The unbounded rule, or `null` when every rule is bounded.
 */
function unboundedRule(config: ServeConfig): ServeHeaderRule | null {
  return config.headers?.find((rule) => rule.prefix === undefined && rule.suffix === undefined) ?? null
}

/**
 * Reads a rule's `Content-Security-Policy` value, matching the header name
 * case-insensitively because `hf serve` compares it that way at request time.
 *
 * @param rule - The header rule to read.
 * @returns The policy value, or `null` when the rule sets no policy.
 */
function contentSecurityPolicy(rule: ServeHeaderRule): string | null {
  return entries(rule.headers ?? {}).find(([name]) => name.toLowerCase() === CSP_HEADER)?.[1] ?? null
}

/**
 * Extracts the source expressions of a policy's `frame-ancestors` directive.
 *
 * @param policy - The `Content-Security-Policy` value.
 * @returns The declared sources, or `null` when the directive is absent.
 */
function frameAncestorSources(policy: string): string[] | null {
  for (const directive of policy.split(';')) {
    const tokens = directive.split(' ').filter((token) => token.length > 0)
    if (tokens[0]?.toLowerCase() === FRAME_ANCESTORS) {
      return tokens.slice(1)
    }
  }
  return null
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require statically deployed projects to ship an hf-serve.config.json declaring who may frame them',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/deploy-static-headers.md',
    },
    schema: [],
    messages: {
      missingServeConfig:
        "Project '{{ projectName }}' deploys as a static site but ships no {{ configPath }}. Without it every origin on the internet may frame it.",
      missingFrameAncestors:
        "'{{ configPath }}' declares no unbounded Content-Security-Policy with a {{ directive }} directive, so paths outside its prefixed rules are framable by any origin.",
      permissiveFrameAncestors: "'{{ configPath }}' declares '{{ directive }} *', which permits every origin and defeats the policy.",
    },
  },

  create(context) {
    const projectRoot = dirname(context.filename)
    const projectJson = readProjectJson(projectRoot)

    // why: the linted file is the project.json being read
    if (!projectJson) {
      return {}
    }

    if (deployKind(projectJson) !== STATIC_KIND) {
      return {}
    }

    const configPath = join(PUBLIC_DIRECTORY, SERVE_CONFIG_FILENAME)
    const config = readJsonFileIfExists<ServeConfig>(join(projectRoot, PUBLIC_DIRECTORY, SERVE_CONFIG_FILENAME))

    return {
      'Program:exit'(node: JSONNode) {
        const report = (messageId: string, data: Record<string, string>): void => {
          context.report({ node: node as unknown as Rule.Node, messageId, data })
        }

        if (config === null) {
          report('missingServeConfig', { projectName: String(projectJson['name'] ?? dirname(context.filename)), configPath })
          return
        }

        const unbounded = unboundedRule(config)
        const policy = unbounded === null ? null : contentSecurityPolicy(unbounded)
        const sources = policy === null ? null : frameAncestorSources(policy)

        if (sources === null || sources.length === 0) {
          report('missingFrameAncestors', { configPath, directive: FRAME_ANCESTORS })
          return
        }

        if (sources.includes(ANY_SOURCE)) {
          report('permissiveFrameAncestors', { configPath, directive: FRAME_ANCESTORS })
        }
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
