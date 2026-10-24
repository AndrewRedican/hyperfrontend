import type { ResolvedFeatureConfig } from '../../shared/types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { reconcileServeIsolation } from './serve-reconciliation'

const FEATURE: ResolvedFeatureConfig = { name: 'probe', version: '1.0.0', contract: './probe.contract.json', url: '/' }

const tmp = useTempDir({ prefix: 'hf-reconcile-' })

/**
 * Writes a serve config into the project, in `public/` unless told otherwise.
 *
 * @param serve - The serve config contents.
 * @param beside - Whether to write it beside the feature config instead of under `public/`.
 * @returns The feature config path the reconciliation is given.
 */
function withServeConfig(serve: unknown, beside = false): string {
  tmp.write(beside ? 'hf-serve.config.json' : 'public/hf-serve.config.json', JSON.stringify(serve))
  return tmp.resolve('feature.config.ts')
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
    expect(reconcileServeIsolation(FEATURE, tmp.resolve('feature.config.ts'))).toBeNull()
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

  it('warns on same-origin-allow-popups, which still severs the opener a cross-origin host holds', () => {
    const sourcePath = withServeConfig({ headers: [{ headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' } }] })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toMatch(/never complete a handshake/)
  })

  it('stays silent when the origin spells the opener policy as unsafe-none', () => {
    const sourcePath = withServeConfig({ headers: [{ headers: { 'Cross-Origin-Opener-Policy': 'unsafe-none' } }] })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toBeNull()
  })

  it('warns when a later unbounded rule sets the opener policy the server ends up serving', () => {
    const sourcePath = withServeConfig({
      headers: [{ headers: { 'X-Test': 'on' } }, { headers: { 'Cross-Origin-Opener-Policy': 'same-origin' } }],
    })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toMatch(/never complete a handshake/)
  })

  it('stays silent when a later unbounded rule relaxes an earlier opener policy', () => {
    const sourcePath = withServeConfig({
      headers: [{ headers: { 'Cross-Origin-Opener-Policy': 'same-origin' } }, { headers: { 'Cross-Origin-Opener-Policy': 'unsafe-none' } }],
    })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toBeNull()
  })

  it('stays silent when an explicit rule takes back the opener policy a declared isolation expands to', () => {
    const sourcePath = withServeConfig({
      isolation: 'require-corp',
      headers: [{ headers: { 'Cross-Origin-Opener-Policy': 'unsafe-none' } }],
    })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toBeNull()
  })

  it('names the opener policy the origin actually serves', () => {
    const sourcePath = withServeConfig({ headers: [{ headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups' } }] })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toMatch(/"Cross-Origin-Opener-Policy: same-origin-allow-popups"/)
  })

  it('ignores an opener policy scoped to part of the origin', () => {
    const sourcePath = withServeConfig({ headers: [{ prefix: '/admin', headers: { 'Cross-Origin-Opener-Policy': 'same-origin' } }] })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toBeNull()
  })

  it('keeps warning when only a suffix-scoped rule relaxes the opener policy', () => {
    const sourcePath = withServeConfig({
      isolation: 'require-corp',
      headers: [{ suffix: '.html', headers: { 'Cross-Origin-Opener-Policy': 'unsafe-none' } }],
    })
    expect(reconcileServeIsolation(FEATURE, sourcePath)).toMatch(/never complete a handshake/)
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
