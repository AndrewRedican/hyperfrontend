/**
 * The Nx plugin that gives every project a `lint` target running this linter from the project's
 * root. It reads no Nx package: the shapes Nx passes and expects are declared here, as far as the
 * plugin uses them. The workspace root has no target of its own; its files are linted by the
 * root project's explicit configuration.
 *
 * @module nx/plugin
 */

import { posix } from 'node:path'

/** What Nx passes to a `createNodesV2` function, as far as the plugin reads it. */
interface CreateNodesContext {
  /** The workspace root, absolute. */
  readonly workspaceRoot: string
}

/** The options of the inferred target. */
interface TargetOptions {
  /** The directory the command runs in, workspace-relative. */
  readonly cwd: string
}

/** What a target tells Nx about itself. */
interface TargetMetadata {
  /** The technologies the target belongs to. */
  readonly technologies: readonly string[]
  /** What the target does. */
  readonly description: string
}

/** The inferred `lint` target. */
interface TargetConfiguration {
  /** The command run. */
  readonly command: string
  /** Its options. */
  readonly options: TargetOptions
  /** Its metadata. */
  readonly metadata: TargetMetadata
}

/** The targets inferred for one project. */
interface ProjectTargets {
  /** The targets by name. */
  readonly targets: Readonly<Record<string, TargetConfiguration>>
}

/** What the plugin answers for one project file. */
interface CreateNodesResult {
  /** The projects, by root, with their inferred targets. */
  readonly projects?: Readonly<Record<string, ProjectTargets>>
}

/** What the plugin answers for every project file. */
type CreateNodesResultV2 = readonly (readonly [string, CreateNodesResult])[]

/** The function Nx calls with the project files it found. */
type CreateNodesFunction = (projectFiles: readonly string[], options: unknown, context: CreateNodesContext) => CreateNodesResultV2

/** The linter's entry, workspace-relative. */
const ENTRY = 'tools/lint/bin/lint.ts'

/**
 * The `lint` target of a project.
 *
 * @param root - The project root, workspace-relative and POSIX
 * @returns The target, running the linter on the project from its root
 */
export function lintTarget(root: string): TargetConfiguration {
  return {
    command: `node ${posix.relative(root, ENTRY)} .`,
    options: { cwd: root },
    metadata: { technologies: ['lint'], description: 'Runs the workspace linter on the project.' },
  }
}

/**
 * The targets inferred from the project files Nx found: a `lint` target for each project but
 * the workspace root.
 *
 * @param projectFiles - The `project.json` and `package.json` files, workspace-relative and POSIX
 * @returns One result per file
 */
function inferTargets(projectFiles: readonly string[]): CreateNodesResultV2 {
  return projectFiles.map((file) => {
    const root = posix.dirname(file)
    return root === '.' ? ([file, {}] as const) : ([file, { projects: { [root]: { targets: { lint: lintTarget(root) } } } }] as const)
  })
}

/** The plugin's entry: the files it reads and the function inferring targets from them. */
export const createNodesV2: readonly [string, CreateNodesFunction] = ['**/{project.json,package.json}', inferTargets]
