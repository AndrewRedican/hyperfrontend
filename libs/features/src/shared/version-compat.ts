import type { ContractCompatibility } from '@hyperfrontend/nexus'
import type { SemVer } from '@hyperfrontend/versioning/semver/models'
import type { FeatureContract } from './types'
import { parseVersion } from '@hyperfrontend/versioning/semver/parse'

/**
 * Rule deciding whether two announced feature contracts may interoperate.
 */
export type ContractCompatRule = (own: FeatureContract, peer: FeatureContract) => ContractCompatibility

/**
 * Reports whether two contract versions may interoperate under caret semantics.
 *
 * @param own - The parsed local version.
 * @param peer - The parsed counterpart version.
 * @returns `true` when the majors match, and for major `0` the minors too.
 */
function isCompatible(own: SemVer, peer: SemVer): boolean {
  // why: Caret semantics — majors break compatibility, and the 0.x range treats every minor as breaking; the rule is symmetric, so either side reaches the same verdict.
  return own.major === peer.major && (own.major !== 0 || own.minor === peer.minor)
}

/**
 * Creates the contract-version compatibility rule applied during the
 * connection handshake.
 *
 * The rule is deliberately permissive about absence: when either side
 * announces no version (peers built before versions existed, or contracts
 * that never declared one), the pair is compatible. When both sides announce
 * one, the versions must share a major — and, below `1.0.0`, a minor — to
 * interoperate; anything else is incompatible with a reason naming both
 * versions, surfaced as the connection-denial error.
 *
 * @returns A rule comparing the local and counterpart contracts.
 *
 * @example Checking two contract cuts for compatibility
 * ```typescript
 * const compat = createContractCompat()
 * compat({ emitted: [], accepted: [], version: '1.2.0' }, { emitted: [], accepted: [], version: '1.9.3' })
 * // => { compatible: true }
 * ```
 */
export function createContractCompat(): ContractCompatRule {
  return (own: FeatureContract, peer: FeatureContract): ContractCompatibility => {
    if (own.version === undefined || peer.version === undefined) {
      return { compatible: true }
    }
    const ownParsed = parseVersion(own.version).version
    const peerParsed = parseVersion(peer.version).version
    if (ownParsed === undefined || peerParsed === undefined) {
      return {
        compatible: false,
        reason: `Unrecognized contract version: this side announces "${own.version}" and the counterpart announces "${peer.version}"; both must be valid semver versions.`,
      }
    }
    if (!isCompatible(ownParsed, peerParsed)) {
      return {
        compatible: false,
        reason: `Incompatible contract versions: this side holds ${own.version} and the counterpart holds ${peer.version}.`,
      }
    }
    return { compatible: true }
  }
}
