import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createMarkdownWorkspace } from './__fixtures__/markdown-workspace.ts'
import rule from './lib-ci-workflows.ts'

const workspace = createMarkdownWorkspace()
workspace.write(
  'libs/utils/json/project.json',
  '{ "name": "lib-json", "projectType": "library", "targets": { "build": {}, "publish": {} } }'
)
workspace.write('plugins/anon/project.json', '{ "projectType": "library", "targets": { "build": {}, "publish": {} } }')
workspace.write('.github/workflows/ci-main.yml', 'LIBS=(\n  "pub:libs/pub"\n  "json-utils:libs/utils/json"\n  "anon:plugins/anon"\n)\n')
workspace.write('.github/workflows/ci-lib-pub.yml', 'name: lib-pub\n')
workspace.write('.github/workflows/ci-lib-json.yml', 'name: lib-json\n')
workspace.write('.github/workflows/ci-lib-anon.yml', 'name: lib-anon\n')
const WORKFLOW = join(workspace.root, '.github', 'workflows', 'ci-libraries.yml')
const bare = createMarkdownWorkspace()
const BARE_WORKFLOW = join(bare.root, '.github', 'workflows', 'ci-libraries.yml')

/** An error over the whole document. */
interface WholeError {
  /** The message. */
  readonly message: string
  /** Line one. */
  readonly line: number
  /** Column one. */
  readonly column: number
  /** The line after the last. */
  readonly endLine: number
  /** Column one again. */
  readonly endColumn: number
}

const filter = (flag: string, path: string): string => `  ${flag}:\n    - '${path}/**'\n`
const matrix = (name: string, path: string, flag: string): string =>
  `add_if_changed "\${{ steps.filter.outputs.${flag} }}" "${name}" "${path}" "${flag}"\n`
const COMPLETE = `filters: |\n${filter('pub', 'libs/pub')}${filter('json-utils', 'libs/utils/json')}${filter('anon', 'plugins/anon')}run: |\n  ${matrix('lib-pub', 'libs/pub', 'pub')}  ${matrix('lib-json', 'libs/utils/json', 'json-utils')}  ${matrix('lib-anon', 'plugins/anon', 'anon')}`
const WITHOUT_JSON = COMPLETE.replace(filter('json-utils', 'libs/utils/json'), '').replace(
  `  ${matrix('lib-json', 'libs/utils/json', 'json-utils')}`,
  ''
)
const FAR_AND_COMMENTED = COMPLETE.replace(filter('pub', 'libs/pub'), `  pub:\n\n\n\n\n    - 'libs/pub/**'\n`).replace(
  `  ${matrix('lib-anon', 'plugins/anon', 'anon')}`,
  `  # ${matrix('lib-anon', 'plugins/anon', 'anon')}`
)
const whole = (text: string, message: string): WholeError => ({
  message,
  line: 1,
  column: 1,
  endLine: text.split(/\r?\n/).length,
  endColumn: 1,
})

const missing = (kind: string, name: string, path: string, flag: string): string => {
  switch (kind) {
    case 'filter':
      return `Publishable library '${name}' (${path}) is missing path filter in ci-libraries.yml. Add: ${flag}: - '${path}/**'`
    case 'matrix':
      return `Publishable library '${name}' (${path}) is missing matrix entry in ci-libraries.yml. Add: add_if_changed "\${{ steps.filter.outputs.${flag} }}" "${name}" "${path}" "${flag}"`
    case 'status':
      return `Publishable library '${name}' (${path}) is missing status workflow. Create: .github/workflows/ci-${name}.yml`
    default:
      return `Publishable library '${name}' (${path}) is missing coverage entry in ci-main.yml. Add: "${flag}:${path}"`
  }
}

testRule(rule, {
  valid: [
    { name: 'every library filtered, in the matrix, with a status workflow and a coverage entry', path: WORKFLOW, text: COMPLETE },
    {
      name: 'a filter whose name carries a trailing comment',
      path: WORKFLOW,
      text: COMPLETE.replace('  pub:\n', '  pub: # the flagship\n'),
    },
    { name: 'a workflow of another name', path: join(workspace.root, '.github', 'workflows', 'ci-main.yml'), text: '' },
    { name: 'a workflow outside the workflows directory', path: workspace.rootFile('ci-libraries.yml'), text: '' },
    { name: 'a workflow outside any workspace', path: '/definitely/not/a/workspace/.github/workflows/ci-libraries.yml', text: '' },
  ],
  invalid: [
    {
      name: 'a workspace without a main workflow',
      path: BARE_WORKFLOW,
      text: 'filters: |\n',
      errors: [whole('filters: |\n', 'Cannot find .github/workflows/ci-main.yml in workspace')],
    },
    {
      name: 'a library missing its filter and matrix entry, reported over the whole document',
      path: WORKFLOW,
      text: WITHOUT_JSON,
      errors: [
        whole(WITHOUT_JSON, missing('filter', 'lib-json', 'libs/utils/json', 'json-utils')),
        whole(WITHOUT_JSON, missing('matrix', 'lib-json', 'libs/utils/json', 'json-utils')),
      ],
    },
    {
      name: 'a filter whose path sits too far below its name, and a matrix line commented out',
      path: WORKFLOW,
      text: FAR_AND_COMMENTED,
      errors: [
        whole(FAR_AND_COMMENTED, missing('filter', 'lib-pub', 'libs/pub', 'pub')),
        whole(FAR_AND_COMMENTED, missing('matrix', 'lib-anon', 'plugins/anon', 'anon')),
      ],
    },
  ],
})

describe('the status workflow and coverage entry', () => {
  it('are reported once removed', () => {
    workspace.write('.github/workflows/ci-main.yml', 'LIBS=(\n  "pub:libs/pub"\n  "json-utils:libs/utils/json"\n)\n')
    rmSync(join(workspace.root, '.github', 'workflows', 'ci-lib-anon.yml'))
    testRule(rule, {
      valid: [],
      invalid: [
        {
          name: 'a library without a status workflow or a coverage entry',
          path: WORKFLOW,
          text: COMPLETE,
          errors: [
            whole(COMPLETE, missing('status', 'lib-anon', 'plugins/anon', 'anon')),
            whole(COMPLETE, missing('coverage', 'lib-anon', 'plugins/anon', 'anon')),
          ],
        },
      ],
    })
    expect(existsSync(join(workspace.root, '.github', 'workflows', 'ci-lib-anon.yml'))).toBe(false)
  })
})

describe('the disposable workspaces', () => {
  it('are removed once the cases have run', () => {
    workspace.remove()
    bare.remove()
    expect(existsSync(workspace.root) || existsSync(bare.root)).toBe(false)
  })
})
