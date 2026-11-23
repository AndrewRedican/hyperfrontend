/**
 * Every service `.railway/railway.ts` declares serves through the exact `@hyperfrontend/features`
 * release its demo installs from the registry, or starts the main its service build wrote, and
 * every project deploying to Railway is declared.
 *
 * @module rules/workspace/railway-service-pins
 */

import type { Node } from '@hyperfrontend/linter'
import { basename, dirname, join, posix } from 'node:path'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { readProjectFile, readResolvedTarget } from '@hyperfrontend/workspace/lint'
import { installedRelease } from './shared/installed-release.ts'
import { sweep } from './shared/sweep.ts'

const PACKAGE = '@hyperfrontend/features'
const PINNED = `${PACKAGE}@`
const EXACT = /^\d+\.\d+\.\d+$/
const EXECUTOR = '@hyperfrontend/workspace:service'
/** The kinds of node that wrap an expression without changing its value. */
const WRAPPERS: readonly string[] = ['TSAsExpression', 'TSSatisfiesExpression', 'TSTypeAssertion', 'TSNonNullExpression']
/** A path a shell passes on as one word, unchanged, without quotes. */
const PLAIN = /^[\w@%+=:,./-]+$/

/** A project that deploys to a Railway service. */
interface DeployingProject {
  /** The project's name, or undefined when its `project.json` states none. */
  readonly name: string | undefined
  /** Its absolute directory. */
  readonly directory: string
  /** Its directory as a POSIX path relative to the workspace root. */
  readonly root: string
  /** Whether it is deployed as a built service. */
  readonly built: boolean
}

/** How a service's options state its `start` command. */
interface Start {
  /** The value of the last `start` property, without what is written around it, or undefined when the options state none. */
  readonly value: Node | undefined
  /** The last spread or computed key after that property, or of the options when they state no `start`: it may replace the command. */
  readonly override: Node | undefined
}

/** What `metadata.deploy` declares, as far as the rule reads it. */
interface DeployMetadata {
  /** The provider. */
  readonly provider?: unknown
  /** The service. */
  readonly service?: unknown
  /** How the project is deployed. */
  readonly kind?: unknown
}

/**
 * The projects below a workspace root that deploy to Railway.
 *
 * @param root - The workspace root
 * @returns The projects, by the service their `metadata.deploy.service` names
 */
function railwayProjects(root: string): Map<string, DeployingProject> {
  const projects = createMap<string, DeployingProject>()
  sweep(root, (entry) => {
    if (entry.directory || entry.name !== 'project.json') return true
    const directory = join(root, dirname(entry.path))
    const project = readProjectFile(directory)
    const deploy = project?.metadata?.['deploy'] as DeployMetadata | undefined
    if (deploy?.provider === 'railway' && typeof deploy.service === 'string')
      projects.set(deploy.service, {
        name: typeof project?.name === 'string' ? project.name : undefined,
        directory,
        root: posix.dirname(entry.path),
        built: deploy.kind === 'service',
      })
    return true
  })
  return projects
}

/**
 * What a message calls a project.
 *
 * @param project - A project deploying to Railway
 * @returns Its name, or `the project at <root>` when its `project.json` states none
 */
function called(project: DeployingProject): string {
  return project.name ?? `the project at ${project.root}`
}

/**
 * The directory a project's service build writes, as the task runner resolves its `build` target.
 *
 * @param root - The workspace root
 * @param project - The project deployed as a built service
 * @returns The directory relative to the workspace root, or null when the project has no `build` target that runs the service executor
 */
function builtOutput(root: string, project: DeployingProject): string | null {
  const build = readResolvedTarget(root, project.directory, 'build')
  if (build?.executor !== EXECUTOR) return null
  const stated = build.options['outputPath']
  return typeof stated === 'string' ? stated : posix.join('dist', project.root)
}

/**
 * An expression without the assertions written around it, none of which changes its value.
 *
 * @param node - The expression
 * @returns The expression inside every `as`, `satisfies`, angle-bracket and non-null assertion
 */
function unwrapped(node: Node): Node {
  let inner = node
  while (WRAPPERS.includes(inner.kind)) inner = inner.expression as Node
  return inner
}

/**
 * The command that starts the main a service build wrote.
 *
 * @param output - The directory the build writes
 * @returns The command, the main's path in double quotes when a shell would split or read it
 */
function startCommand(output: string): string {
  const main = posix.join(output, 'main.cjs')
  return PLAIN.test(main) ? `node ${main}` : `node "${main}"`
}

/**
 * Whether an element of the options is a property keyed `start`, as an identifier or as a string literal.
 *
 * @param element - A property or a spread of the options object literal
 * @returns True when JavaScript reads its key as `start`
 */
function isStart(element: Node): boolean {
  const key = element.key
  // why: a computed identifier is a variable whose value is the key, not the key itself.
  if (key?.kind === 'Identifier') return key.name === 'start' && element.computed !== true
  return key?.kind === 'Literal' && key.value === 'start'
}

