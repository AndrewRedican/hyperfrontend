import type { Rule } from 'eslint'
import type { JSONNode, JSONObjectExpression, JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname } from 'node:path'
import { isPublishableLibrary } from '../utils'

/**
 * Rule identifier for the lib-project-compatibility rule.
 */
export const RULE_NAME = 'lib-project-compatibility'

/** The runtimes a compatibility block must cover, in the order the docs site draws them. */
const ENVIRONMENT_IDS = ['node', 'browser', 'webWorker'] as const

/** The levels a runtime may be declared at. */
const SUPPORT_LEVELS = ['full', 'partial', 'none'] as const

/** The build options whose output only a browser or a CDN consumer loads. */
const BROWSER_BUNDLE_FORMATS = ['iife', 'umd'] as const

/**
 * One of the runtimes a compatibility block reports on.
 */
type EnvironmentId = (typeof ENVIRONMENT_IDS)[number]

/**
 * One of the levels a runtime may be declared at.
 */
type SupportLevel = (typeof SUPPORT_LEVELS)[number]

/**
 * A runtime declaration that parsed cleanly.
 */
interface DeclaredEnvironment {
  /** The level the runtime was declared at */
  level: SupportLevel
  /** The property the declaration came from, so a contradiction can be anchored on it */
  node: JSONProperty
}

/**
 * Every runtime that parsed cleanly, keyed by runtime id. A runtime that was
 * absent or carried an unusable value is missing from the record, which is how
 * the contradiction checks know they have nothing trustworthy to compare.
 */
type EnvironmentReading = Partial<Record<EnvironmentId, DeclaredEnvironment>>

/**
 * Read a JSON property key as text.
 *
 * Keys are quoted strings in the project.json files this rule reads, but an
 * unquoted or numeric key still gets a name so a report can quote it back.
 *
 * @param property - The property whose key is wanted.
 * @returns The key as text.
 */
function getKeyName(property: JSONProperty): string {
  const key = property.key
  if (key.type === 'JSONIdentifier') {
    return key.name
  }
  return typeof key.value === 'string' ? key.value : key.raw
}

/**
 * Find a property of a JSON object by key.
 *
 * @param object - The object to search.
 * @param name - The key to look for.
 * @returns The property, or undefined when the object does not carry it.
 */
function findProperty(object: JSONObjectExpression, name: string): JSONProperty | undefined {
  return object.properties.find((property) => getKeyName(property) === name)
}

/**
 * Narrow a property's value to an object.
 *
 * @param property - The property, when the parent carries one.
 * @returns The object the property holds, or null when it holds anything else.
 */
function asObject(property: JSONProperty | null | undefined): JSONObjectExpression | null {
  if (!property) {
    return null
  }
  return property.value.type === 'JSONObjectExpression' ? property.value : null
}

/**
 * Find a nested object one key below another object.
 *
 * @param parent - The object to search, when there is one.
 * @param name - The key the nested object sits under.
 * @returns The nested object, or null when the path does not lead to one.
 */
function findChildObject(parent: JSONObjectExpression | null, name: string): JSONObjectExpression | null {
  if (!parent) {
    return null
  }
  return asObject(findProperty(parent, name))
}

/**
 * Read a property's value as a string.
 *
 * @param property - The property to read.
 * @returns The string it holds, or null when it holds anything else.
 */
function getStringValue(property: JSONProperty): string | null {
  const value = property.value
  return value.type === 'JSONLiteral' && typeof value.value === 'string' ? value.value : null
}

/**
 * Narrow a declared value to a support level.
 *
 * @param value - The declared value, as text.
 * @returns The level, or null when the value names no level this repository uses.
 */
function toSupportLevel(value: string | null): SupportLevel | null {
  return SUPPORT_LEVELS.find((level) => level === value) ?? null
}

/**
 * Decide whether a build option configures a bundle.
 *
 * The option is written either as one bundle or as a list of them, so both
 * shapes count, and an empty list configures nothing.
 *
 * @param property - The iife or umd option, when the build target carries one.
 * @returns True when the option configures at least one bundle.
 */
