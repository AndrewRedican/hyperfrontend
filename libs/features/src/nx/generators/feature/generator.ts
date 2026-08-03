import type { Tree as ScaffoldTree, WriteOptions } from '@hyperfrontend/project-scope/vfs'
import type { GeneratorCallback, Tree } from '../../model'
import { isAbsolute, join, relative } from 'node:path'
import { createError } from '@hyperfrontend/immutable-api-utils/built-in-copy/error'
import { Mode } from '@hyperfrontend/project-scope/vfs'
import { EXIT_OK, runInit } from '../../../cli'
import { ensureSdkDependency } from '../../shared/dependencies'
import { loadDevkit } from '../../shared/devkit'
import { headlessFlags } from '../../shared/flags'
import { installPackages } from '../../shared/install'

/** Options for the `feature` generator; mirrors `schema.json`. */
export interface FeatureGeneratorSchema {
  /** Feature name. */
  name: string
  /** Path to the feature contract file, relative to the target directory. */
  contract: string
  /** Entry file the generated glue import is wired into. */
  entry: string
  /** Directory to scaffold into, relative to the workspace root. Defaults to the root. */
  directory?: string
  /** Feature version string. */
  version?: string
  /** URL the generated shell loads the feature from. */
  url?: string
}

/** Running tally of scaffold writes staged into the Nx tree. */
interface WriteTally {
  /** Writes that created a file the tree did not already have. */
  created: number
  /** Writes that replaced existing tree content. */
  updated: number
}

/**
 * Translate a scaffold-root-relative path into a workspace-relative, POSIX-style Nx tree path.
 *
 * @param workspaceRoot - Absolute root of the consumer workspace.
 * @param scaffoldRoot - Absolute directory the SDK resolves scaffold paths against.
 * @param filePath - The scaffold path the SDK addressed, scaffold-root-relative or absolute.
 * @returns The equivalent workspace-relative path for the Nx tree.
 */
function toTreePath(workspaceRoot: string, scaffoldRoot: string, filePath: string): string {
  // why: join concatenates an absolute second segment instead of resolving it, so absolute SDK paths (e.g. an absolute --contract) must bypass the scaffold root.
  const absolute = isAbsolute(filePath) ? filePath : join(scaffoldRoot, filePath)
  return relative(workspaceRoot, absolute).split('\\').join('/')
}

/**
 * Build the scaffold tree the SDK stages into, backed by the Nx tree.
 *
 * Reads and writes are forwarded to the Nx tree with paths translated to
 * workspace-relative form, so every scaffolding write lands in Nx's virtual
 * tree and `--dry-run` previews without touching the disk. Skip-if-exists
 * writes check the Nx tree first and stage nothing when the file is present;
 * staged writes are tallied as created or updated for the SDK's summary.
 *
 * @param tree - The Nx virtual file-system tree writes are staged into.
 * @param scaffoldRoot - Absolute directory the SDK resolves scaffold paths against.
 * @param tally - Mutable tally the adapter records staged writes into.
 * @returns The SDK-facing scaffold tree.
 */
function createStagingTree(tree: Tree, scaffoldRoot: string, tally: WriteTally): ScaffoldTree {
  return <ScaffoldTree>{
    root: scaffoldRoot,
    read: (filePath: string, encoding: BufferEncoding) => tree.read(toTreePath(tree.root, scaffoldRoot, filePath), encoding),
    exists: (filePath: string) => tree.exists(toTreePath(tree.root, scaffoldRoot, filePath)),
    write: (filePath: string, content: Buffer | string, options?: WriteOptions) => {
      const treePath = toTreePath(tree.root, scaffoldRoot, filePath)
      const existed = tree.exists(treePath)
      if (existed && options?.mode === Mode.SkipIfExists) {
        return
      }
      tree.write(treePath, typeof content === 'string' ? content : content.toString('utf-8'))
      if (existed) {
        tally.updated += 1
      } else {
        tally.created += 1
      }
    },
  }
}

/**
 * Scaffold a hyperfrontend feature by delegating to the SDK's `hf init`.
 *
 * First ensures `@hyperfrontend/features` is declared in the workspace root
 * `package.json` (an existing declaration is left untouched), then forwards
 * options to `runInit` in headless mode with the SDK's tree seams backed by
 * the Nx tree — every scaffolding write stages into Nx's virtual tree, so
 * `nx g ... --dry-run` previews the full change set without touching the
 * disk. When the consumer workspace has `@nx/devkit` installed, staged files
 * are formatted with it before Nx flushes them. The returned callback — run
 * by Nx only after flushing real changes — installs dependencies only when
 * the manifest was changed by this run.
 *
 * @param tree - The Nx virtual file-system tree every write is staged into.
 * @param options - Generator options forwarded to the SDK runner.
 * @returns The post-flush callback that installs when the manifest changed.
 * @throws {Error} When the underlying `hf init` run exits non-zero.
 *
 * @example Scaffold a feature in a project directory
 * ```bash
 * nx generate \@hyperfrontend/features:feature \
 *   --name=clock --contract=./clock.contract.json --entry=./src/main.ts --directory=apps/clock
 * ```
 */
export async function featureGenerator(tree: Tree, options: FeatureGeneratorSchema): Promise<GeneratorCallback> {
  // why: a workspace missing the SDK dependency gets it declared before scaffolding, so the generated glue module resolves once installed.
  const changed = ensureSdkDependency(tree, { keepExistingVersions: true })
  const tally: WriteTally = { created: 0, updated: 0 }
  const scaffoldRoot = join(tree.root, options.directory ?? '.')
  // why: nx exports the resolved --dry-run flag as NX_DRY_RUN; forwarding it keeps the SDK summary wording honest while staging still previews the change set.
  const dryRun = process.env['NX_DRY_RUN'] === 'true'
  const code = await runInit({
    flags: {
      ...headlessFlags({
        name: options.name,
        contract: options.contract,
        entry: options.entry,
        version: options.version,
        url: options.url,
      }),
      dryRun,
    },
    cwd: scaffoldRoot,
    stdout: process.stdout,
    stderr: process.stderr,
    createTreeFn: (root) => createStagingTree(tree, root, tally),
    commit: () => ({ created: tally.created, updated: tally.updated, deleted: 0, changes: [], dryRun }),
  })
  if (code !== EXIT_OK) {
    throw createError(`hf init failed with exit code ${code}.`)
  }
  const devkit = loadDevkit(tree.root)
  if (devkit?.formatFiles !== undefined) {
    // why: formatting stages writes into the tree, and Nx locks the tree before callbacks run, so it must happen pre-flush.
    await devkit.formatFiles(tree)
  }
  return () => {
    if (changed) {
      if (devkit?.installPackagesTask !== undefined) {
        devkit.installPackagesTask(tree)
      } else {
        installPackages(tree)
      }
    }
  }
}

export default featureGenerator
