import type { JsonNode as ParsedNode } from '@hyperfrontend/json-utils'
import type { JsonNode } from './json-tree'
import { parseJsonSource } from '@hyperfrontend/json-utils'
import { describe, expect, it } from '@hyperfrontend/testing'

describe('the JSON tree types', () => {
  it('take the tree the JSON parser produces', () => {
    const parsed: ParsedNode | null = parseJsonSource('{ "a": [1, true, null, "x"] }').root
    // why: the assignment is the check, made by the typecheck; the parser's tree must stay assignable to the types rules are given.
    const tree: JsonNode | null = parsed
    expect(tree?.kind).toBe('object')
  })
})
