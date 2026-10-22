import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { DEFAULT_LANGUAGE } from '../../config/model.ts'
import { lintFile } from '../../engine/lint-file.ts'
import unused from '../typescript/no-unused-vars.ts'
import rule from './jsx-uses-react.ts'

// why: every case enables the rule through a directive of the previous tester and records what no-unused-vars reported; they are proved below with the unused-variable rule instead.

/**
 * The names the unused-variable rule reports when it runs after this rule.
 *
 * @param text - The text linted as a TSX file
 * @param settings - The settings, the React block among them
 * @returns The messages of the unused-variable rule
 */
function unusedWith(text: string, settings: Readonly<Record<string, unknown>> = {}): readonly string[] {
  const result = lintFile(
    { path: '/root/file.tsx', root: '/root', relativePath: 'file.tsx', text },
    {
      config: {
        rules: createMap([
          [rule.id, { severity: 2 as const, options: undefined }],
          [unused.id, { severity: 2 as const, options: undefined }],
        ]),
        settings,
        // why: the analysis itself references the language's pragma for JSX; without one, only this rule marks it.
        language: { ...DEFAULT_LANGUAGE, jsxPragma: null },
      },
      rules: createMap([
        [rule.id, rule],
        [unused.id, unused],
      ]),
      fix: false,
    }
  )
  return result.messages.map((message) => message.message)
}

describe('react/jsx-uses-react marks the pragma used', () => {
  const cases: readonly (readonly [string, string, Readonly<Record<string, unknown>>, readonly string[]])[] = [
    ['for an element', 'var React; <div />;', {}, []],
    ['from a nested function', 'var React; (function () { <div /> })();', {}, []],
    ['named by an annotation', '/** @jsx Foo */ var Foo; <div />;', {}, []],
    ['named by an annotation member', '/** @jsx h.dom */ var h; <div />;', {}, []],
    ['named by the setting', 'var Foo; <div />;', { react: { pragma: 'Foo' } }, []],
    ['and the fragment for a fragment', 'var React, Fragment; <></>;', {}, []],
    ['and the configured fragment', 'var Frag; <></>;', { react: { fragment: 'Frag' } }, []],
    ['and nothing without JSX', 'var React;', {}, ["'React' is defined but never used."]],
    ['and not React under an annotation', '/** @jsx Foo */ var React; <div />;', {}, ["'React' is defined but never used."]],
    ['and not another fragment', 'var Frag; <></>;', {}, ["'Frag' is defined but never used."]],
    ['and nothing out of reach', 'function make() { var React; return 1; } make(); <div />;', {}, ["'React' is defined but never used."]],
  ]
  for (const [name, text, settings, expected] of cases) {
    it(name, () => {
      expect(unusedWith(text, settings)).toEqual(expected)
    })
  }
})
