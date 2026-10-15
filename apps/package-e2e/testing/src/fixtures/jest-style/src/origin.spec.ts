import { describe, expect, it } from '@hyperfrontend/testing'

describe('the runtime a fixture imports', () => {
  it('is the copy installed under the consumer project, not a workspace alias', () => {
    expect(import.meta.resolve('@hyperfrontend/testing')).toContain('/node_modules/@hyperfrontend/testing/index.mjs')
  })
})
