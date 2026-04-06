import { ESLintUtils, AST_NODE_TYPES } from '@typescript-eslint/utils'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { keys } from '@hyperfrontend/immutable-api-utils/built-in-copy/object'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/**
 * Rule identifier for the no-async-fs-api rule.
 */
export const RULE_NAME = 'no-async-fs-api'

/**
 * Maps async fs methods to their sync equivalents.
 * These are methods that have direct Sync counterparts.
 */
const ASYNC_TO_SYNC_METHODS: Record<string, string> = {
  readFile: 'readFileSync',
  writeFile: 'writeFileSync',
  appendFile: 'appendFileSync',
  copyFile: 'copyFileSync',
  rename: 'renameSync',
  unlink: 'unlinkSync',
  rm: 'rmSync',
  rmdir: 'rmdirSync',
  truncate: 'truncateSync',

  mkdir: 'mkdirSync',
  readdir: 'readdirSync',
  opendir: 'opendirSync',

  link: 'linkSync',
  symlink: 'symlinkSync',
  readlink: 'readlinkSync',

  realpath: 'realpathSync',

  stat: 'statSync',
  lstat: 'lstatSync',
  fstat: 'fstatSync',
  access: 'accessSync',
  exists: 'existsSync',

  chmod: 'chmodSync',
  fchmod: 'fchmodSync',
  lchmod: 'lchmodSync',
  chown: 'chownSync',
  fchown: 'fchownSync',
  lchown: 'lchownSync',
  utimes: 'utimesSync',
  futimes: 'futimesSync',
  lutimes: 'lutimesSync',

  open: 'openSync',
  close: 'closeSync',
  read: 'readSync',
  write: 'writeSync',
  fdatasync: 'fdatasyncSync',
  fsync: 'fsyncSync',
  ftruncate: 'ftruncateSync',

  mkdtemp: 'mkdtempSync',
  cp: 'cpSync',
  glob: 'globSync',
  statfs: 'statfsSync',
  readv: 'readvSync',
  writev: 'writevSync',
}

/**
 * Callback-based async methods that should not be used.
 * These are the same as ASYNC_TO_SYNC_METHODS keys but explicitly listed
 * for clarity when checking callback patterns.
 */
const ASYNC_METHODS = createSet(keys(ASYNC_TO_SYNC_METHODS))

/**
 * fs/promises specific exports that are async-only.
 * Importing from 'fs/promises' or 'node:fs/promises' should be flagged entirely.
 */
const FS_PROMISES_MODULE_PATTERNS = ['fs/promises', 'node:fs/promises']

/**
 * fs module patterns (with or without node: prefix)
 */
const FS_MODULE_PATTERNS = ['fs', 'node:fs']

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://github.com/AndrewRedican/hyperfrontend/blob/main/tools/eslint-rules/docs/${name}.md`
)

/**
 * Message identifiers for the no-async-fs-api rule.
 */
type MessageIds = 'noAsyncFsMethod' | 'noFsPromisesImport' | 'noAsyncFsNamespace'

export default createRule<[], MessageIds>({
  name: RULE_NAME,
  meta: {
    type: 'problem',
    docs: {
      description: 'Prohibit async Node.js file system APIs and suggest using synchronous alternatives',
    },
    schema: [],
    messages: {
      noAsyncFsMethod: "Avoid using async fs method '{{ method }}'. Use '{{ syncMethod }}' instead for synchronous file operations.",
      noFsPromisesImport: "Avoid importing from '{{ source }}'. Use synchronous fs methods from 'node:fs' instead.",
      noAsyncFsNamespace:
        "Avoid using async fs methods via namespace. Use synchronous method '{{ syncMethod }}' instead of '{{ method }}'.",
    },
  },
  defaultOptions: [],
  create(context) {
    const fsNamespaceBindings = createMap<string, 'fs' | 'fs/promises'>()

    return {
      ImportDeclaration(node) {
        const source = node.source.value

        /* istanbul ignore if - source is always string in valid import declarations */
        if (typeof source !== 'string') {
          return
        }

        if (FS_PROMISES_MODULE_PATTERNS.some((pattern) => source === pattern)) {
          context.report({
            node: node.source,
            messageId: 'noFsPromisesImport',
            data: { source },
          })
          return
        }

        if (FS_MODULE_PATTERNS.some((pattern) => source === pattern)) {
          for (const specifier of node.specifiers) {
            if (specifier.type === AST_NODE_TYPES.ImportNamespaceSpecifier) {
              fsNamespaceBindings.set(specifier.local.name, 'fs')
            }
            if (specifier.type === AST_NODE_TYPES.ImportSpecifier) {
              const importedName =
                specifier.imported.type === AST_NODE_TYPES.Identifier ? specifier.imported.name : specifier.imported.value

              if (ASYNC_METHODS.has(importedName)) {
                const syncMethod = ASYNC_TO_SYNC_METHODS[importedName]
                context.report({
                  node: specifier,
                  messageId: 'noAsyncFsMethod',
                  data: {
                    method: importedName,
                    syncMethod,
                  },
                })
              }
            }
          }
        }
      },

      MemberExpression(node) {
        if (node.object.type !== AST_NODE_TYPES.Identifier) {
          return
        }

        const objectName = node.object.name

        if (!fsNamespaceBindings.has(objectName)) {
          return
        }

        let methodName: string | undefined

        if (node.property.type === AST_NODE_TYPES.Identifier) {
          methodName = node.property.name
        } else if (node.property.type === AST_NODE_TYPES.Literal && typeof node.property.value === 'string') {
          methodName = node.property.value
        } else {
          return
        }

        if (ASYNC_METHODS.has(methodName)) {
          const syncMethod = ASYNC_TO_SYNC_METHODS[methodName]
          context.report({
            node,
            messageId: 'noAsyncFsNamespace',
            data: {
              method: methodName,
              syncMethod,
            },
          })
        }
      },

      CallExpression(node) {
        if (node.callee.type !== AST_NODE_TYPES.Identifier || node.callee.name !== 'require') {
          return
        }

        const arg = node.arguments[0]
        if (!arg || arg.type !== AST_NODE_TYPES.Literal || typeof arg.value !== 'string') {
          return
        }

        const source = arg.value

        if (FS_PROMISES_MODULE_PATTERNS.some((pattern) => source === pattern)) {
          context.report({
            node,
            messageId: 'noFsPromisesImport',
            data: { source },
          })
        }
      },
    }
  },
})
