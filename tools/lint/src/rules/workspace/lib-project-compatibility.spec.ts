import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProjectTrees } from './__test-utils__/project-trees.ts'
import rule from './lib-project-compatibility.ts'

const projects = createProjectTrees()
const PUBLISHABLE = projects.file('publishable', 'project.json')
const file = (compatibility: string, build = '"build": {}'): string =>
  `{\n  "name": "lib-x",\n  "metadata": { "compatibility": ${compatibility} },\n  "targets": { ${build}, "publish": {} }\n}\n`
const ALL_FULL =
  '{ "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } }'
const MISSING_OPERATING_SYSTEMS =
  'metadata.compatibility declares no operatingSystems object. Add: "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" }, using full, partial or none for each.'
const MISSING_ENVIRONMENTS =
  'metadata.compatibility declares no environments object. Add: "environments": { "node": "full", "browser": "full", "webWorker": "full" }, using full, partial or none for each runtime.'

testRule(rule, {
  valid: [
    {
      name: 'no support declared where the pipeline does not run the project',
      path: PUBLISHABLE,
      text: '{\n  "name": "demo-x",\n  "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "none", "windows": "none" } } },\n  "targets": { "build": {}, "publish": {} }\n}\n',
    },
    { name: 'the three runtimes at valid levels', path: PUBLISHABLE, text: file(ALL_FULL) },
    {
      name: 'a note in prose',
      path: PUBLISHABLE,
      text: file(
        '{ "environments": { "node": "full", "browser": "partial", "webWorker": "none" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" }, "note": "Workers need a polyfill." }'
      ),
    },
    { name: 'a browser bundle with browser support', path: PUBLISHABLE, text: file(ALL_FULL, '"build": { "options": { "iife": {} } }') },
    {
      name: 'a build without options',
      path: PUBLISHABLE,
      text: file(
        '{ "environments": { "node": "full", "browser": "none", "webWorker": "none" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } }',
        '"build": { "options": 1 }'
      ),
    },
    {
      name: 'targets that are no object',
      path: PUBLISHABLE,
      text: file(
        '{ "environments": { "node": "full", "browser": "none", "webWorker": "none" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } }',
        '"build": {}'
      ).replace('"targets": {', '"targets": 1, "x": {'),
    },
  ],
  invalid: [
    {
      name: 'operating systems that are no object, on the operatingSystems property',
      path: PUBLISHABLE,
      text: '{\n  "name": "lib-x",\n  "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": [] } },\n  "targets": { "build": {}, "publish": {} }\n}\n',
      errors: [{ message: MISSING_OPERATING_SYSTEMS, line: 3, column: 112, endLine: 3, endColumn: 134 }],
    },
    {
      name: 'an operating system at no level, one this repository does not declare, and one left out',
      path: PUBLISHABLE,
      text: '{\n  "name": "lib-x",\n  "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "yes", "bsd": "full", "windows": "full" } } },\n  "targets": { "build": {}, "publish": {} }\n}\n',
      errors: [
        { message: 'metadata.compatibility.operatingSystems is missing macos. Declare it as full, partial or none.', line: 3, column: 132 },
        {
          message:
            'metadata.compatibility.operatingSystems.linux must be full, partial or none. Replace the current value with one of those three levels.',
          line: 3,
          column: 134,
        },
        {
          message: 'bsd is not an operating system this repository declares. Remove it, or rename it to one of linux, macos, windows.',
          line: 3,
          column: 150,
        },
      ],
    },
    {
      name: 'support claimed beyond the pipeline, for a project the pipeline runs on Linux alone',
      path: PUBLISHABLE,
      text: '{\n  "name": "demo-x",\n  "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "partial" } } },\n  "targets": { "build": {}, "publish": {} }\n}\n',
      errors: [
        {
          message:
            'macos is declared full, but the pipeline runs this project on Linux only, so nothing checks the claim. Declare none, or have the pipeline run the project there.',
          line: 3,
          column: 151,
        },
        {
          message:
            'windows is declared partial, but the pipeline runs this project on Linux only, so nothing checks the claim. Declare none, or have the pipeline run the project there.',
          line: 3,
          column: 168,
        },
      ],
    },
    {
      name: 'support claimed beyond the pipeline, for a project without a name',
      path: PUBLISHABLE,
      text: '{\n  "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "partial" } } },\n  "targets": { "build": {}, "publish": {} }\n}\n',
      errors: [
        {
          message:
            'macos is declared full, but the pipeline runs this project on Linux only, so nothing checks the claim. Declare none, or have the pipeline run the project there.',
          line: 2,
          column: 151,
        },
        {
          message:
            'windows is declared partial, but the pipeline runs this project on Linux only, so nothing checks the claim. Declare none, or have the pipeline run the project there.',
          line: 2,
          column: 168,
        },
      ],
    },
    {
      name: 'support claimed beyond the pipeline, for a project whose name is no string',
      path: PUBLISHABLE,
      text: '{\n  "name": 1,\n  "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "partial" } } },\n  "targets": { "build": {}, "publish": {} }\n}\n',
      errors: [
        {
          message:
            'macos is declared full, but the pipeline runs this project on Linux only, so nothing checks the claim. Declare none, or have the pipeline run the project there.',
          line: 3,
          column: 151,
        },
        {
          message:
            'windows is declared partial, but the pipeline runs this project on Linux only, so nothing checks the claim. Declare none, or have the pipeline run the project there.',
          line: 3,
          column: 168,
        },
      ],
    },
    {
      name: 'no compatibility, on the metadata property',
      path: PUBLISHABLE,
      text: '{\n  "name": "lib-x",\n  "metadata": {},\n  "targets": {}\n}\n',
      errors: [
        {
          message:
            'Publishable library project.json is missing metadata.compatibility. Add: "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } } }',
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
            'Publishable library project.json is missing metadata.compatibility. Add: "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } } }',
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
            'Publishable library project.json is missing metadata.compatibility. Add: "metadata": { "compatibility": { "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } } }',
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
      errors: [
        { message: MISSING_ENVIRONMENTS, line: 3, column: 17, endLine: 3, endColumn: 36 },
        { message: MISSING_OPERATING_SYSTEMS, line: 3, column: 17, endLine: 3, endColumn: 36 },
      ],
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
      errors: [
        { message: MISSING_OPERATING_SYSTEMS, line: 3, column: 17, endLine: 3, endColumn: 56 },
        { message: MISSING_ENVIRONMENTS, line: 3, column: 36, endLine: 3, endColumn: 54 },
      ],
    },
    {
      name: 'a runtime left out',
      path: PUBLISHABLE,
      text: file(
        '{ "environments": { "node": "full", "browser": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } }'
      ),
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
      text: file(
        '{ "environments": { "node": "maybe", "browser": "full", "webWorker": "full", "deno": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } }'
      ),
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
      text: file(
        '{ "environments": { "node": 1, "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } }'
      ),
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
      text: file(
        '{ "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" }, "note": "", "foo": 1 }'
      ),
      errors: [
        {
          message: 'metadata.compatibility.note must be a non-empty string. Write the caveat as prose, or remove the field.',
          line: 3,
          column: 189,
          endLine: 3,
          endColumn: 199,
        },
        {
          message: 'foo is not a field of metadata.compatibility. Remove it; only environments, operatingSystems and note are read.',
          line: 3,
          column: 201,
          endLine: 3,
          endColumn: 209,
        },
      ],
    },
    {
      name: 'a note that is no string',
      path: PUBLISHABLE,
      text: file(
        '{ "environments": { "node": "full", "browser": "full", "webWorker": "full" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" }, "note": 1 }'
      ),
      errors: [
        {
          message: 'metadata.compatibility.note must be a non-empty string. Write the caveat as prose, or remove the field.',
          line: 3,
          column: 189,
        },
      ],
    },
    {
      name: 'worker support without browser support, on the webWorker property',
      path: PUBLISHABLE,
      text: file(
        '{ "environments": { "node": "full", "browser": "none", "webWorker": "partial" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } }'
      ),
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
      text: file(
        '{ "environments": { "node": "none", "browser": "none", "webWorker": "none" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } }'
      ),
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
        '{ "environments": { "node": "full", "browser": "none", "webWorker": "none" }, "operatingSystems": { "linux": "full", "macos": "full", "windows": "full" } }',
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

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    projects.remove()
    expect(existsSync(projects.root)).toBe(false)
  })
})
