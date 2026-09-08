import type { ResolvedFeatureConfig } from '../../shared/types'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { reconcileServeIsolation } from './serve-reconciliation'

const FEATURE: ResolvedFeatureConfig = { name: 'probe', version: '1.0.0', contract: './probe.contract.json', url: '/' }

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hf-reconcile-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/**
 * Writes a serve config into the project, in `public/` unless told otherwise.
 *
 * @param serve - The serve config contents.
 * @param beside - Whether to write it beside the feature config instead of under `public/`.
 * @returns The feature config path the reconciliation is given.
 */
function withServeConfig(serve: unknown, beside = false): string {
  const target = beside ? dir : join(dir, 'public')
  if (!beside) {
    mkdirSync(target, { recursive: true })
  }
  writeFileSync(join(target, 'hf-serve.config.json'), JSON.stringify(serve))
  return join(dir, 'feature.config.ts')
}

describe('reconcileServeIsolation', () => {
  it('stays silent when the build ran without a config file', () => {
    expect(reconcileServeIsolation(FEATURE, null)).toBeNull()
  })

  it('stays silent when the feature declared its own isolation', () => {
    const sourcePath = withServeConfig({ isolation: 'require-corp' })
    expect(reconcileServeIsolation({ ...FEATURE, isolation: 'require-corp' }, sourcePath)).toBeNull()
  })

  it('stays silent when the project has no serve config', () => {
    expect(reconcileServeIsolation(FEATURE, join(dir, 'feature.config.ts'))).toBeNull()
  })

  it('stays silent when the served origin sets no opener policy', () => {
    expect(reconcileServeIsolation(FEATURE, withServeConfig({ headers: [{ headers: { 'X-Test': 'on' } }] }))).toBeNull()
  })

  it('warns when the served origin declares isolation and the feature composes windowed modes', () => {
    expect(reconcileServeIsolation(FEATURE, withServeConfig({ isolation: 'require-corp' }))).toMatch(/composes "popup" and "standalone"/)
  })

  it('warns when the served origin spells the opener policy by hand', () => {
    const sourcePath = withServeConfig({ headers: [{ headers: { 'Cross-Origin-Opener-Policy': 'same-origin' } }] })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toMatch(/never complete a handshake/)
  })

  it('matches the opener policy header whatever its case', () => {
    const sourcePath = withServeConfig({ headers: [{ headers: { 'cross-origin-opener-policy': 'SAME-ORIGIN' } }] })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toMatch(/never complete a handshake/)
  })

  it('reads a serve config authored beside the feature config', () => {
    expect(reconcileServeIsolation(FEATURE, withServeConfig({ isolation: 'credentialless' }, true))).toMatch(/composes/)
  })

  it('leaves same-origin-allow-popups alone, which governs windows the document opens', () => {
    const sourcePath = withServeConfig({ headers: [{ headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' } }] })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toBeNull()
  })

  it('ignores an opener policy scoped to part of the origin', () => {
    const sourcePath = withServeConfig({ headers: [{ prefix: '/admin', headers: { 'Cross-Origin-Opener-Policy': 'same-origin' } }] })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toBeNull()
  })

  it('stays silent when the feature composes only the framed modes', () => {
    const sourcePath = withServeConfig({ isolation: 'require-corp' })
    expect(reconcileServeIsolation({ ...FEATURE, display: { modes: ['embedded', 'dialog'] } }, sourcePath)).toBeNull()
  })

  it('names only the windowed modes the feature actually composes', () => {
    const sourcePath = withServeConfig({ isolation: 'require-corp' })
    expect(reconcileServeIsolation({ ...FEATURE, display: { modes: ['embedded', 'popup'] } }, sourcePath)).toMatch(/composes "popup",/)
  })
})
