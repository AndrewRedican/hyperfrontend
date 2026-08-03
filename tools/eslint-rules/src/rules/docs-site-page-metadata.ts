import type { TSESLint, TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'

/**
 * Rule identifier for the docs-site-page-metadata rule.
 */
export const RULE_NAME = 'docs-site-page-metadata'

/** Exported names that satisfy the app router metadata requirement. */
const METADATA_EXPORT_NAMES: readonly string[] = ['metadata', 'generateMetadata']

/** getSubmoduleMetadata option names, in call-site convention order. */
const SUBMODULE_ARG_NAMES: readonly string[] = ['librarySlug', 'packageName', 'submodulePath', 'path']

/**
 * Expected metadata shape and the helper arguments derivable from one
 * docs-site page route.
 */
interface RoutePlan {
  /** Metadata structure the route conventionally uses. */
  kind: 'generic' | 'dynamic' | 'library' | 'architecture' | 'submodule'
  /** Manifest slug expected as the library or architecture helper argument. */
  slug?: string
  /** Expected getSubmoduleMetadata arguments, keyed by option name. */
  submoduleArgs?: Record<string, string>
}

/**
 * A text insertion the missing-metadata fix applies at an absolute source index.
 */
interface FixInsertion {
  /** Absolute source index the text is inserted at. */
  index: number
  /** Text inserted at the index. */
  text: string
}

/**
 * Outcome of locating the metadata helper within an existing '@/lib/metadata' import.
 */
interface HelperImportLookup {
  /** Whether the helper is already imported. */
  present: boolean
  /** Specifier the helper is appended after when the import lacks it. */
  appendAfter?: TSESTree.ImportClause
}

/**
 * Derive the app router route directory from a lint target's filename.
 *
 * @param filename - Path of the file being linted.
 * @returns The route directory relative to the app dir (empty string for the
 * root page), or null when the file is not an app router page.
 */
function routeFromFilename(filename: string): string | null {
  const normalized = filename.split('\\').join('/')
  const marker = '/src/app/'
  const markerIndex = normalized.lastIndexOf(marker)
  if (markerIndex === -1 || !normalized.endsWith('/page.tsx')) {
    return null
  }
  const start = markerIndex + marker.length
  const end = normalized.length - '/page.tsx'.length
  return start > end ? '' : normalized.slice(start, end)
}

/**
 * Classify a page route into its conventional metadata plan. Library-family
 * routes derive every helper argument from the file location; the utils
 * directory maps to `<segment>-utils` package names per the docs-site layout.
 *
 * @param route - Route directory relative to the app dir.
 * @returns The plan describing the expected metadata structure and helper arguments.
 */
function classifyRoute(route: string): RoutePlan {
  const segments = route === '' ? [] : route.split('/')
  if (segments.some((segment) => segment.startsWith('['))) {
    return { kind: 'dynamic' }
  }
  if (segments[0] !== 'docs' || segments[1] !== 'libraries' || segments.length < 3) {
    return { kind: 'generic' }
  }
  const rest = segments.slice(2)
  const head = rest[0] ?? ''
  if (head === 'utils') {
    if (rest.length === 1) {
      return { kind: 'generic' }
    }
    const utilsSegment = rest[1] ?? ''
    if (rest.length === 2) {
      return { kind: 'library', slug: `${utilsSegment}-utils` }
    }
    return {
      kind: 'submodule',
      submoduleArgs: {
        librarySlug: `utils/${utilsSegment}`,
        packageName: `@hyperfrontend/${utilsSegment}-utils`,
        submodulePath: rest.slice(2).join('/'),
        path: `/${route}/`,
      },
    }
  }
  if (rest.length === 1) {
    return { kind: 'library', slug: head }
  }
  if (rest.length === 2 && rest[1] === 'architecture') {
    return { kind: 'architecture', slug: head }
  }
  return {
    kind: 'submodule',
    submoduleArgs: {
      librarySlug: head,
      packageName: `@hyperfrontend/${head}`,
      submodulePath: rest.slice(1).join('/'),
      path: `/${route}/`,
    },
  }
}

/**
 * Resolve the docs-site metadata helper a plan's fix imports and calls.
 *
 * @param plan - The route's metadata plan.
 * @returns The helper name, or null when the plan uses a literal metadata object.
 */
function helperForPlan(plan: RoutePlan): string | null {
  if (plan.kind === 'library') {
    return 'getLibraryMetadata'
  }
  if (plan.kind === 'architecture') {
    return 'getArchitectureMetadata'
  }
  if (plan.kind === 'submodule') {
    return 'getSubmoduleMetadata'
  }
  return null
}

/**
 * Build the metadata export block a route's autofix inserts. Library-family
 * blocks call the conventional helper with fully derived arguments; generic
 * and dynamic blocks leave undefined placeholders the rule keeps reporting
 * until a human completes them.
 *
 * @param plan - The route's metadata plan.
 * @returns The export block text, without a trailing newline.
 */
function blockForPlan(plan: RoutePlan): string {
  if (plan.kind === 'library') {
    return `export function generateMetadata(): Metadata {\n  return getLibraryMetadata('${plan.slug}')\n}`
  }
  if (plan.kind === 'architecture') {
    return `export function generateMetadata(): Metadata {\n  return getArchitectureMetadata('${plan.slug}')\n}`
  }
  if (plan.kind === 'submodule') {
    const args = plan.submoduleArgs ?? {}
    const lines = SUBMODULE_ARG_NAMES.map((name) => `    ${name}: '${args[name]}',`).join('\n')
    return `export function generateMetadata(): Metadata {\n  return getSubmoduleMetadata({\n${lines}\n  })\n}`
  }
  if (plan.kind === 'dynamic') {
    return `export function generateMetadata(): Metadata {\n  return {\n    title: undefined,\n    description: undefined,\n  }\n}`
  }
  return `export const metadata: Metadata = {\n  title: undefined,\n  description: undefined,\n}`
}

/**
 * Collect the metadata-relevant names a top-level statement exports.
 *
 * @param statement - A top-level statement of the page module.
 * @returns The exported names among metadata and generateMetadata.
 */
function metadataNamesExportedBy(statement: TSESTree.ProgramStatement): string[] {
  if (statement.type !== 'ExportNamedDeclaration') {
    return []
  }
  const names: string[] = []
  const declaration = statement.declaration
  if (declaration?.type === 'VariableDeclaration') {
    for (const declarator of declaration.declarations) {
      if (declarator.id.type === 'Identifier' && METADATA_EXPORT_NAMES.includes(declarator.id.name)) {
        names.push(declarator.id.name)
      }
    }
  }
  if (declaration?.type === 'FunctionDeclaration' && declaration.id !== null && METADATA_EXPORT_NAMES.includes(declaration.id.name)) {
    names.push(declaration.id.name)
  }
  for (const specifier of statement.specifiers) {
    if (specifier.exported.type === 'Identifier' && METADATA_EXPORT_NAMES.includes(specifier.exported.name)) {
      names.push(specifier.exported.name)
    }
  }
  return names
}

/**
 * Find the module's leading 'use client' directive, when present.
 *
 * @param program - The parsed module.
 * @returns The directive statement, or null when the module is a server component.
 */
function useClientDirective(program: TSESTree.Program): TSESTree.ExpressionStatement | null {
  for (const statement of program.body) {
    if (statement.type !== 'ExpressionStatement') {
      return null
    }
    const expression = statement.expression
    if (expression.type !== 'Literal' || typeof expression.value !== 'string') {
      return null
    }
    if (expression.value === 'use client') {
      return statement
    }
  }
  return null
}

/**
 * Determine whether an import declaration provides the Metadata type from next.
 *
 * @param declaration - A top-level import declaration.
 * @returns True when the declaration imports the Metadata specifier from 'next'.
 */
function providesMetadataType(declaration: TSESTree.ImportDeclaration): boolean {
  if (declaration.source.value !== 'next') {
    return false
  }
  return declaration.specifiers.some(
    (specifier) =>
      specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier' && specifier.imported.name === 'Metadata'
  )
}

/**
 * Locate the metadata helper within an existing '@/lib/metadata' import.
 *
 * @param imports - Top-level import declarations in source order.
 * @param helper - The helper name the fix needs imported.
 * @returns The lookup outcome, or null when no named '@/lib/metadata' import exists.
 */
function locateHelperImport(imports: TSESTree.ImportDeclaration[], helper: string): HelperImportLookup | null {
  for (const declaration of imports) {
    if (declaration.source.value !== '@/lib/metadata') {
      continue
    }
    let appendAfter: TSESTree.ImportClause | undefined
    for (const specifier of declaration.specifiers) {
      if (specifier.type === 'ImportSpecifier' && specifier.imported.type === 'Identifier' && specifier.imported.name === helper) {
        return { present: true }
      }
      appendAfter = specifier
    }
    if (appendAfter !== undefined) {
      return { present: false, appendAfter }
    }
  }
  return null
}

/**
 * Find the import a new '@/lib/metadata' declaration is inserted before, per
 * the pages' ordering: aliased '@/' imports alphabetically, module imports last.
 *
 * @param imports - Top-level import declarations in source order.
 * @returns The import to insert before, or null to place the declaration after the last import.
 */
function helperInsertionTarget(imports: TSESTree.ImportDeclaration[]): TSESTree.ImportDeclaration | null {
  for (const declaration of imports) {
    if (declaration.importKind === 'type') {
      continue
    }
    const source = <string>declaration.source.value
    if (!source.startsWith('@/') || source > '@/lib/metadata') {
      return declaration
    }
  }
  return null
}

/**
 * Resolve a property's static key name.
 *
 * @param property - The object property node.
 * @returns The key name, or null when the key is computed.
 */
function keyNameOf(property: TSESTree.Property): string | null {
  if (property.key.type === 'Identifier' && !property.computed) {
    return property.key.name
  }
  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value
  }
  return null
}

