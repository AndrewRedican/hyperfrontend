import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import rule from './no-vscode-config.ts'

// why: the rule walks the whole directory tree below the manifest, so the fixture is a disposable workspace root in the temporary directory rather than a tree inside this one.
const ROOT = mkdtempSync(join(tmpdir(), 'lint-vscode-'))
writeFileSync(join(ROOT, 'nx.json'), '{}')
for (const directory of ['.vscode', 'sub/.vscode', 'node_modules/.vscode']) mkdirSync(join(ROOT, directory), { recursive: true })

const message = (path: string, configFile = '.devcontainer/devcontainer.json'): string =>
  `VS Code configuration belongs in ${configFile} under 'customizations.vscode', so the environment has one source of truth. Found '${path}': merge what it holds into that file and delete it.`

testRule(rule, {
  valid: [
    { name: 'a manifest outside the workspace root', path: join(ROOT, 'sub', 'package.json'), text: '{}' },
    { name: 'a file that is no manifest at the workspace root', path: join(ROOT, 'nx.json'), text: '{}' },
  ],
  invalid: [
    {
      name: 'the root manifest, once per .vscode directory, skipping node_modules',
      path: join(ROOT, 'package.json'),
      text: '{}\n',
      errors: [
        { message: message('.vscode'), line: 1, column: 1, endLine: 2, endColumn: 1 },
        { message: message('sub/.vscode'), line: 1, column: 1, endLine: 2, endColumn: 1 },
      ],
    },
    {
      name: 'a configured owning file',
      path: join(ROOT, 'package.json'),
      text: '{}',
      options: { configFile: 'settings.json' },
      errors: [
        { message: message('.vscode', 'settings.json'), line: 1, column: 1 },
        { message: message('sub/.vscode', 'settings.json'), line: 1, column: 1 },
      ],
    },
  ],
})

describe('the disposable workspace root', () => {
  it('is removed once the cases have run', () => {
    rmSync(ROOT, { recursive: true })
    expect(existsSync(ROOT)).toBe(false)
  })
})
