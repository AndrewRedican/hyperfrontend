/**
 * Every app-router page of the documentation site exports its metadata the way its route calls
 * for: a library, architecture, changelog or submodule page through the matching helper with
 * arguments that match the route, any other page through `metadata` or `generateMetadata`, and
 * no client page at all. A missing export is inserted with placeholders to complete.
 *
 * @module rules/workspace/docs-site-page-metadata
 */

import type { Node } from '../../code/model.ts'
import type { Fix } from '../../engine/report.ts'
import { posix, sep } from 'node:path'
import { defineRule } from '../../engine/rule.ts'

/** What a route's page exports. */
interface RoutePlan {
  /** The kind of page. */
  readonly kind: 'generic' | 'dynamic' | 'library' | 'architecture' | 'changelog' | 'submodule'
  /** The library slug a helper takes. */
  readonly slug?: string
  /** The arguments the submodule helper takes. */
  readonly submodule?: Readonly<Record<string, string>>
}

/** One text inserted at an offset. */
interface Insertion {
  /** The offset. */
  readonly index: number
  /** The text. */
  text: string
}

/** The names a metadata export goes by. */
const EXPORT_NAMES = ['metadata', 'generateMetadata']

/** The arguments of the submodule helper, in order. */
const SUBMODULE_ARGUMENTS = ['librarySlug', 'packageName', 'submodulePath', 'path']

/** The helper each kind of page calls. */
const HELPERS: Readonly<Record<string, string>> = {
  library: 'getLibraryMetadata',
  architecture: 'getArchitectureMetadata',
  changelog: 'getChangelogMetadata',
  submodule: 'getSubmoduleMetadata',
}

/** What the rule reports, by the problem found. */
const MESSAGES = {
  missing:
    'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
  client:
    'Client component pages cannot export metadata. Keep page.tsx a server component and move the client logic into a child component.',
}

/**
 * The route of a page file: its directory below `src/app/`.
 *
 * @param path - The file's path
 * @returns The route, empty for the root page, or null for a file that is not a page
 */
function routeOf(path: string): string | null {
  const normalized = path.split(sep).join(posix.sep)
  const marker = normalized.lastIndexOf('/src/app/')
  if (marker === -1 || !normalized.endsWith('/page.tsx')) return null
  const start = marker + 9
  const end = normalized.length - 9
  return start > end ? '' : normalized.slice(start, end)
}

/**
 * What a route's page exports.
 *
 * @param route - A page route, such as `/docs/guides/x`
 * @returns What the page must export and declare for that route
 */
function planOf(route: string): RoutePlan {
  const segments = route === '' ? [] : route.split('/')
  if (segments.some((segment) => segment.startsWith('['))) return { kind: 'dynamic' }
  if (segments[0] !== 'docs' || segments[1] !== 'libraries' || segments.length < 3) return { kind: 'generic' }
  const rest = segments.slice(2)
  const head = rest[0] as string
  const submodule = (slug: string, packageName: string, depth: number): RoutePlan => ({
    kind: 'submodule',
    submodule: { librarySlug: slug, packageName, submodulePath: rest.slice(depth).join('/'), path: `/${route}/` },
  })
  if (head === 'utils') {
    if (rest.length === 1) return { kind: 'generic' }
    const name = `${rest[1] as string}-utils`
    if (rest.length === 2) return { kind: 'library', slug: name }
    if (rest.length === 3 && rest[2] === 'releases') return { kind: 'changelog', slug: name }
    return submodule(`utils/${rest[1] as string}`, `@hyperfrontend/${name}`, 2)
  }
  if (rest.length === 1) return { kind: 'library', slug: head }
  if (rest.length === 2 && rest[1] === 'architecture') return { kind: 'architecture', slug: head }
  // why: a package's changelog page sits at `releases`, since `changelog` is an entry of the versioning package with a submodule page of its own.
  if (rest.length === 2 && rest[1] === 'releases') return { kind: 'changelog', slug: head }
  return submodule(head, `@hyperfrontend/${head}`, 1)
}

