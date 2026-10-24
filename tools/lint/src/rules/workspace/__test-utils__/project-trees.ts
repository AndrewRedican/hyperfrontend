/**
 * Disposable project directories for the rules that read a project's own files beside the one
 * they lint: a publishable library with secondary-entry READMEs, an internal library, an
 * application, libraries with browser bundles, static deploys with and without a header config,
 * and projects in each lifecycle state.
 *
 * @module rules/workspace/__test-utils__/project-trees
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { entries } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'

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
  const root = mkdtempSync(join(tmpdir(), 'lint-projects-'))
  for (const [path, text] of entries(FILES)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  return {
    root,
    file: (project, name) => join(root, project, name),
    remove: () => rmSync(root, { recursive: true, force: true }),
  }
}
