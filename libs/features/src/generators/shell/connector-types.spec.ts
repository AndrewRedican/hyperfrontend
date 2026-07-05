import type { FeatureContract } from '../../shared/types'
import { buildConnectorTypes } from './connector-types'

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

describe('buildConnectorTypes', () => {
  it('projects host-sendable payloads from the feature-accepted actions', () => {
    expect(buildConnectorTypes(contract)).toContain(
      'export interface HostSendPayloads {\n  /** Switches the displayed timezone. */\n  setTimezone: {\n    tz: string\n  }\n}'
    )
  })

  it('projects host-receivable payloads from the feature-emitted actions', () => {
    expect(buildConnectorTypes(contract)).toContain('timeUpdated: {\n    iso: string\n  }')
  })

  it('maps an action without a schema to an unknown payload', () => {
    expect(buildConnectorTypes(contract)).toContain('stopped: unknown')
  })

  it('turns action descriptions into JSDoc on the payload members', () => {
    expect(buildConnectorTypes(contract)).toContain('/** Fires every second with the current time. */')
  })

  it('defuses a comment terminator inside an action description', () => {
    const hostile: FeatureContract = { emitted: [], accepted: [{ type: 'x', description: 'evil */ tail' }] }
    expect(buildConnectorTypes(hostile)).toContain('/** evil *\\/ tail */')
  })

  it('quotes an action type that is not a valid identifier', () => {
    const dashed: FeatureContract = { emitted: [], accepted: [{ type: 'set-zone' }] }
    expect(buildConnectorTypes(dashed)).toContain("'set-zone': unknown")
  })

  it('renders an empty payload map for a side with no actions', () => {
    expect(buildConnectorTypes({ emitted: [], accepted: [] })).toContain('export interface HostSendPayloads {}')
  })

  it('derives the literal action-name unions from the payload maps', () => {
    expect(buildConnectorTypes(contract)).toContain('export type HostSendType = keyof HostSendPayloads')
  })

  it('declares the structural typed handle for tarball-only consumers', () => {
    expect(buildConnectorTypes(contract)).toContain('export interface FeatureShellHandle {')
  })

  it('declares structural shell options with no SDK type imports', () => {
    expect(buildConnectorTypes(contract)).not.toContain('import')
  })
})
