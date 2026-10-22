import type { RuleModule } from '../engine/rule.ts'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { describe, expect, it } from '@hyperfrontend/testing'
import { lintFile } from '../engine/lint-file.ts'
import noDebugger from '../rules/javascript/no-debugger.ts'
import noVar from '../rules/javascript/no-var.ts'
import { DEFAULT_LANGUAGE } from './model.ts'

/** The rules every case runs, both as errors. */
const RULES = createMap<string, RuleModule>([
  ['no-debugger', noDebugger as RuleModule],
  ['no-var', noVar as RuleModule],
])

/**
 * Lints a TypeScript text with `no-debugger` and `no-var` on.
 *
 * @param text - The source linted as `src/x.ts`
 * @param fix - Whether to apply fixes
 * @returns Each message as `line:column severity rule message`, and the fixed text
 */
function lint(text: string, fix = false): { messages: string[]; output: string | null } {
  const outcome = lintFile(
    { path: '/root/src/x.ts', root: '/root', relativePath: 'src/x.ts', text },
    {
      config: {
        rules: createMap([...RULES.keys()].map((id) => [id, { severity: 2, options: undefined }] as const)),
        settings: {},
        language: DEFAULT_LANGUAGE,
      },
      rules: RULES,
      fix,
    }
  )
  return {
    messages: outcome.messages.map(
      (message) => `${message.line}:${message.column} ${message.severity} ${message.ruleId} ${message.message}`
    ),
    output: outcome.output,
  }
}

const DEBUGGER = "Unexpected 'debugger' statement."

