import type { JsonObjectNode } from '@hyperfrontend/json-utils'
import { parseJsonSource } from '@hyperfrontend/json-utils'
import { describe, expect, it } from '@hyperfrontend/testing'
import { lastPropertyOf } from './last-property.ts'

/** Named inputs as `hf.json` writes them, one of them twice. */
const NAMED_INPUTS = parseJsonSource('{ "engine": ["src/runner/**"], "toolchain": ["src/build.ts"], "engine": ["src/cli/**"] }')
  .root as JsonObjectNode

describe('lastPropertyOf', () => {
  it('answers the last property of a key written twice, as a JSON reader does', () => {
    expect(lastPropertyOf(NAMED_INPUTS, 'engine')).toBe(NAMED_INPUTS.properties[2])
  })

  it('answers the property of a key written once', () => {
    expect(lastPropertyOf(NAMED_INPUTS, 'toolchain')).toBe(NAMED_INPUTS.properties[1])
  })

  it('answers null for a key the object does not write', () => {
    expect(lastPropertyOf(NAMED_INPUTS, 'documented')).toBeNull()
  })
})
