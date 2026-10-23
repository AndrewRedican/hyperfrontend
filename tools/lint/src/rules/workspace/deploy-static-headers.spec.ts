import { join } from 'node:path'
import { testRule } from '@hyperfrontend/linter/testing'
import rule from './deploy-static-headers.ts'

const fixture = (name: string): string => join(import.meta.dirname, '__fixtures__', name, 'project.json')
const STATIC = '{\n  "name": "demo",\n  "metadata": { "deploy": { "kind": "static" } }\n}\n'

testRule(rule, {
  valid: [
    { name: 'a static deploy whose config declares frame-ancestors', path: fixture('deploy-good'), text: STATIC },
    { name: 'a project that is not deployed', path: fixture('deploy-missing'), text: '{ "name": "demo" }' },
    {
      name: 'a project deployed another way',
      path: fixture('deploy-missing'),
      text: '{ "metadata": { "deploy": { "kind": "railway" } } }',
    },
    {
      name: 'a project whose deploy kind is no string',
      path: fixture('deploy-missing'),
      text: '{ "metadata": { "deploy": { "kind": 1 } } }',
    },
    { name: 'a project whose metadata is no object', path: fixture('deploy-missing'), text: '{ "metadata": 1 }' },
    {
      name: 'a file that is no project file',
      path: join(import.meta.dirname, '__fixtures__', 'deploy-missing', 'other.json'),
      text: STATIC,
    },
    { name: 'a document that is no object', path: fixture('deploy-missing'), text: '[]' },
  ],
  invalid: [
    {
      name: 'a policy without a frame-ancestors directive',
      path: fixture('deploy-nodirective'),
      text: STATIC,
      errors: [
        {
          message:
            "'public/hf-serve.config.json' declares no unbounded Content-Security-Policy with a frame-ancestors directive, so paths outside its prefixed rules are framable by any origin.",
          line: 1,
          column: 1,
        },
      ],
    },
    {
      name: 'a static deploy without the config file',
      path: fixture('deploy-missing'),
      text: STATIC,
      errors: [
        {
          message:
            "Project 'demo' deploys as a static site but ships no public/hf-serve.config.json. Without it every origin on the internet may frame it.",
          line: 1,
          column: 1,
          endLine: 5,
          endColumn: 1,
        },
      ],
    },
    {
      name: 'a static deploy without a name',
      path: fixture('deploy-missing'),
      text: '{ "metadata": { "deploy": { "kind": "static" } } }',
      errors: [
        {
          message:
            "Project '' deploys as a static site but ships no public/hf-serve.config.json. Without it every origin on the internet may frame it.",
          line: 1,
          column: 1,
        },
      ],
    },
    {
      name: 'a config whose frame-ancestors sits behind a prefix',
      path: fixture('deploy-unbounded'),
      text: STATIC,
      errors: [
        {
          message:
            "'public/hf-serve.config.json' declares no unbounded Content-Security-Policy with a frame-ancestors directive, so paths outside its prefixed rules are framable by any origin.",
          line: 1,
          column: 1,
        },
      ],
    },
    {
      name: 'a config that permits every origin',
      path: fixture('deploy-permissive'),
      text: STATIC,
      errors: [
        {
          message: "'public/hf-serve.config.json' declares 'frame-ancestors *', which permits every origin and defeats the policy.",
          line: 1,
          column: 1,
        },
      ],
    },
  ],
})
