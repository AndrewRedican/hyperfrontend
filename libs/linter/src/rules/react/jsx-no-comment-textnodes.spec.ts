import { testRule } from '../../testing/rule-tester'
import rule from './jsx-no-comment-textnodes'

testRule(rule, {
  valid: [
    {
      name: '#2 class Comp1 extends Component {',
      path: '/root/react.tsx',
      text: '\n        class Comp1 extends Component {\n          render() {\n            return (\n              <>\n                {/* valid */}\n              </>\n            );\n          }\n        }\n      ',
    },
    {
      name: '#5 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          foo: (<div>{/* valid */}</div>),\n          render() {\n            return this.foo;\n          },\n        });\n      ',
    },
    {
      name: '#10 <strong>',
      path: '/root/react.tsx',
      text: '\n        <strong>\n          &nbsp;https://www.example.com/attachment/download/1\n        </strong>\n      ',
    },
    {
      name: "#11 <Foo /* valid */ placeholder={'foo'}/>",
      path: '/root/react.tsx',
      text: "\n        <Foo /* valid */ placeholder={'foo'}/>\n      ",
    },
    {
      name: '#14 <pre>&#x2F;&#x2F; TODO: Write perfect code</pre>',
      path: '/root/react.tsx',
      text: '<pre>&#x2F;&#x2F; TODO: Write perfect code</pre>',
    },
    {
      name: '#16 <div>',
      path: '/root/react.tsx',
      text: '\n        <div>\n          <span className="pl-c"><span className="pl-c">&#47;&#47;</span> ...</span><br />\n        </div>\n      ',
    },
    {
      name: '#18 <a title="// a title" href="/* not a comment */" />;',
      path: '/root/react.tsx',
      text: '<a title="// a title" href="/* not a comment */" />;',
    },
  ],
  invalid: [
    {
      name: '#28 const Component2 = () => {',
      path: '/root/react.tsx',
      text: '\n        const Component2 = () => {\n          return <span>/*</span>;\n        };\n      ',
      errors: [
        {
          message: 'Comments inside children section of tag should be placed inside braces',
          line: 3,
          column: 24,
          endLine: 3,
          endColumn: 26,
        },
      ],
    },
    {
      name: '#29 export const Note = ({ text }: { text: string }) => <p>// {t…',
      path: '/root/note.tsx',
      text: '\n      export const Note = ({ text }: { text: string }) => <p>// {text}</p>;\n    ',
      settings: { react: { version: '19.0' } },
      errors: [
        {
          message: 'Comments inside children section of tag should be placed inside braces',
          line: 2,
          column: 62,
          endLine: 2,
          endColumn: 65,
        },
      ],
    },
  ],
})
