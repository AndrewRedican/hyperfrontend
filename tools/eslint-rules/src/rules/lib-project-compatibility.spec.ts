import { after as afterAll } from 'node:test'
import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { describe } from '@hyperfrontend/testing'
import { createJsonRuleTester, createTempWorkspaceManager } from '../testing'
import rule from './lib-project-compatibility'

const manager = createTempWorkspaceManager()
const ruleTester = createJsonRuleTester()

/**
 * Environments block every runtime supports.
 */
const FULL_EVERYWHERE = { node: 'full', browser: 'full', webWorker: 'full' }

/**
 * Environments block of a Node-only tooling package.
 */
const NODE_ONLY = { node: 'full', browser: 'none', webWorker: 'none' }

/**
 * Build options of a package that ships no browser bundle.
 */
const NO_BUNDLE_OPTIONS = { esm: {}, cjs: {} }

/**
 * Build options of a package that ships an IIFE bundle for CDN consumers.
 */
const IIFE_BUNDLE_OPTIONS = { esm: {}, cjs: {}, iife: { entry: '.', globalName: 'TestLibrary' } }

/**
 * Builds a publishable library project.json around one metadata block.
 *
 * @param metadata - The metadata block, or undefined to leave it out entirely.
 * @param buildOptions - Options of the build target.
 * @returns The project.json contents.
 */
function projectJsonWith(metadata: unknown, buildOptions: object = NO_BUNDLE_OPTIONS): Record<string, unknown> {
  const projectJson: Record<string, unknown> = {
    name: 'lib-test-library',
    description: 'A test library',
    projectType: 'library',
    tags: ['type:util'],
  }

  if (metadata !== undefined) {
    projectJson['metadata'] = metadata
  }

  projectJson['targets'] = { build: { options: buildOptions }, publish: {} }
  return projectJson
}

/**
 * Builds a publishable library project.json around one compatibility block.
 *
 * @param compatibility - The compatibility block.
 * @param buildOptions - Options of the build target.
 * @returns The project.json contents.
 */
function projectJsonFor(compatibility: unknown, buildOptions: object = NO_BUNDLE_OPTIONS): Record<string, unknown> {
  return projectJsonWith({ compatibility }, buildOptions)
}

/**
 * Builds a test case whose linted text is exactly the file written to disk.
 *
 * @param name - Assertive sentence the case is reported under.
 * @param projectJson - The project.json contents.
 * @returns The case, ready for valid cases or for spreading into an invalid one.
 */
function caseFor(name: string, projectJson: object): { name: string; code: string; filename: string } {
  const workspace = manager.create({ projectJson })
  return { name, code: stringify(projectJson, null, 2), filename: workspace.getPath('project.json') }
}

/**
 * Builds a test case whose linted text is written by hand, so it can use JSONC
 * spellings that a serialized object cannot produce.
 *
 * @param name - Assertive sentence the case is reported under.
 * @param code - The text to lint.
 * @param projectJson - The project.json to write to disk, which decides whether the project is publishable.
 * @returns The case, ready for valid cases or for spreading into an invalid one.
 */
function caseForText(name: string, code: string, projectJson: object): { name: string; code: string; filename: string } {
  const workspace = manager.create({ projectJson })
  return { name, code, filename: workspace.getPath('project.json') }
}

