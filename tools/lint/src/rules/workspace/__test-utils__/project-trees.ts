/**
 * Disposable project directories for the rules that read a project's own files beside the one
 * they lint: a publishable library with secondary-entry READMEs, an internal library, an
 * application, libraries with browser bundles, static deploys with and without a header config,
 * static deploys whose config is judged by its header fold and by the release its lock installs,
 * and projects in each lifecycle state.
 *
 * @module rules/workspace/__test-utils__/project-trees
 */

import { stringify } from '@hyperfrontend/immutable-api-utils/built-in-copy/json'
import { fromEntries, keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createTempDir } from '@hyperfrontend/testing/fs'

const POLICY = 'Content-Security-Policy'
const RESTRICTED = "frame-ancestors 'self' https://example.invalid"
const UNRESTRICTED = "default-src 'self'; img-src *"

/** The files of the projects, by path below the directory that holds them. */
const FILES: Readonly<Record<string, string>> = {
  'application/project.json': `{
  "name": "app-fixture",
  "projectType": "application",
  "targets": {
    "build": {},
    "publish": {}
  }
}
`,
  'bundled/project.json': `{
  "name": "lib-bundled",
  "projectType": "library",
  "targets": {
    "build": { "options": { "iife": { "entry": "." }, "umd": { "entry": "./browser" } } },
    "publish": {}
  }
}
`,
  'bundled-empty/project.json': `{
  "name": "lib-empty",
  "projectType": "library",
  "targets": { "build": { "options": { "iife": { "entry": "" }, "umd": { "entry": "." } } }, "publish": {} }
}
`,
  'bundled-same/project.json': `{
  "name": "lib-same",
  "projectType": "library",
  "targets": { "build": { "options": { "iife": { "entry": "." }, "umd": { "entry": "." } } }, "publish": {} }
}
`,
  'deploy-good/project.json': `{
  "name": "demo-deploy-good",
  "projectType": "application",
  "metadata": { "deploy": { "kind": "static" } }
}
`,
  'deploy-good/public/hf-serve.config.json':
    '{ "headers": [{ "headers": { "content-security-policy": "frame-ancestors \'self\' https://example.invalid" } }] }\n',
  'deploy-missing/project.json': `{
  "name": "demo-deploy-missing",
  "projectType": "application",
  "metadata": { "deploy": { "kind": "static" } }
}
`,
  'deploy-nodirective/project.json': `{
  "name": "demo-nodirective",
  "projectType": "application",
  "metadata": { "deploy": { "kind": "static" } }
}
`,
  'deploy-nodirective/public/hf-serve.config.json':
    '{ "headers": [{ "headers": { "Content-Security-Policy": "default-src \'self\'; img-src *" } }] }\n',
  'deploy-permissive/project.json': `{
  "name": "demo-deploy-permissive",
  "projectType": "application",
  "metadata": { "deploy": { "kind": "static" } }
}
`,
  'deploy-permissive/public/hf-serve.config.json':
    '{ "headers": [{ "headers": { "Content-Security-Policy": "default-src \'self\'; frame-ancestors *" } }] }\n',
  'deploy-unbounded/project.json': `{
  "name": "demo-deploy-unbounded",
  "projectType": "application",
  "metadata": { "deploy": { "kind": "static" } }
}
`,
  'deploy-unbounded/public/hf-serve.config.json':
    '{ "headers": [{ "prefix": "/embed", "headers": { "Content-Security-Policy": "frame-ancestors \'none\'" } }, { "headers": { "X-Frame-Options": "DENY" } }] }\n',
  'deploy-unparsable/public/hf-serve.config.json': '{ "headers": [\n',
  'frozen/lint.config.ts': 'export default []\n',
  'frozen/node_modules/x/c.spec.ts': '{}\n',
  'frozen/project.json': `{
  "name": "demo-frozen",
  "metadata": { "lifecycle": { "state": "frozen" } }
}
`,
  'frozen/src/a.spec.ts': 'export const a = 1\n',
  'frozen/src/b.ts': 'export const b = 1\n',
  'internal/project.json': `{
  "name": "tool-fixture",
  "projectType": "library",
  "targets": {
    "build": {}
  }
}
`,
  'planned/project.json': `{
  "name": "demo-planned",
  "metadata": { "lifecycle": { "state": "planned" } }
}
`,
  'planned/src/index.ts': 'export const p = 1\n',
  'publishable/project.json': `{
  "name": "lib-fixture",
  "projectType": "library",
  "targets": {
    "build": {},
    "publish": {}
  }
}
`,
  'publishable/src/bare/README.md': `# bare

## No description
`,
  'publishable/src/bare/index.ts': 'export const bare = 1\n',
  'publishable/src/empty/README.md': '',
  'publishable/src/index.ts': 'export const root = 1\n',
  'publishable/src/mod/README.md': `# Mod Module

Desc.
`,
  'publishable/src/only/README.md': '# only\n',
  'publishable/src/other/README.md': `# Something Else

Text.
`,
  'publishable/src/plain/README.md': 'No heading here.\n',
  'publishable/src/slash/README.md': `# slash/

Desc.
`,
  'publishable/src/sub/README.md': `# Sub

The sub entry.
`,
  'publishable/src/sub/index.ts': 'export const sub = 1\n',
  'retired/project.json': `{
  "name": "demo-retired",
  "metadata": { "lifecycle": { "state": "retired" } }
}
`,
}

