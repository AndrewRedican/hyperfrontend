/**
 * The host's name for one swimming koi.
 *
 * A framework names an app; it stops naming a fish the moment two koi of one
 * framework swim at once. Everything session-shaped in the host — layers,
 * relay records, depth states, held chrome, revival budgets — keys by this
 * instance id instead: the framework plus an ordinal, carried as one string so
 * it drops straight into a `Map` and a `data-` attribute. The wire never sees
 * it; the contract speaks framework and ordinal separately, and the host
 * converts at that boundary alone.
 */
import type { KoiFramework } from '@hyperfrontend/demo-koi-lib'

/** One koi instance's host-side key: its framework slug and its ordinal, joined. */
export type KoiInstanceId = `${KoiFramework}:${number}`

/**
 * Builds the instance id for one of a framework's koi.
 *
 * @param framework - The framework rendering the koi.
 * @param ordinal - Which of that framework's koi it is; 0 is the canonical fish.
 * @returns The instance id.
 *
 * @example Keying a session map
 * ```typescript
 * sessions.set(koiInstanceId('react', 1), session)
 * ```
 */
export function koiInstanceId(framework: KoiFramework, ordinal: number): KoiInstanceId {
  return `${framework}:${ordinal}`
}

/**
 * Reads the framework half of an instance id.
 *
 * @param id - The instance id.
 * @returns The framework slug.
 */
export function instanceFramework(id: KoiInstanceId): KoiFramework {
  return <KoiFramework>id.slice(0, id.indexOf(':'))
}

/**
 * Reads the ordinal half of an instance id.
 *
 * @param id - The instance id.
 * @returns The ordinal; 0 is the framework's canonical fish.
 */
export function instanceOrdinal(id: KoiInstanceId): number {
  return Number(id.slice(id.indexOf(':') + 1))
}
