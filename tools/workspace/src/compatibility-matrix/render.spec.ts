import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { cleanupWorkspaces, createWorkspace, publishableProject, sectionOf } from './__test-utils__/fixtures'
import { buildCompatibilityDocument } from './refresh'
import { renderCompatibilityDocument } from './render'
afterAll(() => {
  cleanupWorkspaces()
})

describe('renderCompatibilityDocument', () => {
  const workspaceWithTwoLibraries = (): string =>
    createWorkspace([
      {
        path: 'libs/logging',
        projectJson: publishableProject({
          name: 'lib-logging',
          compatibility: { environments: { node: 'full', browser: 'full', webWorker: 'full' } },
          buildOptions: {
            esm: {},
            cjs: {},
            iife: { entry: '.', globalName: 'HyperfrontendLogging' },
            umd: { entry: '.', globalName: 'HyperfrontendLogging' },
          },
        }),
        packageJson: {
          name: '@hyperfrontend/logging',
          version: '1.0.0',
          engines: { node: '>=18.0.0', npm: '>=8.0.0' },
          dependencies: { '@hyperfrontend/data-utils': '1.0.0' },
        },
      },
      {
        path: 'libs/utils/data',
        projectJson: publishableProject({
          name: 'lib-data-utils',
          compatibility: { environments: { node: 'full', browser: 'partial', webWorker: 'none' }, note: 'Reads DOM ranges.' },
        }),
        packageJson: { name: '@hyperfrontend/data-utils', version: '1.0.0', engines: { node: '>=18.0.0' } },
      },
    ])

  it('opens with the title and the generated-document note', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
    const lines = document.split('\n')

    expect(lines[0]).toBe('# Library Compatibility Matrix')
    expect(lines[2]).toContain('> Generated from each')
    expect(lines[2]).toContain('npx nx lint:all')
  })

  it('carries no date stamp', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

    expect(document).not.toContain('Last updated')
  })

  it('renders every section in order', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
    const headings = document.split('\n').filter((line) => line.startsWith('## '))

    expect(headings).toEqual([
      '## Platform Support',
      '## Output Formats',
      '## Engine Requirements',
      '## Dependency Graph',
      '## Published Versions',
    ])
  })

  it('renders one platform row per library with a glyph per environment', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
    const platform = sectionOf(document, '## Platform Support')

    expect(platform).toContain('| Library | Node.js | Browser | Web Worker | CDN Bundle |')
    expect(platform).toContain('| `@hyperfrontend/data-utils` | ✅ | ⚠️ | ❌ | ❌ |')
    expect(platform).toContain('| `@hyperfrontend/logging` | ✅ | ✅ | ✅ | ✅ |')
  })

  it('explains the glyphs below the platform table', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

    expect(document).toContain('Legend: ✅ full support, ⚠️ partial support, ❌ no support, ❓ nothing declared.')
  })

  it('renders an unknown glyph for a library that declares no compatibility', () => {
    const root = createWorkspace([
      {
        path: 'libs/undeclared',
        projectJson: publishableProject({ name: 'lib-undeclared' }),
        packageJson: { name: '@hyperfrontend/undeclared', version: '1.0.0' },
      },
    ])

    expect(buildCompatibilityDocument(root)).toContain('| `@hyperfrontend/undeclared` | ❓ | ❓ | ❓ | ❌ |')
  })

  it('marks a CDN bundle when only a UMD build is configured', () => {
    const root = createWorkspace([
      {
        path: 'libs/umd-only',
        projectJson: publishableProject({ name: 'lib-umd-only', buildOptions: { umd: { entry: '.', globalName: 'UmdOnly' } } }),
        packageJson: { name: '@hyperfrontend/umd-only', version: '1.0.0' },
      },
    ])

    expect(buildCompatibilityDocument(root)).toContain('| `@hyperfrontend/umd-only` | ❓ | ❓ | ❓ | ✅ |')
  })

  it('lists a note for every library that declares one', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

    expect(document).toContain('**Notes**')
    expect(document).toContain('- `@hyperfrontend/data-utils`: Reads DOM ranges.')
    expect(document).not.toContain('- `@hyperfrontend/logging`:')
  })

  it('omits the notes block when no library declares a note', () => {
    const root = createWorkspace([
      {
        path: 'libs/quiet',
        projectJson: publishableProject({ name: 'lib-quiet' }),
        packageJson: { name: '@hyperfrontend/quiet', version: '1.0.0' },
      },
    ])

    expect(buildCompatibilityDocument(root)).not.toContain('**Notes**')
  })

  it('renders the output format table with the bundle global names', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
    const formats = sectionOf(document, '## Output Formats')

    expect(formats).toContain('| Library | ESM | CJS | IIFE | UMD | Global name |')
    expect(formats).toContain('| `@hyperfrontend/data-utils` | ✅ | ✅ | ❌ | ❌ | - |')
    expect(formats).toContain('| `@hyperfrontend/logging` | ✅ | ✅ | ✅ | ✅ | `HyperfrontendLogging` |')
  })

  it('joins several global names into one cell', () => {
    const root = createWorkspace([
      {
        path: 'libs/multi',
        projectJson: publishableProject({
          name: 'lib-multi',
          buildOptions: {
            iife: [
              { entry: './host', globalName: 'Host' },
              { entry: './hostee', globalName: 'Hostee' },
            ],
          },
        }),
        packageJson: { name: '@hyperfrontend/multi', version: '1.0.0' },
      },
    ])

    expect(buildCompatibilityDocument(root)).toContain('| `Host`, `Hostee` |')
  })

  it('renders the engine table and a dash where an engine is undeclared', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
    const engines = sectionOf(document, '## Engine Requirements')

    expect(engines).toContain('| Library | Node.js | npm |')
    expect(engines).toContain('| `@hyperfrontend/data-utils` | `>=18.0.0` | - |')
    expect(engines).toContain('| `@hyperfrontend/logging` | `>=18.0.0` | `>=8.0.0` |')
  })

  it('renders the dependency table with a dash for a library that depends on nothing first-party', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
    const dependencies = sectionOf(document, '## Dependency Graph')

    expect(dependencies).toContain('| Library | Depends on |')
    expect(dependencies).toContain('| `@hyperfrontend/data-utils` | - |')
    expect(dependencies).toContain('| `@hyperfrontend/logging` | `@hyperfrontend/data-utils` |')
  })

  it('marks a peer dependency in the dependency table', () => {
    const root = createWorkspace([
      {
        path: 'libs/nexus',
        projectJson: publishableProject({ name: 'lib-nexus' }),
        packageJson: {
          name: '@hyperfrontend/nexus',
          version: '3.0.0',
          peerDependencies: { '@hyperfrontend/network-protocol': '2.0.0' },
        },
      },
      {
        path: 'libs/network-protocol',
        projectJson: publishableProject({ name: 'lib-network-protocol' }),
        packageJson: { name: '@hyperfrontend/network-protocol', version: '2.0.0' },
      },
    ])

    expect(buildCompatibilityDocument(root)).toContain('| `@hyperfrontend/nexus` | `@hyperfrontend/network-protocol` (peer) |')
  })

  it('draws the dependency diagram in a fenced mermaid block with a theme config', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

    expect(document).toContain('```mermaid')
    expect(document).toContain('config:\n  theme: base')
    expect(document).toContain('flowchart TB')
  })

  it('gives every node an identifier free of hyphens', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

    expect(document).toContain('    data_utils["data-utils"]')
    expect(document).toContain('    logging["logging"]')
    expect(document).toContain('    logging --> data_utils')
  })

  it('draws a peer dependency as a dotted edge', () => {
    const root = createWorkspace([
      {
        path: 'libs/nexus',
        projectJson: publishableProject({ name: 'lib-nexus' }),
        packageJson: {
          name: '@hyperfrontend/nexus',
          version: '3.0.0',
          peerDependencies: { '@hyperfrontend/network-protocol': '2.0.0' },
        },
      },
      {
        path: 'libs/network-protocol',
        projectJson: publishableProject({ name: 'lib-network-protocol' }),
        packageJson: { name: '@hyperfrontend/network-protocol', version: '2.0.0' },
      },
    ])

    expect(buildCompatibilityDocument(root)).toContain('    nexus -.-> network_protocol')
  })

  it('omits a diagram edge to a package the matrix does not document', () => {
    const root = createWorkspace([
      {
        path: 'libs/consumer',
        projectJson: publishableProject({ name: 'lib-consumer' }),
        packageJson: {
          name: '@hyperfrontend/consumer',
          version: '1.0.0',
          dependencies: { '@hyperfrontend/absent': '1.0.0' },
        },
      },
    ])

    const document = buildCompatibilityDocument(root)

    expect(document).toContain('| `@hyperfrontend/consumer` | `@hyperfrontend/absent` |')
    expect(document).not.toContain('consumer --> absent')
  })

  it('renders the published version table', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
    const versions = sectionOf(document, '## Published Versions')

    expect(versions).toContain('| Library | Version |')
    expect(versions).toContain('| `@hyperfrontend/logging` | `1.0.0` |')
  })

  it('renders a dash for a library with no published version', () => {
    const root = createWorkspace([
      {
        path: 'libs/bare',
        projectJson: publishableProject({ name: 'lib-bare' }),
        packageJson: { name: '@hyperfrontend/bare' },
      },
    ])

    expect(buildCompatibilityDocument(root)).toContain('| `@hyperfrontend/bare` | - |')
  })

  it('ends with exactly one trailing newline', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())

    expect(document.endsWith('\n')).toBe(true)
    expect(document.endsWith('\n\n')).toBe(false)
  })

  it('uses no em dash anywhere', () => {
    expect(buildCompatibilityDocument(workspaceWithTwoLibraries())).not.toContain('—')
  })

  it('gives every fenced block a language', () => {
    const document = buildCompatibilityDocument(workspaceWithTwoLibraries())
    const fences = document.split('\n').filter((line) => line.startsWith('```'))

    expect(fences).toEqual(['```mermaid', '```'])
  })

  it('renders headers only when the workspace holds no publishable library', () => {
    const document = renderCompatibilityDocument([])

    expect(document).toContain('| Library | Node.js | Browser | Web Worker | CDN Bundle |')
    expect(document).not.toContain('| `@hyperfrontend/')
    expect(document).toContain('flowchart TB\n```')
  })

  it('escapes a pipe inside a table cell', () => {
    const document = renderCompatibilityDocument([
      {
        packageName: '@hyperfrontend/piped',
        shortName: 'piped',
        version: '1.0.0 | beta',
        nodeEngine: null,
        npmEngine: null,
        environments: { node: 'full', browser: 'none', webWorker: 'none' },
        note: null,
        formats: { esm: true, cjs: true, iife: false, umd: false },
        globalNames: [],
        dependencies: [],
      },
    ])

    expect(document).toContain('| `1.0.0 \\| beta` |')
  })

  it('escapes a backslash before a pipe so the pipe stays escaped', () => {
    const document = renderCompatibilityDocument([
      {
        packageName: '@hyperfrontend/slashed',
        shortName: 'slashed',
        version: '1.0.0 \\| beta',
        nodeEngine: null,
        npmEngine: null,
        environments: { node: 'full', browser: 'none', webWorker: 'none' },
        note: null,
        formats: { esm: true, cjs: true, iife: false, umd: false },
        globalNames: [],
        dependencies: [],
      },
    ])

    expect(document).toContain('| `1.0.0 \\\\\\| beta` |')
  })
})
