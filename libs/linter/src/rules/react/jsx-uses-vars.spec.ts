import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { DEFAULT_LANGUAGE } from '../../config/model'
import { lintFile } from '../../engine/lint-file'
import { testRule } from '../../testing/rule-tester'
import unused from '../typescript/no-unused-vars'
import rule from './jsx-uses-vars'

// why: the other cases enable the rule through a directive of the previous tester and record what no-unused-vars, prefer-const or a tester-only rule reported; they are proved below with the unused-variable rule instead.
testRule(rule, { valid: [{ name: '#22 var App; <App />;', path: '/root/react.tsx', text: 'var App; <App />;' }], invalid: [] })

/**
 * The names the unused-variable rule reports when it runs after this rule.
 *
 * @param text - The text linted as a TSX file
 * @returns The messages of the unused-variable rule
 */
function unusedWith(text: string): readonly string[] {
  const result = lintFile(
    { path: '/root/file.tsx', root: '/root', relativePath: 'file.tsx', text },
    {
      config: {
        rules: createMap([
          [rule.id, { severity: 2 as const, options: undefined }],
          [unused.id, { severity: 2 as const, options: undefined }],
        ]),
        settings: {},
        language: DEFAULT_LANGUAGE,
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

describe('react/jsx-uses-vars marks variables used', () => {
  const cases: readonly (readonly [string, string, readonly string[]])[] = [
    ['an element name', 'var App; <App />;', []],
    ['an element name in a function', 'function f() { var App; return <App />; } f();', []],
    ['a member root', 'var App; <App.Hello.World />;', []],
    ['a class', 'class HelloMessage {}; <HelloMessage />', []],
    ['an import', "import { Card } from './card'; export const Page = () => <Card />;", []],
    ['nothing for an unrelated name', 'var App; var unused; <App unused="" />;', ["'unused' is defined but never used."]],
    ['nothing for a lower-case name', 'var lowercase; <lowercase />;', ["'lowercase' is defined but never used."]],
    ['nothing for an undeclared name', '<Missing />;', []],
    ['nothing for a namespaced name', '<svg:circle />;', []],
  ]
  for (const [name, text, expected] of cases) {
    it(name, () => {
      expect(unusedWith(text)).toEqual(expected)
    })
  }
})
