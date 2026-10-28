/**
 * Type-level E2E test for `@hyperfrontend/features`'s Nx support: inside a real Nx workspace,
 * the generated declarations the workspace's tooling is written against and the published
 * generators and executors must agree with the `@nx/devkit` installed there.
 */

import type { ConsumerWorkspace } from './support/nx-workspace'
import { spawnSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { before as beforeAll, after as afterAll } from 'node:test'
import { describe, it, expect } from '@hyperfrontend/testing'
import { SCENARIO_TIMEOUT, SETUP_TIMEOUT, createConsumerWorkspace, installUnsaved } from './support/nx-workspace'
import { writeTypesProbe } from './support/nx-types-probe'

describe('@hyperfrontend/features Nx types', () => {
  let workspace: ConsumerWorkspace
  let status: number | null
  let output: string

  beforeAll(
    () => {
      workspace = createConsumerWorkspace('hf-nx-types-')
      // why: the generated declarations name node:fs types, and the created workspace installs no Node.js typings
      installUnsaved(workspace.pristineDir, ['@types/node@24'])
      const tsconfig = writeTypesProbe(workspace.pristineDir)
      const tsc = join(workspace.pristineDir, 'node_modules', 'typescript', 'bin', 'tsc')
      const result = spawnSync(process.execPath, [tsc, '-p', tsconfig], {
        cwd: workspace.pristineDir,
        encoding: 'utf8',
        timeout: SCENARIO_TIMEOUT,
      })
      status = result.status
      output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    },
    { timeout: SETUP_TIMEOUT + SCENARIO_TIMEOUT }
  )

  afterAll(() => {
    rmSync(workspace.workRoot, { recursive: true, force: true })
  })

  it('type checks the generated declarations and the published plugin against the installed devkit', () => {
    expect({ status, output }).toEqual({ status: 0, output: '' })
  })
})
