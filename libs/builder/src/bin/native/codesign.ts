import { spawnSync } from 'node:child_process'

/**
 * Inputs to {@link removeCodesign}.
 */
export interface RemoveCodesignInputs {
  /** Absolute path to the binary whose existing macOS signature should be removed. */
  binary: string
}

/**
 * Inputs to {@link applyCodesign}.
 */
export interface ApplyCodesignInputs {
  /** Absolute path to the binary to sign. */
  binary: string
  /** Signing identity passed to `codesign --sign`. Use `'-'` for an ad-hoc signature. */
  identity?: string
}

/**
 * Result of a codesign invocation.
 */
export interface CodesignResult {
  /** Whether the codesign command was attempted (skipped silently on non-macOS hosts). */
  ran: boolean
  /** Exit status of the codesign command, or `null` if it was skipped or did not start. */
  status: number | null
  /** Captured stderr, useful for surfacing diagnostics. */
  stderr: string
}

const isMacOs = (): boolean => process.platform === 'darwin'

/**
 * Strips the existing macOS code signature from `inputs.binary` so postject's
 * blob injection doesn't invalidate it. No-op on non-macOS hosts.
 *
 * MVP behavior: removes any existing signature with `codesign --remove-signature`.
 * Re-signing the produced binary (with a real Apple Developer ID) is left to
 * release tooling — Phase 7's responsibility ends at producing an unsigned
 * executable that runs locally.
 *
 * @param inputs - Path to the binary to clean up.
 * @returns Whether the command ran, its exit status, and captured stderr.
 *
 * @example Removing the signature on macOS before postject inject
 * ```typescript
 * removeCodesign({ binary: '/abs/dist/libs/builder/bin/hf-build.darwin-arm64' })
 * ```
 */
export const removeCodesign = (inputs: RemoveCodesignInputs): CodesignResult => {
  if (!isMacOs()) return { ran: false, status: null, stderr: '' }
  const result = spawnSync('codesign', ['--remove-signature', inputs.binary], { encoding: 'utf8' })
  return {
    ran: true,
    status: typeof result.status === 'number' ? result.status : null,
    stderr: (result.stderr ?? '').toString(),
  }
}

/**
 * Applies an ad-hoc (or identity-based) macOS code signature to the produced
 * SEA binary. No-op on non-macOS hosts.
 *
 * Defaults to `--sign -` (ad-hoc signing), which is sufficient for local
 * execution and satisfies macOS Catalina+ launch requirements without an
 * Apple Developer identity. Release tooling can pass a real identity via
 * `inputs.identity`.
 *
 * @param inputs - Binary path and optional signing identity.
 * @returns Whether the command ran, its exit status, and captured stderr.
 *
 * @example Ad-hoc signing the produced SEA binary on macOS
 * ```typescript
 * applyCodesign({ binary: '/abs/dist/libs/builder/bin/hf-build.darwin-arm64' })
 * ```
 */
export const applyCodesign = (inputs: ApplyCodesignInputs): CodesignResult => {
  if (!isMacOs()) return { ran: false, status: null, stderr: '' }
  const identity = inputs.identity ?? '-'
  const result = spawnSync('codesign', ['--sign', identity, inputs.binary], { encoding: 'utf8' })
  return {
    ran: true,
    status: typeof result.status === 'number' ? result.status : null,
    stderr: (result.stderr ?? '').toString(),
  }
}
