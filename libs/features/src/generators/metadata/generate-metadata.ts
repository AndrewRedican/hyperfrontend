import type { Tree } from '@hyperfrontend/project-scope/vfs'
import type { FeatureContract, FeatureDescriptor, ResolvedFeatureConfig } from '../../shared/types'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { canonicalVersion } from '../shared/canonical-version'
import { resolveSdkVersion } from './sdk-version'

// note: Human- and registry-facing sidecar; the bundled connector inlines its own copy of the contract.
const METADATA_PATH = 'metadata.json'

/**
 * Stages the connector's `metadata.json` describing the feature and its contract.
 *
 * Stamps a canonical version string via `@hyperfrontend/versioning` and embeds
 * the contract, the baked security protocol, any declared browser permissions,
 * and the version of the SDK that ran the build, so humans and the registry
 * can inspect the feature without unpacking the bundle. The staged file
 * matches {@link FeatureDescriptor}.
 *
 * @param config - The resolved feature config supplying name, version, URL, and protocol.
 * @param contract - The validated contract embedded for inspection.
 * @param tree - The VFS tree the metadata file is staged into.
 *
 * @example Staging metadata for the clock feature
 * ```typescript
 * generateMetadata({ name: 'clock', version: '1.0.0', contract: './clock.contract.json', url: '/clock', protocol: 'v2' }, contract, tree)
 * ```
 */
export function generateMetadata(config: ResolvedFeatureConfig, contract: FeatureContract, tree: Tree): void {
  const metadata: FeatureDescriptor = {
    name: config.name,
    version: canonicalVersion(config.version),
    url: config.url,
    contract,
    ...(config.protocol !== undefined && { protocol: config.protocol }),
    ...(config.permissions !== undefined && { permissions: config.permissions }),
    generatedBy: '@hyperfrontend/features',
    sdk: resolveSdkVersion(),
  }
  tree.write(METADATA_PATH, `${stringify(metadata, null, 2)}\n`)
}
