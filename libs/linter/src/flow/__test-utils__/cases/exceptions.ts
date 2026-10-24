/**
 * The `exceptions.ts` source the control-flow specs read, and the paths and segments recorded for it.
 *
 * @module flow/__test-utils__/cases/exceptions
 */

export const EXCEPTIONS = {
  name: 'exceptions.ts',
  source: `try {
  a()
  throw new Error('x')
} catch (error) {
  b()
}
try {
  a()
} finally {
  b()
}
function returns() {
  try {
    return 1
  } finally {
    cleanup()
  }
  unreachable()
}
function rethrows() {
  try {
    a()
  } catch {
    throw new Error('y')
  } finally {
    cleanup()
  }
  after()
}
function nested() {
  try {
    try {
      a()
    } catch {
      b()
    }
  } catch {
    c()
  }
  try {
    try {
      d()
    } finally {
      e()
    }
  } catch {
    f()
  }
}
function leaves() {
  for (const item of list) {
    try {
      if (item) break
      if (!item) continue
    } finally {
      cleanup()
    }
  }
  try {
    throw new Error('z')
  } finally {
    return 2
  }
}
throw new Error('top')
`,
  flow: `P Program@0 final=[] thrown=[4]
  S0 live prevs=[] thrown=[] TryStatement@0
  S1 live prevs=[0] thrown=[] BlockStatement@4,ExpressionStatement@8,CallExpression@8,Identifier@8,ThrowStatement@14,NewExpression@20,Identifier@24,Literal@30
  S2 live prevs=[1] thrown=[1] Identifier@44,BlockStatement@51,ExpressionStatement@55,CallExpression@55,Identifier@55,TryStatement@61
  S3 live prevs=[2] thrown=[] BlockStatement@65,ExpressionStatement@69,CallExpression@69,Identifier@69
  S4 live prevs=[3] thrown=[3] BlockStatement@83,ExpressionStatement@87,CallExpression@87,Identifier@87,ThrowStatement@707,NewExpression@713,Identifier@717,Literal@723
P FunctionDeclaration@93 final=[7,8] thrown=[]
  S5 live prevs=[] thrown=[] TryStatement@116
  S6 live prevs=[5] thrown=[] BlockStatement@120,ReturnStatement@126,Literal@133
  S7 live prevs=[6] thrown=[6] BlockStatement@147,ExpressionStatement@153,CallExpression@153,Identifier@153
  S8 dead prevs=[] thrown=[] ExpressionStatement@169,CallExpression@169,Identifier@169
P FunctionDeclaration@185 final=[12] thrown=[12]
  S9 live prevs=[] thrown=[] TryStatement@209
  S10 live prevs=[9] thrown=[] BlockStatement@213,ExpressionStatement@219,CallExpression@219,Identifier@219
  S11 live prevs=[10] thrown=[10] BlockStatement@233,ThrowStatement@239,NewExpression@245,Identifier@249,Literal@255
  S12 live prevs=[10,11] thrown=[11] BlockStatement@272,ExpressionStatement@278,CallExpression@278,Identifier@278,ExpressionStatement@294,CallExpression@294,Identifier@294
P FunctionDeclaration@304 final=[21,22] thrown=[]
  S13 live prevs=[] thrown=[] TryStatement@326
  S14 live prevs=[13] thrown=[] BlockStatement@330,TryStatement@336
  S15 live prevs=[14] thrown=[] BlockStatement@340,ExpressionStatement@348,CallExpression@348,Identifier@348
  S16 live prevs=[15] thrown=[15] BlockStatement@364,ExpressionStatement@372,CallExpression@372,Identifier@372
  S17 live prevs=[15,16] thrown=[14,16] BlockStatement@392,ExpressionStatement@398,CallExpression@398,Identifier@398
  S18 live prevs=[15,16,17] thrown=[] TryStatement@408
  S19 live prevs=[18] thrown=[] BlockStatement@412,TryStatement@418
  S20 live prevs=[19] thrown=[] BlockStatement@422,ExpressionStatement@430,CallExpression@430,Identifier@430
  S21 live prevs=[20] thrown=[20] BlockStatement@448,ExpressionStatement@456,CallExpression@456,Identifier@456
  S22 live prevs=[21] thrown=[19,21] BlockStatement@476,ExpressionStatement@482,CallExpression@482,Identifier@482
P FunctionDeclaration@492 final=[33] thrown=[]
  S23 live prevs=[] thrown=[] ForOfStatement@514,Identifier@533
  S24 live prevs=[23,30] thrown=[] VariableDeclaration@519,VariableDeclarator@525,Identifier@525
  S25 live prevs=[24] thrown=[] BlockStatement@539,TryStatement@545
  S26 live prevs=[25] thrown=[] BlockStatement@549,IfStatement@557,Identifier@561
  S27 live prevs=[26] thrown=[] BreakStatement@567
  S28 live prevs=[26] thrown=[] IfStatement@579,UnaryExpression@583,Identifier@584
  S29 live prevs=[28] thrown=[] ContinueStatement@590
  S30 live prevs=[28,27,29] thrown=[26,27,28,29] BlockStatement@613,ExpressionStatement@621,CallExpression@621,Identifier@621
  S31 live prevs=[24,30] thrown=[] TryStatement@643
  S32 live prevs=[31] thrown=[] BlockStatement@647,ThrowStatement@653,NewExpression@659,Identifier@663,Literal@669
  S33 live prevs=[32] thrown=[32] BlockStatement@686,ReturnStatement@692,Literal@699
`,
}
