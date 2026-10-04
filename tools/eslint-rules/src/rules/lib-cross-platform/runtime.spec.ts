import { after as afterAll } from 'node:test'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../../testing'
import rule, { RULE_NAME } from '../lib-cross-platform'
import { createCrossPlatformFiles } from './test-workspaces'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

const files = createCrossPlatformFiles(manager)

const ruleTester = createTypeScriptRuleTester()

const SHELL = "shell: process.platform === 'win32'"

const RUNTIME_CHOSEN = [
  "import { execFileSync, spawn } from 'node:child_process'",
  "execFileSync(packageManager, ['install'], { stdio: 'inherit' })",
  'spawn(ctx.pm, [])',
  "const bin = 'yarn'",
  'spawn(bin, [])',
  "spawn(win ? 'npm.cmd' : 'npm', [])",
]

/**
 * Builds the shell suggestion expected for one line of {@link RUNTIME_CHOSEN}.
 *
 * @param index - The line the suggestion rewrites.
 * @param line - That line with the shell option added.
 * @returns The expected suggestion.
 */
const shelled = (index: number, line: string) => ({
  messageId: 'useShellOnWindows' as const,
  output: RUNTIME_CHOSEN.map((current, at) => (at === index ? line : current)).join('\n'),
})

ruleTester.run(`${RULE_NAME} runtime`, rule, {
  valid: [
    {
      name: 'allows importing specifiers and file URLs',
      code: "import { pathToFileURL } from 'node:url'\nawait import('./x.js')\nawait import(pathToFileURL(modulePath).href)\nawait import(name)",
      filename: files.node,
    },
    {
      name: 'ignores pathname reads that are not module URLs',
      code: "const a = new URL(x).pathname\nconst b = location.pathname\nconst c = new Other('.', import.meta.url).pathname\nconst d = u.pathname\nconst e = new URL('.', import.meta.url)['pathname']\nconst f = new URL('.', import.meta.url).href",
      filename: files.node,
    },
    {
      name: 'ignores module URL pathnames outside Node projects',
      code: "const dir = new URL('.', import.meta.url).pathname",
      filename: files.browser,
    },
    {
      name: 'allows spawns of real executables or with a shell decided',
      code: [
        "import { execFileSync, execSync, spawn } from 'node:child_process'",
        "execFileSync('git', ['status'])",
        "execFileSync('npm', ['pack'], { shell: true })",
        "execFileSync('npm', ['pack'], { 'shell': false })",
        "execFileSync('npm', ['pack'], { ...options })",
        "execFileSync('npm', args, options)",
        "execFileSync('npm', args)",
        "execFileSync('npm', ...rest)",
        "execSync('npm pack')",
        'spawn(command, [])',
        "spawn(isWindows ? 'git.exe' : 'git', [])",
        'spawn(config.binary, [])',
      ].join('\n'),
      filename: files.node,
    },
    {
      name: 'ignores spawn-named functions from other modules',
      code: "import { spawn } from './process'\nspawn('npm', [])",
      filename: files.node,
    },
    {
      name: 'allows splitting on anything but a bare line feed',
      code: "text.split(/\\r?\\n/)\ntext.split()\ntext.split(',')\nsplitLines('\\n')\ntext['split']('\\n')",
      filename: files.browser,
    },
    {
      name: 'ignores tmp-looking strings that are specifiers, types, keys, or other paths',
      code: [
        "import '/tmp/x'",
        "export * from '/tmp/y'",
        "jest.mock('/tmp/z')",
        "require('/tmp/w')",
        "require.resolve('/tmp/v')",
        "type T = '/tmp'",
        "const o = { '/tmp': 1 }",
        "const a = '/tmpfoo'",
        'const b = `/dev/null${x}`',
        "const c = '/dev/nullx'",
        'const d = 42',
      ].join('\n'),
      filename: files.node,
    },
  ],
  invalid: [
    {
      name: 'fixes a dynamic import of a native path to a file URL',
      code: "import { join } from 'node:path'\nawait import(join(dir, 'x.js'))",
      output:
        "import { join } from 'node:path'\nimport { pathToFileURL } from 'node:url'\nawait import(pathToFileURL(join(dir, 'x.js')).href)",
      errors: [{ messageId: 'nativeImport' }],
      filename: files.node,
    },
    {
      name: 'suggests a file URL for a dynamic import of a path-like name',
      code: 'await import(modulePath)',
      errors: [
        {
          messageId: 'nativeImport',
          suggestions: [
            {
              messageId: 'treatAsNative',
              output: "import { pathToFileURL } from 'node:url'\nawait import(pathToFileURL(modulePath).href)",
            },
          ],
        },
      ],
      filename: files.node,
    },
    {
      name: 'reports a dynamic import whose file URL helper cannot be referenced without a fix',
      code: "const pathToFileURL = 1\nawait import(process.cwd() + '.js')",
      errors: [{ messageId: 'nativeImport' }],
      filename: files.node,
    },
    {
      name: 'fixes a module URL pathname to fileURLToPath',
      code: "import { join } from 'node:path'\nconst dir = new URL('.', import.meta.url).pathname",
      output:
        "import { join } from 'node:path'\nimport { fileURLToPath } from 'node:url'\nconst dir = fileURLToPath(new URL('.', import.meta.url))",
      errors: [{ messageId: 'urlPathname' }],
      filename: files.node,
    },
    {
      name: 'fixes a pathname read through a module URL variable',
      code: "import { fileURLToPath } from 'node:url'\nconst u = new URL('../x', import.meta.url) as URL\nconst p = u.pathname",
      output: "import { fileURLToPath } from 'node:url'\nconst u = new URL('../x', import.meta.url) as URL\nconst p = fileURLToPath(u)",
      errors: [{ messageId: 'urlPathname' }],
      filename: files.node,
    },
    {
      name: 'reports an optional module URL pathname without a fix',
      code: "import { join } from 'node:path'\nconst u = new URL('.', import.meta.url)\nconst a = u?.pathname",
      errors: [{ messageId: 'urlPathname' }],
      filename: files.node,
    },
    {
      name: 'reports a module URL pathname in a file without node imports without a fix',
      code: "const dir = new URL('.', import.meta.url).pathname",
      errors: [{ messageId: 'urlPathname' }],
      filename: files.node,
    },
    {
      name: 'reports a module URL pathname whose helper cannot be referenced without a fix',
      code: "import { join } from 'node:path'\nconst fileURLToPath = 1\nconst dir = new URL('.', import.meta.url).pathname",
      errors: [{ messageId: 'urlPathname' }],
      filename: files.node,
    },
    {
      name: 'suggests the shell option on an npm spawn with inline options',
      code: "import { execFileSync } from 'node:child_process'\nexecFileSync('npm', ['pack'], { cwd })",
      errors: [
        {
          messageId: 'shellShim',
          data: { command: 'npm' },
          suggestions: [
            {
              messageId: 'useShellOnWindows',
              output: `import { execFileSync } from 'node:child_process'\nexecFileSync('npm', ['pack'], { cwd, ${SHELL} })`,
            },
          ],
        },
      ],
      filename: files.node,
    },
    {
      name: 'suggests an options object on a spawn without one',
      code: "import { spawnSync } from 'node:child_process'\nspawnSync('npx', ['nx', 'build'])\nspawnSync('pnpm')",
      errors: [
        {
          messageId: 'shellShim',
          suggestions: [
            {
              messageId: 'useShellOnWindows',
              output: `import { spawnSync } from 'node:child_process'\nspawnSync('npx', ['nx', 'build'], { ${SHELL} })\nspawnSync('pnpm')`,
            },
          ],
        },
        {
          messageId: 'shellShim',
          suggestions: [
            {
              messageId: 'useShellOnWindows',
              output: `import { spawnSync } from 'node:child_process'\nspawnSync('npx', ['nx', 'build'])\nspawnSync('pnpm', { ${SHELL} })`,
            },
          ],
        },
      ],
      filename: files.node,
    },
    {
      name: 'suggests filling an empty options object',
      code: "import cp from 'node:child_process'\ncp.execFile('yarn', [], {})",
      errors: [
        {
          messageId: 'shellShim',
          suggestions: [
            { messageId: 'useShellOnWindows', output: `import cp from 'node:child_process'\ncp.execFile('yarn', [], { ${SHELL} })` },
          ],
        },
      ],
      filename: files.node,
    },
    {
      name: 'reports package managers chosen at runtime, through constants, or behind a conditional',
      code: RUNTIME_CHOSEN.join('\n'),
      errors: [
        {
          messageId: 'shellShim',
          data: { command: 'packageManager' },
          suggestions: [shelled(1, `execFileSync(packageManager, ['install'], { stdio: 'inherit', ${SHELL} })`)],
        },
        { messageId: 'shellShim', data: { command: 'pm' }, suggestions: [shelled(2, `spawn(ctx.pm, [], { ${SHELL} })`)] },
        { messageId: 'shellShim', data: { command: 'yarn' }, suggestions: [shelled(4, `spawn(bin, [], { ${SHELL} })`)] },
        { messageId: 'shellShim', data: { command: 'npm' }, suggestions: [shelled(5, `spawn(win ? 'npm.cmd' : 'npm', [], { ${SHELL} })`)] },
      ],
      filename: files.node,
    },
    {
      name: 'reports commands from the shimCommands option',
      code: "import { spawn } from 'node:child_process'\nspawn('deno', [])\nspawn('npm', [])",
      options: [{ shimCommands: ['deno'] }],
      errors: [
        {
          messageId: 'shellShim',
          data: { command: 'deno' },
          suggestions: [
            {
              messageId: 'useShellOnWindows',
              output: `import { spawn } from 'node:child_process'\nspawn('deno', [], { ${SHELL} })\nspawn('npm', [])`,
            },
          ],
        },
      ],
      filename: files.node,
    },
    {
      name: 'fixes a split on a bare line feed or CRLF',
      code: "const a = text.split('\\n')\nconst b = text.split(`\\r\\n`)",
      output: 'const a = text.split(/\\r?\\n/)\nconst b = text.split(/\\r?\\n/)',
      errors: [{ messageId: 'lineSplit' }, { messageId: 'lineSplit' }],
      filename: files.browser,
    },
    {
      name: 'suggests tmpdir for a hardcoded /tmp',
      code: "const dir = '/tmp'",
      errors: [
        {
          messageId: 'hardcodedTmp',
          data: { path: '/tmp' },
          suggestions: [
            { messageId: 'useOsPath', data: { replacement: 'tmpdir()' }, output: "import { tmpdir } from 'node:os'\nconst dir = tmpdir()" },
          ],
        },
      ],
      filename: files.browser,
    },
    {
      name: 'suggests devNull for a hardcoded /dev/null through a default import',
      code: "import os from 'node:os'\nconst a = '/dev/null'\nconst b = `/dev/null`",
      errors: [
        {
          messageId: 'hardcodedTmp',
          data: { path: '/dev/null' },
          suggestions: [{ messageId: 'useOsPath', output: "import os from 'node:os'\nconst a = os.devNull\nconst b = `/dev/null`" }],
        },
        {
          messageId: 'hardcodedTmp',
          suggestions: [{ messageId: 'useOsPath', output: "import os from 'node:os'\nconst a = '/dev/null'\nconst b = os.devNull" }],
        },
      ],
      filename: files.node,
    },
    {
      name: 'reports paths under /tmp without a suggestion',
      code: "const a = '/tmp/project'\nconst b = `/tmp/${name}`\nconst tmpdir = 1\nconst c = '/tmp'\nfn('/tmp/d')",
      errors: [{ messageId: 'hardcodedTmp' }, { messageId: 'hardcodedTmp' }, { messageId: 'hardcodedTmp' }, { messageId: 'hardcodedTmp' }],
      filename: files.node,
    },
  ],
})
