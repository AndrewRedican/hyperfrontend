/**
 * Keeps publishable libraries, and the other files the `include` option selects, working on
 * Windows: path separators, absolute-path tests, file paths used as module specifiers, `.cmd`
 * shims and CRLF text. Values are traced to where they come from, so only strings crossing
 * between the native and the portable convention are reported.
 *
 * @module rules/workspace/cross-platform
 */

import type { Node } from '@hyperfrontend/linter'
import type { Scan } from './shared/cross-platform/edits.ts'
import type { Helper } from './shared/cross-platform/origin.ts'
import type { Selector } from './shared/cross-platform/project.ts'
import { dirname } from 'node:path'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { defineRule } from '@hyperfrontend/linter'
import { scopeAnalysisOf } from '@hyperfrontend/linter/helpers'
import { createNamer } from './shared/cross-platform/edits.ts'
import { createTracer } from './shared/cross-platform/origin.ts'
import { checkedProject, isNodeProject } from './shared/cross-platform/project.ts'
import {
  checkArray,
  checkFlagTemplate,
  checkImport,
  checkPathname,
  checkRuntimeCall,
  checkTemporaryPath,
} from './shared/cross-platform/runtime.ts'
import { checkBuiltString, checkMethodCall, checkPosixInput, checkRelative } from './shared/cross-platform/separators.ts'
import { workspaceRootOf } from './shared/locate.ts'

/** The rule's options. */
export interface CrossPlatformOptions {
  /** Path helpers outside `node:path` whose output domain is trusted; replaces the defaults. */
  readonly helpers?: readonly Helper[]
  /** Commands that are `.cmd` shims on Windows; replaces the defaults. */
  readonly shimCommands?: readonly string[]
  /** The files checked; replaces the default of every publishable library. */
  readonly include?: readonly Selector[]
}

/** The project-scope helpers, as imported and as the workspace's own sources. */
const PROJECT_SCOPE: Omit<Helper, 'module'> = {
  native: ['join', 'normalizeToNative'],
  portable: [
    'normalizePath',
    'normalizeToForwardSlashes',
    'joinPath',
    'joinPosix',
    'getDirname',
    'relativePath',
    'workspaceRelativePath',
    'resolvePath',
    'resolveFromWorkspace',
    'resolveRealPath',
    'offsetFromRoot',
  ],
}

/** The helpers trusted by default. */
const HELPERS: readonly Helper[] = [
  { module: '@hyperfrontend/project-scope/core', ...PROJECT_SCOPE },
  { module: 'libs/project-scope/src/core', ...PROJECT_SCOPE },
  { module: 'libs/builder/src/bundle/fs/posix-path', portable: ['join', 'normalizeToForwardSlashes'] },
  { module: 'libs/testing/src/runner/portable-paths', portable: ['normalizePath', 'relativePath', 'workspaceRelativePath'] },
]

/** The commands that are `.cmd` shims on Windows by default. */
const SHIMS = [
  'npm',
  'npx',
  'pnpm',
  'pnpx',
  'yarn',
  'yarnpkg',
  'corepack',
  'nx',
  'tsc',
  'eslint',
  'prettier',
  'vite',
  'vitest',
  'jest',
  'rollup',
]

export default defineRule<CrossPlatformOptions | undefined, Node>({
  id: 'workspace/cross-platform',
  language: 'code',
  fixable: true,
  create(context) {
    const options = context.options ?? {}
    const project = checkedProject(context.file.path, options.include ?? [{ publishableLibraries: true }])
    if (project === null) return {}
    const program = context.tree
    const analysis = scopeAnalysisOf(context)
    const scan: Scan = {
      text: context.file.text,
      tracer: createTracer({
        analysis,
        path: context.file.path,
        workspaceRoot: workspaceRootOf(dirname(context.file.path)),
        helpers: options.helpers ?? HELPERS,
      }),
      namer: createNamer(program, analysis),
      node: isNodeProject(project),
      nodeImports: (program.body as readonly Node[]).some(
        (statement) => statement.kind === 'ImportDeclaration' && ((statement.source as Node).value as string).startsWith('node:')
      ),
      shims: createSet(options.shimCommands ?? SHIMS),
      report: (node, message, fix, suggestions) =>
        context.report({
          start: node.start,
          end: node.end,
          message,
          ...(fix == null ? {} : { fix }),
          ...(suggestions === undefined ? {} : { suggestions }),
        }),
    }
    return {
      CallExpression(node) {
        checkMethodCall(scan, node)
        checkRelative(scan, node)
        checkPosixInput(scan, node)
        checkRuntimeCall(scan, node)
      },
      TemplateLiteral(node) {
        if ((node.parent as Node).kind !== 'TaggedTemplateExpression') checkBuiltString(scan, node)
        checkFlagTemplate(scan, node)
        checkTemporaryPath(scan, node)
      },
      BinaryExpression(node) {
        if (node.operator === '+') checkBuiltString(scan, node)
      },
      Literal(node) {
        if (typeof node.value === 'string') checkTemporaryPath(scan, node)
      },
      ArrayExpression(node) {
        checkArray(scan, node)
      },
      ImportExpression(node) {
        checkImport(scan, node)
      },
      MemberExpression(node) {
        checkPathname(scan, node)
      },
    }
  },
})
