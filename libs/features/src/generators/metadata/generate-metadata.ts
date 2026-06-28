import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract, ResolvedFeatureConfig } from '../../shared/types'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { format } from '@hyperfrontend/versioning/semver/format'
import { parseVersionStrict } from '@hyperfrontend/versioning/semver/parse'

// note: Human- and registry-facing sidecar; the bundled connector inlines its own copy of the contract.
const METADATA_PATH = 'metadata.json'

/**
 * Stages the connector's `metadata.json` describing the feature and its contract.
 *
 * Stamps a canonical version string via `@hyperfrontend/versioning` and embeds
 * the contract so humans and the registry can inspect the feature without
 * unpacking the bundle.
 *
 * @param config - The resolved feature config supplying name, version, and URL.
 * @param contract - The validated contract embedded for inspection.
 * @param tree - The VFS tree the metadata file is staged into.
 *
 * @example Staging metadata for the clock feature
 * ```typescript
 * generateMetadata({ name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock' }, contract, tree)
 * ```
 */
export function generateMetadata(config: ResolvedFeatureConfig, contract: FeatureContract, tree: Tree): void {
  const metadata = {
    name: config.name,
    version: format(parseVersionStrict(config.version)),
    url: config.url,
    contract,
    generatedBy: '@hyperfrontend/features',
  }
  tree.write(METADATA_PATH, `${stringify(metadata, null, 2)}\n`)
}