function declaresBundle(property: JSONProperty | undefined): boolean {
  if (!property) {
    return false
  }
  const value = property.value
  if (value.type === 'JSONObjectExpression') {
    return true
  }
  return value.type === 'JSONArrayExpression' && value.elements.length > 0
}

/**
 * Collect the browser bundle formats the build target produces.
 *
 * @param targetsProperty - The top-level targets property, when the file has one.
 * @returns The declared browser bundle formats, in configuration order.
 */
function readBrowserBundleFormats(targetsProperty: JSONProperty | null): string[] {
  const build = findChildObject(asObject(targetsProperty), 'build')
  const options = findChildObject(build, 'options')
  if (!options) {
    return []
  }
  return BROWSER_BUNDLE_FORMATS.filter((format) => declaresBundle(findProperty(options, format)))
}

/**
 * Report the fields of a compatibility block other than its environments, and
 * anything sitting in the block that nothing reads.
 *
 * @param context - The rule context reports go to.
 * @param compatibility - The compatibility object.
 */
function reportCompatibilityFields(context: Rule.RuleContext, compatibility: JSONObjectExpression): void {
  for (const property of compatibility.properties) {
    const keyName = getKeyName(property)

    if (keyName === 'environments') {
      continue
    }

    if (keyName === 'note') {
      const note = getStringValue(property)
      if (note === null || note.trim() === '') {
        context.report({ node: property as unknown as Rule.Node, messageId: 'invalidNote' })
      }
      continue
    }

    context.report({
      node: property as unknown as Rule.Node,
      messageId: 'unknownCompatibilityKey',
      data: { key: keyName },
    })
  }
}

/**
 * Report every malformed runtime declaration and collect the ones that parsed.
 *
 * @param context - The rule context reports go to.
 * @param environments - The environments object.
 * @returns The runtimes that parsed cleanly.
 */
function readEnvironments(context: Rule.RuleContext, environments: JSONObjectExpression): EnvironmentReading {
  const reading: EnvironmentReading = {}
  const declared: EnvironmentId[] = []

  for (const property of environments.properties) {
    const keyName = getKeyName(property)
    const environment = ENVIRONMENT_IDS.find((id) => id === keyName)

    if (!environment) {
      context.report({
        node: property as unknown as Rule.Node,
        messageId: 'unknownEnvironment',
        data: { environment: keyName },
      })
      continue
    }

    declared.push(environment)
    const level = toSupportLevel(getStringValue(property))

    if (!level) {
      context.report({
        node: property as unknown as Rule.Node,
        messageId: 'invalidSupport',
        data: { environment },
      })
      continue
    }

    reading[environment] = { level, node: property }
  }

  for (const environment of ENVIRONMENT_IDS) {
    if (!declared.includes(environment)) {
      context.report({
        node: environments as unknown as Rule.Node,
        messageId: 'missingEnvironment',
        data: { environment },
      })
    }
  }

  return reading
}

/**
 * Report declarations that are each legal on their own but cannot all be true
 * at once.
 *
 * Nothing is compared until all three runtimes parsed, because a comparison
 * against a runtime that was never declared would invent a claim the file does
 * not make.
 *
 * @param context - The rule context reports go to.
 * @param reading - The runtimes that parsed cleanly.
 * @param environments - The environments object, for the report that concerns all of them.
 * @param bundleFormats - The browser bundle formats the build target produces.
 */
