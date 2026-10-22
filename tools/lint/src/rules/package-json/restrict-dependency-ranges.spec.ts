import { testRule } from '../../testing/rule-tester.ts'
import rule from './restrict-dependency-ranges.ts'

const PIN = { forDependencyTypes: ['dependencies', 'devDependencies', 'optionalDependencies'], rangeType: 'pin' }
const MESSAGE = 'This dependency is using the wrong range type.  Acceptable range type(s): pin'
const PATH = '/w/p/package.json'

testRule(rule, {
  valid: [
    { name: 'pinned versions', path: PATH, text: '{ "dependencies": { "a": "1.2.3", "b": "v2.0.0", "c": "1.0.0-beta.1" } }', options: PIN },
    { name: 'a pinned workspace shorthand', path: PATH, text: '{ "dependencies": { "a": "workspace:*" } }', options: PIN },
    { name: 'a section the restriction leaves alone', path: PATH, text: '{ "peerDependencies": { "a": "^1.0.0" } }', options: PIN },
    {
      name: 'versions the rule cannot judge',
      path: PATH,
      text: '{ "dependencies": { "a": "file:../a", "b": "latest", "c": "github:x/y" } }',
      options: PIN,
    },
    { name: 'a version that is no string', path: PATH, text: '{ "dependencies": { "a": 1 } }', options: PIN },
    { name: 'a section that is no object', path: PATH, text: '{ "dependencies": "x" }', options: PIN },
    { name: 'no options', path: PATH, text: '{ "dependencies": { "a": "^1.0.0" } }' },
    {
      name: 'a caret range where carets are allowed',
      path: PATH,
      text: '{ "dependencies": { "a": "^1.0.0", "b": "workspace:^" } }',
      options: { rangeType: ['caret', 'tilde'] },
    },
    {
      name: 'a tilde range where tildes are allowed',
      path: PATH,
      text: '{ "dependencies": { "a": "~1.0.0", "b": "workspace:~" } }',
      options: [{ rangeType: 'tilde' }],
    },
    { name: 'a document that is no object', path: PATH, text: '[]', options: PIN },
  ],
  invalid: [
    {
      name: 'a caret range where only pins are allowed, with a pinning suggestion',
      path: PATH,
      text: '{\n  "dependencies": {\n    "a": "^1.0.0"\n  }\n}\n',
      options: PIN,
      errors: [{ message: MESSAGE, line: 3, column: 10, endLine: 3, endColumn: 18 }],
    },
    {
      name: 'a wildcard, reported without a suggestion',
      path: PATH,
      text: '{ "devDependencies": { "a": "*" } }',
      options: PIN,
      errors: [{ message: MESSAGE, line: 1, column: 29 }],
    },
    {
      name: 'a comparison range and a workspace caret',
      path: PATH,
      text: '{ "optionalDependencies": { "a": ">=1.0.0", "b": "workspace:^" } }',
      options: PIN,
      errors: [
        { message: MESSAGE, line: 1, column: 34 },
        { message: MESSAGE, line: 1, column: 50 },
      ],
    },
    {
      name: 'a pin where only carets are allowed, with the last restriction of a list winning',
      path: PATH,
      text: '{ "dependencies": { "a": "1.0.0" } }',
      options: [{ rangeType: 'pin' }, { rangeType: 'caret' }],
      errors: [{ message: 'This dependency is using the wrong range type.  Acceptable range type(s): caret', line: 1, column: 26 }],
    },
  ],
})
