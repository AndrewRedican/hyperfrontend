/**
 * The `script.js` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/script
 */

export const SCRIPT = {
  name: 'script.js',
  source: `#!/usr/bin/env node
'use strict'
const required = require('module')
module.exports = { required }
const jsx = <div />
const generic = <T,>(x) => x
label: {
  break label
}
`,
  tree: `Program 20-172 sourceType="module"
  ExpressionStatement 20-32 directive="use strict"
    Literal 20-32 raw="'use strict'"
  VariableDeclaration 33-67 kind=const
    VariableDeclarator 39-67
      Identifier 39-47 name="required"
      CallExpression 50-67
        Identifier 50-57 name="require"
        Literal 58-66 raw="'module'"
  ExpressionStatement 68-97
    AssignmentExpression 68-97 operator="="
      MemberExpression 68-82
        Identifier 68-74 name="module"
        Identifier 75-82 name="exports"
      ObjectExpression 85-97
        Property 87-95 kind=init shorthand=true
          Identifier 87-95 name="required"
          Identifier 87-95 name="required"
  VariableDeclaration 98-117 kind=const
    VariableDeclarator 104-117
      Identifier 104-107 name="jsx"
      JSXElement 110-117
        JSXOpeningElement 110-117 selfClosing=true
          JSXIdentifier 111-114 name="div"
  VariableDeclaration 118-146 kind=const
    VariableDeclarator 124-146
      Identifier 124-131 name="generic"
      ArrowFunctionExpression 134-146 expression=true
        TSTypeParameterDeclaration 134-138
          TSTypeParameter 135-136
            Identifier 135-136 name="T"
        Identifier 139-140 name="x"
        Identifier 145-146 name="x"
  LabeledStatement 147-171
    Identifier 147-152 name="label"
    BlockStatement 154-171
      BreakStatement 158-169
        Identifier 164-169 name="label"
`,
}
