import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from '@hyperfrontend/testing'
import { testRule } from '../../testing/rule-tester.ts'
import { createCrossPlatformWorkspace, recordedMessage } from './__fixtures__/cross-platform-workspace.ts'
import rule from './cross-platform.ts'

const workspace = createCrossPlatformWorkspace()

// why: the cases were recorded in temporary workspaces; each is linted in the fixture project its recorded workspace stands for. Case 42 passes a `helpers` option, which the workspace does not configure.
testRule(rule, {
  valid: [
    {
      name: '#1 ignores libraries that are not published',
      path: join(workspace.root, 'unpublished', 'src', 'file.ts'),
      text: "import { join } from 'node:path'\njoin(a, b).split('/')",
    },
    {
      name: '#2 ignores a file no project owns',
      path: join(workspace.root, 'projectless', 'src', 'file.ts'),
      text: "import { join } from 'node:path'\njoin(a, b).split('/')",
      options: { include: [{ files: ['**'] }] },
    },
    {
      name: '#3 ignores a project the default include leaves out',
      path: join(workspace.root, 'tool', 'tools', 'app', 'src', 'file.ts'),
      text: "import { join } from 'node:path'\njoin(a, b).split('/')",
    },
    {
      name: '#4 ignores a project no files glob selects',
      path: join(workspace.root, 'tool', 'tools', 'app', 'src', 'file.ts'),
      text: "import { join } from 'node:path'\njoin(a, b).split('/')",
      options: { include: [{ files: ['apps/**'] }] },
    },
    {
      name: '#7 allows a slash matched against a portable path',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { posix } from 'node:path'\nposix.join(a, b).split('/')",
    },
    {
      name: '#8 allows a slash matched against a canonically converted path',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { join, posix, sep } from 'node:path'\njoin(a, b).split(sep).join(posix.sep).split('/')",
    },
    {
      name: '#11 ignores separator methods whose argument names no slash',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { join } from 'node:path'\njoin(a, b).split('.')\njoin(a, b).split(sep)\njoin(a, b).split()\njoin(a, b).split(...args)\njoin(a, b).replace(/\\./g, '')",
    },
    {
      name: '#12 ignores regexes that also match backslashes',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { join } from 'node:path'\njoin(a, b).replace(/\\\\|\\//g, '-')",
    },
    {
      name: '#13 ignores computed and non-separator methods',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { join } from 'node:path'\njoin(a, b)['split']('/')\njoin(a, b).concat('/')\nsplit('/')",
    },
    {
      name: '#15 ignores built strings stored under or built from URL names',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: 'const fullUrl = `${base}/${filePath}`\nconst o = { href: `${filePath}/x` }\nlink.uri = `${filePath}/x`\nconst x = `${baseUrl}/${filePath}`',
    },
    {
      name: '#16 ignores built strings nested in a larger one, tagged, or without text',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: 'const a = `${x}${dir ? `${dir}/` : ``}y`\nconst b = sql`${dir}/x`\nconst c = `${dir}${name}`\nconst d = `${count}/${total}`\nconst e = a - b',
    },
    {
      name: '#17 treats a ./-prefixed build as a portable specifier',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: 'const prefix = `./${outputDir}`\nprefix.split(`/`)',
    },
    {
      name: '#20 ignores rebuilt paths whose segments come from relative()',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { relative, sep } from 'node:path'\nconst rel = relative(a, b)\nconst parts = rel.split(sep)\nconst p = `/${parts.slice(1).join('/')}`",
    },
    {
      name: '#21 ignores leading slashes that are not followed by a joined list',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "const a = `/${dir}`\nconst b = `/${parts.join(',')}`\nconst c = `/${parts.map(f).filter(Boolean)}`\nconst d = `/x${parts.join('/')}`\nconst e = '/' + 'x'",
    },
  ],
  invalid: [
    {
      name: '#29 fixes every slash operand of a concatenated argument',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { dirname } from 'node:path'\nconst root = dirname(f)\nchild.startsWith(root + '/' + name + `/${kind}/`)",
      errors: [
        {
          message:
            "`.startsWith()` matches a hardcoded '/' against a native path, which uses '\\' on Windows. Match `sep` from node:path, or convert the path first with `normalizePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported.",
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 50,
        },
      ],
      output:
        "import { dirname, sep } from 'node:path'\nconst root = dirname(f)\nchild.startsWith(root + sep + name + `${sep}${kind}${sep}`)",
    },
    {
      name: '#31 reports a slash-only regex on a native path without a fix',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { join } from 'node:path'\njoin(a, b).replace(/\\//g, '-')",
      errors: [
        {
          message:
            "`.replace()` matches a hardcoded '/' against a native path, which uses '\\' on Windows. Match `sep` from node:path, or convert the path first with `normalizePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported.",
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 31,
        },
      ],
      output: null,
    },
    {
      name: '#32 reports a native path that cannot reference sep without a fix',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { join } from 'node:path'\nconst sep = ';'\njoin(a, b).lastIndexOf('/')",
      errors: [
        {
          message:
            "`.lastIndexOf()` matches a hardcoded '/' against a native path, which uses '\\' on Windows. Match `sep` from node:path, or convert the path first with `normalizePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported.",
          line: 3,
          column: 1,
          endLine: 3,
          endColumn: 28,
        },
      ],
      output: null,
    },
    {
      name: '#33 suggests both separators for a path-like name',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "filePath.split('/')",
      errors: [
        {
          message:
            "`.split()` matches a hardcoded '/' against a native path, which uses '\\' on Windows. Match `sep` from node:path, or convert the path first with `normalizePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 20,
        },
      ],
      output: null,
    },
    {
      name: '#34 suggests only the native separator in place of a backslash',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "rootDir.indexOf('\\\\')",
      errors: [
        {
          message:
            "`.indexOf()` matches a hardcoded '/' against a native path, which uses '\\' on Windows. Match `sep` from node:path, or convert the path first with `normalizePath` from @hyperfrontend/project-scope/core/path, or `.split(sep).join(posix.sep)` where that package cannot be imported.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 22,
        },
      ],
      output: null,
    },
    {
      name: '#35 fixes startsWith slash on a native path to isAbsolute',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { resolve } from 'node:path'\nif (!resolve(a).startsWith('/')) {}",
      errors: [
        {
          message: "`startsWith('/')` never matches a Windows absolute path such as 'C:\\x'. Use `isAbsolute()` from node:path.",
          line: 2,
          column: 6,
          endLine: 2,
          endColumn: 32,
        },
      ],
      output: "import { resolve, isAbsolute } from 'node:path'\nif (!isAbsolute(resolve(a))) {}",
    },
    {
      name: '#36 fixes startsWith slash through a default path import',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import path from 'node:path'\npath.resolve(a).startsWith('/')",
      errors: [
        {
          message: "`startsWith('/')` never matches a Windows absolute path such as 'C:\\x'. Use `isAbsolute()` from node:path.",
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 32,
        },
      ],
      output: "import path from 'node:path'\npath.isAbsolute(path.resolve(a))",
    },
    {
      name: '#37 reports an optional startsWith slash without a fix',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { resolve } from 'node:path'\nresolve(a)?.startsWith('/')",
      errors: [
        {
          message: "`startsWith('/')` never matches a Windows absolute path such as 'C:\\x'. Use `isAbsolute()` from node:path.",
          line: 2,
          column: 1,
          endLine: 2,
          endColumn: 28,
        },
      ],
      output: null,
    },
    {
      name: '#38 suggests both isAbsolute flavours for a path-like name',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "projectRoot.startsWith('/')",
      errors: [
        {
          message: "`startsWith('/')` never matches a Windows absolute path such as 'C:\\x'. Use `isAbsolute()` from node:path.",
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 28,
        },
      ],
      output: null,
    },
    {
      name: '#41 reuses a native join helper already in scope',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { join } from '@hyperfrontend/project-scope/core'\nconst p = `${process.cwd()}/a`",
      errors: [
        {
          message:
            "A native path is joined to more segments with a hardcoded '/', which mixes separators on Windows. Use `join()` from node:path, or `posix.join()` when the value is a portable path.",
          line: 2,
          column: 11,
          endLine: 2,
          endColumn: 31,
        },
      ],
      output: "import { join } from '@hyperfrontend/project-scope/core'\nconst p = join(process.cwd(), 'a')",
    },
    {
      name: '#43 escapes quotes, backslashes, backticks, and interpolation markers in join arguments',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "const p = `${process.cwd()}/it's/a\\\\b/${name}\\`x/\\${y}`",
      errors: [
        {
          message:
            "A native path is joined to more segments with a hardcoded '/', which mixes separators on Windows. Use `join()` from node:path, or `posix.join()` when the value is a portable path.",
          line: 1,
          column: 11,
          endLine: 1,
          endColumn: 56,
        },
      ],
      output: "import { join } from 'node:path'\nconst p = join(process.cwd(), 'it\\'s', 'a\\\\b', `${name}\\`x`, '${y}')",
    },
    {
      name: '#44 parenthesises a sequence expression passed to join',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: 'const p = `${(a, process.cwd())}/x`',
      errors: [
        {
          message:
            "A native path is joined to more segments with a hardcoded '/', which mixes separators on Windows. Use `join()` from node:path, or `posix.join()` when the value is a portable path.",
          line: 1,
          column: 11,
          endLine: 1,
          endColumn: 36,
        },
      ],
      output: "import { join } from 'node:path'\nconst p = join((a, process.cwd()), 'x')",
    },
    {
      name: '#45 fixes a trailing-slash prefix by interpolating sep',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: 'const prefix = `${process.cwd()}/`\nconst other = __dirname + "//x"',
      errors: [
        {
          message:
            "A native path is joined to more segments with a hardcoded '/', which mixes separators on Windows. Use `join()` from node:path, or `posix.join()` when the value is a portable path.",
          line: 1,
          column: 16,
          endLine: 1,
          endColumn: 35,
        },
        {
          message:
            "A native path is joined to more segments with a hardcoded '/', which mixes separators on Windows. Use `join()` from node:path, or `posix.join()` when the value is a portable path.",
          line: 2,
          column: 15,
          endLine: 2,
          endColumn: 32,
        },
      ],
      output: "import { sep } from 'node:path'\nconst prefix = `${process.cwd()}${sep}`\nconst other = __dirname + `${sep}${sep}x`",
    },
    {
      name: '#46 suggests join and posix.join for a path-like name',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: 'const p = `${projectRoot}/package.json`',
      errors: [
        {
          message:
            "A native path is joined to more segments with a hardcoded '/', which mixes separators on Windows. Use `join()` from node:path, or `posix.join()` when the value is a portable path.",
          line: 1,
          column: 11,
          endLine: 1,
          endColumn: 40,
        },
      ],
      output: null,
    },
    {
      name: '#47 reports an absolute path rebuilt from joined segments',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "const dir = `/${segments.slice(0, i).join('/')}`",
      errors: [
        {
          message:
            "Rebuilding an absolute path as '/' plus joined segments drops the drive on Windows: 'C:\\x' becomes '/C:/x'. Walk up with `dirname()` instead.",
          line: 1,
          column: 13,
          endLine: 1,
          endColumn: 49,
        },
      ],
      output: null,
    },
    {
      name: '#48 reports a concatenated rebuild joined with either sep',
      path: join(workspace.root, 'node', 'src', 'file.ts'),
      text: "import { posix, sep } from 'node:path'\nconst a = '/' + parts.join(sep)\nconst b = '/' + parts.join(posix.sep) + '/x'",
      errors: [
        {
          message:
            "Rebuilding an absolute path as '/' plus joined segments drops the drive on Windows: 'C:\\x' becomes '/C:/x'. Walk up with `dirname()` instead.",
          line: 2,
          column: 11,
          endLine: 2,
          endColumn: 32,
        },
        {
          message:
            "Rebuilding an absolute path as '/' plus joined segments drops the drive on Windows: 'C:\\x' becomes '/C:/x'. Walk up with `dirname()` instead.",
          line: 3,
          column: 11,
          endLine: 3,
          endColumn: 45,
        },
      ],
      output: null,
    },
  ],
})

const NODE = join(workspace.node, 'src', 'file.ts')
const SPLIT = recordedMessage('separatorLiteral', { method: 'split' })
const JOIN = recordedMessage('separatorJoin')

/**
 * Lines joined into one text.
 *
 * @param lines - The lines of the text, without line feeds
 * @returns The lines joined by line feeds
 */
function text(...lines: readonly string[]): string {
  return lines.join('\n')
}

// why: the cases recorded from the previous linter leave the value tracing through these spellings, the helper modules, the import placement of fixes and a project without sources unexercised.
testRule(rule, {
  valid: [
    {
      name: 'values whose origin the tracing does not prove native',
      path: NODE,
      text: text(
        "import path, { join } from 'node:path'",
        "import * as fs from 'node:fs'",
        "import { isAbsolute, joinPath } from '@hyperfrontend/project-scope/core'",
        "import { sep as other } from './consts'",
        "import ffs = require('node:fs')",
        'var v = join(a)',
        'var v = join(b)',
        'let b',
        'b = join(x)',
        'b = y',
        "const os = require(name), w = require(`path`), u = other('path'), [q] = require('node:path')",
        "const { [k]: z, a = 1, ...rest } = require('node:path')",
        'function helper() {}',
        "for (const e of xs) e.split('/')",
        "for (const k in o) k.split('/')",
        "v.split('/')",
        "b.split('/')",
        "ffs.realpathSync(x).split('/')",
        "helper.join(a).split('/')",
        "path.join.call(null, a).split('/')",
        "fs.promises.x(a).split('/')",
        "joinPath(a).split('/')",
        "isAbsolute(a).split('/')",
        ";(c && join(a)).split('/')",
        ";(a - b).split('/')",
        "this.split('/')",
        ";(42).split('/')",
        ";`x`.split('/')",
        ";('x' + c).split('/')",
        ";(c + 'x').split('/')",
        "x.foo().split('/')",
        "factory()().split('/')",
        "foo(a).split('/')",
        "x.split().join('/')",
        "x.split(other).join('/')",
        "x.split(path.posix.sep).join('-')",
        "z.split('/') + w.split('/') + u.split('/') + q.split('/') + rest.split('/')",
        "globalThis.foo.bar(a).split('/')",
        'const p0 = process.cwd()',
        ...['p1 = p0', 'p2 = p1', 'p3 = p2', 'p4 = p3', 'p5 = p4', 'p6 = p5', 'p7 = p6', 'p8 = p7', 'p9 = p8'].map(
          (pair) => `const ${pair}`
        ),
        "p9.split('/')",
        "URLPath.split('/')",
        "$.split('/')"
      ),
    },
    {
      name: 'a relative import in a library with no workspace above it',
      path: join(workspace.lonely, 'src', 'file.ts'),
      text: text("import { join } from './helpers'", "join(a).split('/')"),
    },
    {
      name: 'a path-like name in a library without sources',
      path: join(workspace.bare, 'file.ts'),
      text: "filePath.split('/')",
    },
    {
      name: 'a portable helper the builder mirrors, imported relatively',
      path: join(workspace.tool, 'tools', 'app', 'src', 'file.ts'),
      options: { include: [{ files: ['tools/**'] }] },
      text: text("import { join } from '../../../libs/builder/src/bundle/fs/posix-path'", "join(a, b).split('/')"),
    },
    {
      name: 'a computed member, a join called through brackets, and a join without a separator',
      path: NODE,
      text: text("ctx['rootDir'].split('/')", "x.split('\\\\')['join']('/')", 'const d = `/${options.segments.join()}`'),
    },
  ],
  invalid: [
    {
      name: 'values traced to a native or relative origin, or named like paths',
      path: NODE,
      text: text(
        "import { join, relative } from 'node:path'",
        "import { normalizeToNative } from '@hyperfrontend/project-scope/core/path'",
        "import { 'sep' as s } from 'node:path'",
        "const path = require('path')",
        "const { join: j, resolve } = require('node:path')",
        'declare const outDir: string',
        'let a = join(x)',
        'const d = join(y)',
        ";(c ?? join(b)).split('/')",
        ";(c ? relative(a, b) : x).split('/')",
        ";(0, join(b)).split('/')",
        ";(c + rootDir).split('/')",
        "import.meta.dirname.split('/')",
        "__filename.split('/')",
        "normalizeToNative(x).split('/')",
        "path.join(x).split('/')",
        "j(x).slice(1).split('/')",
        "resolve(x).split('/')",
        "outDir.split('/')",
        "a.split('/')",
        "d.split('/')",
        "d.split('/')",
        "out2Dir.split('/')",
        "basePATH.split('/')",
        "XMLFile.split('/')",
        "snake_case_dir.split('/')"
      ),
      errors: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map((line) => ({
        message: SPLIT,
        line,
        column: line < 13 ? 2 : 1,
      })),
    },
    {
      name: 'joins whose fix places the import before the first statement or the first later import',
      path: NODE,
      text: text('`${process.cwd()}/x`.length'),
      errors: [{ message: JOIN, line: 1, column: 1 }],
      output: text("import { join } from 'node:path'", "join(process.cwd(), 'x').length"),
    },
    {
      name: 'a join whose fix goes before an external import',
      path: NODE,
      text: text("import { a } from 'lib'", 'const p = `${process.cwd()}/$a${name}\\${b}`'),
      errors: [{ message: JOIN, line: 2, column: 11 }],
      output: text("import { join } from 'node:path'", "import { a } from 'lib'", 'const p = join(process.cwd(), `$a${name}\\${b}`)'),
    },
    {
      name: 'a join whose name is taken by something else',
      path: NODE,
      text: text('const join = (...parts) => parts', 'const p = `${process.cwd()}/a`'),
      errors: [{ message: JOIN, line: 2, column: 11 }],
    },
    {
      name: 'an absolute path rebuilt from a member list',
      path: NODE,
      text: "const d = `/${options.segments.join('/')}`",
      errors: [{ message: recordedMessage('driveLetterLoss'), line: 1, column: 11 }],
    },
    {
      name: 'an import named by a string, and a split converted through a type assertion',
      path: NODE,
      text: text("import { 'join' as j } from 'node:path'", "j(x).split('/').length", ";(j(a).split('\\\\') as string[]).join('/')"),
      errors: [
        { message: SPLIT, line: 2, column: 1 },
        { message: recordedMessage('posixConversion'), line: 3, column: 2 },
        { message: SPLIT, line: 3, column: 3 },
      ],
    },
    {
      name: 'a path-like name whose native separator is taken',
      path: NODE,
      text: text('const sep = 1', "filePath.split('/')"),
      errors: [{ message: SPLIT, line: 2, column: 1 }],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed at the end', () => {
    rmSync(workspace.root, { recursive: true, force: true })
    expect(existsSync(workspace.root)).toBe(false)
  })
})
