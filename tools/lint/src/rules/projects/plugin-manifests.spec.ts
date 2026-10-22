import { testRule } from '../../testing/rule-tester.ts'
import rule from './plugin-manifests.ts'

// why: the workspace enables the rule on manifests alone, so the cases recorded on generators, executors and migrations files are left out; the manifest cases name temporary paths the rule never reads.
testRule(rule, {
  valid: [
    {
      name: '#10 accepts packageGroup versions that are valid semver or allowed tags, in array and object forms',
      path: '/root/tmp/eslint-test-oqac2u/libs/plugin/package.json',
      text: '{\n  "name": "@scope/plugin",\n  "nx-migrations": {\n    "migrations": "./migrations.json",\n    "packageGroup": [\n      {\n        "package": "a",\n        "version": "1.0.0"\n      },\n      {\n        "package": "b",\n        "version": "latest"\n      },\n      "c"\n    ]\n  }\n}',
    },
    {
      name: '#12 accepts a package.json without migrations',
      path: '/root/tmp/eslint-test-oqac2u/libs/plugin/package.json',
      text: '{\n  "name": "@scope/plugin",\n  "migrations": "not an object"\n}',
    },
  ],
  invalid: [
    {
      name: '#38 reports packageGroup members without versions or with invalid ones',
      path: '/root/tmp/eslint-test-oqac2u/libs/plugin/package.json',
      text: '{\n  "nx-migrations": {\n    "packageGroup": [\n      {\n        "package": "a"\n      },\n      {\n        "package": "b",\n        "version": "^1.0.0"\n      },\n      {\n        "version": 2\n      }\n    ]\n  }\n}',
      errors: [
        { message: 'a: Missing required property - `version`', line: 4, column: 7, endLine: 6, endColumn: 8 },
        { message: 'b: Version should be a valid semver', line: 9, column: 20, endLine: 9, endColumn: 28 },
        { message: 'unknown: Version should be a valid semver', line: 12, column: 20, endLine: 12, endColumn: 21 },
      ],
    },
    {
      name: '#39 reports packageGroup object versions the options do not allow',
      path: '/root/tmp/eslint-test-oqac2u/libs/plugin/package.json',
      text: '{\n  "migrations": {\n    "packageGroup": {\n      "a": "latest",\n      "b": "canary"\n    }\n  }\n}',
      options: { allowedVersionStrings: ['canary'] },
      errors: [{ message: 'a: Version should be a valid semver', line: 4, column: 12, endLine: 4, endColumn: 20 }],
    },
    {
      name: '#42 workspace: a tool package.json with a packageGroup version that is not semver',
      path: '/root/tmp/eslint-test-uamfmf/tools/package/package.json',
      text: '{\n  "name": "@hyperfrontend/package",\n  "nx-migrations": {\n    "packageGroup": {\n      "@hyperfrontend/app": "1.0"\n    }\n  }\n}',
      errors: [{ message: '@hyperfrontend/app: Version should be a valid semver', line: 5, column: 29, endLine: 5, endColumn: 34 }],
    },
  ],
})

// why: the cases recorded from the previous linter leave a manifest that is not an object and a file that is not a manifest unexercised.
testRule(rule, {
  valid: [
    { name: 'a manifest that is not an object', path: '/root/package.json', text: '[]' },
    { name: 'a file that is not a manifest', path: '/root/migrations.json', text: '{"nx-migrations":{"packageGroup":{"a":"x"}}}' },
    { name: 'migrations without a package group', path: '/root/package.json', text: '{"nx-migrations":{}}' },
    { name: 'a package group of another shape', path: '/root/package.json', text: '{"nx-migrations":{"packageGroup":"a"}}' },
  ],
  invalid: [],
})
