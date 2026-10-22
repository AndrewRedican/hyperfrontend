import { join } from 'node:path'
import { testRule } from '../../testing/rule-tester.ts'
import rule from './project-lifecycle-policy.ts'

const fixture = (name: string, file: string): string => join(import.meta.dirname, '__fixtures__', name, file)
const FROZEN = {
  forbiddenTargets: ['lint', 'test', 'e2e'],
  forbiddenScripts: ['lint', 'lint:*', 'test', 'test:*'],
  forbiddenDependencies: ['eslint', '@eslint/*', '@*/eslint-*', 'playwright*', '@types/jsdom'],
  forbiddenFiles: ['**/*.spec.*', 'lint.config.*'],
  forbidNpmPublishing: true,
}
const PLANNED = { forbiddenTargets: ['*'], forbiddenFiles: ['src/**'] }
const OPTIONS = { states: { frozen: FROZEN, planned: PLANNED } }

testRule(rule, {
  valid: [
    {
      name: 'a project without a lifecycle',
      path: fixture('publishable', 'project.json'),
      text: '{ "targets": { "lint": {} } }',
      options: OPTIONS,
    },
    { name: 'a state without a policy', path: fixture('retired', 'project.json'), text: '{ "targets": { "lint": {} } }', options: OPTIONS },
    { name: 'no options', path: fixture('frozen', 'project.json'), text: '{ "targets": { "lint": {} } }' },
    { name: 'a file that is no manifest', path: fixture('frozen', 'other.json'), text: '{ "targets": { "lint": {} } }', options: OPTIONS },
    {
      name: 'a frozen project with allowed targets only, and no file policy',
      path: fixture('frozen', 'project.json'),
      text: '{ "targets": { "serve": {} } }',
      options: { states: { frozen: { forbiddenTargets: ['lint'] } } },
    },
    {
      name: 'a frozen manifest shaped for no publishing',
      path: fixture('frozen', 'package.json'),
      text: '{ "private": true, "scripts": { "dev": "x" }, "dependencies": { "vue": "1.0.0" } }',
      options: OPTIONS,
    },
    {
      name: 'a frozen manifest under a policy that allows publishing',
      path: fixture('frozen', 'package.json'),
      text: '{ "publishConfig": {} }',
      options: { states: { frozen: { forbiddenScripts: ['lint'] } } },
    },
    { name: 'a document that is no object', path: fixture('frozen', 'project.json'), text: '[]', options: OPTIONS },
  ],
  invalid: [
    {
      name: 'a frozen project with forbidden and publishing targets, each with a removal suggestion',
      path: fixture('frozen', 'project.json'),
      text: '{\n  "targets": {\n    "serve": {},\n    "lint": {},\n    "e2e": {},\n    "publish": {},\n    "version-check": {}\n  }\n}\n',
      options: { states: { frozen: { forbiddenTargets: ['lint', 'test', 'e2e'], forbidNpmPublishing: true } } },
      errors: [
        { message: "A 'frozen' project must not declare the 'lint' target.", line: 4, column: 5, endLine: 4, endColumn: 15 },
        { message: "A 'frozen' project must not declare the 'e2e' target.", line: 5, column: 5, endLine: 5, endColumn: 14 },
        {
          message: "A 'frozen' project is never published to npm, so it must not declare the 'publish' target.",
          line: 6,
          column: 5,
          endLine: 6,
          endColumn: 18,
        },
        {
          message: "A 'frozen' project is never published to npm, so it must not declare the 'version-check' target.",
          line: 7,
          column: 5,
          endLine: 7,
          endColumn: 24,
        },
      ],
    },
    {
      name: 'a frozen project with forbidden files, reported over the whole document and skipping node_modules',
      path: fixture('frozen', 'project.json'),
      text: '{}\n',
      options: OPTIONS,
      errors: [
        {
          message: "A 'frozen' project must not contain 'lint.config.ts', which matches the forbidden pattern 'lint.config.*'.",
          line: 1,
          column: 1,
          endLine: 2,
          endColumn: 1,
        },
        {
          message: "A 'frozen' project must not contain 'src/a.spec.ts', which matches the forbidden pattern '**/*.spec.*'.",
          line: 1,
          column: 1,
          endLine: 2,
          endColumn: 1,
        },
      ],
    },
    {
      name: 'a planned project, where every target and every source file is forbidden',
      path: fixture('planned', 'project.json'),
      text: '{ "targets": { "build": {} } }',
      options: OPTIONS,
      errors: [
        {
          message: "A 'planned' project must not contain 'src/index.ts', which matches the forbidden pattern 'src/**'.",
          line: 1,
          column: 1,
        },
        { message: "A 'planned' project must not declare the 'build' target.", line: 1, column: 16 },
      ],
    },
    {
      name: 'a frozen manifest with forbidden scripts and dependencies, no private field and a publish config',
      path: fixture('frozen', 'package.json'),
      text: '{\n  "scripts": {\n    "dev": "x",\n    "lint": "x",\n    "test:unit": "x"\n  },\n  "dependencies": {\n    "eslint": "1.0.0",\n    "@types/jsdom": "1.0.0",\n    "playwright-core": "1.0.0",\n    "vue": "1.0.0"\n  },\n  "devDependencies": {\n    "@eslint/js": "1.0.0",\n    "@vue/eslint-config": "1.0.0"\n  },\n  "publishConfig": { "access": "public" }\n}\n',
      options: OPTIONS,
      errors: [
        {
          message: 'A \'frozen\' project is never published to npm, so its package.json must set "private": true.',
          line: 1,
          column: 1,
          endLine: 19,
          endColumn: 1,
        },
        { message: "A 'frozen' project must not declare the 'lint' script.", line: 4, column: 5, endLine: 4, endColumn: 16 },
        { message: "A 'frozen' project must not declare the 'test:unit' script.", line: 5, column: 5, endLine: 5, endColumn: 21 },
        {
          message:
            "A 'frozen' project must not depend on 'eslint'. Remove it with `npm uninstall eslint` so package-lock.json stays in step.",
          line: 8,
          column: 5,
          endLine: 8,
          endColumn: 22,
        },
        {
          message:
            "A 'frozen' project must not depend on '@types/jsdom'. Remove it with `npm uninstall @types/jsdom` so package-lock.json stays in step.",
          line: 9,
          column: 5,
          endLine: 9,
          endColumn: 28,
        },
        {
          message:
            "A 'frozen' project must not depend on 'playwright-core'. Remove it with `npm uninstall playwright-core` so package-lock.json stays in step.",
          line: 10,
          column: 5,
          endLine: 10,
          endColumn: 31,
        },
        {
          message:
            "A 'frozen' project must not depend on '@eslint/js'. Remove it with `npm uninstall @eslint/js` so package-lock.json stays in step.",
          line: 14,
          column: 5,
          endLine: 14,
          endColumn: 26,
        },
        {
          message:
            "A 'frozen' project must not depend on '@vue/eslint-config'. Remove it with `npm uninstall @vue/eslint-config` so package-lock.json stays in step.",
          line: 15,
          column: 5,
          endLine: 15,
          endColumn: 34,
        },
        {
          message: "A 'frozen' project is never published to npm, so its package.json must not declare publishConfig.",
          line: 17,
          column: 3,
          endLine: 17,
          endColumn: 42,
        },
      ],
    },
    {
      name: 'a frozen manifest whose private field is false, with a suggestion to set it',
      path: fixture('frozen', 'package.json'),
      text: '{\n  "name": "demo",\n  "private": false\n}\n',
      options: OPTIONS,
      errors: [
        {
          message: 'A \'frozen\' project is never published to npm, so its package.json must set "private": true.',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 19,
        },
      ],
    },
    {
      name: 'a frozen manifest whose private field is no boolean',
      path: fixture('frozen', 'package.json'),
      text: '{ "private": "yes" }',
      options: OPTIONS,
      errors: [
        { message: 'A \'frozen\' project is never published to npm, so its package.json must set "private": true.', line: 1, column: 3 },
      ],
    },
    {
      name: 'a sole forbidden script and a sole publish config, whose removal suggestions have no neighbour',
      path: fixture('frozen', 'package.json'),
      text: '{ "private": true, "scripts": { "lint": "x" } }',
      options: OPTIONS,
      errors: [{ message: "A 'frozen' project must not declare the 'lint' script.", line: 1, column: 33 }],
    },
    {
      name: 'a publish config first in the manifest',
      path: fixture('frozen', 'package.json'),
      text: '{ "publishConfig": {}, "private": true }',
      options: OPTIONS,
      errors: [
        {
          message: "A 'frozen' project is never published to npm, so its package.json must not declare publishConfig.",
          line: 1,
          column: 3,
        },
      ],
    },
  ],
})
