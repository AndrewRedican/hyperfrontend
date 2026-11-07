import type { ProjectConfiguration } from '../../../runner/contract'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from '@hyperfrontend/testing'
import { useTempDir } from '@hyperfrontend/testing/fs'
import { updateDependentVersions } from './update-dependent-versions'

const workspace = useTempDir({
  tree: {
    'libs/core/package.json': JSON.stringify({ name: '@scope/core', version: '1.0.0' }),
    'libs/consumer/package.json': JSON.stringify({ name: '@scope/consumer', dependencies: { '@scope/core': '1.0.0' } }),
    'libs/current/package.json': JSON.stringify({ name: '@scope/current', dependencies: { '@scope/core': '1.1.0' } }),
    'libs/unrelated/package.json': JSON.stringify({ name: '@scope/unrelated', dependencies: { other: '1.0.0' } }),
    'apps/demo/package.json': JSON.stringify({ name: 'demo', dependencies: { '@scope/core': '1.0.0' } }),
    'apps/demo/package-lock.json': '{}',
    'package.json': JSON.stringify({ name: 'root', devDependencies: { '@scope/core': '1.0.0' } }),
    'package-lock.json': '{}',
  },
})

/** The projects of the workspace, as the executor context carries them. */
const PROJECTS: Readonly<Record<string, ProjectConfiguration>> = {
  core: { name: 'core', root: 'libs/core' },
  consumer: { name: 'consumer', root: 'libs/consumer' },
  current: { name: 'current', root: 'libs/current' },
  unrelated: { name: 'unrelated', root: 'libs/unrelated' },
  bare: { name: 'bare', root: 'libs/bare' },
  demo: { name: 'demo', root: 'apps/demo' },
  root: { name: 'root', root: '.' },
}

/**
 * Reads the pin a manifest of the workspace holds on the core package.
 *
 * @param relativePath - The manifest, workspace-relative
 * @returns The pinned version
 */
function pinOf(relativePath: string): string | undefined {
  const manifest = JSON.parse(readFileSync(workspace.resolve(relativePath), 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  return manifest.dependencies?.['@scope/core'] ?? manifest.devDependencies?.['@scope/core']
}

describe('updateDependentVersions', () => {
  it('brings the projects that pin the package to the version, and names their manifests', () => {
    const files = updateDependentVersions('@scope/core', '1.1.0', workspace.path, PROJECTS, 'core', false)
    expect({ files, pin: pinOf('libs/consumer/package.json') }).toEqual({ files: ['libs/consumer/package.json'], pin: '1.1.0' })
  })

  it('leaves a project that installs from the registry through a lock file of its own, the root included', () => {
    updateDependentVersions('@scope/core', '1.1.0', workspace.path, PROJECTS, 'core', false)
    expect({ demo: pinOf('apps/demo/package.json'), root: pinOf('package.json') }).toEqual({ demo: '1.0.0', root: '1.0.0' })
  })

  it('leaves the versioned project itself, even when it pins the package', () => {
    expect(updateDependentVersions('@scope/core', '1.1.0', workspace.path, PROJECTS, 'current', false)).toEqual([
      'libs/consumer/package.json',
    ])
  })

  it('writes nothing on a dry run and still names what it would change', () => {
    expect({
      files: updateDependentVersions('@scope/core', '1.1.0', workspace.path, PROJECTS, 'core', true),
      pin: pinOf('libs/consumer/package.json'),
    }).toEqual({ files: ['libs/consumer/package.json'], pin: '1.0.0' })
  })

  it('answers nothing when a project root cannot be read', () => {
    expect(
      updateDependentVersions('@scope/core', '1.1.0', workspace.path, { broken: { root: undefined as unknown as string } }, 'core', false)
    ).toEqual([])
  })
})
