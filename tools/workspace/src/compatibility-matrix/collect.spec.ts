import { after as afterAll } from 'node:test'
import { describe, expect, it } from '@hyperfrontend/testing'
import { cleanupWorkspaces, createWorkspace, publishableProject } from './__test-utils__/fixtures'
import { collectMatrixLibraries } from './collect'
afterAll(() => {
  cleanupWorkspaces()
})

describe('collectMatrixLibraries', () => {
  it('collects publishable libraries from libs and plugins sorted by package name', () => {
    const root = createWorkspace([
      {
        path: 'libs/logging',
        projectJson: publishableProject({ name: 'lib-logging' }),
        packageJson: { name: '@hyperfrontend/logging', version: '1.0.0' },
      },
      {
        path: 'plugins/features',
        projectJson: publishableProject({ name: 'plugin-features' }),
        packageJson: { name: '@hyperfrontend/features', version: '0.1.0' },
      },
    ])

    const libraries = collectMatrixLibraries(root)

    expect(libraries.map((library) => library.packageName)).toEqual(['@hyperfrontend/features', '@hyperfrontend/logging'])
  })

  it('finds libraries nested below the scanned folder', () => {
    const root = createWorkspace([
      {
        path: 'libs/utils/json',
        projectJson: publishableProject({ name: 'lib-json-utils' }),
        packageJson: { name: '@hyperfrontend/json-utils', version: '1.0.0' },
      },
    ])

    const libraries = collectMatrixLibraries(root)

    expect(libraries.length).toBe(1)
    expect(libraries[0]?.shortName).toBe('json-utils')
  })

  it('ignores projects without a publish target', () => {
    const root = createWorkspace([
      {
        path: 'libs/internal',
        projectJson: { name: 'lib-internal', projectType: 'library', targets: { build: {} } },
        packageJson: { name: '@hyperfrontend/internal', version: '1.0.0' },
      },
    ])

    expect(collectMatrixLibraries(root)).toEqual([])
  })

  it('ignores libraries without a package.json', () => {
    const root = createWorkspace([
      {
        path: 'libs/no-package',
        projectJson: publishableProject({ name: 'lib-no-package' }),
      },
    ])

    expect(collectMatrixLibraries(root)).toEqual([])
  })

  it('ignores libraries whose package.json declares no name', () => {
    const root = createWorkspace([
      {
        path: 'libs/anonymous',
        projectJson: publishableProject({ name: 'lib-anonymous' }),
        packageJson: { version: '1.0.0' },
      },
    ])

    expect(collectMatrixLibraries(root)).toEqual([])
  })

  it('returns an empty list when neither scanned folder exists', () => {
    const root = createWorkspace([])

    expect(collectMatrixLibraries(root)).toEqual([])
  })

  it('never descends into node_modules, dist or dot directories', () => {
    const root = createWorkspace(
      [
        {
          path: 'libs/node_modules/vendored',
          projectJson: publishableProject({ name: 'vendored' }),
          packageJson: { name: '@hyperfrontend/vendored', version: '1.0.0' },
        },
        {
          path: 'libs/dist/emitted',
          projectJson: publishableProject({ name: 'emitted' }),
          packageJson: { name: '@hyperfrontend/emitted', version: '1.0.0' },
        },
        {
          path: 'libs/.cache/cached',
          projectJson: publishableProject({ name: 'cached' }),
          packageJson: { name: '@hyperfrontend/cached', version: '1.0.0' },
        },
      ],
      { 'libs/stray.txt': 'not a directory' }
    )

    expect(collectMatrixLibraries(root)).toEqual([])
  })

  it('reads the declared support level for each environment', () => {
    const root = createWorkspace([
      {
        path: 'libs/ui',
        projectJson: publishableProject({
          name: 'lib-ui-utils',
          compatibility: { environments: { node: 'partial', browser: 'full', webWorker: 'none' }, note: 'Browser first.' },
        }),
        packageJson: { name: '@hyperfrontend/ui-utils', version: '0.0.8' },
      },
    ])

    const library = collectMatrixLibraries(root)[0]

    expect(library?.environments).toEqual({ node: 'partial', browser: 'full', webWorker: 'none' })
    expect(library?.note).toBe('Browser first.')
  })

  it('leaves every environment undeclared when project.json carries no compatibility metadata', () => {
    const root = createWorkspace([
      {
        path: 'libs/undeclared',
        projectJson: publishableProject({ name: 'lib-undeclared' }),
        packageJson: { name: '@hyperfrontend/undeclared', version: '1.0.0' },
      },
    ])

    const library = collectMatrixLibraries(root)[0]

    expect(library?.environments).toEqual({ node: null, browser: null, webWorker: null })
    expect(library?.note).toBe(null)
  })

  it('treats an unrecognised support level as undeclared', () => {
    const root = createWorkspace([
      {
        path: 'libs/odd',
        projectJson: publishableProject({
          name: 'lib-odd',
          compatibility: { environments: { node: 'maybe', browser: 'full' } },
        }),
        packageJson: { name: '@hyperfrontend/odd', version: '1.0.0' },
      },
    ])

    const library = collectMatrixLibraries(root)[0]

    expect(library?.environments).toEqual({ node: null, browser: 'full', webWorker: null })
  })

  it('reads output formats from the build options', () => {
    const root = createWorkspace([
      {
        path: 'libs/bundled',
        projectJson: publishableProject({
          name: 'lib-bundled',
          buildOptions: { esm: {}, cjs: {}, iife: { entry: '.', globalName: 'Bundled' }, umd: { entry: '.', globalName: 'Bundled' } },
        }),
        packageJson: { name: '@hyperfrontend/bundled', version: '1.0.0' },
      },
    ])

    const library = collectMatrixLibraries(root)[0]

    expect(library?.formats).toEqual({ esm: true, cjs: true, iife: true, umd: true })
    expect(library?.globalNames).toEqual(['Bundled'])
  })

  it('reads a global name from every entry of a multi-bundle configuration', () => {
    const root = createWorkspace([
      {
        path: 'libs/multi',
        projectJson: publishableProject({
          name: 'lib-multi',
          buildOptions: {
            esm: {},
            iife: [{ entry: './host', globalName: 'Host' }, { entry: './hostee', globalName: 'Hostee' }, { entry: './debug' }],
            umd: [{ entry: './host', globalName: 'Host' }],
          },
        }),
        packageJson: { name: '@hyperfrontend/multi', version: '1.0.0' },
      },
    ])

    const library = collectMatrixLibraries(root)[0]

    expect(library?.globalNames).toEqual(['Host', 'Hostee'])
    expect(library?.formats).toEqual({ esm: true, cjs: false, iife: true, umd: true })
  })

  it('collects first-party dependencies and marks peer dependencies', () => {
    const root = createWorkspace([
      {
        path: 'libs/nexus',
        projectJson: publishableProject({ name: 'lib-nexus' }),
        packageJson: {
          name: '@hyperfrontend/nexus',
          version: '3.0.0',
          dependencies: { '@hyperfrontend/logging': '1.0.0', tslib: '2.8.1' },
          peerDependencies: { '@hyperfrontend/network-protocol': '2.0.0', typescript: '5.9.3' },
        },
      },
    ])

    const library = collectMatrixLibraries(root)[0]

    expect(library?.dependencies).toEqual([
      { packageName: '@hyperfrontend/logging', peer: false },
      { packageName: '@hyperfrontend/network-protocol', peer: true },
    ])
  })

  it('reads engines and version from package.json', () => {
    const root = createWorkspace([
      {
        path: 'libs/engined',
        projectJson: publishableProject({ name: 'lib-engined' }),
        packageJson: { name: '@hyperfrontend/engined', version: '2.1.0', engines: { node: '>=18.0.0', npm: '>=8.0.0' } },
      },
    ])

    const library = collectMatrixLibraries(root)[0]

    expect(library?.version).toBe('2.1.0')
    expect(library?.nodeEngine).toBe('>=18.0.0')
    expect(library?.npmEngine).toBe('>=8.0.0')
  })

  it('leaves version and engines unset when package.json declares none', () => {
    const root = createWorkspace([
      {
        path: 'libs/bare',
        projectJson: publishableProject({ name: 'lib-bare' }),
        packageJson: { name: '@hyperfrontend/bare' },
      },
    ])

    const library = collectMatrixLibraries(root)[0]

    expect(library?.version).toBe(null)
    expect(library?.nodeEngine).toBe(null)
    expect(library?.npmEngine).toBe(null)
  })

  it('keeps both rows when two directories declare the same package name', () => {
    const root = createWorkspace([
      {
        path: 'libs/first',
        projectJson: publishableProject({ name: 'lib-first' }),
        packageJson: { name: '@hyperfrontend/twin', version: '1.0.0' },
      },
      {
        path: 'libs/second',
        projectJson: publishableProject({ name: 'lib-second' }),
        packageJson: { name: '@hyperfrontend/twin', version: '2.0.0' },
      },
    ])

    const libraries = collectMatrixLibraries(root)

    expect(libraries.length).toBe(2)
    expect(libraries[0]?.packageName).toBe('@hyperfrontend/twin')
    expect(libraries[1]?.packageName).toBe('@hyperfrontend/twin')
  })

  it('treats a build target without options as shipping no format', () => {
    const root = createWorkspace([
      {
        path: 'libs/optionless',
        projectJson: { name: 'lib-optionless', projectType: 'library', targets: { build: {}, publish: {} } },
        packageJson: { name: '@hyperfrontend/optionless', version: '1.0.0' },
      },
    ])

    const library = collectMatrixLibraries(root)[0]

    expect(library?.formats).toEqual({ esm: false, cjs: false, iife: false, umd: false })
    expect(library?.globalNames).toEqual([])
  })
})
