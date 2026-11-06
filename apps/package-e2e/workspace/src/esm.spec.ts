/**
 * ESM (ES Modules) E2E tests for `@hyperfrontend/workspace`.
 *
 * The packed tarball is installed into a consumer outside the workspace and every test runs under plain Node with no
 * loader hooks: every entry is imported natively, and the graph entry reads the consumer as a workspace.
 */

import { before } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { usePackedConsumer } from '@hyperfrontend/testing/consumer'

/** A workspace of one project, written into the consumer. */
const WORKSPACE = {
  'hf.json': {},
  'libs/alpha/project.json': { name: 'alpha', targets: { build: { command: 'node -e 0' } } },
}

const consumer = usePackedConsumer({ tarball: process.env['HF_E2E_TARBALL'], peers: ['@hyperfrontend/testing@0.5.1'] })

before(() => consumer.writeTree(WORKSPACE))

describe('@hyperfrontend/workspace ESM', () => {
  it('imports every export entry', () => {
    expect(consumer.entries('import').filter((entry) => !entry.ok)).toEqual([])
  })

  it('discovers the projects of the workspace it is installed in through the graph entry', () => {
    const names = consumer.run(async () => {
      const { discoverProjects, listFiles } = await import('@hyperfrontend/workspace/graph')
      return [...discoverProjects(process.cwd(), listFiles(process.cwd())).keys()]
    })
    expect(names).toContain('alpha')
  })
})
