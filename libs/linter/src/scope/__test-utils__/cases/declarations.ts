/**
 * The `declarations.ts` source the scope specs read, and the scopes the reference scope manager finds in it.
 *
 * @module scope/__test-utils__/cases/declarations
 */

export const DECLARATIONS = {
  name: 'declarations.ts',
  source: `import def, { named, type TypeOnly, other as aliased } from 'mod'
import * as ns from 'mod'
import type { T1 } from 'mod'
import eq = ns.inner.thing
import ext = require('mod')
export { named, type TypeOnly }
export type { T1 }
export { other } from 'mod'
export * from 'mod'
export default aliased
function decl(this: Window, p1, p2 = p1, { d1, d2 = d1 }: Opts, ...restParams: number[]): void {
  var inner
  decl()
}
function overload(x: string): void
function overload(x: number): void
function overload(x: unknown) {}
const expr = function named(q = named) {
  return named
}
const anon = function () {
  return arguments
}
const arrow = (p) => p
const arrowBody = (p) => {
  return p
}
@dec
class Decorated<T> extends Base<T> implements Iface {
  @prop field = this.other
  static staticField = Decorated
  declare declared: number
  accessor acc = 1;
  [computed] = 2
  constructor(@paramDec private readonly param: number, @paramDec other = param) {
    super()
  }
  @methodDec
  method<U>(this: Decorated<T>, @paramDec arg: U): U {
    return arg
  }
  static {
    Decorated.staticField
  }
  [index: string]: unknown
  get getter() {
    return 1
  }
  set setter(v) {}
  async *gen() {}
  [computedMethod]() {}
  signature(x: string): void
  signature(x: number): void
  signature(x: unknown) {}
  #priv = 1
  #privMethod() {
    return this.#priv
  }
}
abstract class Abs {
  abstract absMethod(): void
  abstract absProp: number
}
const classExpr = class Named {
  static x = Named
}
const anonClass = class {}
enum Color {
  Red,
  Green = Red + 1,
  'Blue' = Green,
}
declare enum Ambient {
  A,
}
namespace NS {
  export const inside = 1
  namespace Inner {
    const deep = inside
  }
}
declare module 'quoted' {
  const q: number
}
declare global {
  interface Window {
    extra: number
  }
}
interface Iface<T> extends Base<T>, Other.Nested {
  prop: T
  method(): void
}
interface Plain {
  x: number
}
type Alias<T> = T | Plain
type PlainAlias = string
export as namespace Lib
`,
  scopes: `S0 global Program 0-2000 up=- strict=0
S1 module Program 0-2000 up=0 strict=1
  V def defs=ImportBinding@7 ids=7 t=1 v=1 refs=
  V named defs=ImportBinding@14 ids=14 t=1 v=1 refs=186
  V TypeOnly defs=ImportBinding@26 ids=26 t=1 v=1 refs=198
  V aliased defs=ImportBinding@45 ids=45 t=1 v=1 refs=291
  V ns defs=ImportBinding@78 ids=78 t=1 v=1 refs=134
  V T1 defs=ImportBinding@106 ids=106 t=1 v=1 refs=223
  V eq defs=ImportBinding@129 ids=129 t=1 v=1 refs=
  V ext defs=ImportBinding@156 ids=156 t=1 v=1 refs=
  V decl defs=FunctionName@308 ids=308 t=0 v=1 refs=410
  V overload defs=FunctionName@428,FunctionName@463,FunctionName@498 ids=428,463,498 t=0 v=1 refs=
  V expr defs=Variable@528 ids=528 t=0 v=1 refs=528
  V anon defs=Variable@586 ids=586 t=0 v=1 refs=586
  V arrow defs=Variable@634 ids=634 t=0 v=1 refs=634
  V arrowBody defs=Variable@657 ids=657 t=0 v=1 refs=657
  V Decorated defs=ClassName@702 ids=702 t=1 v=1 refs=
  V Abs defs=ClassName@1381 ids=1381 t=1 v=1 refs=
  V classExpr defs=Variable@1451 ids=1451 t=0 v=1 refs=1451
  V anonClass defs=Variable@1504 ids=1504 t=0 v=1 refs=1504
  V Color defs=TSEnumName@1530 ids=1530 t=1 v=1 refs=
  V Ambient defs=TSEnumName@1597 ids=1597 t=1 v=1 refs=
  V NS defs=TSModuleName@1624 ids=1624 t=1 v=1 refs=
  V Iface defs=Type@1823 ids=1823 t=1 v=0 refs=742
  V Plain defs=Type@1903 ids=1903 t=1 v=0 refs=1945
  V Alias defs=Type@1930 ids=1930 t=1 v=0 refs=
  V PlainAlias defs=Type@1956 ids=1956 t=1 v=0 refs=
  R 134 ns r v init=0 we=- => S1:ns
  R 186 named r vt init=0 we=- => S1:named
  R 198 TypeOnly r t init=0 we=- => S1:TypeOnly
  R 223 T1 r t init=0 we=- => S1:T1
  R 291 aliased r vt init=0 we=- => S1:aliased
  R 528 expr w v init=1 we=535 => S1:expr
  R 586 anon w v init=1 we=593 => S1:anon
  R 634 arrow w v init=1 we=642 => S1:arrow
  R 657 arrowBody w v init=1 we=669 => S1:arrowBody
  R 692 dec r v init=0 we=- => ext
  R 1451 classExpr w v init=1 we=1463 => S1:classExpr
  R 1504 anonClass w v init=1 we=1516 => S1:anonClass
  R 1996 Lib r v init=0 we=- => ext
  T 319,357,692,723,753,860,889,931,1019,976,1202,1840,1849,1996
S2 function FunctionDeclaration 299-418 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V this defs=Parameter@313 ids=313 t=0 v=1 refs=
  V p1 defs=Parameter@327 ids=327 t=0 v=1 refs=336
  V p2 defs=Parameter@331 ids=331 t=0 v=1 refs=331
  V d1 defs=Parameter@342 ids=342 t=0 v=1 refs=351
  V d2 defs=Parameter@346 ids=346 t=0 v=1 refs=346
  V restParams defs=Parameter@366 ids=366 t=0 v=1 refs=
  V inner defs=Variable@402 ids=402 t=0 v=1 refs=
  R 319 Window r t init=0 we=- => ext
  R 331 p2 w v init=1 we=336 => S2:p2
  R 336 p1 r v init=0 we=- => S2:p1
  R 346 d2 w v init=1 we=351 => S2:d2
  R 351 d1 r v init=0 we=- => S2:d1
  R 357 Opts r t init=0 we=- => ext
  R 410 decl r v init=0 we=- => S1:decl
  T 319,357,410
S3 function TSDeclareFunction 419-453 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V x defs=Parameter@437 ids=437 t=0 v=1 refs=
  T\x20
S4 function TSDeclareFunction 454-488 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V x defs=Parameter@472 ids=472 t=0 v=1 refs=
  T\x20
S5 function FunctionDeclaration 489-521 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V x defs=Parameter@507 ids=507 t=0 v=1 refs=
  T\x20
S6 function-expression-name FunctionExpression 535-579 up=1 strict=1
  V named defs=FunctionName@544 ids=544 t=0 v=1 refs=554,572
  T\x20
S7 function FunctionExpression 535-579 up=6 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V q defs=Parameter@550 ids=550 t=0 v=1 refs=550
  R 550 q w v init=1 we=554 => S7:q
  R 554 named r v init=0 we=- => S6:named
  R 572 named r v init=0 we=- => S6:named
  T 554,572
S8 function FunctionExpression 593-627 up=1 strict=1
  V arguments defs= ids= t=1 v=1 refs=616
  R 616 arguments r v init=0 we=- => ext
  T\x20
S9 function ArrowFunctionExpression 642-650 up=1 strict=1
  V p defs=Parameter@643 ids=643 t=0 v=1 refs=649
  R 649 p r v init=0 we=- => S9:p
  T\x20
S10 function ArrowFunctionExpression 669-690 up=1 strict=1
  V p defs=Parameter@670 ids=670 t=0 v=1 refs=687
  R 687 p r v init=0 we=- => S10:p
  T\x20
S11 class ClassDeclaration 691-1365 up=1 strict=1
  V Decorated defs=ClassName@702 ids=702 t=1 v=1 refs=800,1004,1075
  V T defs=Type@712 ids=712 t=1 v=0 refs=728,1014
  R 723 Base r v init=0 we=- => ext
  R 728 T r t init=0 we=- => S11:T
  R 742 Iface r t init=0 we=- => S1:Iface
  R 753 prop r v init=0 we=- => ext
  R 860 computed r v init=0 we=- => ext
  R 889 paramDec r v init=0 we=- => ext
  R 931 paramDec r v init=0 we=- => ext
  R 1019 paramDec r v init=0 we=- => ext
  R 976 methodDec r v init=0 we=- => ext
  R 1202 computedMethod r v init=0 we=- => ext
  T 723,742,753,860,889,931,1019,976,1202
S12 class-field-initializer MemberExpression 766-776 up=11 strict=1
  T\x20
S13 class-field-initializer Identifier 800-809 up=11 strict=1
  R 800 Decorated r v init=0 we=- => S11:Decorated
  T 800
S14 class-field-initializer Literal 854-855 up=11 strict=1
  T\x20
S15 class-field-initializer Literal 872-873 up=11 strict=1
  T\x20
S16 function FunctionExpression 887-972 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V param defs=Parameter@915 ids=915 t=0 v=1 refs=948
  V other defs=Parameter@940 ids=940 t=0 v=1 refs=940
  R 940 other w v init=1 we=948 => S16:other
  R 948 param r v init=0 we=- => S16:param
  T\x20
S17 function FunctionExpression 994-1059 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V this defs=Parameter@998 ids=998 t=0 v=1 refs=
  V arg defs=Parameter@1028 ids=1028 t=0 v=1 refs=1052
  V U defs=Type@995 ids=995 t=1 v=0 refs=1033,1037
  R 1004 Decorated r t init=0 we=- => S11:Decorated
  R 1014 T r t init=0 we=- => S11:T
  R 1033 U r t init=0 we=- => S17:U
  R 1037 U r t init=0 we=- => S17:U
  R 1052 arg r v init=0 we=- => S17:arg
  T 1004,1014
S18 class-static-block StaticBlock 1062-1100 up=11 strict=1
  R 1075 Decorated r v init=0 we=- => S11:Decorated
  T 1075
S19 function FunctionExpression 1140-1161 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
S20 function FunctionExpression 1174-1180 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V v defs=Parameter@1175 ids=1175 t=0 v=1 refs=
  T\x20
S21 function FunctionExpression 1193-1198 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
S22 function FunctionExpression 1217-1222 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
S23 function TSEmptyBodyFunctionExpression 1234-1251 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V x defs=Parameter@1235 ids=1235 t=0 v=1 refs=
  T\x20
S24 function TSEmptyBodyFunctionExpression 1263-1280 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V x defs=Parameter@1264 ids=1264 t=0 v=1 refs=
  T\x20
S25 function FunctionExpression 1292-1307 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  V x defs=Parameter@1293 ids=1293 t=0 v=1 refs=
  T\x20
S26 class-field-initializer Literal 1318-1319 up=11 strict=1
  T\x20
S27 function FunctionExpression 1333-1363 up=11 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
S28 class ClassDeclaration 1366-1444 up=1 strict=1
  V Abs defs=ClassName@1381 ids=1381 t=1 v=1 refs=
  T\x20
S29 function TSEmptyBodyFunctionExpression 1407-1415 up=28 strict=1
  V arguments defs= ids= t=1 v=1 refs=
  T\x20
S30 class ClassExpression 1463-1497 up=1 strict=1
  V Named defs=ClassName@1469 ids=1469 t=1 v=1 refs=1490
  T\x20
S31 class-field-initializer Identifier 1490-1495 up=30 strict=1
  R 1490 Named r v init=0 we=- => S30:Named
  T 1490
S32 class ClassExpression 1516-1524 up=1 strict=1
  T\x20
S33 tsEnum TSEnumDeclaration 1525-1583 up=1 strict=1
  V Red defs=TSEnumMemberName@1540 ids=1540 t=1 v=1 refs=1555
  V Green defs=TSEnumMemberName@1547 ids=1547 t=1 v=1 refs=1575
  V Blue defs=TSEnumMemberName@1566 ids= t=1 v=1 refs=
  R 1555 Red r v init=0 we=- => S33:Red
  R 1575 Green r v init=0 we=- => S33:Green
  T\x20
S34 tsEnum TSEnumDeclaration 1584-1613 up=1 strict=1
  V A defs=TSEnumMemberName@1609 ids=1609 t=1 v=1 refs=
  T\x20
S35 tsModule TSModuleDeclaration 1614-1704 up=1 strict=1
  V inside defs=Variable@1644 ids=1644 t=0 v=1 refs=1644,1692
  V Inner defs=TSModuleName@1667 ids=1667 t=1 v=1 refs=
  R 1644 inside w v init=1 we=1653 => S35:inside
  T\x20
S36 tsModule TSModuleDeclaration 1657-1702 up=35 strict=1
  V deep defs=Variable@1685 ids=1685 t=0 v=1 refs=1685
  R 1685 deep w v init=1 we=1692 => S36:deep
  R 1692 inside r v init=0 we=- => S35:inside
  T 1692
S37 tsModule TSModuleDeclaration 1705-1750 up=1 strict=1
  V q defs=Variable@1739 ids=1739 t=0 v=1 refs=
  T\x20
S38 tsModule TSModuleDeclaration 1751-1812 up=1 strict=1
  V Window defs=Type@1780 ids=1780 t=1 v=0 refs=
  T\x20
S39 type TSInterfaceDeclaration 1813-1892 up=1 strict=1
  V T defs=Type@1829 ids=1829 t=1 v=0 refs=1845,1872
  R 1840 Base r t init=0 we=- => ext
  R 1845 T r t init=0 we=- => S39:T
  R 1849 Other r t init=0 we=- => ext
  R 1872 T r t init=0 we=- => S39:T
  T 1840,1849
S40 functionType TSMethodSignature 1876-1890 up=39 strict=1
  T\x20
S41 type TSTypeAliasDeclaration 1925-1950 up=1 strict=1
  V T defs=Type@1936 ids=1936 t=1 v=0 refs=1941
  R 1941 T r t init=0 we=- => S41:T
  R 1945 Plain r t init=0 we=- => S1:Plain
  T 1945
`,
}
