import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { processRegistry, replacements } from './registry'

describe('processRegistry', () => {
  it('hands back the same set for the same name', () => {
    assert.equal(processRegistry('spec-example'), processRegistry('spec-example'))
  })

  it('keeps the set on a registered symbol, so a separately bundled copy finds it', () => {
    assert.equal((globalThis as Record<symbol, unknown>)[Symbol.for('hyperfrontend.testing.replacements')], replacements)
  })
})
