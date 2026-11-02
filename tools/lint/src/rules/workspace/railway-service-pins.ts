/**
 * Every service `.railway/railway.ts` declares serves through the exact `@hyperfrontend/features`
 * release its demo installs from the registry, and every demo deploying to Railway is declared.
 *
 * @module rules/workspace/railway-service-pins
 */

import type { Node } from '@hyperfrontend/linter'
import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parse } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { readProjectFile } from './shared/project-file.ts'
import { sweep } from './shared/sweep.ts'

const PACKAGE = '@hyperfrontend/features'
const PINNED = `${PACKAGE}@`
const REGISTRY = 'https://registry.npmjs.org/'
const EXACT = /^\d+\.\d+\.\d+$/

/** A project that deploys to a Railway service. */
interface DeployingProject {
  /** The project's name. */
  readonly name: string
  /** Its absolute directory. */
  readonly directory: string
}

/** What `metadata.deploy` declares, as far as the rule reads it. */
interface DeployMetadata {
  /** The provider. */
  readonly provider?: unknown
  /** The service. */
  readonly service?: unknown
}

/** One installed package of a lock. */
interface LockEntry {
  /** The installed version. */
  readonly version?: unknown
  /** Where it was installed from. */
  readonly resolved?: unknown
}

/** The lock entries the rule reads. */
interface LockFile {
  /** The installed packages by path. */
  readonly packages?: Readonly<Record<string, LockEntry>>
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
      projects.set(deploy.service, { name: project?.name as string, directory })
    return true
  })
  return projects
}

/**
 * The `@hyperfrontend/features` release a project's lock installs from the registry.
 *
 * @param directory - The project's directory
 * @returns The version, or null when the lock is missing, lacks the package or resolves it elsewhere
 */
function installedRelease(directory: string): string | null {
  try {
    const lock = parse(readFileSync(join(directory, 'package-lock.json'), 'utf8')) as LockFile
    const entry = lock.packages?.[`node_modules/${PACKAGE}`]
    return typeof entry?.version === 'string' && typeof entry.resolved === 'string' && entry.resolved.startsWith(REGISTRY)
      ? entry.version
      : null
  } catch {
    return null
  }
}

/**
 * The `start` command of a service's options, when written as a string literal.
 *
 * @param options - The options object literal
 * @returns The literal, or null
 */
function startCommand(options: Node): Node | null {
  const start = (options.properties as readonly Node[]).find(
    (property) => property.kind === 'Property' && property.key?.kind === 'Identifier' && property.key.name === 'start'
  )
  const value = start?.value as Node | undefined
  return value?.kind === 'Literal' ? value : null
}

export default defineRule<undefined, Node>({
  id: 'workspace/railway-service-pins',
  language: 'code',
  fixable: true,
  create(context) {
    const path = context.file.path
    if (basename(path) !== 'railway.ts' || basename(dirname(path)) !== '.railway') return {}
    const projects = railwayProjects(dirname(dirname(path)))
    const declared = createSet<string>()

    /**
     * Checks one service's pin against what its demo installs.
     *
     * @param service - The service name
     * @param options - The options object literal
     */
    const check = (service: string, options: Node): void => {
      const start = startCommand(options)
      const command = typeof start?.value === 'string' ? start.value : ''
      const at = command.indexOf(PINNED)
      const pin = at === -1 ? '' : (command.slice(at + PINNED.length).split(' ')[0] as string)
      if (start === null || !EXACT.test(pin)) {
        const message = `Service '${service}' must serve through an exact ${PACKAGE}@<version> pin.`
        context.report({ start: (start ?? options).start, end: (start ?? options).end, message })
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
      const installed = installedRelease(project.directory)
      if (installed === null) {
        const message = `Service '${service}' serves ${PINNED}${pin} but ${project.name} installs no ${PACKAGE} from the registry, so the pin cannot be checked.`
        context.report({ ...span, message })
      } else if (installed !== pin) {
        context.report({
          ...span,
          message: `Service '${service}' serves ${PINNED}${pin} but ${project.name} installs ${installed} from the registry; the pin must be the published version the demo was built with.`,
          fix: { ...span, text: installed },
        })
      }
    }

    return {
      CallExpression(node) {
        const [name, options] = node.arguments as readonly Node[]
        if (node.callee?.kind !== 'Identifier' || node.callee.name !== 'service') return
        if (name?.kind !== 'Literal' || typeof name.value !== 'string' || options?.kind !== 'ObjectExpression') return
        declared.add(name.value)
        check(name.value, options)
      },
      'Program:exit'() {
        for (const [service, project] of projects) {
          if (declared.has(service)) continue
          context.report({
            start: 0,
            end: context.file.text.length,
            message: `Project '${project.name}' deploys to Railway service '${service}', which .railway/railway.ts does not declare.`,
          })
        }
      },
    }
  },
})
