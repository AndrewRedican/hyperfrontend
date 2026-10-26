/**
 * Reports whether the packages the workspace would publish now differ from what the registry
 * holds at the same version: rebuilds the named projects, packs each `dist` without writing a
 * tarball, retrieves the published tarball without running its scripts, and compares the two file
 * by file. Report only; the exit code is always zero. Usage, from the workspace root:
 * `node --import ./tools/lint/src/runtime/aliases.ts tools/workspace/scripts/artifact-drift.ts --projects lib-a,lib-b`.
 *
 * @module scripts/artifact-drift
 */

import type { ProjectRecord } from '../src/graph/model'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { nxRunner } from '@hyperfrontend/integration-nx/adapters'
import { createTempDir } from '@hyperfrontend/testing/fs'
import { compareArtifacts, renderDrift } from '../src/artifact-drift/compare'
import { contentHash, hashContent, parsePackJson } from '../src/artifact-drift/pack'
import { readPackageTarball } from '../src/artifact-drift/tar'
import { workspaceGraph } from '../src/graph/build'
import { compareText } from '../src/graph/order'
import { hasTarget } from '../src/graph/workspace'

const { values } = parseArgs({
  options: {
    projects: { type: 'string', default: '' },
    registry: { type: 'string', default: 'https://registry.npmjs.org' },
    'skip-build': { type: 'boolean', default: false },
  },
})

const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const graph = workspaceGraph(root)
const named = values.projects === '' ? null : values.projects.split(',')
const projects = [...graph.projects.values()]
  .filter((project) => (named === null ? hasTarget(project, 'publish') : named.includes(project.name)))
  .sort((left, right) => compareText(left.name, right.name))

/**
 * Runs npm and returns its standard output.
 *
 * @param args - The arguments after `npm`
 * @param cwd - Where to run
 * @returns The output
 */
function npm(args: readonly string[], cwd: string): string {
  return execFileSync('npm', [...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32',
  })
}

/**
 * Reports one project.
 *
 * @param project - The project whose package is compared
 * @returns The report lines
 */
function report(project: ProjectRecord): string[] {
  if (!values['skip-build']) nxRunner(root)(['run', `${project.name}:build`])
  const dist = join(root, 'dist', project.root)
  const pack = parsePackJson(npm(['pack', '--dry-run', '--json', '--ignore-scripts'], dist))
  const local = createMap(pack.files.map((file) => [file.path, hashContent(readFileSync(join(dist, file.path)))] as const))
  const scratch = createTempDir({ prefix: 'artifact-drift-' })
  try {
    npm(
      ['pack', `${pack.name}@${pack.version}`, '--ignore-scripts', '--pack-destination', scratch.path, `--registry=${values.registry}`],
      root
    )
    const tarball = readdirSync(scratch.path).find((name) => name.endsWith('.tgz'))
    if (tarball === undefined) return [`${pack.name}@${pack.version}: the registry returned no tarball`]
    const published = createMap(
      readPackageTarball(readFileSync(join(scratch.path, tarball))).map((entry) => [entry.path, hashContent(entry.content)] as const)
    )
    return renderDrift(compareArtifacts(pack.name, pack.version, local, published))
  } catch (error) {
    return [
      `${pack.name}@${pack.version}: not retrievable from the registry (${(error as Error).message.split(/\r?\n/)[0] ?? ''}); local ${contentHash(local).slice(0, 12)}`,
    ]
  } finally {
    scratch.remove()
  }
}

for (const project of projects) for (const line of report(project)) process.stdout.write(`${line}\n`)