describe('lib-project-compatibility', () => {
  afterAll(() => {
    manager.cleanupAll()
  })

  ruleTester.run('lib-project-compatibility', rule, {
    valid: [
      caseFor('skips a library with no publish target even when its compatibility block is broken', {
        name: 'lib-internal',
        description: 'An internal library',
        projectType: 'library',
        metadata: { compatibility: { environments: { node: 'maybe' } } },
        targets: { build: {} },
      }),
      caseFor('skips an application even when its compatibility block is broken', {
        name: 'app-test',
        description: 'An application',
        projectType: 'application',
        metadata: { compatibility: { environments: {}, nonsense: true } },
        targets: { build: {}, publish: {} },
      }),
      caseFor('skips an e2e project, which declares no compatibility at all', {
        name: 'lib-test-library-e2e',
        description: 'End to end tests',
        projectType: 'application',
        targets: { e2e: {} },
      }),
      caseFor('accepts a package that runs everywhere', projectJsonFor({ environments: FULL_EVERYWHERE })),
      caseFor(
        'accepts a note alongside the environments',
        projectJsonFor({ environments: FULL_EVERYWHERE, note: 'The CLI entry point is Node-only.' })
      ),
      caseFor('accepts a Node-only package that ships no browser bundle', projectJsonFor({ environments: NODE_ONLY })),
      caseFor(
        'accepts partial worker support alongside full browser support',
        projectJsonFor({ environments: { node: 'full', browser: 'full', webWorker: 'partial' } })
      ),
      caseFor(
        'accepts a browser bundle when the browser is supported',
        projectJsonFor({ environments: FULL_EVERYWHERE }, IIFE_BUNDLE_OPTIONS)
      ),
      caseFor(
        'accepts a list of browser bundles when the browser is partially supported',
        projectJsonFor(
          { environments: { node: 'full', browser: 'partial', webWorker: 'none' } },
          {
            esm: {},
            umd: [
              { entry: '.', globalName: 'TestLibrary' },
              { entry: './browser', globalName: 'TestLibraryBrowser' },
            ],
          }
        )
      ),
      caseFor(
        'accepts a Node-only package whose bundle options configure no bundle at all',
        projectJsonFor({ environments: NODE_ONLY }, { esm: {}, iife: null, umd: [] })
      ),
      caseFor(
        'accepts a Node-only package whose build target declares no options',
        projectJsonWith({ compatibility: { environments: NODE_ONLY } })
      ),
      caseForText(
        'accepts a declaration written with unquoted JSONC keys',
        `{
  name: "lib-test-library",
  metadata: { compatibility: { environments: { node: "full", browser: "full", webWorker: "full" } } },
  targets: { build: { options: { esm: {} } }, publish: {} }
}`,
        projectJsonFor({ environments: FULL_EVERYWHERE })
      ),
      caseForText(
        'accepts a Node-only package when the text under lint carries no targets block',
        `{
  "name": "lib-test-library",
  "metadata": { "compatibility": { "environments": { "node": "full", "browser": "none", "webWorker": "none" } } }
}`,
        projectJsonFor({ environments: NODE_ONLY })
      ),
    ],
    invalid: [
      {
        ...caseFor('reports a publishable library with no metadata block', projectJsonWith(undefined)),
        errors: [{ messageId: 'missingCompatibility' }],
      },
      {
        ...caseFor('reports a metadata block that declares no compatibility', projectJsonWith({ owner: 'platform' })),
        errors: [{ messageId: 'missingCompatibility' }],
      },
      {
        ...caseFor('reports a metadata block that is not an object', projectJsonWith('everywhere')),
        errors: [{ messageId: 'missingCompatibility' }],
      },
      {
        ...caseFor('reports a compatibility block that declares no environments', projectJsonFor({ note: 'Runs anywhere.' })),
        errors: [{ messageId: 'missingEnvironments' }],
      },
      {
        ...caseFor('reports environments that are not an object', projectJsonFor({ environments: 'everywhere' })),
        errors: [{ messageId: 'missingEnvironments' }],
      },
      {
        ...caseFor('reports a compatibility block that is not an object', projectJsonFor('everywhere')),
        errors: [{ messageId: 'missingEnvironments' }],
      },
      {
        ...caseFor('reports a runtime left out of the environments', projectJsonFor({ environments: { node: 'full', webWorker: 'full' } })),
        errors: [{ messageId: 'missingEnvironment', data: { environment: 'browser' } }],
      },
      {
        ...caseFor('reports every runtime when the environments are empty', projectJsonFor({ environments: {} })),
        errors: [
          { messageId: 'missingEnvironment', data: { environment: 'node' } },
          { messageId: 'missingEnvironment', data: { environment: 'browser' } },
          { messageId: 'missingEnvironment', data: { environment: 'webWorker' } },
        ],
      },
      {
        ...caseFor(
          'reports a runtime this repository does not declare',
          projectJsonFor({ environments: { ...FULL_EVERYWHERE, deno: 'full' } })
        ),
        errors: [{ messageId: 'unknownEnvironment', data: { environment: 'deno' } }],
      },
      {
        ...caseForText(
          'reports a runtime whose key is not even a string',
          `{
  "name": "lib-test-library",
  "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full", 1: "full" } } },
  "targets": { "build": { "options": { "esm": {} } }, "publish": {} }
}`,
          projectJsonFor({ environments: FULL_EVERYWHERE })
        ),
        errors: [{ messageId: 'unknownEnvironment', data: { environment: '1' } }],
      },
      {
        ...caseFor(
          'reports a support level outside full, partial and none',
          projectJsonFor({ environments: { node: 'full', browser: 'yes', webWorker: 'none' } })
        ),
        errors: [{ messageId: 'invalidSupport', data: { environment: 'browser' } }],
      },
      {
        ...caseFor(
          'reports a support level that is not a string',
          projectJsonFor({ environments: { node: 'full', browser: true, webWorker: 'none' } })
        ),
        errors: [{ messageId: 'invalidSupport', data: { environment: 'browser' } }],
      },
      {
        ...caseFor('reports an empty note', projectJsonFor({ environments: FULL_EVERYWHERE, note: '   ' })),
        errors: [{ messageId: 'invalidNote' }],
      },
      {
        ...caseFor('reports a note that is not a string', projectJsonFor({ environments: FULL_EVERYWHERE, note: 42 })),
        errors: [{ messageId: 'invalidNote' }],
      },
      {
        ...caseFor(
          'reports a field of the compatibility block that nothing reads',
          projectJsonFor({ environments: FULL_EVERYWHERE, notes: 'Runs anywhere.' })
        ),
        errors: [{ messageId: 'unknownCompatibilityKey', data: { key: 'notes' } }],
      },
      {
        ...caseFor(
          'reports an empty note and an unread field together',
          projectJsonFor({ environments: FULL_EVERYWHERE, note: '', engines: { node: '>=22' } })
        ),
        errors: [{ messageId: 'invalidNote' }, { messageId: 'unknownCompatibilityKey', data: { key: 'engines' } }],
      },
      {
        ...caseFor(
          'reports full worker support declared while the browser is unsupported',
          projectJsonFor({ environments: { node: 'full', browser: 'none', webWorker: 'full' } })
        ),
        errors: [{ messageId: 'workerWithoutBrowser', data: { support: 'full' } }],
      },
      {
        ...caseFor(
          'reports partial worker support declared while the browser is unsupported',
          projectJsonFor({ environments: { node: 'none', browser: 'none', webWorker: 'partial' } })
        ),
        errors: [{ messageId: 'workerWithoutBrowser', data: { support: 'partial' } }],
      },
      {
        ...caseFor(
          'reports a package that declares every runtime unsupported',
          projectJsonFor({ environments: { node: 'none', browser: 'none', webWorker: 'none' } })
        ),
        errors: [{ messageId: 'runsNowhere' }],
      },
      {
        ...caseFor(
          'reports an IIFE bundle built for a browser the package says it does not support',
          projectJsonFor({ environments: NODE_ONLY }, IIFE_BUNDLE_OPTIONS)
        ),
        errors: [{ messageId: 'browserBundleWithoutBrowser', data: { formats: 'iife' } }],
      },
      {
        ...caseFor(
          'reports a list of UMD bundles built for a browser the package says it does not support',
          projectJsonFor({ environments: NODE_ONLY }, { esm: {}, umd: [{ entry: '.', globalName: 'TestLibrary' }] })
        ),
        errors: [{ messageId: 'browserBundleWithoutBrowser', data: { formats: 'umd' } }],
      },
      {
        ...caseFor(
          'names both browser bundle formats in one report',
          projectJsonFor(
            { environments: NODE_ONLY },
            {
              esm: {},
              iife: { entry: '.', globalName: 'TestLibrary' },
              umd: { entry: '.', globalName: 'TestLibrary' },
            }
          )
        ),
        errors: [{ messageId: 'browserBundleWithoutBrowser', data: { formats: 'iife and umd' } }],
      },
      {
        ...caseFor(
          'reports the bundle contradiction and the worker contradiction together',
          projectJsonFor({ environments: { node: 'full', browser: 'none', webWorker: 'partial' } }, IIFE_BUNDLE_OPTIONS)
        ),
        errors: [{ messageId: 'browserBundleWithoutBrowser' }, { messageId: 'workerWithoutBrowser' }],
      },
      {
        ...caseFor(
          'reports a package that runs nowhere yet still ships a browser bundle',
          projectJsonFor({ environments: { node: 'none', browser: 'none', webWorker: 'none' } }, IIFE_BUNDLE_OPTIONS)
        ),
        errors: [{ messageId: 'runsNowhere' }, { messageId: 'browserBundleWithoutBrowser' }],
      },
    ],
  })
})
