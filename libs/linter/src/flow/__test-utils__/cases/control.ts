/**
 * The `control.ts` source the control-flow specs read, and the paths and segments recorded for it.
 *
 * @module flow/__test-utils__/cases/control
 */

export const CONTROL = {
  name: 'control.ts',
  source: `if (a) b()
if (a) b()
else c()
const t = a ? b : c
const l = a && b
const n = a ?? b
x ||= y
x += y
while (a) {
  if (b) continue
  if (c) break
  d()
}
while (true) {
  if (a) break
}
function forever() {
  while (/always/) {
    break
  }
  for (;;) {}
  after()
}
for (let i = 0; i < 3; i++) body()
for (let i = 0; ; i++) {
  if (i) break
}
for (const k in o) k()
for (const v of list) v()
do {
  if (a) continue
} while (a)
do {
  if (a) break
} while (true)
do {
  break
} while (b)
outer: for (const a of list) {
  inner: for (const b of list) {
    if (a) continue outer
    if (b) break outer
    break inner
  }
}
block: {
  if (a) break block
  b()
}
switch (a) {
  case 1:
    one()
  case 2:
    two()
    break
  default:
    three()
  case 3:
    four()
}
switch (a) {
  case 1:
    break
}
switch (a) {
}
`,
  flow: `P Program@0 final=[75] thrown=[]
  S0 live prevs=[] thrown=[] IfStatement@0,Identifier@4
  S1 live prevs=[0] thrown=[] ExpressionStatement@7,CallExpression@7,Identifier@7
  S2 live prevs=[1,0] thrown=[] IfStatement@11,Identifier@15
  S3 live prevs=[2] thrown=[] ExpressionStatement@18,CallExpression@18,Identifier@18
  S4 live prevs=[2] thrown=[] ExpressionStatement@27,CallExpression@27,Identifier@27
  S5 live prevs=[3,4] thrown=[] VariableDeclaration@31,VariableDeclarator@37,ConditionalExpression@41,Identifier@41
  S6 live prevs=[5] thrown=[] Identifier@45
  S7 live prevs=[5] thrown=[] Identifier@49
  S8 live prevs=[6,7] thrown=[] Identifier@37,VariableDeclaration@51,VariableDeclarator@57,LogicalExpression@61,Identifier@61
  S9 live prevs=[8] thrown=[] Identifier@66
  S10 live prevs=[9,8] thrown=[] Identifier@57,VariableDeclaration@68,VariableDeclarator@74,LogicalExpression@78,Identifier@78
  S11 live prevs=[10] thrown=[] Identifier@83
  S12 live prevs=[11,10] thrown=[] Identifier@74,ExpressionStatement@85,AssignmentExpression@85,Identifier@85
  S13 live prevs=[12] thrown=[] Identifier@91
  S14 live prevs=[13,12] thrown=[] ExpressionStatement@93,AssignmentExpression@93,Identifier@98,Identifier@93,WhileStatement@100
  S15 live prevs=[14,20,17] thrown=[] Identifier@107
  S16 live prevs=[15] thrown=[] BlockStatement@110,IfStatement@114,Identifier@118
  S17 live prevs=[16] thrown=[] ContinueStatement@121
  S18 live prevs=[16] thrown=[] IfStatement@132,Identifier@136
  S19 live prevs=[18] thrown=[] BreakStatement@139
  S20 live prevs=[18] thrown=[] ExpressionStatement@147,CallExpression@147,Identifier@147
  S21 live prevs=[15,19] thrown=[] WhileStatement@153
  S22 live prevs=[21,23] thrown=[] Literal@160
  S23 live prevs=[22] thrown=[] BlockStatement@166,IfStatement@170,Identifier@174
  S24 live prevs=[23] thrown=[] BreakStatement@177,ForStatement@267,VariableDeclaration@272,VariableDeclarator@276,Literal@280,Identifier@276
  S31 live prevs=[24,33] thrown=[] BinaryExpression@283,Identifier@283,Literal@287
  S32 live prevs=[31] thrown=[] ExpressionStatement@295,CallExpression@295,Identifier@295
  S33 live prevs=[32] thrown=[] UpdateExpression@290,Identifier@290
  S34 live prevs=[31] thrown=[] ForStatement@302,VariableDeclaration@307,VariableDeclarator@311,Literal@315,Identifier@311
  S35 live prevs=[34,38] thrown=[]\x20
  S36 live prevs=[35] thrown=[] BlockStatement@325,IfStatement@329,Identifier@333
  S37 live prevs=[36] thrown=[] BreakStatement@336,ForInStatement@344,Identifier@360
  S38 live prevs=[36] thrown=[] UpdateExpression@320,Identifier@320
  S39 live prevs=[37,40] thrown=[] VariableDeclaration@349,VariableDeclarator@355,Identifier@355
  S40 live prevs=[39] thrown=[] ExpressionStatement@363,CallExpression@363,Identifier@363
  S41 live prevs=[39] thrown=[] ForOfStatement@367,Identifier@383
  S42 live prevs=[41,43] thrown=[] VariableDeclaration@372,VariableDeclarator@378,Identifier@378
  S43 live prevs=[42] thrown=[] ExpressionStatement@389,CallExpression@389,Identifier@389
  S44 live prevs=[42] thrown=[] DoWhileStatement@393
  S45 live prevs=[44,47] thrown=[] BlockStatement@396,IfStatement@400,Identifier@404
  S46 live prevs=[45] thrown=[] ContinueStatement@407
  S47 live prevs=[45,46] thrown=[] Identifier@425
  S48 live prevs=[47] thrown=[] DoWhileStatement@428
  S49 live prevs=[48,51] thrown=[] BlockStatement@431,IfStatement@435,Identifier@439
  S50 live prevs=[49] thrown=[] BreakStatement@442,DoWhileStatement@463
  S51 live prevs=[49] thrown=[] Literal@457
  S52 live prevs=[50] thrown=[] BlockStatement@466,BreakStatement@470,LabeledStatement@488,ForOfStatement@495,Identifier@511
  S53 live prevs=[52,55,60,57] thrown=[] VariableDeclaration@500,VariableDeclarator@506,Identifier@506
  S54 live prevs=[53] thrown=[] BlockStatement@517,LabeledStatement@521,ForOfStatement@528,Identifier@544
  S55 live prevs=[54] thrown=[] VariableDeclaration@533,VariableDeclarator@539,Identifier@539
  S56 live prevs=[55] thrown=[] BlockStatement@550,IfStatement@556,Identifier@560
  S57 live prevs=[56] thrown=[] ContinueStatement@563
  S58 live prevs=[56] thrown=[] IfStatement@582,Identifier@586
  S59 live prevs=[58] thrown=[] BreakStatement@589
  S60 live prevs=[58] thrown=[] BreakStatement@605
  S61 live prevs=[53,59] thrown=[] LabeledStatement@623,BlockStatement@630,IfStatement@634,Identifier@638
  S62 live prevs=[61] thrown=[] BreakStatement@641
  S63 live prevs=[61] thrown=[] ExpressionStatement@655,CallExpression@655,Identifier@655
  S64 live prevs=[63,62] thrown=[] SwitchStatement@661,Identifier@669
  S65 live prevs=[64] thrown=[] Literal@681
  S66 live prevs=[65] thrown=[] ExpressionStatement@688,CallExpression@688,Identifier@688
  S67 live prevs=[65] thrown=[] Literal@701
  S68 live prevs=[66,67] thrown=[] ExpressionStatement@708,CallExpression@708,Identifier@708,BreakStatement@718
  S69 dead prevs=[70] thrown=[] ExpressionStatement@739,CallExpression@739,Identifier@739
  S70 live prevs=[67] thrown=[] Literal@754
  S71 live prevs=[69,70] thrown=[] ExpressionStatement@761,CallExpression@761,Identifier@761
  S72 live prevs=[71,68] thrown=[] SwitchStatement@770,Identifier@778
  S73 live prevs=[72] thrown=[] Literal@790
  S74 live prevs=[73] thrown=[] BreakStatement@797
  S75 live prevs=[73,74] thrown=[] SwitchStatement@805,Identifier@813
P FunctionDeclaration@185 final=[30] thrown=[]
  S25 live prevs=[] thrown=[] WhileStatement@208
  S26 live prevs=[25] thrown=[] Literal@215
  S27 live prevs=[26] thrown=[] BlockStatement@225,BreakStatement@231,ForStatement@243
  S28 live prevs=[27,29] thrown=[]\x20
  S29 live prevs=[28] thrown=[] BlockStatement@252
  S30 dead prevs=[] thrown=[] ExpressionStatement@257,CallExpression@257,Identifier@257
C 676 end=[66]
C 696 end=[]
C 726 end=[69]
C 749 end=[71]
C 785 end=[]
`,
}