/** The serve configurations judged by their header fold, by the directory of the static deploy that ships each. */
const SERVE_CONFIGS: Readonly<Record<string, unknown>> = {
  'deploy-both-old': { embedders: ["'self'"], permissionsPolicy: { camera: [] } },
  'deploy-discarded-authored': { headers: [{ headers: { [POLICY]: `default-src 'self';\u00a0${RESTRICTED}` } }] },
  'deploy-discarded-bounded': {
    headers: [
      { headers: { [POLICY]: RESTRICTED } },
      { suffix: '.html', headers: { [POLICY]: `${RESTRICTED} https://b\u00fccher.invalid` } },
    ],
  },
  'deploy-discarded-embedders': {
    embedders: ['https://example.invalid'],
    headers: [{ headers: { [POLICY]: 'frame-ancestors https://example.invalid\u00a0' } }],
  },
  'deploy-dropped-bounded': {
    headers: [{ headers: { [POLICY]: RESTRICTED } }, { suffix: '.html', headers: { [POLICY]: UNRESTRICTED } }],
  },
  'deploy-dropped-expanded': {
    isolation: 'require-corp',
    permissionsPolicy: { camera: [] },
    headers: [
      { headers: { [POLICY]: RESTRICTED } },
      { headers: { 'X-Content-Type-Options': 'nosniff' } },
      { prefix: '/docs/', suffix: '.html', headers: { [POLICY]: UNRESTRICTED } },
    ],
  },
  'deploy-dropped-later': { headers: [{ headers: { [POLICY]: RESTRICTED } }, { headers: { [POLICY]: UNRESTRICTED } }] },
  'deploy-earlier-bounded': {
    headers: [{ suffix: '.html', headers: { [POLICY]: UNRESTRICTED } }, { headers: { [POLICY]: RESTRICTED } }],
  },
  'deploy-embedders': {
    $schema: './hf-serve.schema.json',
    embedders: ["'self'", 'https://example.invalid'],
    permissionsPolicy: { camera: [] },
    isolation: 'require-corp',
    headers: [{ suffix: '.html', headers: { 'Cache-Control': 'no-cache' } }],
  },
  'deploy-embedders-current': { embedders: ["'self'"] },
  'deploy-embedders-lockless': { embedders: ["'self'"] },
  'deploy-embedders-narrowed': {
    embedders: ["'self'", 'https://example.invalid'],
    headers: [{ prefix: '/host', headers: { [POLICY]: "frame-ancestors 'none'" } }],
  },
  'deploy-embedders-old': { embedders: ["'self'"] },
  'deploy-embedders-prerelease': { embedders: ["'self'"] },
  'deploy-embedders-refused': { embedders: ['*', 'example.invalid'] },
  'deploy-embedders-unversioned': { embedders: ["'self'"] },
  'deploy-not-object': [],
  'deploy-old': { headers: [{ headers: { [POLICY]: RESTRICTED } }] },
  'deploy-open-bound': { headers: [{ prefix: '/', suffix: '', headers: { [POLICY]: RESTRICTED } }] },
  'deploy-open-bound-contradicted': {
    embedders: ["'self'"],
    headers: [{ prefix: '/', headers: { [POLICY]: 'frame-ancestors https://example.invalid' } }],
  },
  'deploy-open-bound-dropped': { headers: [{ headers: { [POLICY]: RESTRICTED } }, { prefix: '', headers: { [POLICY]: UNRESTRICTED } }] },
  'deploy-permissions-old': { permissionsPolicy: { camera: [] }, headers: [{ headers: { [POLICY]: RESTRICTED } }] },
  'deploy-permissive-bounded': {
    headers: [{ headers: { [POLICY]: RESTRICTED } }, { prefix: '/open', headers: { [POLICY]: 'frame-ancestors *' } }],
  },
  'deploy-policy-list': { headers: [{ headers: { [POLICY]: "frame-ancestors *, frame-ancestors 'self'" } }] },
  'deploy-replaced': { headers: [{ headers: { [POLICY]: UNRESTRICTED } }, { headers: { [POLICY]: RESTRICTED } }] },
  'deploy-report-only': {
    headers: [{ headers: { [POLICY]: RESTRICTED } }, { suffix: '.html', headers: { [`${POLICY}-Report-Only`]: UNRESTRICTED } }],
  },
  'deploy-respelled': { headers: [{ headers: { 'content-security-policy': UNRESTRICTED, [POLICY]: RESTRICTED } }] },
  'deploy-scheme-only': { headers: [{ headers: { [POLICY]: 'frame-ancestors https:' } }] },
  'deploy-unknown-field': { embedder: ["'self'"], headers: [{ headers: { [POLICY]: RESTRICTED } }] },
  'deploy-unrestricted-onwards': {
    headers: [
      { headers: { [POLICY]: UNRESTRICTED } },
      { prefix: '/open', headers: { [POLICY]: 'frame-ancestors *' } },
      { suffix: '.html', headers: { [POLICY]: UNRESTRICTED } },
    ],
  },
  'deploy-uppercase': { headers: [{ headers: { [POLICY]: "FRAME-ANCESTORS 'self'" } }] },
  'deploy-wildcard-host': { headers: [{ headers: { [POLICY]: "frame-ancestors 'self' https://*" } }] },
}

