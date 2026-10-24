/**
 * The `crlf.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/crlf
 */

export const CRLF = {
  name: 'crlf.ts',
  source: `const a = 1\r
const b = \`x\r
y\`\r
// comment\r
/* block\r
more */\r
const c = "s\\\r
t"\r
`,
  tree: `Program 0-81 sourceType="module"
  VariableDeclaration 0-11 kind=const
    VariableDeclarator 6-11
      Identifier 6-7 name="a"
      Literal 10-11 raw="1"
  VariableDeclaration 13-29 kind=const
    VariableDeclarator 19-29
      Identifier 19-20 name="b"
      TemplateLiteral 23-29
        TemplateElement 23-29 tail=true raw="x\\r\\ny"
  VariableDeclaration 62-79 kind=const
    VariableDeclarator 68-79
      Identifier 68-69 name="c"
      Literal 72-79 raw="\\"s\\\\\\r\\nt\\""
`,
}
