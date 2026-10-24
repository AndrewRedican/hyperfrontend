/**
 * The `classes.ts` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/classes
 */

export const CLASSES = {
  name: 'classes.ts',
  source: `@component({ selector: 'x' })
@sealed
export class Decorated<T extends object = {}> extends Base<T> implements First, Second<T> {
  static staticField = 1
  readonly readonlyField: string = 'x'
  declare declared: number
  definite!: number
  optional?: string
  private privateField
  protected protectedField
  public publicField
  override overridden = 2
  accessor auto = 3
  static accessor staticAuto = 4
  #secret = 5
  static #staticSecret = 6
  'quoted' = 7
  42 = 8
  [computed] = 9
  @log method(@param a: string, b?: number, ...c: string[]): void {}
  async asyncMethod() {}
  *generatorMethod() {}
  async *bothMethod() {}
  static staticMethod() {}
  get accessor() {
    return 1
  }
  set accessor(value) {}
  static get staticGetter() {
    return 1
  }
  #privateMethod() {}
  get #privateGetter() {
    return 1
  }
  override overriddenMethod() {}
  overloaded(x: number): void
  overloaded(x: string): void
  overloaded(x: number | string): void {}
  constructor(public readonly a: string, protected b: number, private c?: boolean, override d = 1) {
    super()
  }
  [Symbol.iterator]() {}
  static {
    Decorated.staticField = 2
  }
  static;
  get;
  set;
  async;
  declare;
  readonly;
  [key: string]: unknown
  static [key: number]: string
  public static readonly combined = 1
}
export abstract class Abstract {
  abstract abstractMethod(): void
  abstract abstractProperty: string
  protected abstract get abstractGetter(): string
  concrete() {}
}
declare class Ambient {
  field: string
  method(): void
}
class Minimal {}
const expression = class Named extends (a ? B : C) {}
class Generic<const T, in U, out V, W = string> {}
class Semicolons {
  a = 1;
  b() {};
  c
}
class UsesThis {
  method(this: UsesThis) {}
  untyped(this) {}
  modifierNames(readonly, public = 1) {}
  public
  pub = 1;
  ['quoted key'] = 2;
  [noType: string]
  @dec(...args, 1) decoratedWithSpread() {}
  generic<T>(value: T) {}
  static
  separated = 1
}
`,
  tree: `Program 0-1968 sourceType="module"
  ExportNamedDeclaration 38-1308 exportKind="value"
    ClassDeclaration 45-1308
      Decorator 0-29
        CallExpression 1-29
          Identifier 1-10 name="component"
          ObjectExpression 11-28
            Property 13-26 kind=init
              Identifier 13-21 name="selector"
              Literal 23-26 raw="'x'"
      Decorator 30-37
        Identifier 31-37 name="sealed"
      Identifier 51-60 name="Decorated"
      TSTypeParameterDeclaration 60-83
        TSTypeParameter 61-82
          Identifier 61-62 name="T"
          TSObjectKeyword 71-77
          TSTypeLiteral 80-82
      Identifier 92-96 name="Base"
      TSTypeParameterInstantiation 96-99
        TSTypeReference 97-98
          Identifier 97-98 name="T"
      TSClassImplements 111-116
        Identifier 111-116 name="First"
      TSClassImplements 118-127
        Identifier 118-124 name="Second"
        TSTypeParameterInstantiation 124-127
          TSTypeReference 125-126
            Identifier 125-126 name="T"
      ClassBody 128-1308
        PropertyDefinition 132-154 static=true
          Identifier 139-150 name="staticField"
          Literal 153-154 raw="1"
        PropertyDefinition 157-193 readonly=true
          Identifier 166-179 name="readonlyField"
          TSTypeAnnotation 179-187
            TSStringKeyword 181-187
          Literal 190-193 raw="'x'"
        PropertyDefinition 196-220 declare=true
          Identifier 204-212 name="declared"
          TSTypeAnnotation 212-220
            TSNumberKeyword 214-220
        PropertyDefinition 223-240 definite=true
          Identifier 223-231 name="definite"
          TSTypeAnnotation 232-240
            TSNumberKeyword 234-240
        PropertyDefinition 243-260 optional=true
          Identifier 243-251 name="optional"
          TSTypeAnnotation 252-260
            TSStringKeyword 254-260
        PropertyDefinition 263-283 accessibility="private"
          Identifier 271-283 name="privateField"
        PropertyDefinition 286-310 accessibility="protected"
          Identifier 296-310 name="protectedField"
        PropertyDefinition 313-331 accessibility="public"
          Identifier 320-331 name="publicField"
        PropertyDefinition 334-357 override=true
          Identifier 343-353 name="overridden"
          Literal 356-357 raw="2"
        AccessorProperty 360-377
          Identifier 369-373 name="auto"
          Literal 376-377 raw="3"
        AccessorProperty 380-410 static=true
          Identifier 396-406 name="staticAuto"
          Literal 409-410 raw="4"
        PropertyDefinition 413-424
          PrivateIdentifier 413-420 name="secret"
          Literal 423-424 raw="5"
        PropertyDefinition 427-451 static=true
          PrivateIdentifier 434-447 name="staticSecret"
          Literal 450-451 raw="6"
        PropertyDefinition 454-466
          Literal 454-462 raw="'quoted'"
          Literal 465-466 raw="7"
        PropertyDefinition 469-492
          Literal 469-471 raw="42"
          AssignmentExpression 474-492 operator="="
            MemberExpression 474-488 computed=true
              Literal 474-475 raw="8"
              Identifier 479-487 name="computed"
            Literal 491-492 raw="9"
        MethodDefinition 495-561 kind=method
          Decorator 495-499
            Identifier 496-499 name="log"
          Identifier 500-506 name="method"
          FunctionExpression 506-561
            Identifier 514-523 name="a"
              Decorator 507-513
                Identifier 508-513 name="param"
              TSTypeAnnotation 515-523
                TSStringKeyword 517-523
            Identifier 525-535 name="b" optional=true
              TSTypeAnnotation 527-535
                TSNumberKeyword 529-535
            RestElement 537-551
              Identifier 540-541 name="c"
              TSTypeAnnotation 541-551
                TSArrayType 543-551
                  TSStringKeyword 543-549
            TSTypeAnnotation 552-558
              TSVoidKeyword 554-558
            BlockStatement 559-561
        MethodDefinition 564-586 kind=method
          Identifier 570-581 name="asyncMethod"
          FunctionExpression 581-586 async=true
            BlockStatement 584-586
        MethodDefinition 589-610 kind=method
          Identifier 590-605 name="generatorMethod"
          FunctionExpression 605-610 generator=true
            BlockStatement 608-610
        MethodDefinition 613-635 kind=method
          Identifier 620-630 name="bothMethod"
          FunctionExpression 630-635 async=true generator=true
            BlockStatement 633-635
        MethodDefinition 638-662 kind=method static=true
          Identifier 645-657 name="staticMethod"
          FunctionExpression 657-662
            BlockStatement 660-662
        MethodDefinition 665-698 kind=get
          Identifier 669-677 name="accessor"
          FunctionExpression 677-698
            BlockStatement 680-698
              ReturnStatement 686-694
                Literal 693-694 raw="1"
        MethodDefinition 701-723 kind=set
          Identifier 705-713 name="accessor"
          FunctionExpression 713-723
            Identifier 714-719 name="value"
            BlockStatement 721-723
        MethodDefinition 726-770 kind=get static=true
          Identifier 737-749 name="staticGetter"
          FunctionExpression 749-770
            BlockStatement 752-770
              ReturnStatement 758-766
                Literal 765-766 raw="1"
        MethodDefinition 773-792 kind=method
          PrivateIdentifier 773-787 name="privateMethod"
          FunctionExpression 787-792
            BlockStatement 790-792
        MethodDefinition 795-834 kind=get
          PrivateIdentifier 799-813 name="privateGetter"
          FunctionExpression 813-834
            BlockStatement 816-834
              ReturnStatement 822-830
                Literal 829-830 raw="1"
        MethodDefinition 837-867 kind=method override=true
          Identifier 846-862 name="overriddenMethod"
          FunctionExpression 862-867
            BlockStatement 865-867
        MethodDefinition 870-897 kind=method
          Identifier 870-880 name="overloaded"
          TSEmptyBodyFunctionExpression 880-897
            Identifier 881-890 name="x"
              TSTypeAnnotation 882-890
                TSNumberKeyword 884-890
            TSTypeAnnotation 891-897
              TSVoidKeyword 893-897
        MethodDefinition 900-927 kind=method
          Identifier 900-910 name="overloaded"
          TSEmptyBodyFunctionExpression 910-927
            Identifier 911-920 name="x"
              TSTypeAnnotation 912-920
                TSStringKeyword 914-920
            TSTypeAnnotation 921-927
              TSVoidKeyword 923-927
        MethodDefinition 930-969 kind=method
          Identifier 930-940 name="overloaded"
          FunctionExpression 940-969
            Identifier 941-959 name="x"
              TSTypeAnnotation 942-959
                TSUnionType 944-959
                  TSNumberKeyword 944-950
                  TSStringKeyword 953-959
            TSTypeAnnotation 960-966
              TSVoidKeyword 962-966
            BlockStatement 967-969
        MethodDefinition 972-1086 kind=constructor
          Identifier 972-983 name="constructor"
          FunctionExpression 983-1086
            TSParameterProperty 984-1009 accessibility="public" readonly=true
              Identifier 1000-1009 name="a"
                TSTypeAnnotation 1001-1009
                  TSStringKeyword 1003-1009
            TSParameterProperty 1011-1030 accessibility="protected"
              Identifier 1021-1030 name="b"
                TSTypeAnnotation 1022-1030
                  TSNumberKeyword 1024-1030
            TSParameterProperty 1032-1051 accessibility="private"
              Identifier 1040-1051 name="c" optional=true
                TSTypeAnnotation 1042-1051
                  TSBooleanKeyword 1044-1051
            TSParameterProperty 1053-1067 override=true
              AssignmentPattern 1062-1067
                Identifier 1062-1063 name="d"
                Literal 1066-1067 raw="1"
            BlockStatement 1069-1086
              ExpressionStatement 1075-1082
                CallExpression 1075-1082
                  Super 1075-1080
        MethodDefinition 1089-1111 kind=method computed=true
          MemberExpression 1090-1105
            Identifier 1090-1096 name="Symbol"
            Identifier 1097-1105 name="iterator"
          FunctionExpression 1106-1111
            BlockStatement 1109-1111
        StaticBlock 1114-1156
          ExpressionStatement 1127-1152
            AssignmentExpression 1127-1152 operator="="
              MemberExpression 1127-1148
                Identifier 1127-1136 name="Decorated"
                Identifier 1137-1148 name="staticField"
              Literal 1151-1152 raw="2"
        PropertyDefinition 1159-1166
          Identifier 1159-1165 name="static"
        PropertyDefinition 1169-1173
          Identifier 1169-1172 name="get"
        PropertyDefinition 1176-1180
          Identifier 1176-1179 name="set"
        PropertyDefinition 1183-1189
          Identifier 1183-1188 name="async"
        PropertyDefinition 1192-1200
          Identifier 1192-1199 name="declare"
        PropertyDefinition 1203-1212
          Identifier 1203-1211 name="readonly"
        TSIndexSignature 1215-1237
          Identifier 1216-1227 name="key"
            TSTypeAnnotation 1219-1227
              TSStringKeyword 1221-1227
          TSTypeAnnotation 1228-1237
            TSUnknownKeyword 1230-1237
        TSIndexSignature 1240-1268 static=true
          Identifier 1248-1259 name="key"
            TSTypeAnnotation 1251-1259
              TSNumberKeyword 1253-1259
          TSTypeAnnotation 1260-1268
            TSStringKeyword 1262-1268
        PropertyDefinition 1271-1306 accessibility="public" static=true readonly=true
          Identifier 1294-1302 name="combined"
          Literal 1305-1306 raw="1"
  ExportNamedDeclaration 1309-1479 exportKind="value"
    ClassDeclaration 1316-1479 abstract=true
      Identifier 1331-1339 name="Abstract"
      ClassBody 1340-1479
        TSAbstractMethodDefinition 1344-1375 kind=method
          Identifier 1353-1367 name="abstractMethod"
          TSEmptyBodyFunctionExpression 1367-1375
            TSTypeAnnotation 1369-1375
              TSVoidKeyword 1371-1375
        TSAbstractPropertyDefinition 1378-1411
          Identifier 1387-1403 name="abstractProperty"
          TSTypeAnnotation 1403-1411
            TSStringKeyword 1405-1411
        TSAbstractMethodDefinition 1414-1461 kind=get accessibility="protected"
          Identifier 1437-1451 name="abstractGetter"
          TSEmptyBodyFunctionExpression 1451-1461
            TSTypeAnnotation 1453-1461
              TSStringKeyword 1455-1461
        MethodDefinition 1464-1477 kind=method
          Identifier 1464-1472 name="concrete"
          FunctionExpression 1472-1477
            BlockStatement 1475-1477
  ClassDeclaration 1480-1538 declare=true
    Identifier 1494-1501 name="Ambient"
    ClassBody 1502-1538
      PropertyDefinition 1506-1519
        Identifier 1506-1511 name="field"
        TSTypeAnnotation 1511-1519
          TSStringKeyword 1513-1519
      MethodDefinition 1522-1536 kind=method
        Identifier 1522-1528 name="method"
        TSEmptyBodyFunctionExpression 1528-1536
          TSTypeAnnotation 1530-1536
            TSVoidKeyword 1532-1536
  ClassDeclaration 1539-1555
    Identifier 1545-1552 name="Minimal"
    ClassBody 1553-1555
  VariableDeclaration 1556-1609 kind=const
    VariableDeclarator 1562-1609
      Identifier 1562-1572 name="expression"
      ClassExpression 1575-1609
        Identifier 1581-1586 name="Named"
        ConditionalExpression 1596-1605
          Identifier 1596-1597 name="a"
          Identifier 1600-1601 name="B"
          Identifier 1604-1605 name="C"
        ClassBody 1607-1609
  ClassDeclaration 1610-1660
    Identifier 1616-1623 name="Generic"
    TSTypeParameterDeclaration 1623-1657
      TSTypeParameter 1624-1631 const=true
        Identifier 1630-1631 name="T"
      TSTypeParameter 1633-1637 in=true
        Identifier 1636-1637 name="U"
      TSTypeParameter 1639-1644 out=true
        Identifier 1643-1644 name="V"
      TSTypeParameter 1646-1656
        Identifier 1646-1647 name="W"
        TSStringKeyword 1650-1656
    ClassBody 1658-1660
  ClassDeclaration 1661-1704
    Identifier 1667-1677 name="Semicolons"
    ClassBody 1678-1704
      PropertyDefinition 1682-1688
        Identifier 1682-1683 name="a"
        Literal 1686-1687 raw="1"
      MethodDefinition 1691-1697 kind=method
        Identifier 1691-1692 name="b"
        FunctionExpression 1692-1697
          BlockStatement 1695-1697
      PropertyDefinition 1701-1702
        Identifier 1701-1702 name="c"
  ClassDeclaration 1705-1967
    Identifier 1711-1719 name="UsesThis"
    ClassBody 1720-1967
      MethodDefinition 1724-1749 kind=method
        Identifier 1724-1730 name="method"
        FunctionExpression 1730-1749
          Identifier 1731-1745 name="this"
            TSTypeAnnotation 1735-1745
              TSTypeReference 1737-1745
                Identifier 1737-1745 name="UsesThis"
          BlockStatement 1747-1749
      MethodDefinition 1752-1768 kind=method
        Identifier 1752-1759 name="untyped"
        FunctionExpression 1759-1768
          Identifier 1760-1764 name="this"
          BlockStatement 1766-1768
      MethodDefinition 1771-1809 kind=method
        Identifier 1771-1784 name="modifierNames"
        FunctionExpression 1784-1809
          Identifier 1785-1793 name="readonly"
          AssignmentPattern 1795-1805
            Identifier 1795-1801 name="public"
            Literal 1804-1805 raw="1"
          BlockStatement 1807-1809
      PropertyDefinition 1812-1818
        Identifier 1812-1818 name="public"
      PropertyDefinition 1821-1829
        Identifier 1821-1824 name="pub"
        Literal 1827-1828 raw="1"
      PropertyDefinition 1832-1851 computed=true
        Literal 1833-1845 raw="'quoted key'"
        Literal 1849-1850 raw="2"
      TSIndexSignature 1854-1870
        Identifier 1855-1869 name="noType"
          TSTypeAnnotation 1861-1869
            TSStringKeyword 1863-1869
      MethodDefinition 1873-1914 kind=method
        Decorator 1873-1889
          CallExpression 1874-1889
            Identifier 1874-1877 name="dec"
            SpreadElement 1878-1885
              Identifier 1881-1885 name="args"
            Literal 1887-1888 raw="1"
        Identifier 1890-1909 name="decoratedWithSpread"
        FunctionExpression 1909-1914
          BlockStatement 1912-1914
      MethodDefinition 1917-1940 kind=method
        Identifier 1917-1924 name="generic"
        FunctionExpression 1924-1940
          TSTypeParameterDeclaration 1924-1927
            TSTypeParameter 1925-1926
              Identifier 1925-1926 name="T"
          Identifier 1928-1936 name="value"
            TSTypeAnnotation 1933-1936
              TSTypeReference 1935-1936
                Identifier 1935-1936 name="T"
          BlockStatement 1938-1940
      PropertyDefinition 1943-1965 static=true
        Identifier 1952-1961 name="separated"
        Literal 1964-1965 raw="1"
`,
}
