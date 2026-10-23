/**
 * APIs React deprecated by the configured version are reported: members read off the pragma,
 * the DOM and server renderers and the perf addon, names destructured or imported from their
 * modules, and the unsafe lifecycle methods of class components.
 *
 * @module rules/react/no-deprecated
 */

import type { Node } from '../../code/model'
import type { Version } from './shared/settings'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { defineRule } from '../../engine/rule'
import { isEs5Component, isEs6Component } from './shared/class-components'
import { atLeast, pragmaOf, reactVersion } from './shared/settings'

/** A deprecation: since when, what replaces it, and where to read more. */
interface Deprecation {
  /** The version that deprecated it. */
  readonly since: Version
  /** What to use instead, when something replaces it. */
  readonly instead?: string
  /** A page explaining the change, when there is one. */
  readonly see?: string
}

/** The modules whose exports are checked, with the name each is read as. */
const MODULES = createMap<string, string>([
  ['react', 'React'],
  ['react-addons-perf', 'ReactPerf'],
  ['react-dom', 'ReactDOM'],
  ['react-dom/server', 'ReactDOMServer'],
])

/** The names a module's object is bound to that destructuring is checked from. */
const MODULE_OBJECTS = ['React', 'ReactPerf', 'Perf', 'ReactDOM', 'ReactDOMServer']

/** What an object inherits, whose keys the previous rule mistook for modules. */
const INHERITED: object = {}

/** The page on renaming the unsafe lifecycle methods. */
const CODEMOD = 'Use https://github.com/reactjs/react-codemod#rename-unsafe-lifecycles to automatically update your components.'

/** The page on moving to the root API. */
const ROOT_API = 'https://reactjs.org/link/switch-to-createroot'

/**
 * The deprecated APIs, by the name a member expression or a destructured export reads as.
 *
 * @param pragma - The pragma, which prefixes the core APIs
 * @returns Each deprecated name with its version, replacement and reference
 */
function deprecationsOf(pragma: string): Map<string, Deprecation> {
  const lifecycle = (name: string): Deprecation => ({
    since: [16, 9, 0],
    instead: `UNSAFE_${name}`,
    see: `https://reactjs.org/docs/react-component.html#unsafe_${name.toLowerCase()}. ${CODEMOD}`,
  })
  return createMap<string, Deprecation>([
    [`${pragma}.renderComponent`, { since: [0, 12, 0], instead: `${pragma}.render` }],
    [`${pragma}.renderComponentToString`, { since: [0, 12, 0], instead: `${pragma}.renderToString` }],
    [`${pragma}.renderComponentToStaticMarkup`, { since: [0, 12, 0], instead: `${pragma}.renderToStaticMarkup` }],
    [`${pragma}.isValidComponent`, { since: [0, 12, 0], instead: `${pragma}.isValidElement` }],
    [`${pragma}.PropTypes.component`, { since: [0, 12, 0], instead: `${pragma}.PropTypes.element` }],
    [`${pragma}.PropTypes.renderable`, { since: [0, 12, 0], instead: `${pragma}.PropTypes.node` }],
    [`${pragma}.isValidClass`, { since: [0, 12, 0] }],
    ['this.transferPropsTo', { since: [0, 12, 0], instead: 'spread operator ({...})' }],
    [`${pragma}.addons.classSet`, { since: [0, 13, 0], instead: 'the npm module classnames' }],
    [`${pragma}.addons.cloneWithProps`, { since: [0, 13, 0], instead: `${pragma}.cloneElement` }],
    [`${pragma}.render`, { since: [0, 14, 0], instead: 'ReactDOM.render' }],
    [`${pragma}.unmountComponentAtNode`, { since: [0, 14, 0], instead: 'ReactDOM.unmountComponentAtNode' }],
    [`${pragma}.findDOMNode`, { since: [0, 14, 0], instead: 'ReactDOM.findDOMNode' }],
    [`${pragma}.renderToString`, { since: [0, 14, 0], instead: 'ReactDOMServer.renderToString' }],
    [`${pragma}.renderToStaticMarkup`, { since: [0, 14, 0], instead: 'ReactDOMServer.renderToStaticMarkup' }],
    [`${pragma}.addons.LinkedStateMixin`, { since: [15, 0, 0] }],
    ['ReactPerf.printDOM', { since: [15, 0, 0], instead: 'ReactPerf.printOperations' }],
    ['Perf.printDOM', { since: [15, 0, 0], instead: 'Perf.printOperations' }],
    ['ReactPerf.getMeasurementsSummaryMap', { since: [15, 0, 0], instead: 'ReactPerf.getWasted' }],
    ['Perf.getMeasurementsSummaryMap', { since: [15, 0, 0], instead: 'Perf.getWasted' }],
    [`${pragma}.createClass`, { since: [15, 5, 0], instead: 'the npm module create-react-class' }],
    [`${pragma}.addons.TestUtils`, { since: [15, 5, 0], instead: 'ReactDOM.TestUtils' }],
    [`${pragma}.PropTypes`, { since: [15, 5, 0], instead: 'the npm module prop-types' }],
    [`${pragma}.DOM`, { since: [15, 6, 0], instead: 'the npm module react-dom-factories' }],
    ['componentWillMount', lifecycle('componentWillMount')],
    ['componentWillReceiveProps', lifecycle('componentWillReceiveProps')],
    ['componentWillUpdate', lifecycle('componentWillUpdate')],
    ['ReactDOM.render', { since: [18, 0, 0], instead: 'createRoot', see: ROOT_API }],
    ['ReactDOM.hydrate', { since: [18, 0, 0], instead: 'hydrateRoot', see: ROOT_API }],
    ['ReactDOM.unmountComponentAtNode', { since: [18, 0, 0], instead: 'root.unmount', see: ROOT_API }],
    [
      'ReactDOMServer.renderToNodeStream',
      { since: [18, 0, 0], instead: 'renderToPipeableStream', see: 'https://reactjs.org/docs/react-dom-server.html#rendertonodestream' },
    ],
  ])
}

