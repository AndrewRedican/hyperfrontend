import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import rule from './lib-project-compatibility.ts'

const PUBLISHABLE = join(import.meta.dirname, '__fixtures__', 'publishable', 'project.json')
const file = (compatibility: string, build = '"build": {}'): string =>
  `{\n  "name": "lib-x",\n  "metadata": { "compatibility": ${compatibility} },\n  "targets": { ${build}, "publish": {} }\n}\n`
const ALL_FULL = '{ "environments": { "node": "full", "browser": "full", "webWorker": "full" } }'
const MISSING_ENVIRONMENTS =
  'metadata.compatibility declares no environments object. Add: "environments": { "node": "full", "browser": "full", "webWorker": "full" }, using full, partial or none for each runtime.'

testRule(rule, {
  valid: [
    { name: 'the three runtimes at valid levels', path: PUBLISHABLE, text: file(ALL_FULL) },
    {
      name: 'a note in prose',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": "full", "browser": "partial", "webWorker": "none" }, "note": "Workers need a polyfill." }'),
    },
    { name: 'a browser bundle with browser support', path: PUBLISHABLE, text: file(ALL_FULL, '"build": { "options": { "iife": {} } }') },
    {
      name: 'a build without options',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": "full", "browser": "none", "webWorker": "none" } }', '"build": { "options": 1 }'),
    },
    {
      name: 'targets that are no object',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": "full", "browser": "none", "webWorker": "none" } }', '"build": {}').replace(
        '"targets": {',
        '"targets": 1, "x": {'
      ),
    },
  ],
  invalid: [
    {
      name: 'no compatibility, on the metadata property',
      path: PUBLISHABLE,
      text: '{\n  "name": "lib-x",\n  "metadata": {},\n  "targets": {}\n}\n',
      errors: [
        {
          message:
            'Publishable library project.json is missing metadata.compatibility. Add: "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" } } }',
          line: 3,
          column: 3,
          endLine: 3,
          endColumn: 17,
        },
      ],
    },
    {
      name: 'no metadata at all, on the whole document',
      path: PUBLISHABLE,
      text: '{ "name": "lib-x" }',
      errors: [
        {
          message:
            'Publishable library project.json is missing metadata.compatibility. Add: "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" } } }',
          line: 1,
          column: 1,
          endLine: 1,
          endColumn: 20,
        },
      ],
    },
    {
      name: 'metadata that is no object',
      path: PUBLISHABLE,
      text: '{ "name": "lib-x", "metadata": 1 }',
      errors: [
        {
          message:
            'Publishable library project.json is missing metadata.compatibility. Add: "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" } } }',
          line: 1,
          column: 20,
          endLine: 1,
          endColumn: 33,
        },
      ],
    },
    {
      name: 'compatibility without environments, on the compatibility property',
      path: PUBLISHABLE,
      text: file('{}'),
      errors: [{ message: MISSING_ENVIRONMENTS, line: 3, column: 17, endLine: 3, endColumn: 36 }],
    },
    {
      name: 'compatibility that is no object',
      path: PUBLISHABLE,
      text: file('1'),
      errors: [{ message: MISSING_ENVIRONMENTS, line: 3, column: 17 }],
    },
    {
      name: 'environments that are no object, on the environments property',
      path: PUBLISHABLE,
      text: file('{ "environments": [] }'),
      errors: [{ message: MISSING_ENVIRONMENTS, line: 3, column: 36, endLine: 3, endColumn: 54 }],
    },
    {
      name: 'a runtime left out',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": "full", "browser": "full" } }'),
      errors: [
        {
          message:
            'metadata.compatibility.environments is missing webWorker. Declare it as full, partial or none; a runtime left out reads as unsupported wherever the compatibility row is drawn.',
          line: 3,
          column: 52,
          endLine: 3,
          endColumn: 89,
        },
      ],
    },
    {
      name: 'an unknown runtime and an invalid level',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": "maybe", "browser": "full", "webWorker": "full", "deno": "full" } }'),
      errors: [
        {
          message:
            'metadata.compatibility.environments.node must be full, partial or none. Replace the current value with one of those three levels.',
          line: 3,
          column: 54,
          endLine: 3,
          endColumn: 69,
        },
        {
          message: 'deno is not a runtime this repository declares. Remove it, or rename it to one of node, browser, webWorker.',
          line: 3,
          column: 111,
          endLine: 3,
          endColumn: 125,
        },
      ],
    },
    {
      name: 'a level that is no string',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": 1, "browser": "full", "webWorker": "full" } }'),
      errors: [
        {
          message:
            'metadata.compatibility.environments.node must be full, partial or none. Replace the current value with one of those three levels.',
          line: 3,
          column: 54,
        },
      ],
    },
    {
      name: 'an empty note and an unknown key',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "note": "", "foo": 1 }'),
      errors: [
        {
          message: 'metadata.compatibility.note must be a non-empty string. Write the caveat as prose, or remove the field.',
          line: 3,
          column: 112,
          endLine: 3,
          endColumn: 122,
        },
        {
          message: 'foo is not a field of metadata.compatibility. Remove it; only environments and note are read.',
          line: 3,
          column: 124,
          endLine: 3,
          endColumn: 132,
        },
      ],
    },
    {
      name: 'a note that is no string',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "note": 1 }'),
      errors: [
        {
          message: 'metadata.compatibility.note must be a non-empty string. Write the caveat as prose, or remove the field.',
          line: 3,
          column: 112,
        },
      ],
    },
    {
      name: 'worker support without browser support, on the webWorker property',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": "full", "browser": "none", "webWorker": "partial" } }'),
      errors: [
        {
          message:
            'webWorker is declared partial while browser is none. A Web Worker is a browser runtime, so raise browser to the level the package really reaches, or drop webWorker to none.',
          line: 3,
          column: 89,
          endLine: 3,
          endColumn: 111,
        },
      ],
    },
    {
      name: 'a package that runs nowhere, on the environments property',
      path: PUBLISHABLE,
      text: file('{ "environments": { "node": "none", "browser": "none", "webWorker": "none" } }'),
      errors: [
        {
          message:
            'node, browser and webWorker are all declared none, so this package runs in no runtime at all. Set the runtimes it does reach to full or partial.',
          line: 3,
          column: 52,
          endLine: 3,
          endColumn: 110,
        },
      ],
    },
    {
      name: 'a browser bundle without browser support, on the browser property',
      path: PUBLISHABLE,
      text: file(
        '{ "environments": { "node": "full", "browser": "none", "webWorker": "none" } }',
        '"build": { "options": { "iife": { "entry": "." }, "umd": { "entry": "." } } }'
      ),
      errors: [
        {
          message:
            'targets.build.options declares a browser bundle (iife and umd), which only a browser or a CDN consumer loads, while browser is none. Set browser to full or partial, or drop the bundle from the build target.',
          line: 3,
          column: 70,
          endLine: 3,
          endColumn: 87,
        },
      ],
    },
  ],
})