/**
 * The export a plan inserts.
 *
 * @param plan - The page's plan
 * @returns The export's text
 */
function blockOf(plan: RoutePlan): string {
  if (plan.kind === 'submodule') {
    const lines = SUBMODULE_ARGUMENTS.map((name) => `    ${name}: '${(plan.submodule as Readonly<Record<string, string>>)[name]}',`).join(
      '\n'
    )
    return `export function generateMetadata(): Metadata {\n  return getSubmoduleMetadata({\n${lines}\n  })\n}`
  }
  if (plan.kind in HELPERS) return `export function generateMetadata(): Metadata {\n  return ${HELPERS[plan.kind]}('${plan.slug}')\n}`
  if (plan.kind === 'dynamic')
    return 'export function generateMetadata(): Metadata {\n  return {\n    title: undefined,\n    description: undefined,\n  }\n}'
  return 'export const metadata: Metadata = {\n  title: undefined,\n  description: undefined,\n}'
}

/**
 * Whether a statement exports the page's metadata.
 *
 * @param statement - A top-level statement
 * @returns Whether it exports `metadata` or `generateMetadata`
 */
function exportsMetadata(statement: Node): boolean {
  if (statement.kind !== 'ExportNamedDeclaration') return false
  const declaration = statement.declaration as Node | null
  const declared =
    declaration?.kind === 'VariableDeclaration'
      ? (declaration.declarations as readonly Node[]).map((declarator) => (declarator.id as Node).name)
      : declaration?.kind === 'FunctionDeclaration'
        ? [(declaration.id as Node).name]
        : []
  const listed = (statement.specifiers as readonly Node[]).map((specifier) => (specifier.exported as Node).name)
  return [...declared, ...listed].some((name) => EXPORT_NAMES.includes(name as string))
}

/**
 * The name of an object property's key.
 *
 * @param property - An object literal member
 * @returns The name, or null for a computed or non-string key
 */
function keyName(property: Node): string | null {
  const key = property.key as Node
  if (key.kind === 'Identifier' && property.computed !== true) return key.name as string
  return key.kind === 'Literal' && typeof key.value === 'string' ? key.value : null
}

