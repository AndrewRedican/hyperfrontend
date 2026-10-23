/**
 * A plugin's manifest declares the package group its migrations move together with versions that
 * are valid semver or one of the allowed version strings, and each member of a listed group names
 * its version.
 *
 * @module rules/projects/plugin-manifests
 */

import type { JsonNode, JsonObjectNode } from '@hyperfrontend/json-utils'
import type { JsonTreeNode } from '@hyperfrontend/linter'
import { basename } from 'node:path'
import { defineRule } from '@hyperfrontend/linter'
import { propertyOf, rootObject } from '@hyperfrontend/linter/helpers'
import { parseVersionStrict } from '@hyperfrontend/versioning/semver'

/** The rule's options. */
export interface PluginManifestsOptions {
  /** Version strings accepted beside valid semver. */
  readonly allowedVersionStrings?: readonly string[]
}

/** The keys a manifest's migrations settings may sit under. */
const MIGRATION_KEYS = ['nx-migrations', 'ng-update', 'migrations']

/** The version strings accepted when none are configured. */
const DEFAULT_ALLOWED = ['*', 'latest', 'next']

/**
 * Whether a text is a valid semver version, as `semver.valid` reads it: surrounding space and a
 * leading `v` allowed.
 *
 * @param text - A version string from the package group
 * @returns Whether it is a version
 */
function isVersion(text: string): boolean {
  try {
    parseVersionStrict(text.trim().replace(/^v/, ''))
    return true
  } catch {
    return false
  }
}

export default defineRule<PluginManifestsOptions | undefined, JsonTreeNode>({
  id: 'projects/plugin-manifests',
  language: 'json',
  fixable: false,
  create(context) {
    if (basename(context.file.path) !== 'package.json') return {}
    const allowed = context.options?.allowedVersionStrings ?? DEFAULT_ALLOWED
    const versionProblem = (node: JsonNode, key: string): void => {
      const valid = node.kind === 'string' && (isVersion(node.value as string) || allowed.includes(node.value as string))
      if (!valid) context.report({ start: node.start, end: node.end, message: `${key}: Version should be a valid semver` })
    }
    return {
      document(node) {
        const manifest = rootObject(node)
        if (manifest === null) return
        const migrations = manifest.properties.find(
          (property) => MIGRATION_KEYS.includes(property.key.value as string) && property.value.kind === 'object'
        )
        const group = migrations === undefined ? null : propertyOf(migrations.value as JsonObjectNode, 'packageGroup')
        if (group === null) return
        if (group.value.kind === 'array') {
          for (const member of group.value.elements) {
            if (member.kind !== 'object') continue
            const version = propertyOf(member, 'version')
            const name = propertyOf(member, 'package')?.value
            const key = name !== undefined && name.kind === 'string' ? (name.value as string) : 'unknown'
            if (version === null)
              context.report({ start: member.start, end: member.end, message: `${key}: Missing required property - \`version\`` })
            else versionProblem(version.value, key)
          }
        } else if (group.value.kind === 'object') {
          for (const property of group.value.properties) versionProblem(property.value, property.key.value as string)
        }
      },
    }
  },
})