/**
 * The name a declarator destructures from: the module object it reads, or the module it
 * requires; null when it destructures from neither.
 *
 * @param declarator - The variable declarator
 * @param pragma - The pragma, the name of a required object without a module of its own
 * @returns The object's name, or null
 */
function destructuredFrom(declarator: Node, pragma: string): string | null {
  const init = declarator.init as Node | null
  if ((declarator.id as Node).kind !== 'ObjectPattern' || init === null) return null
  if (init.kind === 'Identifier') return MODULE_OBJECTS.includes(init.name as string) ? (init.name as string) : null
  if (init.kind !== 'CallExpression' || (init.callee as Node).name !== 'require') return null
  const module = (init.arguments as readonly Node[])[0]?.value
  if (typeof module !== 'string') return null
  // why: the previous rule looked modules up in a plain object, so a key every object inherits read as a module named after the pragma.
  return MODULES.get(module) ?? (module in INHERITED ? pragma : null)
}

export default defineRule<undefined, Node>({
  id: 'react/no-deprecated',
  language: 'code',
  fixable: false,
  create(context) {
    const pragma = pragmaOf(context.file, context.settings)
    const version = reactVersion(context.settings)
    const deprecations = deprecationsOf(pragma)
    const check = (name: string, node: Node): void => {
      const deprecation = deprecations.get(name)
      if (deprecation === undefined || !atLeast(version, deprecation.since)) return
      const instead = deprecation.instead === undefined ? '' : `, use ${deprecation.instead} instead`
      const see = deprecation.see === undefined ? '' : `, see ${deprecation.see}`
      context.report({
        start: node.start,
        end: node.end,
        message: `${name} is deprecated since React ${deprecation.since.join('.')}${instead}${see}`,
      })
    }
    const checkLifecycle = (members: readonly Node[]): void => {
      for (const member of members) {
        const key = member.key as Node | undefined
        if (key?.kind === 'Identifier') check(key.name as string, key)
      }
    }
    const checkClass = (node: Node): void => {
      if (isEs6Component(context, node)) checkLifecycle((node.body as Node).body as readonly Node[])
    }
    return {
      MemberExpression(node) {
        check(context.file.text.slice(node.start, node.end), node)
      },
      ImportDeclaration(node) {
        const module = MODULES.get((node.source as Node).value as string)
        if (module === undefined) return
        for (const specifier of node.specifiers as readonly Node[]) {
          if (specifier.kind === 'ImportSpecifier') check(`${module}.${(specifier.imported as Node).name as string}`, specifier)
        }
      },
      VariableDeclarator(node) {
        const from = destructuredFrom(node, pragma)
        if (from === null) return
        for (const property of (node.id as Node).properties as readonly Node[]) {
          if (property.kind === 'Property') check(`${from}.${(property.key as Node).name as string}`, property)
        }
      },
      ObjectExpression(node) {
        if (isEs5Component(context, node)) checkLifecycle(node.properties as readonly Node[])
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
    }
  },
})
