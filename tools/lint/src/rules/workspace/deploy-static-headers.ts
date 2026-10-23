/**
 * A project deployed as a static site ships `public/hf-serve.config.json`, and that file's
 * unbounded header rule declares a `frame-ancestors` directive that does not permit every origin.
 *
 * @module rules/workspace/deploy-static-headers
 */

import type { JsonTreeNode } from '@hyperfrontend/linter'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { defineRule } from '@hyperfrontend/linter'
import { propertyOf, rootObject, wholeDocument } from '@hyperfrontend/linter/helpers'

/** One header rule of the serve configuration. */
interface HeaderRule {
  /** The path prefix the rule applies under; every path when absent. */
  readonly prefix?: unknown
  /** The path suffix the rule applies to; every path when absent. */
  readonly suffix?: unknown
  /** The headers the rule sets. */
  readonly headers?: Readonly<Record<string, unknown>>
}

/** The serve configuration. */
interface ServeConfig {
  /** The header rules in order. */
  readonly headers?: readonly HeaderRule[]
}

const CONFIG_PATH = 'public/hf-serve.config.json'
const DIRECTIVE = 'frame-ancestors'

/**
 * The sources of the unbounded rule's `frame-ancestors` directive.
 *
 * @param directory - The project directory
 * @returns The sources, an empty list when the directive is declared with none, or null when no unbounded rule declares it
 */
function frameAncestors(directory: string): readonly string[] | null {
  const config = parse(readFileSync(join(directory, 'public', 'hf-serve.config.json'), 'utf8')) as ServeConfig
  const unbounded = config.headers?.find((rule) => rule.prefix === undefined && rule.suffix === undefined)
  const policy = entries(unbounded?.headers ?? {}).find(([name]) => name.toLowerCase() === 'content-security-policy')?.[1]
  if (typeof policy !== 'string') return null
  for (const directive of policy.split(';')) {
    const [name, ...sources] = directive.trim().split(/\s+/)
    if (name === DIRECTIVE) return sources
  }
  return null
}

export default defineRule<undefined, JsonTreeNode>({
  id: 'workspace/deploy-static-headers',
  language: 'json',
  fixable: false,
  create(context) {
    if (basename(context.file.path) !== 'project.json') return {}
    return {
      document(node) {
        const root = rootObject(node)
        if (root === null) return
        const metadata = propertyOf(root, 'metadata')?.value
        const deploy = metadata?.kind === 'object' ? propertyOf(metadata, 'deploy')?.value : undefined
        const kind = deploy?.kind === 'object' ? propertyOf(deploy, 'kind')?.value : undefined
        if (kind?.kind !== 'string' || kind.value !== 'static') return
        const name = propertyOf(root, 'name')?.value
        const projectName = name?.kind === 'string' ? name.value : ''
        const directory = dirname(context.file.path)
        let sources: readonly string[] | null
        try {
          sources = frameAncestors(directory)
        } catch {
          context.report({
            ...wholeDocument(context.file),
            message: `Project '${projectName}' deploys as a static site but ships no ${CONFIG_PATH}. Without it every origin on the internet may frame it.`,
          })
          return
        }
        if (sources === null) {
          context.report({
            ...wholeDocument(context.file),
            message: `'${CONFIG_PATH}' declares no unbounded Content-Security-Policy with a ${DIRECTIVE} directive, so paths outside its prefixed rules are framable by any origin.`,
          })
        } else if (sources.includes('*')) {
          context.report({
            ...wholeDocument(context.file),
            message: `'${CONFIG_PATH}' declares '${DIRECTIVE} *', which permits every origin and defeats the policy.`,
          })
        }
      },
    }
  },
})
