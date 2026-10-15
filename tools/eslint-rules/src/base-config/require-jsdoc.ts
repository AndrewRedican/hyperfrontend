/**
 * Options the workspace hands `jsdoc/require-jsdoc` for every TypeScript source file.
 *
 * The AST contexts say which declarations must carry a JSDoc block: exported functions and
 * classes, every interface and type alias with their members, and every class member a
 * consumer can reach. The last group is what the generated API reference documents member
 * by member, so it is drawn the same way the reference is: public and protected members,
 * abstract members included, whether or not the class itself is exported. Private members
 * and `#names` are never published and need no block.
 *
 * Constructors are checked only when they take parameters, since a parameterless one is
 * described by its class. A getter is the member a reader looks up, so it is checked and
 * its setter shares the block; a setter without a getter is checked on its own. Overload
 * signatures are each documented in turn, so the implementation beneath them, which the
 * reference never shows, is exempt: a method with a body directly after an overload
 * signature can only be that implementation.
 *
 * A method is matched through its function node rather than its definition, because the
 * plugin's accessor and constructor exemptions read the definition as the function's
 * parent. An abstract method has no function node the plugin visits, so it is matched as
 * the definition itself.
 *
 * Held here rather than inline in the base config so the enforcement can be exercised by
 * the spec beside this file without loading the whole config.
 *
 * @example Reading the options from a flat config
 * ```javascript
 * const { REQUIRE_JSDOC_OPTIONS } = require('./tools/eslint-rules/src/base-config/require-jsdoc.ts')
 * rules['jsdoc/require-jsdoc'] = ['error', REQUIRE_JSDOC_OPTIONS]
 * ```
 */
export const REQUIRE_JSDOC_OPTIONS = {
  contexts: [
    'ExportNamedDeclaration > FunctionDeclaration',
    'ExportDefaultDeclaration > FunctionDeclaration',
    'ExportNamedDeclaration > ClassDeclaration',
    'ExportDefaultDeclaration > ClassDeclaration',
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > ArrowFunctionExpression',
    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > FunctionExpression',
    'TSInterfaceDeclaration',
    'TSTypeAliasDeclaration',
    'TSPropertySignature',
    'TSMethodSignature',
    'MethodDefinition[accessibility!="private"]:not([key.type="PrivateIdentifier"]):not(MethodDefinition:has(> TSEmptyBodyFunctionExpression) + MethodDefinition) > FunctionExpression',
    'MethodDefinition[accessibility!="private"]:not([key.type="PrivateIdentifier"]) > TSEmptyBodyFunctionExpression',
    'PropertyDefinition[accessibility!="private"]:not([key.type="PrivateIdentifier"])',
    'TSAbstractMethodDefinition[accessibility!="private"]',
    'TSAbstractPropertyDefinition[accessibility!="private"]',
  ],
  checkConstructors: true,
  exemptEmptyConstructors: true,
  checkGetters: true,
  checkSetters: 'no-getter',
} as const
