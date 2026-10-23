/**
 * A buildable project's manifest declares exactly the packages its build uses: every package its
 * build inputs import is declared in a production section, at a range the installed version
 * satisfies, and nothing declared there goes unused.
 *
 * @module rules/projects/dependency-checks
 */

import type { JsonNode, JsonObjectNode, JsonPropertyNode } from '@hyperfrontend/json-utils'
import type { Fix, JsonTreeNode } from '@hyperfrontend/linter'
import { basename, dirname, join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { defineRule } from '@hyperfrontend/linter'
import { isString, rootObject } from '@hyperfrontend/linter/helpers'
import { workspaceRelativePath } from '@hyperfrontend/project-scope/core/path'
import { eq, parseRange, parseVersion, satisfies } from '@hyperfrontend/versioning/semver'
import { workspaceGraph } from '../../graph/build.ts'
import { readJson } from '../../graph/workspace.ts'
import { baseConfigRootOf } from '../workspace/shared/aliases.ts'
import { inputFiles, selfInputs, usedPackages } from './shared/dependencies.ts'

/** The rule's options. */
export interface DependencyChecksOptions {
  /** Packages never reported. */
  readonly ignoredDependencies?: readonly string[]
  /** File patterns whose imports are not counted, `{projectRoot}` standing for the project's root. */
  readonly ignoredFiles?: readonly string[]
}

/** The sections of a manifest the build installs. */
const PRODUCTION_SECTIONS = ['dependencies', 'peerDependencies', 'optionalDependencies']

/** The keys of the sections checked, in any case. */
const SECTION_KEY = /^(peer|optional)?dependencies$/i

/** A manifest's dependency sections, as far as they are read. */
interface Manifest {
  /** The runtime dependencies. */
  readonly dependencies?: Readonly<Record<string, string>>
  /** The development dependencies. */
  readonly devDependencies?: Readonly<Record<string, string>>
  /** The peer dependencies. */
  readonly peerDependencies?: Readonly<Record<string, string>>
  /** The optional dependencies. */
  readonly optionalDependencies?: Readonly<Record<string, string>>
}

/**
 * Whether an installed version satisfies a declared range; a range that does not parse is never
 * satisfied. An exact version is compared as a version, since the range parser drops its
 * prerelease identifiers.
 *
 * @param installed - The installed version
 * @param range - The declared range
 * @returns Whether it does
 */
function isSatisfied(installed: string, range: string): boolean {
  const version = parseVersion(installed).version
  if (version === undefined) return false
  const pinned = parseVersion(range).version
  if (pinned !== undefined) return eq(version, pinned)
  const parsed = parseRange(range).range
  return parsed !== undefined && satisfies(version, parsed)
}

/**
 * The key of a property.
 *
 * @param property - A dependency entry, whose key is a string literal
 * @returns The key's text
 */
function keyOf(property: JsonPropertyNode): string {
  return property.key.value as string
}

/**
 * The fix removing a property from its object together with the comma that joins it.
 *
 * @param object - The object holding it
 * @param property - The dependency entry to remove
 * @returns The fix
 */
function removal(object: JsonObjectNode, property: JsonPropertyNode): Fix {
  const { properties } = object
  const index = properties.indexOf(property)
  const last = index === properties.length - 1
  if (index > 0) {
    const shift = last ? 0 : 1
    return { start: (properties[index - 1] as JsonPropertyNode).end + shift, end: property.end + shift, text: '' }
  }
  return last ? { start: object.start + 1, end: object.end - 1, text: '' } : { start: object.start + 1, end: property.end + 1, text: '' }
}

export default defineRule<DependencyChecksOptions | undefined, JsonTreeNode>({
  id: 'projects/dependency-checks',
  language: 'json',
  fixable: true,
  create(context) {
    const path = context.file.path
    if (basename(path) !== 'package.json') return {}
    const root = baseConfigRootOf(dirname(path))
    if (root === null) return {}
    const graph = workspaceGraph(root)
    const project = graph.projectOf(workspaceRelativePath(root, path))
    if (project === null || project.configuration?.targets?.['build'] === undefined) return {}
    const ignoredDependencies = context.options?.ignoredDependencies ?? []
    const files = inputFiles(project, selfInputs(root, project, 'build'), context.options?.ignoredFiles ?? [])
    const used = usedPackages(graph, project, files)
    const expected = [...used.keys()]
    const workspaceManifest = readJson<Manifest>(join(root, 'package.json')) ?? {}
    const rootDependencies: Record<string, string> = {
      ...workspaceManifest.dependencies,
      ...workspaceManifest.devDependencies,
      ...workspaceManifest.peerDependencies,
      ...workspaceManifest.optionalDependencies,
    }
    const versionFor = (name: string): string => rootDependencies[name] || (used.get(name) as string)
    return {
      document(node) {
        const manifestObject = rootObject(node)
        if (manifestObject === null) return
        const manifest = parse(context.file.text) as Manifest
        const declared: Record<string, string> = {
          ...manifest.dependencies,
          ...manifest.peerDependencies,
          ...manifest.optionalDependencies,
        }
        checkSections(manifestObject, declared)
        for (const section of manifestObject.properties) {
          if (!SECTION_KEY.test(keyOf(section))) continue
          checkMissing(section, declared)
          if (section.value.kind !== 'object') continue
          for (const dependency of section.value.properties) checkDependency(section.value, dependency)
        }
      },
    }

    /**
     * Reports a manifest declaring no production section while its build uses packages.
     *
     * @param manifestObject - The manifest's root object
     * @param declared - The production dependencies declared, which the fix extends
     */
    function checkSections(manifestObject: JsonObjectNode, declared: Record<string, string>): void {
      if (!expected.some((name) => !ignoredDependencies.includes(name))) return
      if (manifestObject.properties.some((property) => PRODUCTION_SECTIONS.includes(keyOf(property)))) return
      for (const name of [...expected].sort()) declared[name] = versionFor(name)
      const listed = keys(declared)
        .map((name) => `\n    "${name}": "${declared[name]}"`)
        .join(',')
      const { properties } = manifestObject
      const fix: Fix =
        properties.length === 0
          ? { start: manifestObject.start, end: manifestObject.end, text: `{\n  "dependencies": {${listed}\n  }\n}` }
          : {
              start: (properties[properties.length - 1] as JsonPropertyNode).end,
              end: (properties[properties.length - 1] as JsonPropertyNode).end,
              text: `,\n  "dependencies": {${listed}\n  }`,
            }
      context.report({
        start: manifestObject.start,
        end: manifestObject.end,
        message: `Dependency sections are missing from the "package.json" but following dependencies were detected:${expected.map((name) => `\n- "${name}"`).join()}`,
        fix,
      })
    }

    /**
     * Reports, on a section, the used packages no production section declares.
     *
     * @param section - The section's property
     * @param declared - The production dependencies declared
     */
    function checkMissing(section: JsonPropertyNode, declared: Readonly<Record<string, string>>): void {
      const missing = expected.filter((name) => !declared[name] && !ignoredDependencies.includes(name))
      if (missing.length === 0) return
      const listed = missing.map((name) => `\n    "${name}": "${versionFor(name)}"`).join(',')
      const value = section.value as JsonNode
      let fix: Fix | undefined
      if (value.kind === 'object') {
        const last = value.properties[value.properties.length - 1]
        fix =
          last === undefined
            ? { start: value.end - 1, end: value.end - 1, text: `${listed}\n  ` }
            : { start: last.end, end: last.end, text: `,${listed}` }
      }
      context.report({
        start: section.start,
        end: section.end,
        message: `The "${project?.name}" project uses the following packages, but they are missing from "${keyOf(section)}":${missing.map((name) => `\n    - ${name}`).join('')}`,
        ...(fix === undefined ? {} : { fix }),
      })
    }

    /**
     * Reports a declared dependency the build does not use, or whose range the installed version misses.
     *
     * @param section - The section's object
     * @param dependency - The dependency's property
     */
    function checkDependency(section: JsonObjectNode, dependency: JsonPropertyNode): void {
      const name = keyOf(dependency)
      if (ignoredDependencies.includes(name)) return
      const installed = used.get(name)
      if (installed === undefined) {
        context.report({
          start: dependency.start,
          end: dependency.end,
          message: `The "${name}" package is not used by "${project?.name}" project.`,
          fix: removal(section, dependency),
        })
        return
      }
      if (!isString(dependency.value)) return
      const range = dependency.value.value
      if (
        installed.startsWith('file:') ||
        range.startsWith('file:') ||
        installed === '*' ||
        range === '*' ||
        range.startsWith('workspace:')
      )
        return
      if (isSatisfied(installed, range)) return
      context.report({
        start: dependency.start,
        end: dependency.end,
        message: `The version specifier does not contain the installed version of "${name}" package: ${installed}.`,
        fix: { start: dependency.start, end: dependency.end, text: `"${name}": "${rootDependencies[name] || installed}"` },
      })
    }
  },
})