function reportContradictions(
  context: Rule.RuleContext,
  reading: EnvironmentReading,
  environments: JSONObjectExpression,
  bundleFormats: string[]
): void {
  const nodeRuntime = reading.node
  const browser = reading.browser
  const webWorker = reading.webWorker

  if (!nodeRuntime || !browser || !webWorker) {
    return
  }

  if (browser.level === 'none' && nodeRuntime.level === 'none' && webWorker.level === 'none') {
    context.report({ node: environments as unknown as Rule.Node, messageId: 'runsNowhere' })
  }

  if (browser.level === 'none' && bundleFormats.length > 0) {
    context.report({
      node: browser.node as unknown as Rule.Node,
      messageId: 'browserBundleWithoutBrowser',
      data: { formats: bundleFormats.join(' and ') },
    })
  }

  if (browser.level === 'none' && webWorker.level !== 'none') {
    context.report({
      node: webWorker.node as unknown as Rule.Node,
      messageId: 'workerWithoutBrowser',
      data: { support: webWorker.level },
    })
  }
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Validate the metadata.compatibility block of a publishable library project.json',
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-project-compatibility.md',
    },
    schema: [],
    messages: {
      missingCompatibility:
        'Publishable library project.json is missing metadata.compatibility. Add: "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" } } }',
      missingEnvironments:
        'metadata.compatibility declares no environments object. Add: "environments": { "node": "full", "browser": "full", "webWorker": "full" }, using full, partial or none for each runtime.',
      missingEnvironment:
        'metadata.compatibility.environments is missing {{ environment }}. Declare it as full, partial or none; a runtime left out reads as unsupported wherever the compatibility row is drawn.',
      unknownEnvironment:
        '{{ environment }} is not a runtime this repository declares. Remove it, or rename it to one of node, browser, webWorker.',
      invalidSupport:
        'metadata.compatibility.environments.{{ environment }} must be full, partial or none. Replace the current value with one of those three levels.',
      invalidNote: 'metadata.compatibility.note must be a non-empty string. Write the caveat as prose, or remove the field.',
      unknownCompatibilityKey: '{{ key }} is not a field of metadata.compatibility. Remove it; only environments and note are read.',
      workerWithoutBrowser:
        'webWorker is declared {{ support }} while browser is none. A Web Worker is a browser runtime, so raise browser to the level the package really reaches, or drop webWorker to none.',
      runsNowhere:
        'node, browser and webWorker are all declared none, so this package runs in no runtime at all. Set the runtimes it does reach to full or partial.',
      browserBundleWithoutBrowser:
        'targets.build.options declares a browser bundle ({{ formats }}), which only a browser or a CDN consumer loads, while browser is none. Set browser to full or partial, or drop the bundle from the build target.',
    },
  },

  create(context) {
    const filePath = context.filename
    const projectRoot = dirname(filePath)

    // why: only publishable libraries declare compatibility; applications and internal libraries publish nothing to document
    if (!isPublishableLibrary(projectRoot)) {
      return {}
    }

    let metadataProperty: JSONProperty | null = null
    let targetsProperty: JSONProperty | null = null

    return {
      JSONProperty(node: JSONNode) {
        // why: type guard for jsonc-eslint-parser
        if (node.type !== 'JSONProperty') {
          return
        }

        const parent = node.parent
        // why: both keys also appear nested inside targets, so only the top-level object counts
        if (parent?.type !== 'JSONObjectExpression' || parent.parent?.type !== 'JSONExpressionStatement') {
          return
        }

        const keyName = getKeyName(node)

        if (keyName === 'metadata') {
          metadataProperty = node
        }

        if (keyName === 'targets') {
          targetsProperty = node
        }
      },

      'Program:exit'(programNode: JSONNode) {
        const metadata = asObject(metadataProperty)
        const compatibilityProperty = metadata ? findProperty(metadata, 'compatibility') : undefined

        if (!compatibilityProperty) {
          context.report({
            node: (metadataProperty ?? programNode) as unknown as Rule.Node,
            messageId: 'missingCompatibility',
          })
          return
        }

        const compatibility = asObject(compatibilityProperty)
        const environmentsProperty = compatibility ? findProperty(compatibility, 'environments') : undefined
        const environments = asObject(environmentsProperty)

        if (compatibility) {
          reportCompatibilityFields(context, compatibility)
        }

        if (!environments) {
          context.report({
            node: (environmentsProperty ?? compatibilityProperty) as unknown as Rule.Node,
            messageId: 'missingEnvironments',
          })
          return
        }

        const reading = readEnvironments(context, environments)
        reportContradictions(context, reading, environments, readBrowserBundleFormats(targetsProperty))
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