describe('directives', () => {
  it('ignores a disable region written as a line comment', () => {
    expect(lint('// lint-disable\ndebugger\nexport {}\n').messages).toEqual([`2:1 2 no-debugger ${DEBUGGER}`])
  })

  it('reports a disable whose rules all suppressed nothing, naming both', () => {
    expect(lint('/* lint-disable no-debugger, no-var */\nexport {}\n').messages).toEqual([
      "1:1 1 null Unused lint-disable directive (no problems were reported from 'no-debugger' or 'no-var').",
    ])
  })

  it('removes a wholly unused directive, leaving a space', () => {
    expect(lint('/* lint-disable no-debugger, no-var */\nexport {}\n', true).output).toBe(' \nexport {}\n')
  })

  it('reports only the rule of a list that suppressed nothing', () => {
    expect(lint('/* lint-disable no-debugger, no-var */\ndebugger\nexport {}\n').messages).toEqual([
      "1:1 1 null Unused lint-disable directive (no problems were reported from 'no-var').",
    ])
  })

  it('removes an unused last name with the comma before it', () => {
    expect(lint('/* lint-disable no-debugger, no-var */\ndebugger\nexport {}\n', true).output).toBe(
      '/* lint-disable no-debugger */\ndebugger\nexport {}\n'
    )
  })

  it('removes unused first and last names with the comma that joins each', () => {
    expect(lint('/* lint-disable no-var,no-debugger,no-empty */\ndebugger\nexport {}\n', true).output).toBe(
      '/* lint-disable no-debugger */\ndebugger\nexport {}\n'
    )
  })

  it('lists three unused rules with a final or', () => {
    expect(lint('/* lint-disable no-var, no-debugger, no-empty */\nexport {}\n').messages).toEqual([
      "1:1 1 null Unused lint-disable directive (no problems were reported from 'no-var', 'no-debugger', or 'no-empty').",
    ])
  })

  it('reports an unused disable of every rule', () => {
    expect(lint('/* lint-disable */\nexport {}\n').messages).toEqual([
      '1:1 1 null Unused lint-disable directive (no problems were reported).',
    ])
  })

  it('cuts the justification off a line directive', () => {
    expect(lint('// lint-disable-next-line no-debugger -- because\ndebugger\nexport {}\n').messages).toEqual([])
  })

  it('suppresses with a justification and no rule list', () => {
    expect(lint('// lint-disable-next-line -- reason\ndebugger\nexport {}\n').messages).toEqual([])
  })

  it('reports an enable that ends no disable, naming its rule', () => {
    expect(lint('/* lint-enable no-var */\nexport {}\n').messages).toEqual([
      "1:1 1 null Unused lint-enable directive (no matching lint-disable directives were found for 'no-var').",
    ])
  })

  it('reports an enable of every rule that ends no disable', () => {
    expect(lint('/* lint-enable */\nexport {}\n').messages).toEqual([
      '1:1 1 null Unused lint-enable directive (no matching lint-disable directives were found).',
    ])
  })

  it('lists three rules of an unused enable', () => {
    expect(lint('/* lint-enable no-var, no-debugger, no-empty */\nexport {}\n').messages).toEqual([
      "1:1 1 null Unused lint-enable directive (no matching lint-disable directives were found for 'no-var', 'no-debugger', or 'no-empty').",
    ])
  })

  it('starts a region where its comment starts, not at its line', () => {
    expect(lint('debugger; /* lint-disable */\nexport {}\n').messages).toEqual([
      `1:1 2 no-debugger ${DEBUGGER}`,
      '1:11 1 null Unused lint-disable directive (no problems were reported).',
    ])
  })

  it('counts the next line from where a block directive ends', () => {
    expect(lint('/* lint-disable-next-line\n no-debugger */\ndebugger\nexport {}\n').messages).toEqual([])
  })

  it('rejects a line directive spanning lines and ignores it', () => {
    expect(lint('/* lint-disable-line\n no-debugger */\ndebugger\nexport {}\n').messages).toEqual([
      '1:1 2 null lint-disable-line comment should not span multiple lines.',
      `3:1 2 no-debugger ${DEBUGGER}`,
    ])
  })

  it('reads quoted rule names and covers the whole line', () => {
    expect(lint('// lint-disable-line "no-debugger"\ndebugger // lint-disable-line "no-debugger"\nexport {}\n').messages).toEqual([
      "1:1 1 null Unused lint-disable directive (no problems were reported from 'no-debugger').",
    ])
  })

  it('covers code before a line directive on its own line', () => {
    expect(lint('debugger /* lint-disable-line no-debugger */ ; debugger\nexport {}\n').messages).toEqual([])
  })

  it('reports an unknown rule at its comment and keeps the known ones', () => {
    expect(lint('// lint-disable-next-line nope/x, no-debugger\ndebugger\nexport {}\n').messages).toEqual([
      "1:1 2 nope/x Definition for rule 'nope/x' was not found.",
    ])
  })

  it('drops a directive naming only unknown rules rather than disabling every rule', () => {
    expect(lint('// lint-disable-next-line nope/x\ndebugger\nexport {}\n').messages).toEqual([
      "1:1 2 nope/x Definition for rule 'nope/x' was not found.",
      `2:1 2 no-debugger ${DEBUGGER}`,
    ])
  })

  it('re-enables only the named rule inside a disable of every rule', () => {
    expect(lint('/* lint-disable */\n/* lint-enable no-var */\ndebugger\nvar a = 1\nexport { a }\n').messages).toEqual([
      '4:1 2 no-var Unexpected var, use let or const instead.',
    ])
  })

  it('counts an enable inside a disable of every rule as used', () => {
    expect(lint('/* lint-disable */\n/* lint-enable no-var, no-debugger */\nexport {}\n').messages).toEqual([
      '1:1 1 null Unused lint-disable directive (no problems were reported).',
    ])
  })

  it('ends a re-enabled rule when an enable of every rule closes the region', () => {
    expect(lint('/* lint-disable */\ndebugger\n/* lint-enable no-debugger */\ndebugger\n/* lint-enable */\nexport {}\n').messages).toEqual([
      `4:1 2 no-debugger ${DEBUGGER}`,
    ])
  })

  it('credits the named disable that re-disables a rule inside a disable of every rule', () => {
    expect(
      lint('/* lint-disable */\n/* lint-enable no-debugger */\n/* lint-disable no-debugger */\ndebugger\nexport {}\n').messages
    ).toEqual(['1:1 1 null Unused lint-disable directive (no problems were reported).'])
  })

  it('credits the latest of two disables of one rule', () => {
    expect(
      lint('/* lint-disable no-debugger */\ndebugger\n/* lint-disable no-debugger */\ndebugger\n/* lint-enable no-debugger */\nexport {}\n')
        .messages
    ).toEqual([])
  })

  it('reports the second enable of a rule already enabled', () => {
    expect(lint('/* lint-disable no-var */\n/* lint-enable no-var */\n/* lint-enable no-var */\nexport {}\n').messages).toEqual([
      "1:1 1 null Unused lint-disable directive (no problems were reported from 'no-var').",
      "3:1 1 null Unused lint-enable directive (no matching lint-disable directives were found for 'no-var').",
    ])
  })

  it('reads a plain comment as no directive', () => {
    expect(lint('/* lint-disabled is not a word here */\n// lint-\ndebugger\nexport {}\n').messages).toEqual([
      `3:1 2 no-debugger ${DEBUGGER}`,
    ])
  })

  it('skips the empty names of a list', () => {
    expect(lint('// lint-disable-next-line no-debugger,,\ndebugger\nexport {}\n').messages).toEqual([])
  })
})
