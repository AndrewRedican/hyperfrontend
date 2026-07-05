import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { Mode } from '@hyperfrontend/project-scope/vfs'

// note: Write-once target; re-runs never clobber handlers the author has filled in.
const MODULE_PATH = 'src/hyperfrontend.feature.ts'

/**
 * Derives the extensionless import specifier for the contract module, computed
 * relative to the directory the integration module is written into.
 *
 * @param contractPath - The config's contract path, tree-root-relative or absolute.
 * @param treeRoot - Absolute root of the tree the integration module is staged into.
 * @returns A POSIX-style relative specifier suitable for an `import` statement.
 */
function toContractImportPath(contractPath: string, treeRoot: string): string {
  const withoutExtension = contractPath.replace(/\.(json|ts|js)$/, '')
  const target = isAbsolute(withoutExtension) ? withoutExtension : join(treeRoot, withoutExtension)
  const specifier = relative(join(treeRoot, dirname(MODULE_PATH)), target)
    .split('\\')
    .join('/')
  return specifier.startsWith('.') ? specifier : `./${specifier}`
}

/**
 * Builds the feature integration module source from the contract.
 *
 * @param config - The resolved feature config naming the feature and contract path.
 * @param contract - The validated contract whose actions drive the scaffolded stubs.
 * @param treeRoot - Absolute root the config's contract path is relative to.
 * @returns The integration module source as a string.
 */
function buildFeatureModule(config: ResolvedFeatureConfig, contract: FeatureContract, treeRoot: string): string {
  const handlers = contract.accepted
    .map((action) => `feature.on('${action.type}', (_data: unknown) => {\n  // todo: handle ${action.type}\n})`)
    .join('\n\n')
  const emits = contract.emitted.map((action) => `// feature.send('${action.type}', undefined)`).join('\n')
  return `/**
 * Host integration for the "${config.name}" feature (v${config.version}).
 *
 * Wires this app to its host: registers a handler for each action the feature
 * accepts and exposes the feature handle for sending actions. Generated once and
 * safe to edit — re-running the generator never overwrites it.
 *
 * @module ${config.name}.feature
 */
import { createFeature } from '@hyperfrontend/features/hostee'
import contract from '${toContractImportPath(config.contract, treeRoot)}'

/** The ${config.name} feature handle; use it to send and receive contract actions. */
export const feature = createFeature({ name: '${config.name}', contract })

${handlers}

// note: Example emits — uncomment and supply a payload to send.
${emits}
`
}

/**
 * Stages the feature integration module into the consumer app (write-once).
 *
 * Emits `src/hyperfrontend.feature.ts` with one `feature.on` stub per `accepted`
 * action and a commented `feature.send` example per `emitted` action. Uses
 * `Mode.SkipIfExists`, so a re-run never clobbers the author's edits. The CLI
 * owns inserting the marker-guarded import into the entry file.
 *
 * @param config - The resolved feature config.
 * @param contract - The validated feature contract driving the scaffolded stubs.
 * @param tree - The VFS tree the integration module is staged into.
 *
 * @example Scaffolding the integration module for the clock feature
 * ```typescript
 * generateFeatureModule({ name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock' }, contract, tree)
 * ```
 */
export function generateFeatureModule(config: ResolvedFeatureConfig, contract: FeatureContract, tree: Tree): void {
  tree.write(MODULE_PATH, buildFeatureModule(config, contract, tree.root), { mode: Mode.SkipIfExists })
}
