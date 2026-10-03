import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

const created: string[] = []

/**
 * Writes a set of files into a fresh temporary workspace.
 *
 * @param files - File contents keyed by workspace-relative path.
 * @returns The absolute path to the workspace root.
 */
function plantWorkspace(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'compatibility-matrix-'))
  created.push(root)
  for (const [path, content] of entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  return root
}

/**
 * Removes every workspace planted so far.
 */
export function cleanupWorkspaces(): void {
  for (const root of created.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
}

/**
 * A library planted in a temporary workspace for one test.
 */
export interface LibraryFixture {
  /** Path of the library directory, relative to the workspace root. */
  path: string
  /** Content written to the library's project.json. */
  projectJson: object
  /** Content written to the library's package.json, omitted to leave the file out. */
  packageJson?: object
}

/**
 * Options for the publishable project.json helper.
 */
export interface ProjectConfig {
  /** Nx project name. */
  name: string
  /** Value placed under `metadata.compatibility`. */
  compatibility?: object
  /** Value placed under `targets.build.options`. */
  buildOptions?: object
}

/**
 * Builds a publishable project.json for a fixture library.
 *
 * @param config - What the project declares.
 * @returns The project.json content.
 */
export function publishableProject(config: ProjectConfig): object {
  return {
    name: config.name,
    projectType: 'library',
    metadata: config.compatibility ? { compatibility: config.compatibility } : undefined,
    targets: {
      build: { options: config.buildOptions ?? { esm: {}, cjs: {} } },
      publish: {},
    },
  }
}

/**
 * Creates a temporary workspace holding the given libraries.
 *
 * @param libraries - Libraries to plant.
 * @param extraFiles - Extra files keyed by workspace-relative path.
 * @returns The absolute path to the workspace root.
 */
export function createWorkspace(libraries: LibraryFixture[], extraFiles: Record<string, string> = {}): string {
  const files: Record<string, string> = { 'nx.json': stringify({ version: 2 }, null, 2), ...extraFiles }

  for (const library of libraries) {
    files[`${library.path}/project.json`] = stringify(library.projectJson, null, 2)

    if (library.packageJson) {
      files[`${library.path}/package.json`] = stringify(library.packageJson, null, 2)
    }
  }

  return plantWorkspace(files)
}

/**
 * Extracts the section of the generated document under a heading.
 *
 * @param document - The generated document.
 * @param heading - Heading that opens the section.
 * @returns The section text, without the heading itself.
 */
export function sectionOf(document: string, heading: string): string {
  const start = document.indexOf(heading)
  const rest = document.slice(start + heading.length)
  const end = rest.indexOf('\n## ')

  return end === -1 ? rest : rest.slice(0, end)
}
