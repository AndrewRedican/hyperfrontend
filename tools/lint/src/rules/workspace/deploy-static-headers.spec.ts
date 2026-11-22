import type { ExpectedError } from '@hyperfrontend/linter/testing'
import { existsSync } from 'node:fs'
import { testRule } from '@hyperfrontend/linter/testing'
import { describe, expect, it } from '@hyperfrontend/testing'
import { createProjectTrees } from './__test-utils__/project-trees.ts'
import rule from './deploy-static-headers.ts'

const projects = createProjectTrees()
const fixture = (name: string): string => projects.file(name, 'project.json')
const STATIC = '{\n  "name": "demo",\n  "metadata": { "deploy": { "kind": "static" } }\n}\n'

const MISSING =
  '\'public/hf-serve.config.json\' declares neither "embedders" nor an unbounded Content-Security-Policy with a frame-ancestors directive, so paths outside its bounded rules are framable by any origin.'

/**
 * A report on the whole document.
 *
 * @param message - What the rule reports
 * @returns The expected error
 */
const whole = (message: string): ExpectedError => ({ message, line: 1, column: 1 })

/**
 * The report for a config the server will not load.
 *
 * @param problem - What the server says about it
 * @returns The expected error
 */
const refused = (problem: string): ExpectedError => whole(`'public/hf-serve.config.json' is a config hf serve refuses to load: ${problem}`)

/**
 * The report for a bounded rule whose policy has no directive.
 *
 * @param index - Where the rule sits among the authored rules
 * @returns The expected error
 */
const dropped = (index: number): ExpectedError =>
  whole(
    `'public/hf-serve.config.json' sets a Content-Security-Policy without a frame-ancestors directive in headers[${index}], which replaces the unbounded policy on the paths that rule matches and leaves them framable by any origin.`
  )

/**
 * The report for a rule whose directive lets any origin through.
 *
 * @param index - Where the rule sits among the authored rules
 * @returns The expected error
 */
const permissive = (index: number): ExpectedError =>
  whole(
    `'public/hf-serve.config.json' declares a frame-ancestors source that permits every origin in headers[${index}], which defeats the policy.`
  )

/**
 * The report for policy fields the installed server ignores.
 *
 * @param fields - What the config declares, as the report words it
 * @param installed - The release the project's lock resolves
 * @returns The expected error
 */
const unread = (fields: string, installed: string): ExpectedError =>
  whole(
    `'public/hf-serve.config.json' declares ${fields}, which @hyperfrontend/features ${installed} does not read: the policy would silently not be sent. The project's lock must install 0.13.0 or later.`
  )

