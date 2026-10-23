/**
 * Lint from the command line or as a function, configure with ordered blocks in
 * `lint.config.ts`, select the packaged rules and presets, and define rules of your own.
 *
 * @module @hyperfrontend/linter
 */

export type { LintReport, LintRequest, LintText } from './api/lint'
export type { RunEnvironment } from './cli/run'
export type { Kind, Node, RegexValue, SourceToken, TemplateValue } from './code/model'
export type { SourceComment } from './config/directives'
export type { ConfigBlock, LanguageSettings, RuleSetting } from './config/model'
export type { RuleFamily, RuleModuleExports, RuleSource } from './engine/registry'
export type { FileResult, Fix, Location, Message, Problem, Suggestion } from './engine/report'
export type { Language, RuleContext, RuleFile, RuleModule } from './engine/rule'
export type { Listener, Listeners, TreeNode } from './engine/traverse'
export type { JsonDocument, JsonTreeNode } from './languages/json'
export type { JsonArrayNode, JsonLiteralNode, JsonNode, JsonObjectNode, JsonPropertyNode, JsonSpan } from './languages/json-tree'
export type { TextDocument } from './languages/text'
export type { MarkdownAlign, MarkdownKind, MarkdownNode, MarkdownPoint, MarkdownPosition } from './markdown/model'
export type { LineMap, Position } from './text/lines'
export { lint } from './api/lint'
export { run } from './cli/run'
export { defineRule } from './engine/rule'
export { formatJson } from './output/json'
export { formatStylish } from './output/stylish'
export { BROWSER_AND_NODE_GLOBALS } from './presets/globals'
export { CODE, CODE_RULES, JAVASCRIPT, JSDOC_RULES, REACT_RULES, SCRIPT, TYPESCRIPT, on } from './presets/rule-sets'
export { RULE_IDS } from './rules/ids'