/**
 * A service's `start` option as JavaScript takes it: the last property keyed `start` wins, and a
 * spread or a computed key written after it may replace it.
 *
 * @param options - The options object literal
 * @returns The value and what may override it
 */
function readStart(options: Node): Start {
  let value: Node | undefined
  let override: Node | undefined
  for (const element of options.properties as readonly Node[]) {
    if (isStart(element)) {
      value = unwrapped(element.value as Node)
      override = undefined
    } else if (element.kind === 'SpreadElement' || element.computed === true) override = element
  }
  return { value, override }
}

export default defineRule<undefined, Node>({
  id: 'workspace/railway-service-pins',
  language: 'code',
  fixable: true,
  create(context) {
    const path = context.file.path
    if (basename(path) !== 'railway.ts' || basename(dirname(path)) !== '.railway') return {}
    const root = dirname(dirname(path))
    const projects = railwayProjects(root)
    const declared = createSet<string>()

    /**
     * Checks one service's pin against what its demo installs.
     *
     * @param service - The service name
     * @param options - The options object literal
     */
    const check = (service: string, options: Node): void => {
      const { value, override } = readStart(options)
      // why: a spread or a computed key after the command may replace it, so the pin written is not known to be the pin served.
      const overriding = value === undefined ? undefined : override
      const start = value?.kind === 'Literal' && overriding === undefined ? value : null
      const command = typeof start?.value === 'string' ? start.value : ''
      const at = command.indexOf(PINNED)
      const pin = at === -1 ? '' : (command.slice(at + PINNED.length).split(' ')[0] as string)
      if (start === null || !EXACT.test(pin)) {
        const message = `Service '${service}' must serve through an exact ${PACKAGE}@<version> pin.`
        const unread = start ?? overriding ?? options
        context.report({ start: unread.start, end: unread.end, message })
        return
      }
      const pinStart = start.start + context.file.text.slice(start.start, start.end).indexOf(PINNED) + PINNED.length
      const span = { start: pinStart, end: pinStart + pin.length }
      const project = projects.get(service)
      if (project === undefined) {
        const message = `Service '${service}' matches no demo's metadata.deploy.service, so its pin cannot be checked against what the demo installs.`
        context.report({ ...span, message })
        return
      }
      const installed = installedRelease(project.directory, PACKAGE)
      if (installed === null) {
        const message = `Service '${service}' serves ${PINNED}${pin} but ${called(project)} installs no ${PACKAGE} from the registry, so the pin cannot be checked.`
        context.report({ ...span, message })
      } else if (installed !== pin) {
        context.report({
          ...span,
          message: `Service '${service}' serves ${PINNED}${pin} but ${called(project)} installs ${installed} from the registry; the pin must be the published version the demo was built with.`,
          fix: { ...span, text: installed },
        })
      }
    }

    /**
     * Checks that a built service starts the main its build wrote.
     *
     * @param name - The service name literal
     * @param options - The options object literal
     * @param project - The project deployed as that service
     */
    const checkBuilt = (name: Node, options: Node, project: DeployingProject): void => {
      const service = name.value as string
      const output = builtOutput(root, project)
      if (output === null) {
        const message = `Service '${service}' deploys ${called(project)} as a built service, but ${called(project)} has no build target that runs ${EXECUTOR}.`
        context.report({ start: name.start, end: name.end, message })
        return
      }
      const command = startCommand(output)
      const { value: start, override } = readStart(options)
      if (override === undefined && start?.kind === 'Literal' && start.value === command) return
      const message = `Service '${service}' must start with '${command}': a built service runs the main its build wrote, with nothing between the platform's signal and the process.`
      if (override !== undefined || start?.kind !== 'Literal' || typeof start.value !== 'string') {
        const unread = override ?? start ?? options
        context.report({ start: unread.start, end: unread.end, message })
        return
      }
      const quote = context.file.text.charAt(start.start)
      // why: the command is written inside the literal's own quotes, so a backslash or that quote in the command is escaped.
      const text = command.split('\\').join('\\\\').split(quote).join(`\\${quote}`)
      context.report({ start: start.start, end: start.end, message, fix: { start: start.start + 1, end: start.end - 1, text } })
    }

    return {
      CallExpression(node) {
        const [name, options] = node.arguments as readonly Node[]
        if (node.callee?.kind !== 'Identifier' || node.callee.name !== 'service') return
        if (name?.kind !== 'Literal' || typeof name.value !== 'string' || options?.kind !== 'ObjectExpression') return
        declared.add(name.value)
        const project = projects.get(name.value)
        if (project?.built) checkBuilt(name, options, project)
        else check(name.value, options)
      },
      'Program:exit'() {
        for (const [service, project] of projects) {
          if (declared.has(service)) continue
          const subject = project.name === undefined ? `The project at ${project.root}` : `Project '${project.name}'`
          context.report({
            start: 0,
            end: context.file.text.length,
            message: `${subject} deploys to Railway service '${service}', which .railway/railway.ts does not declare.`,
          })
        }
      },
    }
  },
})
