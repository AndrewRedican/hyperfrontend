import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import rule from './lib-pkg-secondary-entry-readme.ts'

const PUBLISHABLE = join(import.meta.dirname, '__fixtures__', 'publishable', 'package.json')

testRule(rule, {
  valid: [
    {
      name: 'headings with a trailing slash or a module suffix',
      path: PUBLISHABLE,
      text: '{ "exports": { "./slash": "./src/slash/index.js", "./mod": "./src/mod/index.js" } }',
    },
    {
      name: 'an entry with a complete README',
      path: PUBLISHABLE,
      text: '{ "exports": { ".": "./src/index.js", "./sub": "./src/sub/index.js", "./package.json": "./package.json" } }',
    },
    {
      name: 'glob keys and keys without the prefix',
      path: PUBLISHABLE,
      text: '{ "exports": { "./*": "./src/*/index.js", "x": "./x.js" } }',
    },
    { name: 'exports that are no object', path: PUBLISHABLE, text: '{ "exports": "./src/index.js" }' },
    { name: 'no exports', path: PUBLISHABLE, text: '{}' },
  ],
  invalid: [
    {
      name: 'an empty README',
      path: PUBLISHABLE,
      text: '{ "exports": { "./empty": "./src/empty/index.js" } }',
      errors: [{ message: "Secondary entrypoint './empty' README at src/empty/README.md must start with '# empty'", line: 1, column: 16 }],
    },
    {
      name: 'a README with nothing beneath its heading',
      path: PUBLISHABLE,
      text: '{ "exports": { "./only": "./src/only/index.js" } }',
      errors: [
        {
          message: "Secondary entrypoint './only' README at src/only/README.md must include a description line beneath the H1",
          line: 1,
          column: 16,
        },
      ],
    },
    {
      name: 'an entry without a README, on the exports entry',
      path: PUBLISHABLE,
      text: '{\n  "exports": {\n    "./missing": "./src/missing/index.js"\n  }\n}\n',
      errors: [
        {
          message: "Secondary entrypoint './missing' is missing required README at src/missing/README.md",
          line: 3,
          column: 5,
          endLine: 3,
          endColumn: 42,
        },
      ],
    },
    {
      name: 'a nested entry without a README',
      path: PUBLISHABLE,
      text: '{ "exports": { "./sub/deeper": "./src/sub/deeper/index.js" } }',
      errors: [
        { message: "Secondary entrypoint './sub/deeper' is missing required README at src/sub/deeper/README.md", line: 1, column: 16 },
      ],
    },
    {
      name: 'a README whose heading names something else',
      path: PUBLISHABLE,
      text: '{ "exports": { "./other": "./src/other/index.js" } }',
      errors: [{ message: "Secondary entrypoint './other' README at src/other/README.md must start with '# other'", line: 1, column: 16 }],
    },
    {
      name: 'a README that opens without a heading',
      path: PUBLISHABLE,
      text: '{ "exports": { "./plain": "./src/plain/index.js" } }',
      errors: [{ message: "Secondary entrypoint './plain' README at src/plain/README.md must start with '# plain'", line: 1, column: 16 }],
    },
    {
      name: 'a README without a description beneath its heading',
      path: PUBLISHABLE,
      text: '{ "exports": { "./bare": "./src/bare/index.js" } }',
      errors: [
        {
          message: "Secondary entrypoint './bare' README at src/bare/README.md must include a description line beneath the H1",
          line: 1,
          column: 16,
        },
      ],
    },
  ],
})
