/**
 * CJS (CommonJS) E2E tests for `@hyperfrontend/workspace`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node with no
 * loader hooks: the CommonJS build of every entry is required natively.
 */

'use strict'

const { describe, it, expect } = require('@hyperfrontend/testing')
const { usePackedConsumer } = require('@hyperfrontend/testing/consumer')

const consumer = usePackedConsumer({ tarball: process.env.HF_E2E_TARBALL, peers: ['@hyperfrontend/testing@0.5.1'] })

describe('@hyperfrontend/workspace CJS', () => {
  it('requires every export entry', () => {
    expect(consumer.entries('require').filter((entry) => !entry.ok)).toEqual([])
  })
})
