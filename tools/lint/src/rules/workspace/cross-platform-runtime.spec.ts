import type { ExpectedError, InvalidCase, RuleCase } from '@hyperfrontend/linter/testing'
import { existsSync, rmSync } from 'node:fs'
import { join, posix } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createCrossPlatformWorkspace, recordedMessage } from './__test-utils__/cross-platform-workspace.ts'
import rule from './cross-platform.ts'

const workspace = createCrossPlatformWorkspace()
const NODE = join(workspace.node, 'src', 'file.ts')
const BROWSER = join(workspace.browser, 'src', 'file.ts')

/**
 * A case accepted in the Node library.
 *
 * @param name - What the case shows
 * @param lines - The lines of the text linted
 * @param path - The file linted
 * @returns The case
 */
function valid(name: string, lines: readonly string[], path = NODE): RuleCase {
  return { name, path, text: lines.join('\n') }
}

/**
 * A case reported in the Node library.
 *
 * @param name - What the case shows
 * @param lines - The lines of the text linted
 * @param errors - The problems reported
 * @param output - The lines after the fixes, when there are any
 * @param path - The file linted
 * @returns The case
 */
function invalid(
  name: string,
  lines: readonly string[],
  errors: readonly ExpectedError[],
  output?: readonly string[],
  path = NODE
): InvalidCase {
  return { name, path, text: lines.join('\n'), errors, ...(output === undefined ? {} : { output: output.join('\n') }) }
}

/**
 * A problem at a position.
 *
 * @param id - The recorded message id
 * @param line - The 1-based line reported
 * @param column - The 1-based column reported
 * @param data - The message's placeholders
 * @returns The expected problem
 */
function at(id: string, line: number, column: number, data: Readonly<Record<string, string>> = {}): ExpectedError {
  return { message: recordedMessage(id, data), line, column }
}

// how: the reported paths are spelled from their segments, so this spec does not write them out itself.
const TMP = posix.join(posix.sep, 'tmp')
const DEV_NULL = posix.join(posix.sep, 'dev', 'null')
const SPAWN = "import { execFileSync, execSync, spawn, spawnSync } from 'node:child_process'"

