/**
 * Logging goes through `@hyperfrontend/logging`: no global console method, no Nx devkit logger
 * method and no frozen console copy is used directly. Handing a console or devkit method straight
 * to a logging export is how a logger is built, so that stays allowed, as does a devkit call
 * inside a function once `createLogger` is in scope. The file is read in one pass, so a binding
 * counts only from its import onwards.
 *
 * @module rules/workspace/no-direct-console
 */

import type { Node } from '@hyperfrontend/linter'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'

/** The module that holds the frozen console copies. */
const CONSOLE_COPIES = '@hyperfrontend/immutable-api-utils/built-in-copy/console'

/** The package whose exports are the sanctioned way to log. */
const LOGGING = '@hyperfrontend/logging'

/** The console methods that write, time, count or group. */
const CONSOLE_METHODS = createSet([
  'assert',
  'clear',
  'count',
  'countReset',
  'debug',
  'dir',
  'error',
  'group',
  'groupCollapsed',
  'groupEnd',
  'info',
  'log',
  'profile',
  'profileEnd',
  'table',
  'time',
  'timeEnd',
  'timeLog',
  'timeStamp',
  'trace',
  'warn',
])

/** The methods of the Nx devkit logger. */
const DEVKIT_METHODS = createSet(['debug', 'error', 'fatal', 'info', 'log', 'verbose', 'warn'])

/** The function kinds a devkit call may sit in once `createLogger` is imported. */
const FUNCTIONS = createSet(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'])

/** What the rule has learnt of the file so far. */
interface Bindings {
  /** The local names of the devkit logger, each with the specifiers that bound it. */
  readonly devkit: Map<string, Node[]>
  /** The local names of the console copies, by named or namespace import. */
  readonly copies: Set<string>
  /** The local names bound by any import from the logging package. */
  readonly logging: Set<string>
  /** The specifiers already reported. */
  readonly flagged: Set<Node>
  /** Whether `createLogger` has been imported. */
  wrapping: boolean
}

/**
 * Reads the text of a name that is an identifier or a string literal.
 *
 * @param node - The identifier or literal
 * @returns The name, or undefined for any other node
 */
function nameOf(node: Node | undefined): string | undefined {
  if (node?.kind === 'Identifier') return node.name as string
  return node?.kind === 'Literal' && typeof node.value === 'string' ? node.value : undefined
}

/**
 * Reads the member name of a member expression as written after the object, whether dotted or
 * bracketed: an identifier gives its own name, a string literal its value.
 *
 * @param member - The member expression
 * @returns The member name, or undefined for any other key
 */
function memberName(member: Node): string | undefined {
  return nameOf(member.property)
}

/**
 * Tells whether a member expression is passed straight to a function the logging package
 * exports, which is how a logger takes its transports.
 *
 * @param member - The member expression
 * @param bindings - What the file has bound so far
 * @returns True when the member is a direct argument of such a call
 */
function feedsLogger(member: Node, bindings: Bindings): boolean {
  const call = member.parent
  if (call?.kind !== 'CallExpression' || call.callee?.kind !== 'Identifier') return false
  return bindings.logging.has(call.callee.name as string) && (call.arguments as readonly Node[]).includes(member)
}

/**
 * Records what an import declaration binds.
 *
 * @param declaration - The import declaration
 * @param bindings - What the file has bound so far
 */
function bind(declaration: Node, bindings: Bindings): void {
  const source = declaration.source?.value
  for (const specifier of declaration.specifiers as readonly Node[]) {
    const local = specifier.local?.name as string
    const named = specifier.kind === 'ImportSpecifier'
    if (source === LOGGING || (typeof source === 'string' && source.startsWith(`${LOGGING}/`))) {
      bindings.logging.add(local)
      if (named && nameOf(specifier.imported) === 'createLogger') bindings.wrapping = true
    } else if (source === '@nx/devkit' && named && nameOf(specifier.imported) === 'logger') {
      bindings.devkit.set(local, [...(bindings.devkit.get(local) ?? []), specifier])
    } else if (source === CONSOLE_COPIES && specifier.kind !== 'ImportDefaultSpecifier') {
      bindings.copies.add(local)
    }
  }
}

export default defineRule<undefined, Node>({
  id: 'workspace/no-direct-console',
  language: 'code',
  fixable: false,
  create(context) {
    const bindings: Bindings = { devkit: createMap(), copies: createSet(), logging: createSet(), flagged: createSet(), wrapping: false }

    /**
     * Reports a use of a copy binding.
     *
     * @param node - The call or member expression
     * @param name - The name the message shows
     */
    const reportCopy = (node: Node, name: string): void => {
      context.report({
        start: node.start,
        end: node.end,
        message: `Avoid using '${name}' from disallowed source. Use '${LOGGING}' APIs instead.`,
      })
    }

    /**
     * Reports a devkit logger method together with the specifiers that bound its object.
     *
     * @param member - The member expression
     * @param local - The local name of the logger
     * @param method - The logger method called, shown in the message
     */
    const reportDevkit = (member: Node, local: string, method: string): void => {
      for (const specifier of bindings.devkit.get(local) as Node[]) {
        if (bindings.flagged.has(specifier)) continue
        bindings.flagged.add(specifier)
        context.report({
          start: specifier.start,
          end: specifier.end,
          message: `Avoid importing 'logger' from '@nx/devkit'. Use '${LOGGING}' APIs instead (e.g., createLogger, logger).`,
        })
      }
      reportCopy(member, `${local}.${method}`)
    }

    return {
      ImportDeclaration(node) {
        bind(node, bindings)
      },
      CallExpression(node) {
        const callee = node.callee as Node
        if (callee.kind !== 'Identifier') return
        const first = node.arguments?.[0]
        if (callee.name === 'require' && first?.kind === 'Literal' && first.value === CONSOLE_COPIES) {
          const message = `Avoid importing from '${CONSOLE_COPIES}'. Use '${LOGGING}' APIs instead.`
          context.report({ start: node.start, end: node.end, message })
        } else if (bindings.copies.has(callee.name as string)) {
          reportCopy(node, callee.name as string)
        }
      },
      MemberExpression(node, parents) {
        const object = node.object as Node
        if (object.kind !== 'Identifier') return
        const local = object.name as string
        if (bindings.copies.has(local)) {
          const property = node.property as Node
          reportCopy(node, property.kind === 'Identifier' ? `${local}.${property.name as string}` : local)
          return
        }
        const method = memberName(node)
        if (method === undefined || feedsLogger(node, bindings)) return
        if (local === 'console' && CONSOLE_METHODS.has(method)) {
          const message = `Avoid using global 'console.${method}'. Use '${LOGGING}' APIs instead (e.g., createLogger, logger).`
          context.report({ start: node.start, end: node.end, message })
        } else if (bindings.devkit.has(local) && DEVKIT_METHODS.has(method)) {
          if (!bindings.wrapping || !parents.some((parent) => FUNCTIONS.has(parent.kind))) reportDevkit(node, local, method)
        }
      },
    }
  },
})
