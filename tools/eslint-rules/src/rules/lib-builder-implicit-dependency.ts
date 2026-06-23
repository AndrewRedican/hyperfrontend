import type { Rule } from 'eslint'
import type { JSONNode, JSONObjectExpression, JSONProperty } from 'jsonc-eslint-parser/lib/parser/ast'
import { dirname } from 'node:path'
import { readProjectJson } from '../utils/nx-project'

/**
 * Rule identifier for the lib-builder-implicit-dependency rule.
 */
export const RULE_NAME = 'lib-builder-implicit-dependency'

/**
 * Build-tooling projects whose raw source is read (via tsconfig path aliases)
 * when a library's `build` target runs.
 *
 * The `@hyperfrontend/package:build` executor lives in `tool-package` and does
 * `import { build } from '@hyperfrontend/builder'`; both aliases resolve to
 * `libs/builder/src` and `tools/package/src` rather than a version-pinned npm
 * package. Because the build consumes their raw source, changes to them
 * materially affect every library's build output and must be tracked as
 * implicit dependencies so Nx invalidates the affected builds.
 */
const REQUIRED_BUILD_TOOLING_PROJECTS = ['lib-builder', 'tool-package']

/**
 * The root statement of a parsed JSON document, whose `expression` is the
 * top-level value. For a project.json that value is always an object.
 */
interface JSONExpressionStatementNode {
  /** The top-level JSON value of the document. */
  expression: JSONObjectExpression
}

/**
 * A JSON property key carrying its parsed value. project.json is strict JSON,
 * so keys are always string literals exposing a `value`.
 */
interface JSONKeyWithValue {
  /** The parsed key value. */
  value: unknown
}

/**
 * Reads the string key of a JSON property.
 *
 * project.json is strict JSON, so every property key is a string literal — no
 * identifier-key branch (JSON5) is reachable here.
 *
 * @param prop - The JSON property node.
 * @returns The string key.
 */
function getKeyName(prop: JSONProperty): string {
  return String((prop.key as JSONKeyWithValue).value)
}

/**
 * Finds a top-level property by name within the root JSON object.
 *
 * @param root - The root JSON object expression.
 * @param name - The property name to locate.
 * @returns The matching property, or undefined when absent.
 */
function findProperty(root: JSONObjectExpression, name: string): JSONProperty | undefined {
  for (const prop of root.properties) {
    if (getKeyName(prop) === name) {
      return prop
    }
  }
  return undefined
}

/**
 * Renders a project name as a double-quoted JSON string.
 *
 * @param name - The project name.
 * @returns The quoted name.
 */
function quote(name: string): string {
  return `"${name}"`
}

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description: "Require build-tooling projects in implicitDependencies for libraries that define a 'build' target",
      url: 'https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/lib-builder-implicit-dependency.md',
    },
    schema: [],
    messages: {
      missingImplicitDependency:
        "Library with a 'build' target must declare {{ missing }} in 'implicitDependencies'. The build reads these projects from source, so changes to them materially affect the output and must invalidate this project's build cache.",
      invalidImplicitDependencies: "'implicitDependencies' must be an array of project names.",
    },
  },

  create(context) {
    const projectRoot = dirname(context.filename)
    const projectJson = readProjectJson(projectRoot)

    if (!projectJson) {
      /* istanbul ignore next -- the linted file is itself a project.json, always readable */
      return {}
    }

    // context: only libraries that define a build target are in scope
    if (projectJson.projectType !== 'library') {
      return {}
    }
    const targets = projectJson.targets
    if (!targets || !targets.build) {
      return {}
    }

    // why: tool-package already depends on lib-builder, so adding the reverse
    // why: edge would create a project-graph cycle; skip the tooling projects
    const name = projectJson['name']
    const currentName = typeof name === 'string' ? name : null
    if (currentName !== null && REQUIRED_BUILD_TOOLING_PROJECTS.includes(currentName)) {
      return {}
    }

    return {
      JSONExpressionStatement(node: JSONNode) {
        // context: the document's single top-level value is the project.json object
        const root = (node as unknown as JSONExpressionStatementNode).expression
        const property = findProperty(root, 'implicitDependencies')

        const existing: string[] = []
        if (property) {
          const value = property.value
          if (value.type !== 'JSONArrayExpression') {
            context.report({
              node: property as unknown as Rule.Node,
              messageId: 'invalidImplicitDependencies',
            })
            return
          }
          for (const element of value.elements) {
            /* istanbul ignore if -- JSON arrays never contain holes */
            if (!element) {
              continue
            }
            if (element.type === 'JSONLiteral' && typeof element.value === 'string') {
              existing.push(element.value)
            }
          }
        }

        const missing = REQUIRED_BUILD_TOOLING_PROJECTS.filter((project) => !existing.includes(project))
        if (missing.length === 0) {
          return
        }

        context.report({
          node: (property ?? root) as unknown as Rule.Node,
          messageId: 'missingImplicitDependency',
          data: { missing: missing.map(quote).join(', ') },
          fix(fixer) {
            if (property) {
              const merged = [...existing, ...missing].map(quote).join(', ')
              return fixer.replaceText(property.value as unknown as Rule.Node, `[${merged}]`)
            }
            const lastProp = root.properties[root.properties.length - 1]
            /* istanbul ignore if -- a valid project.json always has at least one property */
            if (!lastProp) {
              return null
            }
            return fixer.insertTextAfter(
              lastProp as unknown as Rule.Node,
              `,\n  "implicitDependencies": [${missing.map(quote).join(', ')}]`
            )
          },
        })
      },
    } as unknown as Rule.RuleListener
  },
}

export default rule
