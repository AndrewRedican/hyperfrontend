/**
 * The `elements.tsx` source the parser specs read, and the tree the reference parser builds from it.
 *
 * @module code/__test-utils__/cases/elements
 */

export const ELEMENTS = {
  name: 'elements.tsx',
  source: `const simple = <div />
const nested = (
  <section className="wrap" data-id={id} aria-hidden hyphen-ated="x" ns:attr="y" {...spread} multi="a
b">
    text &amp; entities &#65; &#x42; &unknown; more
    {expression}
    {/* a comment only */}
    {}
    <Inner.Member prop={<span>child</span>}>
      <>fragment {inside}</>
    </Inner.Member>
    {...spreadChild}
    {list.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </section>
)
const generic = <T,>(value: T) => value
const typed = <Component<string> prop="x" />
const elementValue = <a attr=<c /> />
const selfClosingChild = <p><br /><img src="x" /></p>
const stringChild = <a>{'text'}</a>
const comparison = a < b
const emptyText = <b></b>
const nestedSameLine = <ul><li>one</li><li>two</li></ul>
const withNewlines = (
  <div>
    <span>a</span>

    <span>b</span>
  </div>
)
const svg = <svg:circle xlink:href="#id" />
const cast = value as number
function Component() {
  return <div>{this}</div>
}
`,
  tree: `Program 0-973 sourceType="module"
  VariableDeclaration 0-22 kind=const
    VariableDeclarator 6-22
      Identifier 6-12 name="simple"
      JSXElement 15-22
        JSXOpeningElement 15-22 selfClosing=true
          JSXIdentifier 16-19 name="div"
  VariableDeclaration 23-445 kind=const
    VariableDeclarator 29-445
      Identifier 29-35 name="nested"
      JSXElement 42-443
        JSXOpeningElement 42-145
          JSXIdentifier 43-50 name="section"
          JSXAttribute 51-67
            JSXIdentifier 51-60 name="className"
            Literal 61-67 raw="\\"wrap\\""
          JSXAttribute 68-80
            JSXIdentifier 68-75 name="data-id"
            JSXExpressionContainer 76-80
              Identifier 77-79 name="id"
          JSXAttribute 81-92
            JSXIdentifier 81-92 name="aria-hidden"
          JSXAttribute 93-108
            JSXIdentifier 93-104 name="hyphen-ated"
            Literal 105-108 raw="\\"x\\""
          JSXAttribute 109-120
            JSXNamespacedName 109-116
              JSXIdentifier 109-111 name="ns"
              JSXIdentifier 112-116 name="attr"
            Literal 117-120 raw="\\"y\\""
          JSXSpreadAttribute 121-132
            Identifier 125-131 name="spread"
          JSXAttribute 133-144
            JSXIdentifier 133-138 name="multi"
            Literal 139-144 raw="\\"a\\nb\\""
        JSXText 145-202 raw="\\n    text &amp; entities &#65; &#x42; &unknown; more\\n    " value="\\n    text & entities A B &unknown; more\\n    "
        JSXExpressionContainer 202-214
          Identifier 203-213 name="expression"
        JSXText 214-219 raw="\\n    " value="\\n    "
        JSXExpressionContainer 219-241
          JSXEmptyExpression 220-240
        JSXText 241-246 raw="\\n    " value="\\n    "
        JSXExpressionContainer 246-248
          JSXEmptyExpression 247-247
        JSXText 248-253 raw="\\n    " value="\\n    "
        JSXElement 253-342
          JSXOpeningElement 253-293
            JSXMemberExpression 254-266
              JSXIdentifier 254-259 name="Inner"
              JSXIdentifier 260-266 name="Member"
            JSXAttribute 267-292
              JSXIdentifier 267-271 name="prop"
              JSXExpressionContainer 272-292
                JSXElement 273-291
                  JSXOpeningElement 273-279
                    JSXIdentifier 274-278 name="span"
                  JSXText 279-284 raw="child" value="child"
                  JSXClosingElement 284-291
                    JSXIdentifier 286-290 name="span"
          JSXText 293-300 raw="\\n      " value="\\n      "
          JSXFragment 300-322
            JSXOpeningFragment 300-302
            JSXText 302-311 raw="fragment " value="fragment "
            JSXExpressionContainer 311-319
              Identifier 312-318 name="inside"
            JSXClosingFragment 319-322
          JSXText 322-327 raw="\\n    " value="\\n    "
          JSXClosingElement 327-342
            JSXMemberExpression 329-341
              JSXIdentifier 329-334 name="Inner"
              JSXIdentifier 335-341 name="Member"
        JSXText 342-347 raw="\\n    " value="\\n    "
        JSXSpreadChild 347-363
          Identifier 351-362 name="spreadChild"
        JSXText 363-368 raw="\\n    " value="\\n    "
        JSXExpressionContainer 368-430
          CallExpression 369-429
            MemberExpression 369-377
              Identifier 369-373 name="list"
              Identifier 374-377 name="map"
            ArrowFunctionExpression 378-428 expression=true
              Identifier 379-383 name="item"
              JSXElement 396-422
                JSXOpeningElement 396-411
                  JSXIdentifier 397-399 name="li"
                  JSXAttribute 400-410
                    JSXIdentifier 400-403 name="key"
                    JSXExpressionContainer 404-410
                      Identifier 405-409 name="item"
                JSXExpressionContainer 411-417
                  Identifier 412-416 name="item"
                JSXClosingElement 417-422
                  JSXIdentifier 419-421 name="li"
        JSXText 430-433 raw="\\n  " value="\\n  "
        JSXClosingElement 433-443
          JSXIdentifier 435-442 name="section"
  VariableDeclaration 446-485 kind=const
    VariableDeclarator 452-485
      Identifier 452-459 name="generic"
      ArrowFunctionExpression 462-485 expression=true
        TSTypeParameterDeclaration 462-466
          TSTypeParameter 463-464
            Identifier 463-464 name="T"
        Identifier 467-475 name="value"
          TSTypeAnnotation 472-475
            TSTypeReference 474-475
              Identifier 474-475 name="T"
        Identifier 480-485 name="value"
  VariableDeclaration 486-530 kind=const
    VariableDeclarator 492-530
      Identifier 492-497 name="typed"
      JSXElement 500-530
        JSXOpeningElement 500-530 selfClosing=true
          JSXIdentifier 501-510 name="Component"
          TSTypeParameterInstantiation 510-518
            TSStringKeyword 511-517
          JSXAttribute 519-527
            JSXIdentifier 519-523 name="prop"
            Literal 524-527 raw="\\"x\\""
  VariableDeclaration 531-568 kind=const
    VariableDeclarator 537-568
      Identifier 537-549 name="elementValue"
      JSXElement 552-568
        JSXOpeningElement 552-568 selfClosing=true
          JSXIdentifier 553-554 name="a"
          JSXAttribute 555-565
            JSXIdentifier 555-559 name="attr"
            JSXElement 560-565
              JSXOpeningElement 560-565 selfClosing=true
                JSXIdentifier 561-562 name="c"
  VariableDeclaration 569-622 kind=const
    VariableDeclarator 575-622
      Identifier 575-591 name="selfClosingChild"
      JSXElement 594-622
        JSXOpeningElement 594-597
          JSXIdentifier 595-596 name="p"
        JSXElement 597-603
          JSXOpeningElement 597-603 selfClosing=true
            JSXIdentifier 598-600 name="br"
        JSXElement 603-618
          JSXOpeningElement 603-618 selfClosing=true
            JSXIdentifier 604-607 name="img"
            JSXAttribute 608-615
              JSXIdentifier 608-611 name="src"
              Literal 612-615 raw="\\"x\\""
        JSXClosingElement 618-622
          JSXIdentifier 620-621 name="p"
  VariableDeclaration 623-658 kind=const
    VariableDeclarator 629-658
      Identifier 629-640 name="stringChild"
      JSXElement 643-658
        JSXOpeningElement 643-646
          JSXIdentifier 644-645 name="a"
        JSXExpressionContainer 646-654
          Literal 647-653 raw="'text'"
        JSXClosingElement 654-658
          JSXIdentifier 656-657 name="a"
  VariableDeclaration 659-683 kind=const
    VariableDeclarator 665-683
      Identifier 665-675 name="comparison"
      BinaryExpression 678-683 operator="<"
        Identifier 678-679 name="a"
        Identifier 682-683 name="b"
  VariableDeclaration 684-709 kind=const
    VariableDeclarator 690-709
      Identifier 690-699 name="emptyText"
      JSXElement 702-709
        JSXOpeningElement 702-705
          JSXIdentifier 703-704 name="b"
        JSXClosingElement 705-709
          JSXIdentifier 707-708 name="b"
  VariableDeclaration 710-766 kind=const
    VariableDeclarator 716-766
      Identifier 716-730 name="nestedSameLine"
      JSXElement 733-766
        JSXOpeningElement 733-737
          JSXIdentifier 734-736 name="ul"
        JSXElement 737-749
          JSXOpeningElement 737-741
            JSXIdentifier 738-740 name="li"
          JSXText 741-744 raw="one" value="one"
          JSXClosingElement 744-749
            JSXIdentifier 746-748 name="li"
        JSXElement 749-761
          JSXOpeningElement 749-753
            JSXIdentifier 750-752 name="li"
          JSXText 753-756 raw="two" value="two"
          JSXClosingElement 756-761
            JSXIdentifier 758-760 name="li"
        JSXClosingElement 761-766
          JSXIdentifier 763-765 name="ul"
  VariableDeclaration 767-847 kind=const
    VariableDeclarator 773-847
      Identifier 773-785 name="withNewlines"
      JSXElement 792-845
        JSXOpeningElement 792-797
          JSXIdentifier 793-796 name="div"
        JSXText 797-802 raw="\\n    " value="\\n    "
        JSXElement 802-816
          JSXOpeningElement 802-808
            JSXIdentifier 803-807 name="span"
          JSXText 808-809 raw="a" value="a"
          JSXClosingElement 809-816
            JSXIdentifier 811-815 name="span"
        JSXText 816-822 raw="\\n\\n    " value="\\n\\n    "
        JSXElement 822-836
          JSXOpeningElement 822-828
            JSXIdentifier 823-827 name="span"
          JSXText 828-829 raw="b" value="b"
          JSXClosingElement 829-836
            JSXIdentifier 831-835 name="span"
        JSXText 836-839 raw="\\n  " value="\\n  "
        JSXClosingElement 839-845
          JSXIdentifier 841-844 name="div"
  VariableDeclaration 848-891 kind=const
    VariableDeclarator 854-891
      Identifier 854-857 name="svg"
      JSXElement 860-891
        JSXOpeningElement 860-891 selfClosing=true
          JSXNamespacedName 861-871
            JSXIdentifier 861-864 name="svg"
            JSXIdentifier 865-871 name="circle"
          JSXAttribute 872-888
            JSXNamespacedName 872-882
              JSXIdentifier 872-877 name="xlink"
              JSXIdentifier 878-882 name="href"
            Literal 883-888 raw="\\"#id\\""
  VariableDeclaration 892-920 kind=const
    VariableDeclarator 898-920
      Identifier 898-902 name="cast"
      TSAsExpression 905-920
        Identifier 905-910 name="value"
        TSNumberKeyword 914-920
  FunctionDeclaration 921-972
    Identifier 930-939 name="Component"
    BlockStatement 942-972
      ReturnStatement 946-970
        JSXElement 953-970
          JSXOpeningElement 953-958
            JSXIdentifier 954-957 name="div"
          JSXExpressionContainer 958-964
            ThisExpression 959-963
          JSXClosingElement 964-970
            JSXIdentifier 966-969 name="div"
`,
}
