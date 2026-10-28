import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createMarkdownWorkspace } from './__test-utils__/markdown-workspace.ts'
import rule from './lib-ci-workflows.ts'

const workspace = createMarkdownWorkspace()
workspace.write(
  'libs/utils/json/project.json',
  '{ "name": "lib-json", "projectType": "library", "targets": { "build": {}, "publish": {} } }'
)
workspace.write('plugins/anon/project.json', '{ "projectType": "library", "targets": { "build": {}, "publish": {} } }')
workspace.write('.github/workflows/ci-lib-pub.yml', 'name: lib-pub\n')
workspace.write('.github/workflows/ci-lib-json.yml', 'name: lib-json\n')
workspace.write('.github/workflows/ci-lib-anon.yml', 'name: lib-anon\n')
const WORKFLOW = join(workspace.root, '.github', 'workflows', 'ci-main.yml')

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

const entry = (flag: string, path: string): string => `  "${flag}:${path}"\n`
const COMPLETE = `LIBS=(\n${entry('pub', 'libs/pub')}${entry('json-utils', 'libs/utils/json')}${entry('anon', 'plugins/anon')})\n`
const WITHOUT_JSON = COMPLETE.replace(entry('json-utils', 'libs/utils/json'), '')
const WITHOUT_ANON = COMPLETE.replace(entry('anon', 'plugins/anon'), '')
const whole = (text: string, message: string): WholeError => ({
  message,
  line: 1,
  column: 1,
  endLine: text.split(/\r?\n/).length,
  endColumn: 1,
})

const missing = (kind: string, name: string, path: string, flag: string): string =>
  kind === 'status'
    ? `Publishable library '${name}' (${path}) is missing status workflow. Create: .github/workflows/ci-${name}.yml`
    : `Publishable library '${name}' (${path}) is missing coverage entry in ci-main.yml. Add: "${flag}:${path}"`

testRule(rule, {
  valid: [
    { name: 'every library with a status workflow and a coverage entry', path: WORKFLOW, text: COMPLETE },
    { name: 'a workflow of another name', path: join(workspace.root, '.github', 'workflows', 'ci-pr.yml'), text: '' },
    { name: 'a workflow outside the workflows directory', path: workspace.rootFile('ci-main.yml'), text: '' },
    { name: 'a workflow outside any workspace', path: '/definitely/not/a/workspace/.github/workflows/ci-main.yml', text: '' },
  ],
  invalid: [
    {
      name: 'a library missing its coverage entry, reported over the whole document',
      path: WORKFLOW,
      text: WITHOUT_JSON,
      errors: [whole(WITHOUT_JSON, missing('coverage', 'lib-json', 'libs/utils/json', 'json-utils'))],
    },
  ],
})

describe('the status workflow', () => {
  it('is reported once removed, beside the coverage entry', () => {
    rmSync(join(workspace.root, '.github', 'workflows', 'ci-lib-anon.yml'))
    testRule(rule, {
      valid: [],
      invalid: [
        {
          name: 'a library without a status workflow or a coverage entry',
          path: WORKFLOW,
          text: WITHOUT_ANON,
          errors: [
            whole(WITHOUT_ANON, missing('status', 'lib-anon', 'plugins/anon', 'anon')),
            whole(WITHOUT_ANON, missing('coverage', 'lib-anon', 'plugins/anon', 'anon')),
          ],
        },
      ],
    })
    expect(existsSync(join(workspace.root, '.github', 'workflows', 'ci-lib-anon.yml'))).toBe(false)
  })
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    workspace.remove()
    expect(existsSync(workspace.root)).toBe(false)
  })
})