export default defineRule<undefined, Node>({
  id: 'workspace/docs-site-page-metadata',
  language: 'code',
  fixable: true,
  create(context) {
    const route = routeOf(context.file.path)
    if (route === null) return {}
    const plan = planOf(route)
    const text = context.file.text
    const mismatch = (value: Node, property: string, expected: string): void =>
      context.report({
        start: value.start,
        end: value.end,
        message: `The ${property} argument does not match this page route; expected '${expected}'.`,
        fix: { start: value.start, end: value.end, text: `'${expected}'` },
      })
    const insertMetadata = (program: Node): Fix => {
      const statements = program.body as readonly Node[]
      const imports = statements.filter((statement) => statement.kind === 'ImportDeclaration')
      const helper = HELPERS[plan.kind]
      const block = blockOf(plan)
      const insertions: Insertion[] = []
      const add = (index: number, inserted: string): void => {
        const existing = insertions.find((insertion) => insertion.index === index)
        if (existing === undefined) insertions.push({ index, text: inserted })
        else existing.text += inserted
      }
      const first = imports[0]
      if (first === undefined) {
        const helperImport = helper === undefined ? '' : `import { ${helper} } from '@/lib/metadata'\n`
        add(
          statements[0]?.start ?? 0,
          `import type { Metadata } from 'next'\n${helperImport}\n${block}${statements[0] === undefined ? '\n' : '\n\n'}`
        )
      } else {
        const typed = imports.some(
          (declaration) =>
            (declaration.source as Node).value === 'next' &&
            (declaration.specifiers as readonly Node[]).some(
              (specifier) => specifier.kind === 'ImportSpecifier' && (specifier.imported as Node).name === 'Metadata'
            )
        )
        if (!typed) add(first.start, "import type { Metadata } from 'next'\n")
        let tail = `\n\n${block}`
        if (helper !== undefined) {
          const metadataImports = imports.filter(
            (declaration) =>
              (declaration.source as Node).value === '@/lib/metadata' && (declaration.specifiers as readonly Node[]).length > 0
          )
          const holder = metadataImports[0]
          const specifiers = holder === undefined ? [] : (holder.specifiers as readonly Node[])
          if (holder === undefined) {
            const target = imports.find(
              (declaration) =>
                declaration.importKind !== 'type' &&
                (!((declaration.source as Node).value as string).startsWith('@/') ||
                  ((declaration.source as Node).value as string) > '@/lib/metadata')
            )
            if (target === undefined) tail = `\nimport { ${helper} } from '@/lib/metadata'\n\n${block}`
            else add(target.start, `import { ${helper} } from '@/lib/metadata'\n`)
          } else if (
            !specifiers.some((specifier) => specifier.kind === 'ImportSpecifier' && (specifier.imported as Node).name === helper)
          ) {
            add((specifiers[specifiers.length - 1] as Node).end, `, ${helper}`)
          }
        }
        add((imports[imports.length - 1] as Node).end, tail)
      }
      const ordered = [...insertions].sort((a, b) => a.index - b.index)
      const from = (ordered[0] as Insertion).index
      const to = (ordered[ordered.length - 1] as Insertion).index
      let replacement = ''
      let at = from
      for (const insertion of ordered) {
        replacement += text.slice(at, insertion.index) + insertion.text
        at = insertion.index
      }
      return { start: from, end: to, text: replacement }
    }
    return {
      'Program:exit'(program) {
        for (const statement of program.body as readonly Node[]) {
          const expression = statement.expression as Node | undefined
          if (statement.kind !== 'ExpressionStatement' || expression?.kind !== 'Literal' || typeof expression.value !== 'string') break
          if (expression.value === 'use client')
            return context.report({ start: statement.start, end: statement.end, message: MESSAGES.client })
        }
        if ((program.body as readonly Node[]).some(exportsMetadata)) return
        context.report({
          start: 0,
          at: { line: 1, column: 1, endLine: 1, endColumn: 1 },
          message: MESSAGES.missing,
          fix: insertMetadata(program),
        })
      },
      Property(node) {
        const value = node.value as Node
        const name = keyName(node)
        if (value.kind !== 'Identifier' || value.name !== 'undefined' || (name !== 'title' && name !== 'description')) return
        let statement = node
        while ((statement.parent as Node).kind !== 'Program') statement = statement.parent as Node
        if (exportsMetadata(statement))
          context.report({
            start: value.start,
            end: value.end,
            message: `Complete the metadata placeholder: replace undefined with the page ${name}.`,
          })
      },
      CallExpression(node) {
        const callee = node.callee as Node
        if (callee.kind !== 'Identifier') return
        const argument = (node.arguments as readonly Node[])[0]
        if (plan.kind !== 'submodule' && HELPERS[plan.kind] === callee.name) {
          if (argument?.kind === 'Literal' && typeof argument.value === 'string' && argument.value !== plan.slug)
            mismatch(argument, 'slug', plan.slug as string)
          return
        }
        if (plan.kind !== 'submodule' || callee.name !== 'getSubmoduleMetadata' || argument?.kind !== 'ObjectExpression') return
        for (const property of argument.properties as readonly Node[]) {
          const name = property.kind === 'Property' ? keyName(property) : null
          const value = property.value as Node | undefined
          if (name === null || !SUBMODULE_ARGUMENTS.includes(name) || value?.kind !== 'Literal' || typeof value.value !== 'string') continue
          const expected = (plan.submodule as Readonly<Record<string, string>>)[name] as string
          if (value.value !== expected) mismatch(value, name, expected)
        }
      },
    }
  },
})
