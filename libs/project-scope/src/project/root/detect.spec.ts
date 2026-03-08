import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import { findNearestPackageJson } from '../package'
import { findProjectRoot, findWorkspaceRoot, findRootDirectory, findGitRoot, ROOT_MARKERS, WORKSPACE_MARKERS } from './detect'

const FIXTURES_DIR = resolve(__dirname, '../../../__fixtures__')
const MINIMAL_PROJECT = resolve(FIXTURES_DIR, 'minimal-project')
const MONOREPO = resolve(FIXTURES_DIR, 'monorepo')
const PROJECT_JSON_ONLY = resolve(FIXTURES_DIR, 'project-json-only')
const ENTRY_FILE_ONLY = resolve(FIXTURES_DIR, 'entry-file-only')
const NO_MARKERS_PROJECT = resolve(FIXTURES_DIR, 'no-markers-project')
const BARE_PACKAGE = resolve(FIXTURES_DIR, 'bare-package')
const WORKSPACE_ONLY = resolve(FIXTURES_DIR, 'workspace-only')
const NX_INTEGRATED_APP = resolve(FIXTURES_DIR, 'nx-integrated-workspace/applications/main-app')
const MONOREPO_UTILS = resolve(FIXTURES_DIR, 'monorepo/packages/utils')
const GIT_ROOT = resolve(__dirname, '../../../../..')

describe('findProjectRoot', () => {
  it('finds project root from project directory', () => {
    const result = findProjectRoot(MINIMAL_PROJECT)

    expect(result).toBe(MINIMAL_PROJECT)
  })

  it('finds project root from nested directory', () => {
    const result = findProjectRoot(resolve(MINIMAL_PROJECT, 'src'))

    expect(result).toBe(MINIMAL_PROJECT)
  })

  it('finds nested project in monorepo', () => {
    const result = findProjectRoot(resolve(MONOREPO, 'packages/core/src'))

    expect(result).toBe(resolve(MONOREPO, 'packages/core'))
  })

  it('returns null for non-existent path', () => {
    const result = findProjectRoot('/tmp/non-existent-project')

    expect(result).toBeNull()
  })

  it('finds project root when only project.json exists (no src folder)', () => {
    const result = findProjectRoot(PROJECT_JSON_ONLY)

    expect(result).toBe(PROJECT_JSON_ONLY)
  })

  it('finds project root when only entry file exists at root (no src folder)', () => {
    const result = findProjectRoot(ENTRY_FILE_ONLY)

    expect(result).toBe(ENTRY_FILE_ONLY)
  })

  it('finds project root with src folder', () => {
    const result = findProjectRoot(NO_MARKERS_PROJECT)

    expect(result).toBe(NO_MARKERS_PROJECT)
  })

  it('finds project root from deeply nested path', () => {
    const result = findProjectRoot(resolve(MINIMAL_PROJECT, 'src/nested/deep'))

    expect(result).toBe(MINIMAL_PROJECT)
  })

  it('does not consider bare package as project root (no src, entry points, or project.json)', () => {
    // A directory with only package.json and no identifying features
    // should not be detected as a project root
    const result = findProjectRoot(BARE_PACKAGE)

    // It will traverse up and find the fixtures directory or hyperfrontend workspace
    // which have package.json AND looksLikeProjectDir returns true
    expect(result).not.toBe(BARE_PACKAGE)
  })

  it('finds project root via project.json when package.json does not exist', () => {
    const result = findProjectRoot(PROJECT_JSON_ONLY)

    expect(result).toBe(PROJECT_JSON_ONLY)
  })

  it('finds project root for NX-style project with only project.json (no package.json)', () => {
    const result = findProjectRoot(NX_INTEGRATED_APP)

    expect(result).toBe(NX_INTEGRATED_APP)
  })

  it('finds project root via project.json in monorepo package without package.json', () => {
    const result = findProjectRoot(MONOREPO_UTILS)

    expect(result).toBe(MONOREPO_UTILS)
  })
})

describe('findWorkspaceRoot', () => {
  it('finds workspace root with nx.json', () => {
    const result = findWorkspaceRoot(resolve(MONOREPO, 'packages/core'))

    expect(result).toBe(MONOREPO)
  })

  it('finds workspace root with workspaces field', () => {
    const result = findWorkspaceRoot(resolve(MONOREPO, 'packages/core'))

    expect(result).toBe(MONOREPO)
  })

  it('finds workspace root from deeply nested path', () => {
    const result = findWorkspaceRoot(resolve(MONOREPO, 'packages/core/src'))

    expect(result).toBe(MONOREPO)
  })

  it('falls back to finding the actual workspace root when starting from a project inside it', () => {
    const result = findWorkspaceRoot(MINIMAL_PROJECT)

    // MINIMAL_PROJECT is inside the actual hyperfrontend workspace, so it finds that
    expect(result).toBe(GIT_ROOT)
  })

  it('falls back to nearest package.json when no workspace markers exist', () => {
    const result = findWorkspaceRoot(NO_MARKERS_PROJECT)

    // This should eventually find the hyperfrontend workspace root
    expect(result).toBe(GIT_ROOT)
  })

  it('returns null when no workspace root can be found', () => {
    const result = findWorkspaceRoot('/tmp')

    expect(result).toBeNull()
  })

  it('finds workspace root by workspace markers before checking workspaces field', () => {
    // The workspace-only fixture is nested inside hyperfrontend which has nx.json,
    // so the function correctly finds the parent workspace root first (by marker)
    const result = findWorkspaceRoot(resolve(WORKSPACE_ONLY, 'packages/nested/src'))

    // Since WORKSPACE_ONLY is inside GIT_ROOT (which has nx.json), it finds that first
    expect(result).toBe(GIT_ROOT)
  })
})

