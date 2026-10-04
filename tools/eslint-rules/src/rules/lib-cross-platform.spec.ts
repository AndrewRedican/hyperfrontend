import { after as afterAll } from 'node:test'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../testing'
import rule, { RULE_NAME } from './lib-cross-platform'
import { createCrossPlatformFiles } from './lib-cross-platform/test-workspaces'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

const files = createCrossPlatformFiles(manager)

const ruleTester = createTypeScriptRuleTester()

ruleTester.run(RULE_NAME, rule, {
  valid: [
    {
      name: 'ignores libraries that are not published',
      code: "import { join } from 'node:path'\njoin(a, b).split('/')",
      filename: files.unpublished,
    },
    {
      name: 'allows a slash matched against a portable path',
      code: "import { posix } from 'node:path'\nposix.join(a, b).split('/')",
      filename: files.node,
    },
    {
      name: 'allows a slash matched against a canonically converted path',
      code: "import { join, posix, sep } from 'node:path'\njoin(a, b).split(sep).join(posix.sep).split('/')",
      filename: files.node,
    },
    {
      name: 'ignores path-like names outside Node projects',
      code: "filePath.split('/')",
      filename: files.browser,
    },
    {
      name: 'ignores names that read as URLs or requests',
      code: "url.split('/')\nrequestPath.split('/')\nexportPath.includes('/')",
      filename: files.node,
    },
    {
      name: 'ignores separator methods whose argument names no slash',
      code: "import { join } from 'node:path'\njoin(a, b).split('.')\njoin(a, b).split(sep)\njoin(a, b).split()\njoin(a, b).split(...args)\njoin(a, b).replace(/\\./g, '')",
      filename: files.node,
    },
    {
      name: 'ignores regexes that also match backslashes',
      code: "import { join } from 'node:path'\njoin(a, b).replace(/\\\\|\\//g, '-')",
      filename: files.node,
    },
    {
      name: 'ignores computed and non-separator methods',
      code: "import { join } from 'node:path'\njoin(a, b)['split']('/')\njoin(a, b).concat('/')\nsplit('/')",
      filename: files.node,
    },
    {
      name: 'ignores built strings that read as specifiers, URLs, queries, or prose',
      code: [
        'const a = `./${projectRoot}/x`',
        'const b = `${projectRoot}/x?y=1`',
        'const c = `https://${host}/${projectRoot}`',
        'const d = `${projectRoot}/ index`',
        'const e = `${projectRoot}/x#top`',
        "const f = '../' + projectRoot + '/x'",
      ].join('\n'),
      filename: files.node,
    },
    {
      name: 'ignores built strings stored under or built from URL names',
      code: 'const fullUrl = `${base}/${filePath}`\nconst o = { href: `${filePath}/x` }\nlink.uri = `${filePath}/x`\nconst x = `${baseUrl}/${filePath}`',
      filename: files.node,
    },
    {
      name: 'ignores built strings nested in a larger one, tagged, or without text',
      code: 'const a = `${x}${dir ? `${dir}/` : ``}y`\nconst b = sql`${dir}/x`\nconst c = `${dir}${name}`\nconst d = `${count}/${total}`\nconst e = a - b',
      filename: files.node,
    },
    {
      name: 'treats a ./-prefixed build as a portable specifier',
      code: 'const prefix = `./${outputDir}`\nprefix.split(`/`)',
      filename: files.node,
    },
    {
      name: 'ignores startsWith on a portable value',
      code: "import { posix } from 'node:path'\nposix.resolve(a).startsWith('/')",
      filename: files.node,
    },
    {
      name: 'ignores rebuilt absolute paths outside Node projects',
      code: "const dir = `/${segments.join('/')}`",
      filename: files.browser,
    },
    {
      name: 'ignores rebuilt paths whose segments come from relative()',
      code: "import { relative, sep } from 'node:path'\nconst rel = relative(a, b)\nconst parts = rel.split(sep)\nconst p = `/${parts.slice(1).join('/')}`",
      filename: files.node,
    },
    {
      name: 'ignores leading slashes that are not followed by a joined list',
      code: "const a = `/${dir}`\nconst b = `/${parts.join(',')}`\nconst c = `/${parts.map(f).filter(Boolean)}`\nconst d = `/x${parts.join('/')}`\nconst e = '/' + 'x'",
      filename: files.node,
    },
  ],
  invalid: [
    {
      name: 'fixes a slash split on a native path to sep',
      code: "import { join } from 'node:path'\njoin(a, b).split('/')",
      output: "import { join, sep } from 'node:path'\njoin(a, b).split(sep)",
      errors: [{ messageId: 'separatorLiteral', data: { method: 'split' } }],
      filename: files.node,
    },
    {
      name: 'fixes a backslash split on a native path to sep',
      code: "import { join } from 'node:path'\njoin(a, b).split('\\\\')",
      output: "import { join, sep } from 'node:path'\njoin(a, b).split(sep)",
      errors: [{ messageId: 'separatorLiteral' }],
      filename: files.node,
    },
    {
      name: 'fixes a literal containing slashes into an interpolated template',
      code: "import { resolve } from 'node:path'\nresolve(a).includes('/node_modules/')",
      output: "import { resolve, sep } from 'node:path'\nresolve(a).includes(`${sep}node_modules${sep}`)",
      errors: [{ messageId: 'separatorLiteral', data: { method: 'includes' } }],
      filename: files.node,
    },
    {
      name: 'fixes a template argument interpolating a native directory',
      code: "import { dirname } from 'node:path'\nconst dir = dirname(f)\nfile.startsWith(`${dir}/`)",
      output: "import { dirname, sep } from 'node:path'\nconst dir = dirname(f)\nfile.startsWith(`${dir}${sep}`)",
      errors: [{ messageId: 'separatorLiteral', data: { method: 'startsWith' } }],
      filename: files.node,
    },
    {
      name: 'fixes every slash operand of a concatenated argument',
      code: "import { dirname } from 'node:path'\nconst root = dirname(f)\nchild.startsWith(root + '/' + name + `/${kind}/`)",
      output:
        "import { dirname, sep } from 'node:path'\nconst root = dirname(f)\nchild.startsWith(root + sep + name + `${sep}${kind}${sep}`)",
      errors: [{ messageId: 'separatorLiteral' }],
      filename: files.node,
    },
    {
      name: 'fixes a single slash operand of a concatenated argument',
      code: "const root = __dirname\nchild.endsWith(root + '/')",
      output: "import { sep } from 'node:path'\nconst root = __dirname\nchild.endsWith(root + sep)",
      errors: [{ messageId: 'separatorLiteral', data: { method: 'endsWith' } }],
      filename: files.node,
    },
    {
      name: 'reports a slash-only regex on a native path without a fix',
      code: "import { join } from 'node:path'\njoin(a, b).replace(/\\//g, '-')",
      errors: [{ messageId: 'separatorLiteral', data: { method: 'replace' } }],
      filename: files.node,
    },
    {
      name: 'reports a native path that cannot reference sep without a fix',
      code: "import { join } from 'node:path'\nconst sep = ';'\njoin(a, b).lastIndexOf('/')",
      errors: [{ messageId: 'separatorLiteral', data: { method: 'lastIndexOf' } }],
      filename: files.node,
    },
    {
      name: 'suggests both separators for a path-like name',
      code: "filePath.split('/')",
      errors: [
        {
          messageId: 'separatorLiteral',
          suggestions: [
            { messageId: 'treatAsNative', data: { replacement: 'sep' }, output: "import { sep } from 'node:path'\nfilePath.split(sep)" },
            {
              messageId: 'treatAsPortable',
              data: { replacement: 'posix.sep' },
              output: "import { posix } from 'node:path'\nfilePath.split(posix.sep)",
            },
          ],
        },
      ],
      filename: files.node,
    },
    {
      name: 'suggests only the native separator in place of a backslash',
      code: "rootDir.indexOf('\\\\')",
      errors: [
        {
          messageId: 'separatorLiteral',
          suggestions: [{ messageId: 'treatAsNative', output: "import { sep } from 'node:path'\nrootDir.indexOf(sep)" }],
        },
      ],
      filename: files.node,
    },
    {
      name: 'fixes startsWith slash on a native path to isAbsolute',
      code: "import { resolve } from 'node:path'\nif (!resolve(a).startsWith('/')) {}",
      output: "import { resolve, isAbsolute } from 'node:path'\nif (!isAbsolute(resolve(a))) {}",
      errors: [{ messageId: 'absoluteCheck' }],
      filename: files.node,
    },
    {
      name: 'fixes startsWith slash through a default path import',
      code: "import path from 'node:path'\npath.resolve(a).startsWith('/')",
      output: "import path from 'node:path'\npath.isAbsolute(path.resolve(a))",
      errors: [{ messageId: 'absoluteCheck' }],
      filename: files.node,
    },
    {
      name: 'reports an optional startsWith slash without a fix',
      code: "import { resolve } from 'node:path'\nresolve(a)?.startsWith('/')",
      errors: [{ messageId: 'absoluteCheck' }],
      filename: files.node,
    },
    {
      name: 'suggests both isAbsolute flavours for a path-like name',
      code: "projectRoot.startsWith('/')",
      errors: [
        {
          messageId: 'absoluteCheck',
          suggestions: [
            { messageId: 'treatAsNative', output: "import { isAbsolute } from 'node:path'\nisAbsolute(projectRoot)" },
            { messageId: 'treatAsPortable', output: "import { posix } from 'node:path'\nposix.isAbsolute(projectRoot)" },
          ],
        },
      ],
      filename: files.node,
    },
    {
      name: 'fixes a slash-joined template into join',
      code: "import { dirname } from 'node:path'\nconst dir = dirname(f)\nconst file = `${dir}/src/${name}.ts`",
      output: "import { dirname, join } from 'node:path'\nconst dir = dirname(f)\nconst file = join(dir, 'src', `${name}.ts`)",
      errors: [{ messageId: 'separatorJoin' }],
      filename: files.node,
    },
    {
      name: 'fixes a slash-joined concatenation into join',
      code: "const p = __dirname + '/x/' + name",
      output: "import { join } from 'node:path'\nconst p = join(__dirname, 'x', name)",
      errors: [{ messageId: 'separatorJoin' }],
      filename: files.node,
    },
    {
      name: 'reuses a native join helper already in scope',
      code: "import { join } from '@hyperfrontend/project-scope/core'\nconst p = `${process.cwd()}/a`",
      output: "import { join } from '@hyperfrontend/project-scope/core'\nconst p = join(process.cwd(), 'a')",
      errors: [{ messageId: 'separatorJoin' }],
      filename: files.node,
    },
    {
      name: 'reports without a fix when join names a portable helper',
      code: "import { join } from './fs/posix-path'\nconst p = `${process.cwd()}/a`",
      errors: [{ messageId: 'separatorJoin' }],
      options: [{ helpers: [{ module: 'src/fs/posix-path', portable: ['join'] }] }],
      filename: files.node,
    },
    {
      name: 'escapes quotes, backslashes, backticks, and interpolation markers in join arguments',
      code: "const p = `${process.cwd()}/it's/a\\\\b/${name}\\`x/\\${y}`",
      output: "import { join } from 'node:path'\nconst p = join(process.cwd(), 'it\\'s', 'a\\\\b', `${name}\\`x`, '${y}')",
      errors: [{ messageId: 'separatorJoin' }],
      filename: files.node,
    },
    {
      name: 'parenthesises a sequence expression passed to join',
      code: 'const p = `${(a, process.cwd())}/x`',
      output: "import { join } from 'node:path'\nconst p = join((a, process.cwd()), 'x')",
      errors: [{ messageId: 'separatorJoin' }],
      filename: files.node,
    },
    {
      name: 'fixes a trailing-slash prefix by interpolating sep',
      code: 'const prefix = `${process.cwd()}/`\nconst other = __dirname + "//x"',
      output: [
        'import { sep } from \'node:path\'\nconst prefix = `${process.cwd()}${sep}`\nconst other = __dirname + "//x"',
        "import { sep } from 'node:path'\nconst prefix = `${process.cwd()}${sep}`\nconst other = __dirname + `${sep}${sep}x`",
      ],
      errors: [{ messageId: 'separatorJoin' }, { messageId: 'separatorJoin' }],
      filename: files.node,
    },
    {
      name: 'suggests join and posix.join for a path-like name',
      code: 'const p = `${projectRoot}/package.json`',
      errors: [
        {
          messageId: 'separatorJoin',
          suggestions: [
            { messageId: 'treatAsNative', output: "import { join } from 'node:path'\nconst p = join(projectRoot, 'package.json')" },
            {
              messageId: 'treatAsPortable',
              output: "import { posix } from 'node:path'\nconst p = posix.join(projectRoot, 'package.json')",
            },
          ],
        },
      ],
      filename: files.node,
    },
    {
      name: 'reports an absolute path rebuilt from joined segments',
      code: "const dir = `/${segments.slice(0, i).join('/')}`",
      errors: [{ messageId: 'driveLetterLoss' }],
      filename: files.node,
    },
    {
      name: 'reports a concatenated rebuild joined with either sep',
      code: "import { posix, sep } from 'node:path'\nconst a = '/' + parts.join(sep)\nconst b = '/' + parts.join(posix.sep) + '/x'",
      errors: [{ messageId: 'driveLetterLoss' }, { messageId: 'driveLetterLoss' }],
      filename: files.node,
    },
  ],
})
