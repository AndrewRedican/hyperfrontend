/**
 * A publishable library declares where it runs in `metadata.compatibility`: the three runtimes
 * `node`, `browser` and `webWorker`, each at `full`, `partial` or `none`, with an optional note,
 * and the declaration must not contradict itself or the build.
 *
 * @module rules/workspace/lib-project-compatibility
 */

import type { JsonObjectNode, JsonPropertyNode, JsonSpan } from '@hyperfrontend/json-utils'
import type { JsonTreeNode, RuleContext } from '@hyperfrontend/linter'
import { isString, propertyOf, wholeDocument } from '@hyperfrontend/linter/helpers'
import { manifestRule } from './shared/manifest-rule.ts'

/** The runtimes a library declares. */
const RUNTIMES = ['node', 'browser', 'webWorker']

/** The support levels a runtime can be declared at. */
const LEVELS = ['full', 'partial', 'none']

/** The build formats only a browser or a CDN consumer loads. */
const BROWSER_FORMATS = ['iife', 'umd']

const MISSING_COMPATIBILITY =
  'Publishable library project.json is missing metadata.compatibility. Add: "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" } } }'
const MISSING_ENVIRONMENTS =
  'metadata.compatibility declares no environments object. Add: "environments": { "node": "full", "browser": "full", "webWorker": "full" }, using full, partial or none for each runtime.'
const INVALID_NOTE = 'metadata.compatibility.note must be a non-empty string. Write the caveat as prose, or remove the field.'
const RUNS_NOWHERE =
  'node, browser and webWorker are all declared none, so this package runs in no runtime at all. Set the runtimes it does reach to full or partial.'

/**
 * The property of an object, as a span to report on.
 *
 * @param property - The node a message anchors on
 * @returns Its start and end
 */
function spanOf(property: JsonPropertyNode): JsonSpan {
  return { start: property.start, end: property.end }
}

/**
 * The browser bundle formats a build target produces.
 *
 * @param root - The project file's root object
 * @returns The formats in configuration order
 */
function browserFormats(root: JsonObjectNode): string[] {
  const targets = propertyOf(root, 'targets')?.value
  const build = targets?.kind === 'object' ? propertyOf(targets, 'build')?.value : undefined
  const options = build?.kind === 'object' ? propertyOf(build, 'options')?.value : undefined
  if (options?.kind !== 'object') return []
  return BROWSER_FORMATS.filter((format) => propertyOf(options, format) !== null)
}

/**
 * Checks the environments object and reports every problem in it.
 *
 * @param environments - The `environments` property
 * @param root - The project file's root object
 * @param context - Where to report
 */
function checkEnvironments(environments: JsonPropertyNode, root: JsonObjectNode, context: RuleContext<undefined, JsonTreeNode>): void {
  if (environments.value.kind !== 'object') {
    context.report({ ...spanOf(environments), message: MISSING_ENVIRONMENTS })
    return
  }
  const levels: Record<string, string> = {}
  const declared: Record<string, JsonPropertyNode> = {}
  for (const property of environments.value.properties) {
    const runtime = property.key.value as string
    if (!RUNTIMES.includes(runtime)) {
      context.report({
        ...spanOf(property),
        message: `${runtime} is not a runtime this repository declares. Remove it, or rename it to one of node, browser, webWorker.`,
      })
      continue
    }
    declared[runtime] = property
    if (!isString(property.value) || !LEVELS.includes(property.value.value)) {
      context.report({
        ...spanOf(property),
        message: `metadata.compatibility.environments.${runtime} must be full, partial or none. Replace the current value with one of those three levels.`,
      })
      continue
    }
    levels[runtime] = property.value.value
  }
  const value = { start: environments.value.start, end: environments.value.end }
  for (const runtime of RUNTIMES) {
    if (declared[runtime] === undefined) {
      context.report({
        ...value,
        message: `metadata.compatibility.environments is missing ${runtime}. Declare it as full, partial or none; a runtime left out reads as unsupported wherever the compatibility row is drawn.`,
      })
    }
  }
  const worker = declared['webWorker']
  if (worker !== undefined && levels['browser'] === 'none' && (levels['webWorker'] === 'full' || levels['webWorker'] === 'partial')) {
    context.report({
      ...spanOf(worker),
      message: `webWorker is declared ${levels['webWorker']} while browser is none. A Web Worker is a browser runtime, so raise browser to the level the package really reaches, or drop webWorker to none.`,
    })
  }
  if (RUNTIMES.every((runtime) => levels[runtime] === 'none')) context.report({ ...value, message: RUNS_NOWHERE })
  const browser = declared['browser']
  const formats = browserFormats(root)
  if (browser !== undefined && levels['browser'] === 'none' && formats.length > 0) {
    context.report({
      ...spanOf(browser),
      message: `targets.build.options declares a browser bundle (${formats.join(' and ')}), which only a browser or a CDN consumer loads, while browser is none. Set browser to full or partial, or drop the bundle from the build target.`,
    })
  }
}

export default manifestRule('workspace/lib-project-compatibility', 'project.json', (root, context) => {
  const metadata = propertyOf(root, 'metadata')
  const compatibility = metadata !== null && metadata.value.kind === 'object' ? propertyOf(metadata.value, 'compatibility') : null
  if (compatibility === null) {
    context.report({ ...(metadata === null ? wholeDocument(context.file) : spanOf(metadata)), message: MISSING_COMPATIBILITY })
    return
  }
  if (compatibility.value.kind !== 'object') {
    context.report({ ...spanOf(compatibility), message: MISSING_ENVIRONMENTS })
    return
  }
  const environments = propertyOf(compatibility.value, 'environments')
  if (environments === null) context.report({ ...spanOf(compatibility), message: MISSING_ENVIRONMENTS })
  else checkEnvironments(environments, root, context)
  for (const property of compatibility.value.properties) {
    const key = property.key.value as string
    if (key === 'environments') continue
    if (key === 'note') {
      if (!isString(property.value) || property.value.value.trim() === '') context.report({ ...spanOf(property), message: INVALID_NOTE })
      continue
    }
    context.report({
      ...spanOf(property),
      message: `${key} is not a field of metadata.compatibility. Remove it; only environments and note are read.`,
    })
  }
})
