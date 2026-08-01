/**
 * Channel security settings interpretation.
 *
 * Central predicates deciding whether a channel's settings ask for an
 * encrypted transport and whether plaintext fallback is forbidden.
 *
 * @module security/settings
 */

import type { ChannelSecuritySettings } from '../types/security'

/**
 * Channel security settings narrowed to a present protocol selection.
 */
export type SecuredChannelSettings = ChannelSecuritySettings & Required<Pick<ChannelSecuritySettings, 'protocol'>>

/**
 * Checks whether the settings select an encrypted protocol.
 *
 * True when a protocol other than `'none'` is configured and security is
 * not explicitly disabled. Narrows the settings so the selected protocol
 * can be read without further guards.
 *
 * @param settings - The channel security settings to inspect (may be absent)
 * @returns True when the channel should negotiate an encrypted transport
 *
 * @example Deciding whether to send a security negotiation request
 * ```typescript
 * if (requestsSecurity(settings)) {
 *   const request = createSecurityRequest([settings.protocol, 'none'])
 * }
 * ```
 */
export function requestsSecurity(settings: ChannelSecuritySettings | null | undefined): settings is SecuredChannelSettings {
  return !!settings && !settings.disabled && !!settings.protocol && settings.protocol !== 'none'
}

/**
 * Checks whether plaintext fallback is forbidden for the channel.
 *
 * True when the settings select an encrypted protocol and
 * `mode: 'fail-closed'` is set; the handshake then denies instead of
 * falling back to plaintext when encryption cannot be established.
 *
 * @param settings - The channel security settings to inspect (may be absent)
 * @returns True when a plaintext outcome must be refused
 *
 * @example Enforcing fail-closed during negotiation
 * ```typescript
 * if (requiresSecurity(settings) && negotiated === 'none') {
 *   deny('security-unavailable')
 * }
 * ```
 */
export function requiresSecurity(settings: ChannelSecuritySettings | null | undefined): boolean {
  return requestsSecurity(settings) && settings.mode === 'fail-closed'
}
