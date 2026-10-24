/**
 * A disposable workspace for the publishable-library rules: one publishable library exporting
 * entries of every shape, a library that is not publishable, and a publishable library without a
 * manifest.
 *
 * @module rules/workspace/__test-utils__/library-workspace
 */

import { join } from 'node:path'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { createTempDir } from '@hyperfrontend/testing/fs'

/** The project file of a publishable library. */
const PUBLISHABLE = stringify({ name: 'test-lib', projectType: 'library', targets: { build: {}, publish: {} } })

/** The files of the workspace, by workspace-relative path. */
const FILES: Readonly<Record<string, string>> = {
  'nx.json': '{}',
  'package.json': stringify({ name: 'workspace', private: true }),
  'pub/project.json': PUBLISHABLE,
  'pub/package.json': stringify({
    name: '@hyperfrontend/test-lib',
    exports: {
      '.': './src/index.js',
      './package.json': './package.json',
      './utils': './src/utils/index.js',
      './cjs': { require: './src/cjs/index.cjs' },
      './esm': { default: './src/esm/index.mjs' },
      './imported': { import: './src/imported/index.js' },
      './other': { types: './src/other/index.d.ts' },
      './nx/executors/serve': './src/nx/executors/serve/index.js',
    },
  }),
  'internal/project.json': stringify({ name: 'internal-lib', projectType: 'library', targets: { build: {} } }),
  'internal/package.json': stringify({ name: 'internal-lib' }),
  'nopkg/project.json': PUBLISHABLE,
  'plain/project.json': PUBLISHABLE,
  'plain/package.json': stringify({ name: '@hyperfrontend/plain' }),
}

/** The roots of the workspace's libraries. */
export interface LibraryWorkspace {
  /** The workspace root. */
  readonly root: string
  /** The publishable library. */
  readonly publishable: string
  /** The library that is not publishable. */
  readonly internal: string
  /** The publishable library without a manifest. */
  readonly bare: string
  /** The publishable library whose manifest declares no exports. */
  readonly plain: string
}

/**
 * Creates the workspace in a temporary directory.
 *
 * @returns The roots
 */
export function createLibraryWorkspace(): LibraryWorkspace {
  const root = createTempDir({ prefix: 'lint-libraries-', tree: FILES }).path
  return { root, publishable: join(root, 'pub'), internal: join(root, 'internal'), bare: join(root, 'nopkg'), plain: join(root, 'plain') }
}