/** The `@hyperfrontend/features` version each static deploy's lock installs from the registry, by its directory. */
const FEATURES_LOCKS: Readonly<Record<string, string>> = {
  'deploy-both-old': '0.12.2',
  'deploy-embedders': '0.14.1',
  'deploy-embedders-current': '0.13.0',
  'deploy-embedders-old': '0.12.2',
  'deploy-embedders-prerelease': '0.13.0-rc.1',
  'deploy-embedders-unversioned': 'next',
  'deploy-old': '0.12.2',
  'deploy-permissions-old': '0.12.2',
}

/**
 * A lock installing `@hyperfrontend/features` from the registry.
 *
 * @param version - What the lock installs
 * @returns The file text
 */
const featuresLock = (version: string): string =>
  `${stringify({
    packages: {
      'node_modules/@hyperfrontend/features': {
        version,
        resolved: `https://registry.npmjs.org/@hyperfrontend/features/-/features-${version}.tgz`,
      },
    },
  })}\n`

/** The serve configurations and locks as files, by path below the directory that holds the projects. */
const DEPLOY_FILES: Readonly<Record<string, string>> = fromEntries([
  ...keys(SERVE_CONFIGS).map((project) => [`${project}/public/hf-serve.config.json`, `${stringify(SERVE_CONFIGS[project])}\n`]),
  ...keys(FEATURES_LOCKS).map((project) => [`${project}/package-lock.json`, featuresLock(FEATURES_LOCKS[project] as string)]),
])

/** The paths the specs lint as. */
export interface ProjectTrees {
  /** The directory that holds one subdirectory per project. */
  readonly root: string
  /** A file of a project, whether or not it exists. */
  readonly file: (project: string, name: string) => string
  /** Removes the projects. */
  readonly remove: () => void
}

/**
 * Writes the projects to a temporary directory.
 *
 * @returns Their paths
 */
export function createProjectTrees(): ProjectTrees {
  const directory = createTempDir({ prefix: 'lint-projects-', tree: { ...FILES, ...DEPLOY_FILES } })
  return {
    root: directory.path,
    file: (project, name) => directory.resolve(project, name),
    remove: directory.remove,
  }
}
