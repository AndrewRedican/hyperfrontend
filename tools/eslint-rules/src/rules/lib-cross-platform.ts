import type { CheckContext, MessageIds, PathHelperModule, RuleOptions } from './lib-cross-platform/types'
import { dirname } from 'node:path'
import { ESLintUtils } from '@typescript-eslint/utils'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { isPublishableLibrary } from '../utils/nx-project'
import { findProjectRoot, findWorkspaceRoot } from '../utils/workspace'
import { checkPosixConversion, checkRelativeEscapes } from './lib-cross-platform/conversions'
import { createClassifier, tierOfDomain } from './lib-cross-platform/domain'
import { importsNodeModule, isNodeCapableProject } from './lib-cross-platform/node-project'
import { checkHardcodedTmp, checkLineSplit, checkNativeImport, checkShellShim, checkUrlPathname } from './lib-cross-platform/runtime'
import { checkDriveLetterLoss, checkSeparatorJoin, checkSeparatorMethod } from './lib-cross-platform/separators'

/**
 * Rule identifier for the lib-cross-platform rule.
 */
export const RULE_NAME = 'lib-cross-platform'

/**
 * Exports of `@hyperfrontend/project-scope/core` whose output is native.
 */
const PROJECT_SCOPE_NATIVE = ['join', 'normalizeToNative']

/**
 * Exports of `@hyperfrontend/project-scope/core` whose output always uses `/`.
 */
const PROJECT_SCOPE_PORTABLE = [
  'normalizePath',
  'normalizeToForwardSlashes',
  'joinPath',
  'joinPosix',
  'getDirname',
  'relativePath',
  'resolvePath',
  'resolveFromWorkspace',
  'resolveRealPath',
  'offsetFromRoot',
]

/**
 * Path helpers in this workspace whose output domain is known, keyed by how consumers import them.
 */
const DEFAULT_HELPERS: PathHelperModule[] = [
  { module: '@hyperfrontend/project-scope/core', native: PROJECT_SCOPE_NATIVE, portable: PROJECT_SCOPE_PORTABLE },
  { module: 'libs/project-scope/src/core', native: PROJECT_SCOPE_NATIVE, portable: PROJECT_SCOPE_PORTABLE },
  { module: 'libs/builder/src/bundle/fs/posix-path', portable: ['join', 'normalizeToForwardSlashes'] },
]

/**
 * Commands installed as `.cmd` shims on Windows.
 */
const DEFAULT_SHIM_COMMANDS = [
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

/**
 * Creates the lib-cross-platform ESLint rule.
 */
const rule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)<[RuleOptions?], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description:
        'Keep publishable libraries working on Windows: path separators, absolute paths, dynamic imports, .cmd shims, and CRLF text',
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          helpers: {
            type: 'array',
            description: 'Path helpers outside node:path whose output domain the rule should trust.',
            items: {
              type: 'object',
              properties: {
                module: { type: 'string', description: 'Bare specifier, or workspace-relative source path, the helpers come from.' },
                native: { type: 'array', items: { type: 'string' }, description: 'Exports that return native OS paths.' },
                portable: { type: 'array', items: { type: 'string' }, description: 'Exports that return forward-slash paths.' },
              },
              required: ['module'],
              additionalProperties: false,
            },
          },
          shimCommands: {
            type: 'array',
            items: { type: 'string' },
            description: 'Commands that are .cmd shims on Windows and need a shell to spawn.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      separatorLiteral:
        "`.{{ method }}()` matches a hardcoded '/' against a native path, which uses '\\' on Windows. Match `sep` from node:path, or convert the path with `.split(sep).join(posix.sep)` first.",
      absoluteCheck: "`startsWith('/')` never matches a Windows absolute path such as 'C:\\x'. Use `isAbsolute()` from node:path.",
      separatorJoin:
        "A native path is joined to more segments with a hardcoded '/', which mixes separators on Windows. Use `join()` from node:path, or `posix.join()` when the value is a portable path.",
      relativeEscapes:
        '`relative()` returns backslashes on Windows, and this result leaves as data (a key, an Nx root, a stored or returned value). Convert it with `.split(sep).join(posix.sep)`.',
      driveLetterLoss:
        "Rebuilding an absolute path as '/' plus joined segments drops the drive on Windows: 'C:\\x' becomes '/C:/x'. Walk up with `dirname()` instead.",
      posixConversion:
        'Convert native paths to POSIX with `.split(sep).join(posix.sep)`. This spelling also rewrites backslashes on POSIX, where they are legal file-name characters.',
      nativeImport:
        "`import()` of a native path fails on Windows, where 'C:\\x' parses as a URL with scheme 'c:'. Import `pathToFileURL(path).href` from node:url instead.",
      urlPathname: "`.pathname` of a module URL is '/C:/x' with percent-encoding on Windows. Use `fileURLToPath()` from node:url.",
      shellShim:
        "'{{ command }}' is a .cmd shim on Windows and cannot be spawned without a shell (ENOENT or EINVAL). Pass `shell: process.platform === 'win32'` and keep its arguments free of spaces and shell metacharacters.",
      lineSplit: "Splitting on a bare line feed leaves '\\r' on every line of a CRLF file. Split on `/\\r?\\n/`.",
      hardcodedTmp: "'{{ path }}' does not exist on Windows. Use `tmpdir()` or `devNull` from node:os.",
      treatAsNative: 'Treat it as a native OS path: `{{ replacement }}`',
      treatAsPortable: 'Treat it as a portable POSIX path: `{{ replacement }}`',
      useShellOnWindows: 'Spawn through a shell on Windows only',
      useOsPath: 'Use `{{ replacement }}` from node:os',
    },
  },
  defaultOptions: [{ helpers: DEFAULT_HELPERS, shimCommands: DEFAULT_SHIM_COMMANDS }],
  create(context, [options]) {
    const projectRoot = findProjectRoot(dirname(context.filename))
    if (!projectRoot || !isPublishableLibrary(projectRoot)) return {}

    const sourceCode = context.sourceCode
    const binding = { sourceCode, filename: context.filename, workspaceRoot: findWorkspaceRoot(projectRoot) }
    const helpers = options?.helpers ?? DEFAULT_HELPERS
    const classify = createClassifier(binding, helpers)
    const nodeCapable = isNodeCapableProject(projectRoot)
    const check: CheckContext = {
      context,
      sourceCode,
      binding,
      helpers,
      nodeCapable,
      nodeFile: importsNodeModule(sourceCode.ast),
      shimCommands: createSet(options?.shimCommands ?? DEFAULT_SHIM_COMMANDS),
      classify,
      tierOf: (node) => tierOfDomain(classify(node), nodeCapable),
    }

    return {
      CallExpression(node) {
        checkSeparatorMethod(check, node)
        checkRelativeEscapes(check, node)
        checkPosixConversion(check, node)
        checkShellShim(check, node)
        checkLineSplit(check, node)
      },
      TemplateLiteral(node) {
        checkSeparatorJoin(check, node)
        checkDriveLetterLoss(check, node)
        checkHardcodedTmp(check, node)
      },
      BinaryExpression(node) {
        checkSeparatorJoin(check, node)
        checkDriveLetterLoss(check, node)
      },
      Literal(node) {
        checkHardcodedTmp(check, node)
      },
      ImportExpression(node) {
        checkNativeImport(check, node)
      },
      MemberExpression(node) {
        checkUrlPathname(check, node)
      },
    }
  },
})

export default rule
