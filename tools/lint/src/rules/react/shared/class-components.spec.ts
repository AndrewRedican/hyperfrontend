import type { Node } from '../../../code/model.ts'
import type { InvalidCase } from '../../../testing/rule-tester.ts'
import { defineRule } from '../../../engine/rule.ts'
import { testRule } from '../../../testing/rule-tester.ts'
import { parentEs5Component, parentEs6Component } from './class-components.ts'

/** Reports each `this` with the kinds of class component around it. */
const probe = defineRule<undefined, Node>({
  id: 'react/probe-class-components',
  language: 'code',
  fixable: false,
  create: (context) => ({
    ThisExpression(node) {
      const es6 = parentEs6Component(context, node) === null ? '' : 'es6'
      const es5 = parentEs5Component(context, node) === null ? '' : 'es5'
      context.report({ start: node.start, end: node.end, message: `${es6}${es5}` || 'none' })
    },
  }),
})

/**
 * A case whose one `this` reports the kinds found around it.
 *
 * @param name - The test's name
 * @param text - The text linted, with one `this`
 * @param message - The message expected: `es6`, `es5` or `none`
 * @param settings - The settings, when the case needs them
 * @returns The case
 */
function found(name: string, text: string, message: string, settings?: Readonly<Record<string, unknown>>): InvalidCase {
  const column = text.indexOf('this') + 1
  return { name, path: '/root/file.tsx', text, settings, errors: [{ message, line: 1, column }] }
}

testRule(probe, {
  valid: [],
  invalid: [
    found('a class extending Component', 'class A extends Component { m() { this.x } }', 'es6'),
    found('a class extending the pragma PureComponent', 'class A extends React.PureComponent { m() { this.x } }', 'es6'),
    found('a class extending another object Component', 'class A extends Other.Component { m() { this.x } }', 'none'),
    found('a class extending a call', 'class A extends mixin() { m() { this.x } }', 'none'),
    found('a class extending another class', 'class A extends Base { m() { this.x } }', 'none'),
    found('a class extending nothing', 'class A { m() { this.x } }', 'none'),
    found('a nested function in a component', 'class A extends Component { m() { return function () { this.x } } }', 'es6'),
    found('the program', 'this.x', 'none'),
    found('a factory object', 'createReactClass({ m() { this.x } })', 'es5'),
    found('a pragma factory object', 'React.createReactClass({ m: function () { this.x } })', 'es5'),
    found('another call', 'make({ m() { this.x } })', 'none'),
    found('an object in an array', '[{ m() { this.x } }]', 'none'),
    found('a function declaration', 'function f() { this.x }', 'none'),
    found('a configured factory', 'build({ m() { this.x } })', 'es5', { react: { createClass: 'build' } }),
  ],
})