// why: the cases recorded from the previous linter cover only the separator checks; the specifier, URL, line, temporary-path, spawn and conversion checks are specified here.
testRule(rule, {
  valid: [
    valid('portable and unknown paths given to path/posix functions', [
      "import { join, posix, relative, sep } from 'node:path'",
      'const a = posix.join(root, file)',
      "const b = posix.dirname('libs/a/src/x.ts')",
      'const c = posix.relative(relative(a, b).split(sep).join(posix.sep), file)',
      'const d = posix.sep.concat(join(root, file))',
      'const e = posix.format({ dir: join(root, file) })',
      'const f = join(process.cwd(), file)',
    ]),
    valid('imports of specifiers and file URLs', [
      "import { pathToFileURL } from 'node:url'",
      "await import('./x.js')",
      'await import(pathToFileURL(modulePath).href)',
      'await import(name)',
    ]),
    valid('pathname reads that are not module URLs', [
      'const a = new URL(x).pathname',
      'const b = location.pathname',
      "const c = new Other('.', import.meta.url).pathname",
      'const d = u.pathname',
      "const e = new URL('.', import.meta.url)['pathname']",
      "const f = new URL('.', import.meta.url).href",
      "const g = new globalThis.URL('.', import.meta.url).pathname",
    ]),
    valid('module URL pathnames outside Node projects', ["const dir = new URL('.', import.meta.url).pathname"], BROWSER),
    valid('specifier flags followed by specifiers, file URLs or nothing', [
      "import { register } from 'node:module'",
      "import { join } from 'node:path'",
      "import { pathToFileURL } from 'node:url'",
      "const a = ['--import', './register.mjs', '--test-reporter', 'lcov', '--import']",
      "const b = ['--import', pathToFileURL(join(root, 'x.js')).href]",
      "const c = ['--require', join(root, 'x.js'), '--import', ...rest]",
      "const d = [, '--import', specifier, '--loader', , 1]",
      "args.push('--loader', 'tsx')",
      "args.concat('--import', join(root, 'x.js'))",
      "push('--import', join(root, 'x.js'))",
      'const e = `--import=${pathToFileURL(join(root, "x.js")).href}`',
      `const f = \`--import=\${join(root, "x.js")}.js\``,
      `const g = \`--require=\${join(root, "x.js")}\``,
      `const h = \`\${a}--import=\${join(root, "x.js")}\``,
      'const i = `--import=`',
      "register('./hooks.mjs', import.meta.url)",
      "register(pathToFileURL(join(root, 'hooks.mjs')).href)",
      'register()',
      'register(...rest)',
      "other.register(join(root, 'hooks.mjs'))",
    ]),
    valid(
      'splits on anything but a bare line feed',
      ['text.split(/\\r?\\n/)', 'text.split()', "text.split(',')", "splitLines('\\n')", "text['split']('\\n')"],
      BROWSER
    ),
    valid('temporary-looking strings that are specifiers, types, keys or other paths', [
      "import '/tmp/x'",
      "export * from '/tmp/y'",
      "export { a } from '/tmp/u'",
      "import r = require('/tmp/r')",
      "jest.mock('/tmp/z')",
      "require('/tmp/w')",
      "require.resolve('/tmp/v')",
      "type T = '/tmp'",
      "const o = { '/tmp': 1 }",
      "const a = '/tmpfoo'",
      'const b = `/dev/null${x}`',
      "const c = '/dev/nullx'",
      'const d = 42',
      'const e = tag`\\xZ${a}`',
    ]),
    valid('spawns of real executables, or with the shell decided', [
      SPAWN,
      "execFileSync('git', ['status'])",
      "execFileSync('npm', ['pack'], { shell: true })",
      "execFileSync('npm', ['pack'], { 'shell': false })",
      "execFileSync('npm', ['pack'], { [key]: 1, shell: true })",
      "execFileSync('npm', ['pack'], { ...options })",
      "execFileSync('npm', args, options)",
      "execFileSync('npm', args)",
      "execFileSync('npm', ...rest)",
      "execSync('npm pack')",
      'spawn(command, [])',
      "spawn(isWindows ? 'git.exe' : 'git', [])",
      'spawn(config.binary, [])',
      'spawn()',
    ]),
    valid('spawns of entry scripts, other paths, and split lines that are not commands', [
      SPAWN,
      "import { join } from 'node:path'",
      "execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit'])",
      "spawn(join(root, 'node_modules', '.bin'), [])",
      "spawn(join(root, 'bin', 'tool'), [])",
      "spawn(locate(root, '.bin', 'tsc'), [])",
      "spawn(join(root, '.bin', name), [])",
      "spawn('.bin/' + name, [])",
      "spawn(join(root, 'node_modules', '.bin', 'tsc'), [], { shell: true })",
      "const [first, second] = line.split(' ')",
      'spawn(second, [])',
      "const [word] = line.split(',')",
      'spawn(word, [])',
      'const [head] = words',
      'spawn(head, [])',
      'const [, later] = line.split(/\\s+/)',
      'spawn(later, [])',
      "spawn(line.split(' ')[1], [])",
      "spawn(line.split(' ')[index], [])",
      'spawn(words[0], [])',
      "spawn(line.split(' ').length, [])",
      "const { file } = line.split(' ')",
      'spawn(file, [])',
      'spawn(spawn, [])',
      'spawn(factory()(), [])',
      'for (const [cmd] of lines) spawn(cmd, [])',
      "const a0 = 'npm'",
      ...['a1 = a0', 'a2 = a1', 'a3 = a2', 'a4 = a3', 'a5 = a4', 'a6 = a5', 'a7 = a6', 'a8 = a7', 'a9 = a8'].map((pair) => `const ${pair}`),
      'spawn(a9, [])',
    ]),
    valid('spawn-named functions of other modules', ["import { spawn } from './process'", "spawn('npm', [])"]),
    valid('canonical and normalising conversions', [
      "import { join, posix, sep } from 'node:path'",
      'const a = join(x, y).split(sep).join(posix.sep)',
      "const b = x.replace(/[\\\\/]/g, '/')",
      "const c = x.split(/[/\\\\]+/).join('/')",
      "const d = x.replace(/\\\\/, '/')",
      "const e = x.replace(/\\\\/g, '-')",
      "const f = x.split('a').join('/')",
      "const g = x.join('/')",
      "const h = x.replace(/[\\\\\\/]/g, '/') + x.replace(/[\\/\\\\]/g, '/') + x.replace(/[ab]/g, '/') + x.replace(/x/g, '/')",
    ]),
    valid('legacy conversions outside Node projects', ["const a = x.replace(/\\\\/g, '/')"], BROWSER),
    valid('relative() results kept local, or not from node:path', [
      "import { relative } from 'node:path'",
      "import { relative as distance } from './math'",
      'log(relative(a, b))',
      'foo.bar(relative(a, b))',
      "const same = relative(a, b) === ''",
      'const less = relative(a, b) < x',
      'const text = `x${relative(a, b)}`',
      'let r',
      'r = relative(a, b)',
      'const both = c && relative(a, b)',
      'const fn = (x = relative(a, b)) => x',
      'const { length } = relative(a, b)',
      'const local = relative(a, b)',
      'log(local)',
      'const key = { [relative(a, b)]: 1 }',
      'function f() { return distance(a) }',
      'factory()(a)',
      'const r0 = relative(a, b)',
      ...['r1 = r0', 'r2 = r1', 'r3 = r2', 'r4 = r3', 'r5 = r4', 'r6 = r5', 'r7 = r6', 'r8 = r7', 'r9 = r8'].map((pair) => `const ${pair}`),
      'const o9 = { r9 }',
    ]),
  ],
  invalid: [
    invalid(
      'a dynamic import of a native path',
      ["import { join } from 'node:path'", "await import(join(dir, 'x.js'))"],
      [at('nativeImport', 2, 7)],
      [
        "import { join } from 'node:path'",
        "import { pathToFileURL } from 'node:url'",
        "await import(pathToFileURL(join(dir, 'x.js')).href)",
      ]
    ),
    invalid('a dynamic import of a path-like name', ['await import(modulePath)'], [at('nativeImport', 1, 7)]),
    invalid(
      'a dynamic import whose URL helper name is taken',
      ['const pathToFileURL = 1', "await import(process.cwd() + '.js')"],
      [at('nativeImport', 2, 7)]
    ),
    invalid(
      'native paths after specifier flags and given to register()',
      [
        "import { register } from 'node:module'",
        "import { join } from 'node:path'",
        `const argv = ['--import', join(root, 'a.ts'), \`--test-reporter=\${join(root, 'r.ts')}\`]`,
        "args.push('--loader', join(root, 'l.mjs'))",
        "args.unshift('--experimental-loader', registerPath)",
        "register(join(root, 'hooks.mjs'))",
      ],
      [
        at('nativeSpecifier', 3, 27, { target: '--import' }),
        at('nativeSpecifier', 3, 66, { target: '--test-reporter' }),
        at('nativeSpecifier', 4, 23, { target: '--loader' }),
        at('nativeSpecifier', 5, 39, { target: '--experimental-loader' }),
        at('nativeSpecifier', 6, 10, { target: 'register()' }),
      ],
      [
        "import { register } from 'node:module'",
        "import { join } from 'node:path'",
        "import { pathToFileURL } from 'node:url'",
        "const argv = ['--import', pathToFileURL(join(root, 'a.ts')).href, `--test-reporter=${pathToFileURL(join(root, 'r.ts')).href}`]",
        "args.push('--loader', pathToFileURL(join(root, 'l.mjs')).href)",
        "args.unshift('--experimental-loader', registerPath)",
        "register(pathToFileURL(join(root, 'hooks.mjs')).href)",
      ]
    ),
    invalid(
      'a module URL pathname',
      ["import { join } from 'node:path'", "const dir = new URL('.', import.meta.url).pathname"],
      [at('urlPathname', 2, 13)],
      [
        "import { join } from 'node:path'",
        "import { fileURLToPath } from 'node:url'",
        "const dir = fileURLToPath(new URL('.', import.meta.url))",
      ]
    ),
    invalid(
      'a pathname read through a module URL variable',
      ["import { fileURLToPath } from 'node:url'", "const u = new URL('../x', import.meta.url) as URL", 'const p = u.pathname'],
      [at('urlPathname', 3, 11)],
      ["import { fileURLToPath } from 'node:url'", "const u = new URL('../x', import.meta.url) as URL", 'const p = fileURLToPath(u)']
    ),
    invalid(
      'module URL pathnames left unfixed in a file without node: imports, or read optionally',
      ["const a = new URL('.', import.meta.url).pathname", "const b = new URL('.', import.meta.url)?.pathname"],
      [at('urlPathname', 1, 11), at('urlPathname', 2, 11)]
    ),
    invalid(
      'splits on a bare line feed',
      ["const a = text.split('\\n')", "const b = text.split('\\r\\n')"],
      [at('lineSplit', 1, 22), at('lineSplit', 2, 22)],
      ['const a = text.split(/\\r?\\n/)', 'const b = text.split(/\\r?\\n/)'],
      BROWSER
    ),
    invalid(
      'temporary paths written out',
      [
        "const a = '/tmp'",
        'const b = `/tmp/${name}`',
        "const c = '/dev/null'",
        'const d = `/dev/null`',
        "const e = { a: '/tmp/x' }",
        "fn(x, '/tmp')",
      ],
      [
        at('hardcodedTmp', 1, 11, { path: TMP }),
        at('hardcodedTmp', 2, 11, { path: TMP }),
        at('hardcodedTmp', 3, 11, { path: DEV_NULL }),
        at('hardcodedTmp', 4, 11, { path: DEV_NULL }),
        at('hardcodedTmp', 5, 16, { path: TMP }),
        at('hardcodedTmp', 6, 7, { path: TMP }),
      ]
    ),
    invalid(
      'shims spawned without a shell',
      [
        SPAWN,
        "import * as cp from 'node:child_process'",
        "execFileSync('npm', ['pack'], { cwd })",
        "spawnSync('npx')",
        "execFileSync(packageManager, ['install'], { stdio: 'inherit' })",
        'spawn(ctx.pm, [])',
        "const bin = 'yarn'",
        'spawn(bin, [])',
        "spawn(win ? 'npm.cmd' : 'npm', [])",
        "spawn(win ? 'pnpm' : 'git', [])",
        "cp.spawn('nx', [])",
      ],
      [
        at('shellShim', 3, 1, { command: 'npm' }),
        at('shellShim', 4, 1, { command: 'npx' }),
        at('shellShim', 5, 1, { command: 'packageManager' }),
        at('shellShim', 6, 1, { command: 'pm' }),
        at('shellShim', 8, 1, { command: 'yarn' }),
        at('shellShim', 9, 1, { command: 'npm' }),
        at('shellShim', 10, 1, { command: 'pnpm' }),
        at('shellShim', 11, 1, { command: 'nx' }),
      ]
    ),
    invalid(
      'a shim spawned with empty options',
      ["import cp from 'node:child_process'", "cp.execFile('yarn', [], {})"],
      [at('shellShim', 2, 1, { command: 'yarn' })]
    ),
    invalid(
      'a native path after a specifier flag whose URL helper name is taken',
      ["import { join } from 'node:path'", 'const pathToFileURL = 1', "const argv = ['--import', join(root, 'a.ts')]"],
      [at('nativeSpecifier', 3, 27, { target: '--import' })]
    ),
    invalid(
      'shims spawned through required bindings',
      [
        "const cp = require('child_process')",
        "const { spawn: run } = require('node:child_process')",
        "cp.execFileSync('pnpm', [])",
        "run('yarn', [])",
      ],
      [at('shellShim', 3, 1, { command: 'pnpm' }), at('shellShim', 4, 1, { command: 'yarn' })]
    ),
    invalid(
      'launchers under node_modules/.bin',
      [
        SPAWN,
        "import { join, resolve } from 'node:path'",
        "spawn(join(root, 'node_modules', '.bin', 'tsc'), [])",
        'spawn(`${base}/node_modules/.bin/vite`, [])',
        "spawn(base + '/node_modules/.bin/jest', [])",
        "const tsc = resolve(root, 'node_modules/.bin/tsc')",
        "execFileSync(tsc, ['--noEmit'])",
        "spawn('node_modules/.bin/eslint')",
      ],
      [
        at('binShim', 3, 1, { command: 'tsc' }),
        at('binShim', 4, 1, { command: 'vite' }),
        at('binShim', 5, 1, { command: 'jest' }),
        at('binShim', 7, 1, { command: 'tsc' }),
        at('binShim', 8, 1, { command: 'eslint' }),
      ]
    ),
    invalid(
      'the first word of a split command line',
      [
        SPAWN,
        "const [file, ...args] = command.split(' ')",
        'execFileSync(file, args, { cwd })',
        "spawn(line.split(' ')[0], [])",
        'const words = line.split(/\\s+/)',
        'spawn(words[0], [])',
      ],
      [
        at('splitCommand', 3, 1, { command: 'file' }),
        at('splitCommand', 4, 1, { command: "line.split(' ')[0]" }),
        at('splitCommand', 6, 1, { command: 'words[0]' }),
      ]
    ),
    invalid(
      'legacy conversions fixed to the canonical spelling',
      [
        "import { join } from 'node:path'",
        "const a = join(x, y).replace(/\\\\/g, '/')",
        "const b = x.replaceAll('\\\\', '/')",
        "const c = x.split('\\\\').join('/')",
      ],
      [at('posixConversion', 2, 11), at('posixConversion', 3, 11), at('posixConversion', 4, 11)],
      [
        "import { join, sep, posix } from 'node:path'",
        'const a = join(x, y).split(sep).join(posix.sep)',
        'const b = x.split(sep).join(posix.sep)',
        'const c = x.split(sep).join(posix.sep)',
      ]
    ),
    invalid(
      'legacy conversions keeping the separator already canonical',
      ["import { posix, sep } from 'node:path'", "const a = x.split(sep).join('/')", "const b = x.split('\\\\').join(posix.sep)"],
      [at('posixConversion', 2, 11), at('posixConversion', 3, 11)],
      ["import { posix, sep } from 'node:path'", 'const a = x.split(sep).join(posix.sep)', 'const b = x.split(sep).join(posix.sep)']
    ),
    invalid(
      'legacy conversions without a safe fix',
      [
        "const a = x.replace(/\\\\/g, '/')",
        "import { join } from 'node:path'",
        'function f(sep) {',
        "  return [x.replace(/\\\\/g, '/'), x.split('\\\\').join('/')]",
        '}',
      ],
      [at('posixConversion', 1, 11), at('posixConversion', 4, 11), at('posixConversion', 4, 34)]
    ),
    invalid(
      'native paths given to path/posix functions',
      [
        "import { join, posix, relative } from 'node:path'",
        'const a = posix.relative(process.cwd(), file)',
        'const b = posix.dirname(join(root, file))',
        "const c = posix.join(relative(a, b), 'x')",
        'const d = posix.basename(__dirname)',
      ],
      [
        at('posixNative', 2, 26, { method: 'relative' }),
        at('posixNative', 3, 25, { method: 'dirname' }),
        at('posixNative', 4, 22, { method: 'join' }),
        at('posixNative', 5, 26, { method: 'basename' }),
      ]
    ),
    invalid('legacy conversions in a file without node: imports', ["const a = x.replace(/\\\\/g, '/')"], [at('posixConversion', 1, 11)]),
    invalid(
      'relative() results that leave as data',
      [
        "import { relative } from 'node:path'",
        'function f() { return relative(a, b) }',
        'const o = { root: relative(a, b) }',
        'const list = [relative(a, b) as string]',
        'const g = () => relative(a, b)',
        'o.root = relative(a, b)',
        'set.add(relative(a, b)!)',
        "const same = relative(a, b) === 'x/y'",
        'const other = rel !== relative(a, b)',
        'const spec = `./${relative(a, b)}`',
        "const kept = relative(a, b) || '.'",
        'function h() { return c ? relative(a, b) : d }',
        'const stored = relative(a, b)',
        'export default { stored }',
        'const forwarded = stored',
      ],
      [
        at('relativeEscapes', 2, 23),
        at('relativeEscapes', 3, 19),
        at('relativeEscapes', 4, 15),
        at('relativeEscapes', 5, 17),
        at('relativeEscapes', 6, 10),
        at('relativeEscapes', 7, 9),
        at('relativeEscapes', 8, 14),
        at('relativeEscapes', 9, 23),
        at('relativeEscapes', 10, 19),
        at('relativeEscapes', 12, 27),
        at('relativeEscapes', 13, 16),
      ]
    ),
    invalid(
      'a relative() result fixed to the canonical conversion',
      ["import { relative } from 'node:path'", 'export const root = { root: relative(a, b) }'],
      [at('relativeEscapes', 2, 29)],
      ["import { relative, sep, posix } from 'node:path'", 'export const root = { root: relative(a, b).split(sep).join(posix.sep) }']
    ),
    invalid(
      'a relative() result whose separator name is taken',
      ["import { relative } from 'node:path'", 'const sep = 1', 'export const root = { root: relative(a, b) }'],
      [at('relativeEscapes', 3, 29)]
    ),
  ],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(workspace.root, { recursive: true, force: true })
    expect(existsSync(workspace.root)).toBe(false)
  })
})
