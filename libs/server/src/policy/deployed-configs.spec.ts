import type { DeployedCase } from './__test-utils__/deployed-configs'
import type { ServeConfig } from './serve-types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { DEPLOYED_CASES } from './__test-utils__/deployed-configs'
import { applyHeaderRules, expandHeaderPolicy } from './expand'
import { checkServeConfig } from './serve-config'

// how: The fold keeps a header in the place it first took, so the entries of the record are the lines in the order a response carries them.
const lines = (config: ServeConfig, path: string): string[] =>
  Object.entries(applyHeaderRules(expandHeaderPolicy(config), path)).map(([name, value]) => `${name}: ${value}`)

const ROWS = DEPLOYED_CASES.map((deployed): [string, string, DeployedCase] => [deployed.name, deployed.path, deployed])

describe('the deployed serve configs', () => {
  it.each(ROWS)('sends the deployed lines for the %s config at %s', (_name: string, path: string, deployed: DeployedCase) => {
    expect(lines(deployed.deployed, path)).toEqual(deployed.lines)
  })

  it.each(ROWS)(
    'sends the same lines for the %s config rewritten to embedders at %s',
    (_name: string, path: string, deployed: DeployedCase) => {
      expect(lines(deployed.rewritten, path)).toEqual(deployed.lines)
    }
  )

  it.each(ROWS)(
    'sends the same lines in another order for the %s config rewritten to embedders and isolation at %s',
    (_name: string, path: string, deployed: DeployedCase) => {
      const sent = lines(deployed.isolated, path)
      expect({ lines: [...sent].sort(), reordered: sent.join('\n') !== deployed.lines.join('\n') }).toEqual({
        lines: [...deployed.lines].sort(),
        reordered: true,
      })
    }
  )

  it('loads every form of every config without a problem', () => {
    expect(
      DEPLOYED_CASES.flatMap((deployed) => [deployed.deployed, deployed.rewritten, deployed.isolated]).flatMap((config) =>
        checkServeConfig(config)
      )
    ).toEqual([])
  })
})
