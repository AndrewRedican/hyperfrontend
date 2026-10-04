import { after as afterAll } from 'node:test'
import { createTempWorkspaceManager, createTypeScriptRuleTester } from '../../testing'
import rule, { RULE_NAME } from '../lib-cross-platform'
import { createCrossPlatformFiles } from './test-workspaces'

const manager = createTempWorkspaceManager()

afterAll(() => manager.cleanupAll())

const files = createCrossPlatformFiles(manager)

const ruleTester = createTypeScriptRuleTester()

ruleTester.run(`${RULE_NAME} conversions`, rule, {
  valid: [
    {
      name: 'allows the canonical conversion',
      code: "import { posix, relative, sep } from 'node:path'\nexport const f = (a, b) => relative(a, b).split(sep).join(posix.sep)",
      filename: files.node,
    },
    {
      name: 'allows conversions that normalise either separator',
      code: "import { join } from 'node:path'\nx.replace(/[\\\\/]/g, '/')\nx.replace(/[/\\\\]+/g, '/')\nx.split(/[\\\\/]/).join('/')\nx.replaceAll(/[\\\\/]/g, '/')",
      filename: files.node,
    },
    {
      name: 'ignores replacements that are not a global backslash-to-slash rewrite',
      code: "import { join } from 'node:path'\nx.replace(/\\\\/, '/')\nx.replace('\\\\', '/')\nx.replace(/\\\\/g, '-')\nx.replace(/a/g, '/')\nx.split('\\\\').join('-')\nx.split(';').join('/')\nfoo().join('/')\njoin('/')",
      filename: files.node,
    },
    {
      name: 'ignores legacy conversions outside Node projects',
      code: "x.replace(/\\\\/g, '/')",
      filename: files.browser,
    },
    {
      name: 'ignores relative() results used as further path input',
      code: "import { join, relative } from 'node:path'\nconst a = join(root, relative(x, y))\nconst rel = relative(x, y)\nif (rel.startsWith('..')) {}\nconst b = relative(x, y) === ''\nconst c = relative(x, y) ? 1 : 2\nconst d = flag && relative(x, y)\nconst { e = relative(x, y) } = o\nlet g\ng = relative(x, y)\nfn(relative(x, y))\nrelative(x, y)",
      filename: files.node,
    },
    {
      name: 'ignores relative() from modules other than node:path',
      code: "import { relative } from './paths'\nexport const f = () => relative(a, b)",
      filename: files.node,
    },
  ],
  invalid: [
    {
      name: 'fixes a global backslash regex replace to the canonical conversion',
      code: "import { join } from 'node:path'\nconst p = join(a).replace(/\\\\/g, '/')",
      output: "import { join, sep, posix } from 'node:path'\nconst p = join(a).split(sep).join(posix.sep)",
      errors: [{ messageId: 'posixConversion' }],
      filename: files.node,
    },
    {
      name: 'fixes replaceAll of a backslash string through a default import',
      code: "import path from 'node:path'\nconst p = x.replaceAll('\\\\', path.posix.sep)",
      output: "import path from 'node:path'\nconst p = x.split(path.sep).join(path.posix.sep)",
      errors: [{ messageId: 'posixConversion' }],
      filename: files.node,
    },
    {
      name: 'fixes an optional replace call in place',
      code: "import { sep, posix } from 'node:path'\nconst p = x?.replace(/\\\\/g, '/')",
      output: "import { sep, posix } from 'node:path'\nconst p = x?.split(sep).join(posix.sep)",
      errors: [{ messageId: 'posixConversion' }],
      filename: files.node,
    },
    {
      name: 'fixes both halves of a backslash split joined with a slash',
      code: "import { relative } from 'node:path'\nexport const f = (a, b) => relative(a, b).split('\\\\').join('/')",
      output: "import { relative, sep, posix } from 'node:path'\nexport const f = (a, b) => relative(a, b).split(sep).join(posix.sep)",
      errors: [{ messageId: 'posixConversion' }],
      filename: files.node,
    },
    {
      name: 'fixes only the join half of a sep split joined with a slash',
      code: "import { sep } from 'node:path'\nconst p = x.split(sep).join('/')",
      output: "import { sep, posix } from 'node:path'\nconst p = x.split(sep).join(posix.sep)",
      errors: [{ messageId: 'posixConversion' }],
      filename: files.node,
    },
    {
      name: 'fixes only the split half of a backslash split joined with posix.sep',
      code: "import { posix } from 'node:path'\nconst p = x.split('\\\\').join(posix.sep)",
      output: "import { posix, sep } from 'node:path'\nconst p = x.split(sep).join(posix.sep)",
      errors: [{ messageId: 'posixConversion' }],
      filename: files.node,
    },
    {
      name: 'reports a legacy conversion in a file without node imports without a fix',
      code: "const p = x.replace(/\\\\/g, '/')",
      errors: [{ messageId: 'posixConversion' }],
      filename: files.node,
    },
    {
      name: 'reports a legacy conversion whose separators cannot be referenced without a fix',
      code: "import { join } from 'node:path'\nconst posix = 1\nconst p = join(a).replace(/\\\\/g, '/')\nconst q = x.split('\\\\').join('/')",
      errors: [{ messageId: 'posixConversion' }, { messageId: 'posixConversion' }],
      filename: files.node,
    },
    {
      name: 'fixes a returned relative() result',
      code: "import { relative } from 'node:path'\nfunction f(a, b) {\n  return relative(a, b)\n}",
      output: "import { relative, sep, posix } from 'node:path'\nfunction f(a, b) {\n  return relative(a, b).split(sep).join(posix.sep)\n}",
      errors: [{ messageId: 'relativeEscapes' }],
      filename: files.node,
    },
    {
      name: 'fixes a relative() result returned through a default import',
      code: "import path from 'node:path'\nexport const f = (a: string) => path.relative(root, a) as string",
      output:
        "import path from 'node:path'\nexport const f = (a: string) => path.relative(root, a).split(path.sep).join(path.posix.sep) as string",
      errors: [{ messageId: 'relativeEscapes' }],
      filename: files.node,
    },
    {
      name: 'reports relative() results stored, compared, or prefixed',
      code: [
        "import { relative, sep, posix } from 'node:path'",
        'const o = { root: x ?? relative(a, b), [k]: c ? relative(a, b) : d }',
        'const list = [relative(a, b)]',
        'o.root = relative(a, b)',
        'set.add(relative(a, b))',
        'const same = relative(a, b) !== other',
        'const slashed = relative(a, b) === "x/y"',
        'const spec = `./${relative(a, b)}`',
      ].join('\n'),
      output: [
        "import { relative, sep, posix } from 'node:path'",
        'const o = { root: x ?? relative(a, b).split(sep).join(posix.sep), [k]: c ? relative(a, b).split(sep).join(posix.sep) : d }',
        'const list = [relative(a, b).split(sep).join(posix.sep)]',
        'o.root = relative(a, b).split(sep).join(posix.sep)',
        'set.add(relative(a, b).split(sep).join(posix.sep))',
        'const same = relative(a, b).split(sep).join(posix.sep) !== other',
        'const slashed = relative(a, b).split(sep).join(posix.sep) === "x/y"',
        'const spec = `./${relative(a, b).split(sep).join(posix.sep)}`',
      ].join('\n'),
      errors: [
        { messageId: 'relativeEscapes' },
        { messageId: 'relativeEscapes' },
        { messageId: 'relativeEscapes' },
        { messageId: 'relativeEscapes' },
        { messageId: 'relativeEscapes' },
        { messageId: 'relativeEscapes' },
        { messageId: 'relativeEscapes' },
        { messageId: 'relativeEscapes' },
      ],
      filename: files.node,
    },
    {
      name: 'fixes a relative() result that escapes through variables',
      code: "import { relative, sep, posix } from 'node:path'\nfunction f(a, b) {\n  const rel = relative(a, b)\n  const key = rel\n  map.set(key, 1)\n}",
      output:
        "import { relative, sep, posix } from 'node:path'\nfunction f(a, b) {\n  const rel = relative(a, b).split(sep).join(posix.sep)\n  const key = rel\n  map.set(key, 1)\n}",
      errors: [{ messageId: 'relativeEscapes' }],
      filename: files.node,
    },
    {
      name: 'reports an escaping relative() result whose separators cannot be referenced without a fix',
      code: "import { relative } from 'node:path'\nconst sep = 1\nexport const f = () => relative(a, b)",
      errors: [{ messageId: 'relativeEscapes' }],
      filename: files.node,
    },
  ],
})