/**
 * Determine whether a node sits inside a metadata or generateMetadata export.
 *
 * @param node - The node whose enclosing top-level statement is inspected.
 * @returns True when the enclosing statement exports page metadata.
 */
function isWithinMetadataExport(node: TSESTree.Node): boolean {
  let current: TSESTree.Node = node
  while (current.parent !== undefined && current.parent.type !== 'Program') {
    current = current.parent
  }
  return metadataNamesExportedBy(<TSESTree.ProgramStatement>current).length > 0
}

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the docs-site-page-metadata rule.
 */
type MessageIds = 'missingMetadata' | 'clientPage' | 'placeholderValue' | 'wrongMetadataArg'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require docs-site app router pages to export metadata following the centralized metadata conventions',
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingMetadata:
        'Docs-site pages must export metadata or generateMetadata. The autofix inserts the conventional structure for this route; complete any undefined placeholders it leaves.',
      clientPage:
        'Client component pages cannot export metadata. Keep page.tsx a server component and move the client logic into a child component.',
      placeholderValue: 'Complete the metadata placeholder: replace undefined with the page {{property}}.',
      wrongMetadataArg: 'The {{property}} argument does not match this page route; expected {{expected}}.',
    },
  },
  defaultOptions: [],
  create(context) {
    const filePath = context.filename ?? context.getFilename()
    const route = routeFromFilename(filePath)
    if (route === null) {
      return {}
    }
    const plan = classifyRoute(route)

    /**
     * Report a library or architecture helper call whose slug argument does
     * not match the value derived from the page route.
     *
     * @param call - The helper call expression.
     */
    function reportSlugMismatch(call: TSESTree.CallExpression): void {
      const argument = call.arguments[0]
      if (argument === undefined || argument.type !== 'Literal' || typeof argument.value !== 'string') {
        return
      }
      const expected = plan.slug ?? ''
      if (argument.value === expected) {
        return
      }
      context.report({
        node: argument,
        messageId: 'wrongMetadataArg',
        data: { property: 'slug', expected: `'${expected}'` },
        fix(fixer) {
          return fixer.replaceText(argument, `'${expected}'`)
        },
      })
    }

    /**
     * Report getSubmoduleMetadata options whose literal values do not match
     * the values derived from the page route.
     *
     * @param call - The helper call expression.
     */
    function reportSubmoduleMismatches(call: TSESTree.CallExpression): void {
      const argument = call.arguments[0]
      if (argument === undefined || argument.type !== 'ObjectExpression') {
        return
      }
      const expectedArgs = plan.submoduleArgs ?? {}
      for (const property of argument.properties) {
        if (property.type !== 'Property') {
          continue
        }
        const name = keyNameOf(property)
        if (name === null || !SUBMODULE_ARG_NAMES.includes(name)) {
          continue
        }
        const value = property.value
        if (value.type !== 'Literal' || typeof value.value !== 'string') {
          continue
        }
        const expected = expectedArgs[name]
        if (expected === undefined || value.value === expected) {
          continue
        }
        context.report({
          node: value,
          messageId: 'wrongMetadataArg',
          data: { property: name, expected: `'${expected}'` },
          fix(fixer) {
            return fixer.replaceText(value, `'${expected}'`)
          },
        })
      }
    }

    /**
     * Build the fixes inserting the conventional metadata structure with any
     * imports it needs, placed per the pages' import ordering.
     *
     * @param fixer - The rule fixer.
     * @param program - The parsed module.
     * @returns The fixes to apply.
     */
    function buildMissingMetadataFixes(fixer: TSESLint.RuleFixer, program: TSESTree.Program): TSESLint.RuleFix[] {
      const imports = program.body.filter((statement): statement is TSESTree.ImportDeclaration => statement.type === 'ImportDeclaration')
      const helper = helperForPlan(plan)
      const block = blockForPlan(plan)
      const fixes: TSESLint.RuleFix[] = []
      const insertions: FixInsertion[] = []
      const firstStatement = program.body[0]
      if (imports.length === 0) {
        const helperImport = helper === null ? '' : `import { ${helper} } from '@/lib/metadata'\n`
        const insertIndex = firstStatement === undefined ? 0 : firstStatement.range[0]
        const trailer = firstStatement === undefined ? '\n' : '\n\n'
        insertions.push({ index: insertIndex, text: `import type { Metadata } from 'next'\n${helperImport}\n${block}${trailer}` })
      } else {
        const lastImport = imports[imports.length - 1]
        const firstImport = imports[0]
        if (firstImport !== undefined && !imports.some(providesMetadataType)) {
          insertions.push({ index: firstImport.range[0], text: "import type { Metadata } from 'next'\n" })
        }
        let blockText = `\n\n${block}`
        if (helper !== null) {
          const lookup = locateHelperImport(imports, helper)
          if (lookup === null) {
            const target = helperInsertionTarget(imports)
            if (target === null) {
              blockText = `\nimport { ${helper} } from '@/lib/metadata'\n\n${block}`
            } else {
              insertions.push({ index: target.range[0], text: `import { ${helper} } from '@/lib/metadata'\n` })
            }
          } else if (!lookup.present && lookup.appendAfter !== undefined) {
            fixes.push(fixer.insertTextAfter(lookup.appendAfter, `, ${helper}`))
          }
        }
        if (lastImport !== undefined) {
          insertions.push({ index: lastImport.range[1], text: blockText })
        }
      }
      const merged: FixInsertion[] = []
      for (const insertion of insertions) {
        const existing = merged.find((candidate) => candidate.index === insertion.index)
        if (existing === undefined) {
          merged.push({ index: insertion.index, text: insertion.text })
        } else {
          existing.text += insertion.text
        }
      }
      for (const insertion of merged) {
        fixes.push(fixer.insertTextAfterRange([insertion.index, insertion.index], insertion.text))
      }
      return fixes
    }

    return {
      'Program:exit'(program: TSESTree.Program) {
        const directive = useClientDirective(program)
        if (directive !== null) {
          context.report({ node: directive, messageId: 'clientPage' })
          return
        }
        const hasMetadataExport = program.body.some((statement) => metadataNamesExportedBy(statement).length > 0)
        if (hasMetadataExport) {
          return
        }
        context.report({
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
          messageId: 'missingMetadata',
          fix(fixer) {
            return buildMissingMetadataFixes(fixer, program)
          },
        })
      },
      Property(node: TSESTree.Property) {
        if (node.value.type !== 'Identifier' || node.value.name !== 'undefined') {
          return
        }
        const propertyName = keyNameOf(node)
        if (propertyName !== 'title' && propertyName !== 'description') {
          return
        }
        if (!isWithinMetadataExport(node)) {
          return
        }
        context.report({ node: node.value, messageId: 'placeholderValue', data: { property: propertyName } })
      },
      CallExpression(node: TSESTree.CallExpression) {
        if (node.callee.type !== 'Identifier') {
          return
        }
        const calleeName = node.callee.name
        const slugHelperMatches =
          (plan.kind === 'library' && calleeName === 'getLibraryMetadata') ||
          (plan.kind === 'architecture' && calleeName === 'getArchitectureMetadata')
        if (slugHelperMatches) {
          reportSlugMismatch(node)
        }
        if (plan.kind === 'submodule' && calleeName === 'getSubmoduleMetadata') {
          reportSubmoduleMismatches(node)
        }
      },
    }
  },
})
