/**
 * The `statements.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/statements
 */

export const STATEMENTS = {
  name: 'statements.ts',
  source: `'use strict'
;(function () {})()
var a = 1,
  b
let [c, , d = 2, ...e] = [1, 2, 3]
const { f, g: h, i = 3, ...j } = { f: 1 }
const [{ k }, [l]] = [{ k: 1 }, [2]]
label: for (let m = 0; m < 3; m++) {
  if (m === 1) continue label
  else if (m === 2) break label
  else {
  }
}
for (;;) break
for (var n in {}) {
}
for (const o of [1]) o
for await (const q of []) q
for (a = 0; a < 1; a++) a
for (let [r] of [[1]]) r
for (;;) {
  break
}
while (false) {}
do a++
while (false)
do {} while (false);
switch (a) {
  case 1:
  case 2: {
    break
  }
  default:
    a = 3
}
try {
  throw new Error('x')
} catch {
} finally {
}
try {
} catch (error) {
  error
}
try {
} catch ({ message }) {
  message
}
debugger;
;
if (a) a
else b
function declared(x, y = 1, ...rest) {
  return x
}
function* generator() {
  yield
  yield 1
  yield* generator()
  const inner = yield
}
async function asynchronous() {
  await a
  for await (const s of []) s
}
async function* both() {
  yield await 1
}
function hoisted() {
  return
}
function withThis(this: Window, arg: number): void {}
function overload(x: number): number
function overload(x: string): string
function overload(x: number | string): number | string {
  return x
}
outer: inner: a++
a = b ? c : d
if (a) {
} else if (b) {
}
using resource = acquire()
await using asyncResource = acquireAsync()
for ([t, u] of pairs) t
for ({ v } of objects) v
for (var w, x; ; ) break
for (await using y of []) y
const asyncInstance = async instanceof Function
class Sub extends Base {
  make() {
    return new super.constructor()
  }
}
const optionalTyped = obj?.<string>(a)
@(decorators.factory()) @plain.member class DecoratedWithCall {}
;[...rest] = source
;[a = 1, [b], { c }] = source
;({ d = 2, e: [f = 3] } = source)
;(a as any) += 1
;(b!) -= 1
await promise
await (promise)
;({ ...everything } = source)
for (item of items) item
for (obj.prop in source) {
}
await
promise2
`,
  tree: `Program 0-1911 sourceType="module"
  ExpressionStatement 0-14 directive="use strict"
    Literal 0-12 raw="'use strict'"
  ExpressionStatement 14-32
    CallExpression 14-32
      FunctionExpression 15-29
        BlockStatement 27-29
  VariableDeclaration 33-47 kind=var
    VariableDeclarator 37-42
      Identifier 37-38 name="a"
      Literal 41-42 raw="1"
    VariableDeclarator 46-47
      Identifier 46-47 name="b"
  VariableDeclaration 48-82 kind=let
    VariableDeclarator 52-82
      ArrayPattern 52-70
        Identifier 53-54 name="c"
        AssignmentPattern 58-63
          Identifier 58-59 name="d"
          Literal 62-63 raw="2"
        RestElement 65-69
          Identifier 68-69 name="e"
      ArrayExpression 73-82
        Literal 74-75 raw="1"
        Literal 77-78 raw="2"
        Literal 80-81 raw="3"
  VariableDeclaration 83-124 kind=const
    VariableDeclarator 89-124
      ObjectPattern 89-113
        Property 91-92 kind=init shorthand=true
          Identifier 91-92 name="f"
          Identifier 91-92 name="f"
        Property 94-98 kind=init
          Identifier 94-95 name="g"
          Identifier 97-98 name="h"
        Property 100-105 kind=init shorthand=true
          Identifier 100-101 name="i"
          AssignmentPattern 100-105
            Identifier 100-101 name="i"
            Literal 104-105 raw="3"
        RestElement 107-111
          Identifier 110-111 name="j"
      ObjectExpression 116-124
        Property 118-122 kind=init
          Identifier 118-119 name="f"
          Literal 121-122 raw="1"
  VariableDeclaration 125-161 kind=const
    VariableDeclarator 131-161
      ArrayPattern 131-143
        ObjectPattern 132-137
          Property 134-135 kind=init shorthand=true
            Identifier 134-135 name="k"
            Identifier 134-135 name="k"
        ArrayPattern 139-142
          Identifier 140-141 name="l"
      ArrayExpression 146-161
        ObjectExpression 147-155
          Property 149-153 kind=init
            Identifier 149-150 name="k"
            Literal 152-153 raw="1"
        ArrayExpression 157-160
          Literal 158-159 raw="2"
  LabeledStatement 162-275
    Identifier 162-167 name="label"
    ForStatement 169-275
      VariableDeclaration 174-183 kind=let
        VariableDeclarator 178-183
          Identifier 178-179 name="m"
          Literal 182-183 raw="0"
      BinaryExpression 185-190 operator="<"
        Identifier 185-186 name="m"
        Literal 189-190 raw="3"
      UpdateExpression 192-195 operator="++"
        Identifier 192-193 name="m"
      BlockStatement 197-275
        IfStatement 201-273
          BinaryExpression 205-212 operator="==="
            Identifier 205-206 name="m"
            Literal 211-212 raw="1"
          ContinueStatement 214-228
            Identifier 223-228 name="label"
          IfStatement 236-273
            BinaryExpression 240-247 operator="==="
              Identifier 240-241 name="m"
              Literal 246-247 raw="2"
            BreakStatement 249-260
              Identifier 255-260 name="label"
            BlockStatement 268-273
  ForStatement 276-290
    BreakStatement 285-290
  ForInStatement 291-312
    VariableDeclaration 296-301 kind=var
      VariableDeclarator 300-301
        Identifier 300-301 name="n"
    ObjectExpression 305-307
    BlockStatement 309-312
  ForOfStatement 313-335
    VariableDeclaration 318-325 kind=const
      VariableDeclarator 324-325
        Identifier 324-325 name="o"
    ArrayExpression 329-332
      Literal 330-331 raw="1"
    ExpressionStatement 334-335
      Identifier 334-335 name="o"
  ForOfStatement 336-363 await=true
    VariableDeclaration 347-354 kind=const
      VariableDeclarator 353-354
        Identifier 353-354 name="q"
    ArrayExpression 358-360
    ExpressionStatement 362-363
      Identifier 362-363 name="q"
  ForStatement 364-389
    AssignmentExpression 369-374 operator="="
      Identifier 369-370 name="a"
      Literal 373-374 raw="0"
    BinaryExpression 376-381 operator="<"
      Identifier 376-377 name="a"
      Literal 380-381 raw="1"
    UpdateExpression 383-386 operator="++"
      Identifier 383-384 name="a"
    ExpressionStatement 388-389
      Identifier 388-389 name="a"
  ForOfStatement 390-414
    VariableDeclaration 395-402 kind=let
      VariableDeclarator 399-402
        ArrayPattern 399-402
          Identifier 400-401 name="r"
    ArrayExpression 406-411
      ArrayExpression 407-410
        Literal 408-409 raw="1"
    ExpressionStatement 413-414
      Identifier 413-414 name="r"
  ForStatement 415-435
    BlockStatement 424-435
      BreakStatement 428-433
  WhileStatement 436-452
    Literal 443-448 raw="false"
    BlockStatement 450-452
  DoWhileStatement 453-473
    ExpressionStatement 456-459
      UpdateExpression 456-459 operator="++"
        Identifier 456-457 name="a"
    Literal 467-472 raw="false"
  DoWhileStatement 474-494
    BlockStatement 477-479
    Literal 487-492 raw="false"
  SwitchStatement 495-566
    Identifier 503-504 name="a"
    SwitchCase 510-517
      Literal 515-516 raw="1"
    SwitchCase 520-543
      Literal 525-526 raw="2"
      BlockStatement 528-543
        BreakStatement 534-539
    SwitchCase 546-564
      ExpressionStatement 559-564
        AssignmentExpression 559-564 operator="="
          Identifier 559-560 name="a"
          Literal 563-564 raw="3"
  TryStatement 567-619
    BlockStatement 571-597
      ThrowStatement 575-595
        NewExpression 581-595
          Identifier 585-590 name="Error"
          Literal 591-594 raw="'x'"
    CatchClause 598-607
      BlockStatement 604-607
    BlockStatement 616-619
  TryStatement 620-653
    BlockStatement 624-627
    CatchClause 628-653
      Identifier 635-640 name="error"
      BlockStatement 642-653
        ExpressionStatement 646-651
          Identifier 646-651 name="error"
  TryStatement 654-695
    BlockStatement 658-661
    CatchClause 662-695
      ObjectPattern 669-680
        Property 671-678 kind=init shorthand=true
          Identifier 671-678 name="message"
          Identifier 671-678 name="message"
      BlockStatement 682-695
        ExpressionStatement 686-693
          Identifier 686-693 name="message"
  DebuggerStatement 696-705
  EmptyStatement 706-707
  IfStatement 708-723
    Identifier 712-713 name="a"
    ExpressionStatement 715-716
      Identifier 715-716 name="a"
    ExpressionStatement 722-723
      Identifier 722-723 name="b"
  FunctionDeclaration 724-775
    Identifier 733-741 name="declared"
    Identifier 742-743 name="x"
    AssignmentPattern 745-750
      Identifier 745-746 name="y"
      Literal 749-750 raw="1"
    RestElement 752-759
      Identifier 755-759 name="rest"
    BlockStatement 761-775
      ReturnStatement 765-773
        Identifier 772-773 name="x"
  FunctionDeclaration 776-862 generator=true
    Identifier 786-795 name="generator"
    BlockStatement 798-862
      ExpressionStatement 802-807
        YieldExpression 802-807
      ExpressionStatement 810-817
        YieldExpression 810-817
          Literal 816-817 raw="1"
      ExpressionStatement 820-838
        YieldExpression 820-838 delegate=true
          CallExpression 827-838
            Identifier 827-836 name="generator"
      VariableDeclaration 841-860 kind=const
        VariableDeclarator 847-860
          Identifier 847-852 name="inner"
          YieldExpression 855-860
  FunctionDeclaration 863-936 async=true
    Identifier 878-890 name="asynchronous"
    BlockStatement 893-936
      ExpressionStatement 897-904
        AwaitExpression 897-904
          Identifier 903-904 name="a"
      ForOfStatement 907-934 await=true
        VariableDeclaration 918-925 kind=const
          VariableDeclarator 924-925
            Identifier 924-925 name="s"
        ArrayExpression 929-931
        ExpressionStatement 933-934
          Identifier 933-934 name="s"
  FunctionDeclaration 937-979 async=true generator=true
    Identifier 953-957 name="both"
    BlockStatement 960-979
      ExpressionStatement 964-977
        YieldExpression 964-977
          AwaitExpression 970-977
            Literal 976-977 raw="1"
  FunctionDeclaration 980-1011
    Identifier 989-996 name="hoisted"
    BlockStatement 999-1011
      ReturnStatement 1003-1009
  FunctionDeclaration 1012-1065
    Identifier 1021-1029 name="withThis"
    Identifier 1030-1042 name="this"
      TSTypeAnnotation 1034-1042
        TSTypeReference 1036-1042
          Identifier 1036-1042 name="Window"
    Identifier 1044-1055 name="arg"
      TSTypeAnnotation 1047-1055
        TSNumberKeyword 1049-1055
    TSTypeAnnotation 1056-1062
      TSVoidKeyword 1058-1062
    BlockStatement 1063-1065
  TSDeclareFunction 1066-1102
    Identifier 1075-1083 name="overload"
    Identifier 1084-1093 name="x"
      TSTypeAnnotation 1085-1093
        TSNumberKeyword 1087-1093
    TSTypeAnnotation 1094-1102
      TSNumberKeyword 1096-1102
  TSDeclareFunction 1103-1139
    Identifier 1112-1120 name="overload"
    Identifier 1121-1130 name="x"
      TSTypeAnnotation 1122-1130
        TSStringKeyword 1124-1130
    TSTypeAnnotation 1131-1139
      TSStringKeyword 1133-1139
  FunctionDeclaration 1140-1209
    Identifier 1149-1157 name="overload"
    Identifier 1158-1176 name="x"
      TSTypeAnnotation 1159-1176
        TSUnionType 1161-1176
          TSNumberKeyword 1161-1167
          TSStringKeyword 1170-1176
    TSTypeAnnotation 1177-1194
      TSUnionType 1179-1194
        TSNumberKeyword 1179-1185
        TSStringKeyword 1188-1194
    BlockStatement 1195-1209
      ReturnStatement 1199-1207
        Identifier 1206-1207 name="x"
  LabeledStatement 1210-1227
    Identifier 1210-1215 name="outer"
    LabeledStatement 1217-1227
      Identifier 1217-1222 name="inner"
      ExpressionStatement 1224-1227
        UpdateExpression 1224-1227 operator="++"
          Identifier 1224-1225 name="a"
  ExpressionStatement 1228-1241
    AssignmentExpression 1228-1241 operator="="
      Identifier 1228-1229 name="a"
      ConditionalExpression 1232-1241
        Identifier 1232-1233 name="b"
        Identifier 1236-1237 name="c"
        Identifier 1240-1241 name="d"
  IfStatement 1242-1268
    Identifier 1246-1247 name="a"
    BlockStatement 1249-1252
    IfStatement 1258-1268
      Identifier 1262-1263 name="b"
      BlockStatement 1265-1268
  VariableDeclaration 1269-1295 kind=using
    VariableDeclarator 1275-1295
      Identifier 1275-1283 name="resource"
      CallExpression 1286-1295
        Identifier 1286-1293 name="acquire"
  VariableDeclaration 1296-1338 kind=await using
    VariableDeclarator 1308-1338
      Identifier 1308-1321 name="asyncResource"
      CallExpression 1324-1338
        Identifier 1324-1336 name="acquireAsync"
  ForOfStatement 1339-1362
    ArrayPattern 1344-1350
      Identifier 1345-1346 name="t"
      Identifier 1348-1349 name="u"
    Identifier 1354-1359 name="pairs"
    ExpressionStatement 1361-1362
      Identifier 1361-1362 name="t"
  ForOfStatement 1363-1387
    ObjectPattern 1368-1373
      Property 1370-1371 kind=init shorthand=true
        Identifier 1370-1371 name="v"
        Identifier 1370-1371 name="v"
    Identifier 1377-1384 name="objects"
    ExpressionStatement 1386-1387
      Identifier 1386-1387 name="v"
  ForStatement 1388-1412
    VariableDeclaration 1393-1401 kind=var
      VariableDeclarator 1397-1398
        Identifier 1397-1398 name="w"
      VariableDeclarator 1400-1401
        Identifier 1400-1401 name="x"
    BreakStatement 1407-1412
  ForOfStatement 1413-1440
    VariableDeclaration 1418-1431 kind=await using
      VariableDeclarator 1430-1431
        Identifier 1430-1431 name="y"
    ArrayExpression 1435-1437
    ExpressionStatement 1439-1440
      Identifier 1439-1440 name="y"
  VariableDeclaration 1441-1488 kind=const
    VariableDeclarator 1447-1488
      Identifier 1447-1460 name="asyncInstance"
      BinaryExpression 1463-1488 operator="instanceof"
        Identifier 1463-1468 name="async"
        Identifier 1480-1488 name="Function"
  ClassDeclaration 1489-1565
    Identifier 1495-1498 name="Sub"
    Identifier 1507-1511 name="Base"
    ClassBody 1512-1565
      MethodDefinition 1516-1563 kind=method
        Identifier 1516-1520 name="make"
        FunctionExpression 1520-1563
          BlockStatement 1523-1563
            ReturnStatement 1529-1559
              NewExpression 1536-1559
                MemberExpression 1540-1557
                  Super 1540-1545
                  Identifier 1546-1557 name="constructor"
  VariableDeclaration 1566-1604 kind=const
    VariableDeclarator 1572-1604
      Identifier 1572-1585 name="optionalTyped"
      ChainExpression 1588-1604
        CallExpression 1588-1604 optional=true
          Identifier 1588-1591 name="obj"
          TSTypeParameterInstantiation 1593-1601
            TSStringKeyword 1594-1600
          Identifier 1602-1603 name="a"
  ClassDeclaration 1605-1669
    Decorator 1605-1628
      CallExpression 1607-1627
        MemberExpression 1607-1625
          Identifier 1607-1617 name="decorators"
          Identifier 1618-1625 name="factory"
    Decorator 1629-1642
      MemberExpression 1630-1642
        Identifier 1630-1635 name="plain"
        Identifier 1636-1642 name="member"
    Identifier 1649-1666 name="DecoratedWithCall"
    ClassBody 1667-1669
  EmptyStatement 1670-1671
  ExpressionStatement 1671-1691
    AssignmentExpression 1671-1689 operator="="
      ArrayPattern 1671-1680
        RestElement 1672-1679
          Identifier 1675-1679 name="rest"
      Identifier 1683-1689 name="source"
  ExpressionStatement 1691-1721
    AssignmentExpression 1691-1719 operator="="
      ArrayPattern 1691-1710
        AssignmentPattern 1692-1697
          Identifier 1692-1693 name="a"
          Literal 1696-1697 raw="1"
        ArrayPattern 1699-1702
          Identifier 1700-1701 name="b"
        ObjectPattern 1704-1709
          Property 1706-1707 kind=init shorthand=true
            Identifier 1706-1707 name="c"
            Identifier 1706-1707 name="c"
      Identifier 1713-1719 name="source"
  ExpressionStatement 1721-1755
    AssignmentExpression 1722-1752 operator="="
      ObjectPattern 1722-1743
        Property 1724-1729 kind=init shorthand=true
          Identifier 1724-1725 name="d"
          AssignmentPattern 1724-1729
            Identifier 1724-1725 name="d"
            Literal 1728-1729 raw="2"
        Property 1731-1741 kind=init
          Identifier 1731-1732 name="e"
          ArrayPattern 1734-1741
            AssignmentPattern 1735-1740
              Identifier 1735-1736 name="f"
              Literal 1739-1740 raw="3"
      Identifier 1746-1752 name="source"
  ExpressionStatement 1755-1772
    AssignmentExpression 1755-1770 operator="+="
      TSAsExpression 1756-1764
        Identifier 1756-1757 name="a"
        TSAnyKeyword 1761-1764
      Literal 1769-1770 raw="1"
  ExpressionStatement 1772-1781
    AssignmentExpression 1772-1781 operator="-="
      TSNonNullExpression 1773-1775
        Identifier 1773-1774 name="b"
      Literal 1780-1781 raw="1"
  ExpressionStatement 1782-1795
    AwaitExpression 1782-1795
      Identifier 1788-1795 name="promise"
  ExpressionStatement 1796-1813
    AwaitExpression 1796-1811
      Identifier 1803-1810 name="promise"
  ExpressionStatement 1813-1841
    AssignmentExpression 1814-1840 operator="="
      ObjectPattern 1814-1831
        RestElement 1816-1829
          Identifier 1819-1829 name="everything"
      Identifier 1834-1840 name="source"
  ForOfStatement 1842-1866
    Identifier 1847-1851 name="item"
    Identifier 1855-1860 name="items"
    ExpressionStatement 1862-1866
      Identifier 1862-1866 name="item"
  ForInStatement 1867-1895
    MemberExpression 1872-1880
      Identifier 1872-1875 name="obj"
      Identifier 1876-1880 name="prop"
    Identifier 1884-1890 name="source"
    BlockStatement 1892-1895
  ExpressionStatement 1896-1910
    AwaitExpression 1896-1910
      Identifier 1902-1910 name="promise2"
`,
}
