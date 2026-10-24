import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { CONSUMER_SOURCES } from '../__test-utils__/consumer-sources'
import { PROJECT_DIR } from './installed-package'

/**
 * The git-ignored scratch directory the consumer projects are written under. It sits inside
 * the e2e project so that a bare `@hyperfrontend/testing` import in a consumer source climbs
 * to this project's `node_modules`, which holds the installed tarball.
 */
const SCRATCH_DIR = join(PROJECT_DIR, 'tmp')

/**
 * Where {@link writeConsumerProjects} put the consumer projects.
 */
export type ConsumerProjects = {
  /** The absolute directory holding one subdirectory per consumer project. */
  root: string
  /** Names the root of one consumer project. */
  dir: (name: string) => string
  /** Names the root of one consumer project relative to the e2e project root, with forward slashes, the way coverage reports name files. */
  workspacePath: (name: string) => string
  /** Deletes the consumer projects, and the scratch directory once no other suite holds projects in it. */
  remove: () => void
}

/**
 * Writes every consumer project to a fresh directory under the e2e project's scratch directory.
 *
 * @returns The paths of the written projects and the way to delete them.
 */
export function writeConsumerProjects(): ConsumerProjects {
  mkdirSync(SCRATCH_DIR, { recursive: true })
  const root = mkdtempSync(join(SCRATCH_DIR, 'consumers-'))
  for (const [name, files] of Object.entries(CONSUMER_SOURCES)) {
    for (const [path, text] of Object.entries(files)) {
      const file = join(root, name, path)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, text)
    }
  }
  return {
    root,
    dir: (name) => join(root, name),
    workspacePath: (name) => [basename(SCRATCH_DIR), basename(root), name].join('/'),
    remove: () => {
      rmSync(root, { recursive: true, force: true })
      if (readdirSync(SCRATCH_DIR).length === 0) rmSync(SCRATCH_DIR, { recursive: true, force: true })
    },
  }
}
