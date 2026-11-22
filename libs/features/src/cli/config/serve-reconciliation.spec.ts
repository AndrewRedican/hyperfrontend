import type { ResolvedFeatureConfig } from '../../shared/types'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { reconcileServeIsolation, reconcileServePermissions } from './serve-reconciliation'

const FEATURE: ResolvedFeatureConfig = { name: 'probe', version: '1.0.0', contract: './probe.contract.json', url: '/' }

// note: A feature that asks its host for two browser permissions.
const CAPTURING: ResolvedFeatureConfig = { ...FEATURE, permissions: ['camera', 'geolocation'] }

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

  it('reads a rule whose prefix excludes no path as a rule for every path', () => {
    const sourcePath = withServeConfig({ headers: [{ prefix: '/', headers: { 'Cross-Origin-Opener-Policy': 'same-origin' } }] })
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

describe('reconcileServeIsolation over a serve config the server refuses', () => {
  it.each([
    ['headers that are no array', { headers: { 'Cross-Origin-Opener-Policy': 'same-origin' } }],
    ['a rule that is no object', { headers: [null] }],
    ['a rule without a headers record', { headers: [{}] }],
    ['a field the server does not take', { isolaton: 'require-corp' }],
  ])('stays silent for %s', (_label: string, refused: Record<string, unknown>) => {
    expect(reconcileServeIsolation(FEATURE, withServeConfig({ isolation: 'require-corp', ...refused }))).toBeNull()
  })
})

describe('reconcileServePermissions', () => {
  it('stays silent when the build ran without a config file', () => {
    expect(reconcileServePermissions(CAPTURING, null)).toBeNull()
  })

  it('stays silent when the project has no serve config', () => {
    expect(reconcileServePermissions(CAPTURING, tmp.resolve('feature.config.ts'))).toBeNull()
  })

  it('stays silent when the feature declares no permission', () => {
    expect(reconcileServePermissions(FEATURE, withServeConfig({ permissionsPolicy: { camera: [] } }))).toBeNull()
  })

  it('stays silent when the serve config declares no permissions policy', () => {
    expect(reconcileServePermissions(CAPTURING, withServeConfig({ embedders: ["'self'"] }))).toBeNull()
  })

  it('stays silent when the policy keeps the permission for the origin of the feature', () => {
    const sourcePath = withServeConfig({ permissionsPolicy: { camera: ['self'], geolocation: ['*'] } })
    expect(reconcileServePermissions(CAPTURING, sourcePath)).toBeNull()
  })

  it('stays silent when the policy disables only what the feature never declared', () => {
    expect(reconcileServePermissions(CAPTURING, withServeConfig({ permissionsPolicy: { microphone: [] } }))).toBeNull()
  })

  it('warns when the policy disables a permission the feature declares', () => {
    expect(reconcileServePermissions(CAPTURING, withServeConfig({ permissionsPolicy: { camera: [] } }))).toBe(
      'Warning: this feature declares the "camera" permission, but its hf-serve.config.json sends "Permissions-Policy: camera=()" on every path, which disables it in the feature\'s own document whatever the host delegates. Remove it from the serve config\'s "permissionsPolicy" or allow it with ["self"].\n'
    )
  })

  it('warns once for each disabled permission, in the order the feature declares them', () => {
    const sourcePath = withServeConfig({ permissionsPolicy: { geolocation: [], microphone: [], camera: [] } })
    expect(reconcileServePermissions(CAPTURING, sourcePath)?.match(/the "[a-z-]+" permission/g)).toEqual([
      'the "camera" permission',
      'the "geolocation" permission',
    ])
  })

  it('reads a serve config authored beside the feature config', () => {
    expect(reconcileServePermissions(CAPTURING, withServeConfig({ permissionsPolicy: { camera: [] } }, true))).toMatch(/"camera"/)
  })

  it('stays silent when a rule for every path writes the header by hand, replacing the declared policy', () => {
    const sourcePath = withServeConfig({
      permissionsPolicy: { camera: [] },
      headers: [{ headers: { 'permissions-policy': 'camera=(self)' } }],
    })
    expect(reconcileServePermissions(CAPTURING, sourcePath)).toBeNull()
  })

  it('keeps warning when only a bounded rule writes the header by hand', () => {
    const sourcePath = withServeConfig({
      permissionsPolicy: { camera: [] },
      headers: [{ prefix: '/admin/', headers: { 'Permissions-Policy': 'camera=(self)' } }],
    })
    expect(reconcileServePermissions(CAPTURING, sourcePath)).toMatch(/"Permissions-Policy: camera=\(\)"/)
  })

  it('stays silent when a rule whose prefix excludes no path writes the header by hand', () => {
    const sourcePath = withServeConfig({
      permissionsPolicy: { camera: [] },
      headers: [{ prefix: '/', suffix: '', headers: { 'Permissions-Policy': 'camera=(self)' } }],
    })
    expect(reconcileServePermissions(CAPTURING, sourcePath)).toBeNull()
  })

  it.each([
    ['headers that are no array', { headers: { 'X-Test': 'on' } }],
    ['a rule that is no object', { headers: [null] }],
    ['a rule without a headers record', { headers: [{}] }],
    ['an allowlist that is no array', { permissionsPolicy: { camera: '' } }],
    ['a field the server does not take', { permissions: { camera: [] } }],
  ])('stays silent about a serve config the server refuses to load for %s', (_label: string, refused: Record<string, unknown>) => {
    const sourcePath = withServeConfig({ permissionsPolicy: { camera: [] }, ...refused })
    expect(reconcileServePermissions(CAPTURING, sourcePath)).toBeNull()
  })

  it('stays silent about a permission the policy does not list, whatever every object inherits under that name', () => {
    const inherited = { ...FEATURE, permissions: ['toString', 'valueOf'] } as unknown as ResolvedFeatureConfig
    expect(reconcileServePermissions(inherited, withServeConfig({ permissionsPolicy: {} }))).toBeNull()
  })
})