testRule(rule, {
  valid: [
    { name: 'a static deploy whose config declares frame-ancestors', path: fixture('deploy-good'), text: STATIC },
    { name: 'a static deploy whose config declares embedders', path: fixture('deploy-embedders'), text: STATIC },
    { name: 'embedders narrowed under a prefix', path: fixture('deploy-embedders-narrowed'), text: STATIC },
    {
      name: 'an earlier unbounded policy without the directive that a later unbounded one replaces',
      path: fixture('deploy-replaced'),
      text: STATIC,
    },
    {
      name: 'an earlier bounded policy without the directive that a later unbounded one replaces',
      path: fixture('deploy-earlier-bounded'),
      text: STATIC,
    },
    { name: 'a directive name written in uppercase', path: fixture('deploy-uppercase'), text: STATIC },
    { name: 'a policy whose rule carries bounds that exclude no path', path: fixture('deploy-open-bound'), text: STATIC },
    { name: 'a policy list whose second policy restricts', path: fixture('deploy-policy-list'), text: STATIC },
    { name: 'a header spelled twice whose later spelling restricts', path: fixture('deploy-respelled'), text: STATIC },
    { name: 'a bounded report-only policy without the directive', path: fixture('deploy-report-only'), text: STATIC },
    {
      name: 'embedders with a lock at the first release that reads them',
      path: fixture('deploy-embedders-current'),
      text: STATIC,
    },
    { name: 'embedders with no lock to compare', path: fixture('deploy-embedders-lockless'), text: STATIC },
    { name: 'embedders with a lock whose version is no release', path: fixture('deploy-embedders-unversioned'), text: STATIC },
    { name: 'a config without the policy fields under an older lock', path: fixture('deploy-old'), text: STATIC },
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
      path: projects.file('deploy-missing', 'other.json'),
      text: STATIC,
    },
    { name: 'a document that is no object', path: fixture('deploy-missing'), text: '[]' },
  ],
  invalid: [
    {
      name: 'a policy without a frame-ancestors directive',
      path: fixture('deploy-nodirective'),
      text: STATIC,
      errors: [whole(MISSING)],
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
        whole(
          "Project '' deploys as a static site but ships no public/hf-serve.config.json. Without it every origin on the internet may frame it."
        ),
      ],
    },
    {
      name: 'a static deploy whose config file is no JSON',
      path: fixture('deploy-unparsable'),
      text: STATIC,
      errors: [
        whole(
          "Project 'demo' deploys as a static site but ships no public/hf-serve.config.json. Without it every origin on the internet may frame it."
        ),
      ],
    },
    {
      name: 'a config whose frame-ancestors sits behind a prefix',
      path: fixture('deploy-unbounded'),
      text: STATIC,
      errors: [whole(MISSING)],
    },
    {
      name: 'a later unbounded policy that drops frame-ancestors',
      path: fixture('deploy-dropped-later'),
      text: STATIC,
      errors: [whole(MISSING)],
    },
    {
      name: 'a later policy that drops frame-ancestors under a bound that excludes no path',
      path: fixture('deploy-open-bound-dropped'),
      text: STATIC,
      errors: [whole(MISSING)],
    },
    {
      name: 'a policy whose directive a browser discards for a no-break space',
      path: fixture('deploy-discarded-authored'),
      text: STATIC,
      errors: [whole(MISSING)],
    },
    {
      name: 'a bounded policy whose directive a browser discards for a host outside ASCII',
      path: fixture('deploy-discarded-bounded'),
      text: STATIC,
      errors: [dropped(1)],
    },
    {
      name: 'a rule restating the embedders in a directive a browser discards',
      path: fixture('deploy-discarded-embedders'),
      text: STATIC,
      errors: [
        refused(
          'headers[0].headers["Content-Security-Policy"] replaces the policy "embedders" declares and has no frame-ancestors directive, so the paths it matches could be framed by any origin: add the directive to that value or remove "embedders".'
        ),
      ],
    },
    {
      name: 'a rule that lists other sources than the embedders under a bound that excludes no path',
      path: fixture('deploy-open-bound-contradicted'),
      text: STATIC,
      errors: [
        refused(
          'headers[0].headers["Content-Security-Policy"] applies to every path, because its prefix and suffix exclude none, with a frame-ancestors list other than the one "embedders" declares: make the two equal, give the rule a prefix longer than "/" or a suffix that is not empty, or remove "embedders".'
        ),
      ],
    },
    {
      name: 'a bounded policy that drops frame-ancestors',
      path: fixture('deploy-dropped-bounded'),
      text: STATIC,
      errors: [dropped(1)],
    },
    {
      name: 'a bounded policy that drops frame-ancestors behind fields that expand into rules',
      path: fixture('deploy-dropped-expanded'),
      text: STATIC,
      errors: [dropped(2)],
    },
    {
      name: 'every rule from an unbounded policy without the directive onwards',
      path: fixture('deploy-unrestricted-onwards'),
      text: STATIC,
      errors: [whole(MISSING), permissive(1), dropped(2)],
    },
    {
      name: 'a config that permits every origin',
      path: fixture('deploy-permissive'),
      text: STATIC,
      errors: [permissive(0)],
    },
    { name: 'a scheme-only source', path: fixture('deploy-scheme-only'), text: STATIC, errors: [permissive(0)] },
    { name: 'a wildcard host source', path: fixture('deploy-wildcard-host'), text: STATIC, errors: [permissive(0)] },
    {
      name: 'a bounded rule that permits every origin',
      path: fixture('deploy-permissive-bounded'),
      text: STATIC,
      errors: [permissive(1)],
    },
    {
      name: 'an embedders field the server refuses',
      path: fixture('deploy-embedders-refused'),
      text: STATIC,
      errors: [
        refused('embedders[0] permits every origin: name each host instead of a bare "*", a scheme on its own or a "*" host.'),
        refused('embedders[1] must start with a scheme and "://", as in https://host.example.'),
      ],
    },
    {
      name: 'an unknown top-level field',
      path: fixture('deploy-unknown-field'),
      text: STATIC,
      errors: [refused('"embedder" is not a serve config field.')],
    },
    {
      name: 'a config that is no object',
      path: fixture('deploy-not-object'),
      text: STATIC,
      errors: [refused('serve config must be an object.')],
    },
    {
      name: 'embedders with a lock older than the first release that reads them',
      path: fixture('deploy-embedders-old'),
      text: STATIC,
      errors: [unread('"embedders"', '0.12.2')],
    },
    {
      name: 'embedders with a lock at a prerelease of the first release that reads them',
      path: fixture('deploy-embedders-prerelease'),
      text: STATIC,
      errors: [unread('"embedders"', '0.13.0-rc.1')],
    },
    {
      name: 'a permissions policy with such a lock',
      path: fixture('deploy-permissions-old'),
      text: STATIC,
      errors: [unread('"permissionsPolicy"', '0.12.2')],
    },
    {
      name: 'both policy fields with such a lock',
      path: fixture('deploy-both-old'),
      text: STATIC,
      errors: [unread('"embedders" and "permissionsPolicy"', '0.12.2')],
    },
  ],
})

describe('the disposable workspace', () => {
  it('is removed once the cases have run', () => {
    projects.remove()
    expect(existsSync(projects.root)).toBe(false)
  })
})
