import type { DisplayMode, FeatureContract } from '../../shared/types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { buildShellTypes } from './shell-types'

const allModes: DisplayMode[] = ['embedded', 'dialog', 'popup', 'standalone']

const contract: FeatureContract = {
  emitted: [
    {
      type: 'timeUpdated',
      description: 'Fires every second with the current time.',
      schema: { type: 'object', properties: { iso: { type: 'string' } }, required: ['iso'] },
    },
    { type: 'stopped' },
  ],
  accepted: [
    {
      type: 'setTimezone',
      description: 'Switches the displayed timezone.',
      schema: { type: 'object', properties: { tz: { type: 'string' } }, required: ['tz'] },
    },
  ],
}

describe('buildShellTypes', () => {
  it('projects host-sendable payloads from the feature-accepted actions', () => {
    expect(buildShellTypes(contract, allModes)).toContain(
      'export interface HostSendPayloads {\n  /** Switches the displayed timezone. */\n  setTimezone: {\n    tz: string\n  }\n}'
    )
  })

  it('projects host-receivable payloads from the feature-emitted actions', () => {
    expect(buildShellTypes(contract, allModes)).toContain('timeUpdated: {\n    iso: string\n  }')
  })

  it('maps an action without a schema to an unknown payload', () => {
    expect(buildShellTypes(contract, allModes)).toContain('stopped: unknown')
  })

  it('turns action descriptions into JSDoc on the payload members', () => {
    expect(buildShellTypes(contract, allModes)).toContain('/** Fires every second with the current time. */')
  })

  it('defuses a comment terminator inside an action description', () => {
    const hostile: FeatureContract = { emitted: [], accepted: [{ type: 'x', description: 'evil */ tail' }] }
    expect(buildShellTypes(hostile, allModes)).toContain('/** evil *\\/ tail */')
  })

  it('quotes an action type that is not a valid identifier', () => {
    const dashed: FeatureContract = { emitted: [], accepted: [{ type: 'set-zone' }] }
    expect(buildShellTypes(dashed, allModes)).toContain("'set-zone': unknown")
  })

  it('renders an empty payload map for a side with no actions', () => {
    expect(buildShellTypes({ emitted: [], accepted: [] }, allModes)).toContain('export interface HostSendPayloads {}')
  })

  it('derives the literal action-name unions from the payload maps', () => {
    expect(buildShellTypes(contract, allModes)).toContain('export type HostSendType = keyof HostSendPayloads')
  })

  it('declares the structural typed handle for tarball-only consumers', () => {
    expect(buildShellTypes(contract, allModes)).toContain('export interface FeatureShellHandle {')
  })

  it('types request payloads from the accepted-action map on the handle', () => {
    expect(buildShellTypes(contract, allModes)).toContain(
      'request<T extends HostSendType>(type: T, data?: HostSendPayloads[T], options?: FeatureRequestOptions): Promise<unknown>'
    )
  })

  it('declares the per-request options interface with the timeout override', () => {
    expect(buildShellTypes(contract, allModes)).toContain(
      'export interface FeatureRequestOptions {\n  /** Milliseconds to wait for the response before rejecting; defaults to 30000. */\n  timeoutMs?: number\n}'
    )
  })

  it('declares the structured unresponsive error payload with its discriminator', () => {
    expect(buildShellTypes(contract, allModes)).toContain(
      "export interface FeatureUnresponsiveError {\n  /** Discriminates the unresponsive error from other `error` payloads. */\n  reason: 'unresponsive'"
    )
  })

  it('declares the structured open-failed error payload with its discriminator', () => {
    expect(buildShellTypes(contract, allModes)).toContain(
      "export interface FeatureOpenFailedError {\n  /** Discriminates the open-failure error from other `error` payloads. */\n  reason: 'open-failed'"
    )
  })

  it('types request handlers from the emitted-action map on the handle', () => {
    expect(buildShellTypes(contract, allModes)).toContain(
      'handle<T extends HostEventType>(type: T, handler: (data: HostEventPayloads[T]) => unknown): () => void'
    )
  })

  it('declares the readonly dirty-state mirror on the handle', () => {
    expect(buildShellTypes(contract, allModes)).toContain('readonly isDirty: boolean')
  })

  it('declares structural shell options with no SDK type imports', () => {
    expect(buildShellTypes(contract, allModes)).not.toContain('import')
  })

  it('unions every declared mode in declaration order', () => {
    expect(buildShellTypes(contract, allModes)).toContain("export type FeatureDisplayMode = 'embedded' | 'dialog' | 'popup' | 'standalone'")
  })

  it('narrows FeatureDisplayMode to a single declared mode', () => {
    expect(buildShellTypes(contract, ['embedded'])).toContain("export type FeatureDisplayMode = 'embedded'\n")
  })

  it('omits the frame surface entirely for a windowed-only feature', () => {
    const types = buildShellTypes(contract, ['popup', 'standalone'])
    expect(types).not.toContain('FeatureSandboxOptions')
    expect(types).not.toContain('sandbox')
    expect(types).not.toContain('permissions')
    expect(types).not.toContain('container')
  })

  it('emits the frame surface when an iframe mode is declared', () => {
    const types = buildShellTypes(contract, ['dialog'])
    expect(types).toContain('export interface FeatureSandboxOptions {')
    expect(types).toContain('sandbox?: boolean | FeatureSandboxOptions')
    expect(types).toContain('permissions?: readonly string[]')
  })

  it('requires container when embedded is the first declared mode', () => {
    const types = buildShellTypes(contract, ['embedded', 'dialog'])
    expect(types).toContain('  container: string | HTMLElement')
    expect(types).not.toContain('container?:')
  })

  it('makes container optional when embedded is not the default mode', () => {
    expect(buildShellTypes(contract, ['dialog', 'embedded'])).toContain('  container?: string | HTMLElement')
  })

  it('omits the embed options for a dialog-only feature', () => {
    const types = buildShellTypes(contract, ['dialog'])
    expect(types).not.toContain('container')
    expect(types).not.toContain('embedWidth')
    expect(types).toContain('dialogBackdrop?:')
  })

  it('omits the dialog options when dialog is not declared', () => {
    const types = buildShellTypes(contract, ['embedded'])
    expect(types).not.toContain('dialogWidth')
    expect(types).not.toContain('closeOnEscape')
  })

  it('emits the popup dimensions only when popup is declared', () => {
    expect(buildShellTypes(contract, ['popup', 'standalone'])).toContain('popupWidth?: number')
    expect(buildShellTypes(contract, ['embedded'])).not.toContain('popupWidth')
  })

  it('declares the nine-value position union when dialog is declared', () => {
    expect(buildShellTypes(contract, ['dialog'])).toContain(
      "export type FeatureBoxPosition =\n  | 'center'\n  | 'top-left'\n  | 'top-center'\n  | 'top-right'\n  | 'center-left'\n  | 'center-right'\n  | 'bottom-left'\n  | 'bottom-center'\n  | 'bottom-right'"
    )
  })

  it('declares the position union when only popup needs it', () => {
    expect(buildShellTypes(contract, ['popup'])).toContain('export type FeatureBoxPosition =')
  })

  it('omits the position union when neither positioned mode is declared', () => {
    expect(buildShellTypes(contract, ['embedded', 'standalone'])).not.toContain('FeatureBoxPosition')
  })

  it('types the dialog position option from the position union', () => {
    expect(buildShellTypes(contract, ['dialog'])).toContain('dialogPosition?: FeatureBoxPosition')
  })

  it('omits the dialog position option when dialog is not declared', () => {
    expect(buildShellTypes(contract, ['popup'])).not.toContain('dialogPosition')
  })

  it('types the popup position option from the position union', () => {
    expect(buildShellTypes(contract, ['popup'])).toContain('popupPosition?: FeatureBoxPosition')
  })

  it('omits the popup position option when popup is not declared', () => {
    expect(buildShellTypes(contract, ['dialog'])).not.toContain('popupPosition')
  })

  it('documents the first declared mode as the displayMode default', () => {
    expect(buildShellTypes(contract, ['popup', 'standalone'])).toContain('How the feature should be surfaced; defaults to `popup`.')
  })

  it('adds dismiss to the lifecycle union when dialog is declared', () => {
    expect(buildShellTypes(contract, ['dialog'])).toContain("'open' | 'closing' | 'close' | 'error' | 'status' | 'dirty-state' | 'dismiss'")
  })

  it('keeps dismiss out of the lifecycle union without dialog', () => {
    const types = buildShellTypes(contract, ['embedded'])
    expect(types).toContain("'open' | 'closing' | 'close' | 'error' | 'status' | 'dirty-state', handler")
    expect(types).not.toContain("'dismiss'")
  })
})
