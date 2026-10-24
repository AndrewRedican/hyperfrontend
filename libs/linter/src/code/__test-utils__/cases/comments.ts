/**
 * The `comments.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/comments
 */

export const COMMENTS = {
  name: 'comments.ts',
  source: `// leading line comment
/* leading block */
/** jsdoc */
const a = /* inline */ 1 // trailing
/**
 * multi
 * line
 */
function b() {} /* after */ // and after
const c = \`template with // not a comment /* nor this */\`
const d = '// string' + "/* string */"
const e = /\\/\\/ regex \\/\\* /g
/* final */
`,
  tree: `Program 57-299 sourceType="module"
  VariableDeclaration 57-81 kind=const
    VariableDeclarator 63-81
      Identifier 63-64 name="a"
      Literal 80-81 raw="1"
  FunctionDeclaration 119-134
    Identifier 128-129 name="b"
    BlockStatement 132-134
  VariableDeclaration 160-217 kind=const
    VariableDeclarator 166-217
      Identifier 166-167 name="c"
      TemplateLiteral 170-217
        TemplateElement 170-217 tail=true raw="template with // not a comment /* nor this */"
  VariableDeclaration 218-256 kind=const
    VariableDeclarator 224-256
      Identifier 224-225 name="d"
      BinaryExpression 228-256 operator="+"
        Literal 228-239 raw="'// string'"
        Literal 242-256 raw="\\"/* string */\\""
  VariableDeclaration 257-286 kind=const
    VariableDeclarator 263-286
      Identifier 263-264 name="e"
      Literal 267-286 raw="/\\\\/\\\\/ regex \\\\/\\\\* /g"
`,
}
