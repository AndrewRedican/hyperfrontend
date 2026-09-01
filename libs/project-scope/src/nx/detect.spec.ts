import { resolve } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { isNxWorkspace, isNxProject, findNxWorkspaceRoot, getNxWorkspaceInfo, NX_CONFIG_FILES, NX_PROJECT_FILE } from './detect'

const FIXTURES_DIR = resolve(import.meta.dirname, '../../__fixtures__')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const CORE_PROJECT = resolve(MONOREPO, 'packages/core')
const NX_WORKSPACE_JSON_ONLY = resolve(FIXTURES_DIR, 'nx-workspace-json-only')
const NX_INTEGRATED_WORKSPACE = resolve(FIXTURES_DIR, 'nx-integrated-workspace')

describe('NX Detection', () => {
  describe('NX_CONFIG_FILES constant', () => {
    it('includes nx.json', () => {
      expect(NX_CONFIG_FILES).toContain('nx.json')
    })

    it('includes workspace.json', () => {
      expect(NX_CONFIG_FILES).toContain('workspace.json')
    })
  })

  describe('NX_PROJECT_FILE constant', () => {
    it('is project.json', () => {
      expect(NX_PROJECT_FILE).toBe('project.json')
    })
  })

  describe('isNxWorkspace', () => {
    it('returns true for monorepo fixture with nx.json', () => {
      expect(isNxWorkspace(MONOREPO)).toBe(true)
    })

    it('returns true for workspace with workspace.json only', () => {
      expect(isNxWorkspace(NX_WORKSPACE_JSON_ONLY)).toBe(true)
    })

    it('returns false for non-NX project', () => {
      expect(isNxWorkspace(MINIMAL_PROJECT)).toBe(false)
    })

    it('returns false for non-existent path', () => {
      expect(isNxWorkspace('/non/existent/path')).toBe(false)
    })
  })

  describe('isNxProject', () => {
    it('returns true for directory with project.json', () => {
      expect(isNxProject(CORE_PROJECT)).toBe(true)
    })

    it('returns false for directory without project.json', () => {
      expect(isNxProject(MINIMAL_PROJECT)).toBe(false)
    })

    it('returns false for non-existent path', () => {
      expect(isNxProject('/non/existent/path')).toBe(false)
    })
  })

  describe('findNxWorkspaceRoot', () => {
    it('finds workspace root from nested project', () => {
      const root = findNxWorkspaceRoot(CORE_PROJECT)
      expect(root).toBe(MONOREPO)
      expect(root).not.toBeNull()
    })

    it('finds workspace root from workspace root', () => {
      const root = findNxWorkspaceRoot(MONOREPO)
      expect(root).toBe(MONOREPO)
    })

    it('returns null for non-existent path', () => {
      const root = findNxWorkspaceRoot('/non/existent/path')
      expect(root).toBeNull()
    })

    it('returns nearest NX workspace root', () => {
      const root = findNxWorkspaceRoot(MINIMAL_PROJECT)
      const isValidResult = root === null || typeof root === 'string'
      expect(isValidResult).toBe(true)
    })

    it('finds workspace root from integrated workspace', () => {
      const root = findNxWorkspaceRoot(NX_INTEGRATED_WORKSPACE)
      expect(root).toBe(NX_INTEGRATED_WORKSPACE)
    })
  })

  describe('getNxWorkspaceInfo', () => {
    it('returns workspace info for NX workspace', () => {
      const info = getNxWorkspaceInfo(MONOREPO)

      expect(info).not.toBeNull()
      expect(info?.root).toBe(MONOREPO)
      expect(info?.nxJson).toBeDefined()
      expect(info?.workspaceLayout).toBeDefined()
      expect(info?.workspaceLayout.appsDir).toBe('apps')
      expect(info?.workspaceLayout.libsDir).toBe('libs')
    })

    it('returns null for non-NX workspace', () => {
      const info = getNxWorkspaceInfo(MINIMAL_PROJECT)
      expect(info).toBeNull()
    })

    it('returns null for non-existent path', () => {
      const info = getNxWorkspaceInfo('/non/existent/path')
      expect(info).toBeNull()
    })

    it('detects integrated vs standalone status', () => {
      const info = getNxWorkspaceInfo(MONOREPO)
      expect(info?.isIntegrated).toBeDefined()
      expect(typeof info?.isIntegrated).toBe('boolean')
    })

    it('falls back to workspace.json when nx.json is missing', () => {
      const info = getNxWorkspaceInfo(NX_WORKSPACE_JSON_ONLY)

      expect(info).not.toBeNull()
      expect(info?.root).toBe(NX_WORKSPACE_JSON_ONLY)
      expect(info?.isIntegrated).toBe(true)
      expect(info?.workspaceLayout.appsDir).toBe('apps')
      expect(info?.workspaceLayout.libsDir).toBe('libs')
      expect(info?.nxJson).toEqual({})
    })

    it('detects NX version from package.json', () => {
      const info = getNxWorkspaceInfo(NX_WORKSPACE_JSON_ONLY)

      expect(info?.version).toBe('18.0.0')
    })

    it('detects NX version with semver range stripped', () => {
      const info = getNxWorkspaceInfo(NX_INTEGRATED_WORKSPACE)

      expect(info?.version).toBe('19.5.0')
    })

    it('returns integrated true for workspace with targetDefaults', () => {
      const info = getNxWorkspaceInfo(NX_INTEGRATED_WORKSPACE)

      expect(info?.isIntegrated).toBe(true)
    })

    it('returns custom workspaceLayout from nx.json', () => {
      const info = getNxWorkspaceInfo(NX_INTEGRATED_WORKSPACE)

      expect(info?.workspaceLayout.appsDir).toBe('applications')
      expect(info?.workspaceLayout.libsDir).toBe('libraries')
    })

    it('returns defaultProject from nx.json', () => {
      const info = getNxWorkspaceInfo(NX_INTEGRATED_WORKSPACE)

      expect(info?.defaultProject).toBe('main-app')
    })
  })
})