describe('findWorkspaceRoot with isolated temp directories', () => {
  let TEMP_WORKSPACE: string

  beforeAll(() => {
    // Create a secure temporary directory
    TEMP_WORKSPACE = mkdtempSync(join(tmpdir(), 'test-workspace-detection-'))

    // Create a workspace with workspaces field but no workspace markers
    mkdirSync(join(TEMP_WORKSPACE, 'packages', 'app', 'src'), { recursive: true })
    writeFileSync(join(TEMP_WORKSPACE, 'package.json'), JSON.stringify({ name: 'test-workspace', workspaces: ['packages/*'] }))
    writeFileSync(join(TEMP_WORKSPACE, 'packages', 'app', 'package.json'), JSON.stringify({ name: 'test-app' }))
  })

  afterAll(() => {
    rmSync(TEMP_WORKSPACE, { recursive: true, force: true })
  })

  it('finds workspace root by workspaces field when no workspace markers exist', () => {
    const result = findWorkspaceRoot(join(TEMP_WORKSPACE, 'packages', 'app', 'src'))

    expect(result).toBe(TEMP_WORKSPACE)
  })

  it('falls back to nearest package.json for deeply nested project without workspaces', () => {
    // Create a secure temporary directory for deeply nested structure
    const DEEP_PROJECT = mkdtempSync(join(tmpdir(), 'test-deep-project-'))
    mkdirSync(join(DEEP_PROJECT, 'level1', 'level2', 'level3', 'src'), { recursive: true })
    writeFileSync(join(DEEP_PROJECT, 'package.json'), JSON.stringify({ name: 'deep-project' }))

    const result = findWorkspaceRoot(join(DEEP_PROJECT, 'level1', 'level2', 'level3', 'src'))

    expect(result).toBe(DEEP_PROJECT)

    rmSync(DEEP_PROJECT, { recursive: true, force: true })
  })
})

describe('findRootDirectory', () => {
  it('finds directory with package.json marker', () => {
    const result = findRootDirectory(resolve(MINIMAL_PROJECT, 'src'), ['package.json'])

    expect(result).toBe(MINIMAL_PROJECT)
  })

  it('finds directory with nx.json marker', () => {
    const result = findRootDirectory(resolve(MONOREPO, 'packages/core'), ['nx.json'])

    expect(result).toBe(MONOREPO)
  })

  it('finds directory with multiple markers', () => {
    const result = findRootDirectory(resolve(MONOREPO, 'packages/core'), ['nx.json', 'turbo.json'])

    expect(result).toBe(MONOREPO)
  })

  it('returns null when no markers found', () => {
    const result = findRootDirectory('/tmp', ['non-existent-marker-file.xyz'])

    expect(result).toBeNull()
  })
})

describe('findGitRoot', () => {
  it('finds git root from workspace', () => {
    const result = findGitRoot(GIT_ROOT)

    expect(result).toBe(GIT_ROOT)
  })

  it('finds git root from nested path', () => {
    const result = findGitRoot(MINIMAL_PROJECT)

    expect(result).toBe(GIT_ROOT)
  })

  it('returns null when no .git directory', () => {
    const result = findGitRoot('/tmp')

    expect(result).toBeNull()
  })
})

describe('findNearestPackageJson', () => {
  it('finds package.json from project root', () => {
    const result = findNearestPackageJson(MINIMAL_PROJECT)

    expect(result).toBe(MINIMAL_PROJECT)
  })

  it('finds package.json from nested directory', () => {
    const result = findNearestPackageJson(resolve(MINIMAL_PROJECT, 'src'))

    expect(result).toBe(MINIMAL_PROJECT)
  })

  it('returns null when no package.json found', () => {
    const result = findNearestPackageJson('/tmp')

    expect(result).toBeNull()
  })
})

describe('ROOT_MARKERS', () => {
  it('contains package.json', () => {
    expect(ROOT_MARKERS).toContain('package.json')
  })

  it('contains .git', () => {
    expect(ROOT_MARKERS).toContain('.git')
  })
})

describe('WORKSPACE_MARKERS', () => {
  it('contains nx.json', () => {
    expect(WORKSPACE_MARKERS).toContain('nx.json')
  })

  it('contains turbo.json', () => {
    expect(WORKSPACE_MARKERS).toContain('turbo.json')
  })

  it('contains lerna.json', () => {
    expect(WORKSPACE_MARKERS).toContain('lerna.json')
  })

  it('contains pnpm-workspace.yaml', () => {
    expect(WORKSPACE_MARKERS).toContain('pnpm-workspace.yaml')
  })
})
