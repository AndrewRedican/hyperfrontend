import type { Node } from '../../../code/model'
import type { RuleCase } from '../../../testing/rule-tester'
import { defineRule } from '../../../engine/rule'
import { testRule } from '../../../testing/rule-tester'
import { avoidsDocs, isUnimplemented } from './exemptions'
import { documentedNodes } from './functions'

/** A rule reporting every documented function no exemption lets go, constructors, getters and setters passed over. */
const rule = defineRule<undefined, Node>({
  id: 'jsdoc/exemptions-probe',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (node, block) => {
      if (!avoidsDocs(context, node, block, { checkConstructors: false, checkGetters: false, checkSetters: false })) {
        context.report({ start: block.start, end: block.end, message: 'checked' })
      }
    }),
})

/**
 * A valid case.
 *
 * @param name - What it exercises
 * @param text - The code
 * @returns The case
 */
function valid(name: string, text: string): RuleCase {
  return { name, path: '/root/file.ts', text }
}

testRule(rule, {
  valid: [
    valid('an ignored function', '/** @ignore */\nfunction f() {}'),
    valid('a method of an overriding class', '/** @override */\nclass A {\n  /** M */\n  m() {}\n}'),
    valid('a constructor', 'class A {\n  /** C */\n  constructor() {}\n}'),
    valid('a getter', 'class A {\n  /** G */\n  get g() { return 1 }\n}'),
    valid('a setter', 'class A {\n  /** S */\n  set s(v) {}\n}'),
    valid('an object getter', 'const o = {\n  /** G */\n  get g() { return 1 }\n}'),
    valid('an inheriting block', '/** @inheritDoc */\nfunction f() {}'),
  ],
  invalid: [
    {
      name: 'a method of an undocumented class',
      path: '/root/file.ts',
      text: 'class A {\n  /** M */\n  m() {}\n}',
      errors: [{ message: 'checked', line: 2, column: 3, endLine: 2, endColumn: 11 }],
    },
    {
      name: 'a method of a documented class',
      path: '/root/file.ts',
      text: '/** A */\nconst A = class {\n  /** M */\n  m() {}\n}',
      errors: [{ message: 'checked', line: 3, column: 3, endLine: 3, endColumn: 11 }],
    },
    {
      name: 'an object method',
      path: '/root/file.ts',
      text: 'const o = {\n  /** M */\n  m() {}\n}',
      errors: [{ message: 'checked', line: 2, column: 3, endLine: 2, endColumn: 11 }],
    },
  ],
})

/** A rule reporting every documented function with an implementation to check. */
const implemented = defineRule<undefined, Node>({
  id: 'jsdoc/unimplemented-probe',
  language: 'code',
  fixable: false,
  create: (context) =>
    documentedNodes(context, (node, block) => {
      if (!isUnimplemented(context, node, block)) context.report({ start: block.start, end: block.end, message: 'implemented' })
    }),
})

testRule(implemented, {
  valid: [
    valid('an abstract function', '/** @abstract */\nfunction f() {}'),
    valid('a constructor', 'class A {\n  /** C */\n  constructor() {}\n}'),
    valid('a method of an interface class', '/** @interface */\nclass A {\n  /** M */\n  m() {}\n}'),
  ],
  invalid: [
    {
      name: 'a method of a plain class',
      path: '/root/file.ts',
      text: '/** A */\nclass A {\n  /** M */\n  m() {}\n}',
      errors: [{ message: 'implemented', line: 3, column: 3, endLine: 3, endColumn: 11 }],
    },
    {
      name: 'a method of an undocumented class',
      path: '/root/file.ts',
      text: 'class A {\n  /** M */\n  m() {}\n}',
      errors: [{ message: 'implemented', line: 2, column: 3, endLine: 2, endColumn: 11 }],
    },
  ],
})
