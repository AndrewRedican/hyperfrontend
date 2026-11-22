/**
 * A project deployed as a static site ships a `public/hf-serve.config.json` that `hf serve` loads,
 * whose header rules leave no path framable by every origin, and whose policy fields the installed
 * `@hyperfrontend/features` release reads.
 *
 * @module rules/workspace/deploy-static-headers
 */

import type { JsonTreeNode } from '@hyperfrontend/linter'
import type { HeaderPolicy, ServeHeaderRule } from '@hyperfrontend/server/policy'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { defineRule } from '@hyperfrontend/linter'
import { propertyOf, rootObject, wholeDocument } from '@hyperfrontend/linter/helpers'
import { checkServeConfig, expandHeaderPolicy, frameAncestorsOf, matchesEveryPath, permitsEveryOrigin } from '@hyperfrontend/server/policy'
import { lt } from '@hyperfrontend/versioning/semver/compare'
import { parseVersion, parseVersionStrict } from '@hyperfrontend/versioning/semver/parse'
import { installedRelease } from './shared/installed-release.ts'

/** A rule's policy header, placed among the rules its author wrote. */
interface AuthoredPolicy {
  /** The header's value. */
  readonly value: string
  /** Where the rule sits in the config's `headers`; negative for a rule a declared field expands into. */
  readonly index: number
  /** Whether the rule applies to every path. */
  readonly unbounded: boolean
}

const CONFIG_PATH = 'public/hf-serve.config.json'
const DIRECTIVE = 'frame-ancestors'
const POLICY_HEADER = 'content-security-policy'
const PACKAGE = '@hyperfrontend/features'
const POLICY_FIELDS = ['embedders', 'permissionsPolicy'] as const

// why: 0.12.2 loads a config that declares either policy field and sends nothing for it; reading them arrives as a feature, so in the next minor release. A prerelease of that release orders before it and is held to be older, since nothing says which of its builds reads the fields.
const FIRST_RELEASE_READING_POLICY_FIELDS = '0.13.0'

const MISSING = `'${CONFIG_PATH}' declares neither "embedders" nor an unbounded Content-Security-Policy with a ${DIRECTIVE} directive, so paths outside its bounded rules are framable by any origin.`

/**
 * The value a rule leaves in the policy header.
 *
 * @param rule - One entry of the expanded headers
 * @returns The value, or undefined when the rule does not set the header
 */
function policyOf(rule: ServeHeaderRule): string | undefined {
  // why: the server keeps one spelling of a header, so the last one a rule writes is the value it sends.
  return keys(rule.headers)
    .filter((name) => name.toLowerCase() === POLICY_HEADER)
    .map((name) => rule.headers[name])
    .at(-1)
}

/**
 * What the header rules of a loadable config leave framable by every origin.
 *
 * @param config - What the server accepted from the file
 * @returns One message per problem, in the order of the rules
 */
function framingProblems(config: HeaderPolicy): readonly string[] {
  const rules = expandHeaderPolicy(config)
  // why: the declared fields expand into rules ahead of the authored ones, and a report names a rule by where its author wrote it.
  const expanded = rules.length - (config.headers ?? []).length
  const policies = rules.flatMap((rule, index): readonly AuthoredPolicy[] => {
    const value = policyOf(rule)
    // why: a prefix of "/" or an empty bound excludes no path, so such a rule replaces the header on the whole site like one without bounds.
    return value === undefined ? [] : [{ value, index: index - expanded, unbounded: matchesEveryPath(rule) }]
  })
  // why: a later rule replaces the whole header on the paths it matches, so the last unbounded policy is the one every path starts from.
  const base = policies.map((policy) => policy.unbounded).lastIndexOf(true)
  if (base === -1) return [MISSING]
  return policies.slice(base).flatMap((policy, position) => {
    const lists = frameAncestorsOf(policy.value)
    if (lists.length > 0) {
      // why: a browser enforces every policy of a header, so one list that names its hosts still restricts.
      return lists.every((sources) => sources.some((source) => permitsEveryOrigin(source)))
        ? [
            `'${CONFIG_PATH}' declares a ${DIRECTIVE} source that permits every origin in headers[${policy.index}], which defeats the policy.`,
          ]
        : []
    }
    return position === 0
      ? [MISSING]
      : [
          `'${CONFIG_PATH}' sets a Content-Security-Policy without a ${DIRECTIVE} directive in headers[${policy.index}], which replaces the unbounded policy on the paths that rule matches and leaves them framable by any origin.`,
        ]
  })
}

/**
 * The policy fields a config declares for a server too old to read them.
 *
 * @param config - What the server accepted from the file
 * @param directory - Where the project lives, its lock naming the installed server
 * @returns The message, or none when no field is declared or the lock installs no older release from the registry
 */
function unreadFieldProblems(config: HeaderPolicy, directory: string): readonly string[] {
  const fields = POLICY_FIELDS.filter((field) => config[field] !== undefined)
  const installed = installedRelease(directory, PACKAGE) ?? ''
  const release = parseVersion(installed).version
  if (fields.length === 0 || release === undefined || !lt(release, parseVersionStrict(FIRST_RELEASE_READING_POLICY_FIELDS))) return []
  return [
    `'${CONFIG_PATH}' declares ${fields.map((field) => `"${field}"`).join(' and ')}, which ${PACKAGE} ${installed} does not read: the policy would silently not be sent. The project's lock must install ${FIRST_RELEASE_READING_POLICY_FIELDS} or later.`,
  ]
}

/**
 * Everything wrong with a serve config that was read from disk.
 *
 * @param config - The parsed file
 * @param directory - Where the project lives
 * @returns What the server refuses, or else what its header rules leave framable and which fields the installed server ignores
 */
function configProblems(config: unknown, directory: string): readonly string[] {
  const refusals = checkServeConfig(config)
  if (refusals.length > 0) return refusals.map((issue) => `'${CONFIG_PATH}' is a config hf serve refuses to load: ${issue.message}`)
  return [...framingProblems(config as HeaderPolicy), ...unreadFieldProblems(config as HeaderPolicy, directory)]
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
        let config: unknown
        try {
          config = parse(readFileSync(join(directory, 'public', 'hf-serve.config.json'), 'utf8'))
        } catch {
          context.report({
            ...wholeDocument(context.file),
            message: `Project '${projectName}' deploys as a static site but ships no ${CONFIG_PATH}. Without it every origin on the internet may frame it.`,
          })
          return
        }
        for (const message of configProblems(config, directory)) context.report({ ...wholeDocument(context.file), message })
      },
    }
  },
})
