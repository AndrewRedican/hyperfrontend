import type { FileTree } from '@hyperfrontend/testing/fs'
import { posix } from 'node:path'
import { CONSUMER_SOURCES } from '../__test-utils__/consumer-sources'

/** The directory under the consumer the projects are written to, one subdirectory each. */
export const CONSUMERS_DIR = 'consumers'

/** The spec files of the `jest-style` consumer project, in the order the suites run them. */
export const JEST_STYLE_SPECS = [
  'src/origin.spec.ts',
  'src/mock-factory.spec.ts',
  'src/automock.spec.ts',
  'src/do-mock.spec.ts',
  'src/timers.spec.ts',
  'src/each.spec.ts',
]

/** The suite names the `jest-style` specs declare, which the TAP report prints back. */
export const JEST_STYLE_SUITES = [
  'the runtime a fixture imports',
  'jest.mock with a factory',
  'jest.mock automock of a built-in',
  'jest.doMock after jest.resetModules',
  'fake timers',
  'it.each',
]

/**
 * The consumer projects as one tree to write under the consumer, so a bare `@hyperfrontend/testing` import in any
 * of them climbs to the consumer's `node_modules`, which holds the installed tarball.
 *
 * @returns Every project's files keyed by `consumers/<project>/<path>`.
 */
export function consumerProjectsTree(): FileTree {
  const tree: FileTree = {}
  for (const [name, files] of Object.entries(CONSUMER_SOURCES)) {
    for (const [path, text] of Object.entries(files)) tree[posix.join(CONSUMERS_DIR, name, path)] = text
  }
  return tree
}

/**
 * Names one consumer project relative to the consumer, with forward slashes, the way coverage reports name files.
 *
 * @param name - Which consumer project, as the sources key it.
 * @returns The project's directory below `consumers`, spelled the way coverage reports spell it.
 */
export function consumerProjectPath(name: string): string {
  return posix.join(CONSUMERS_DIR, name)
}
