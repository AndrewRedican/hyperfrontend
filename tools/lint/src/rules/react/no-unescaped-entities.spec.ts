import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-unescaped-entities.ts'

// why: the workspace runs the rule with its default options; the cases with a `forbid` list are left out.
testRule(rule, {
  valid: [
    {
      name: '#1 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          render: function() {\n            return (\n              <div/>\n            );\n          }\n        });\n      ',
    },
    {
      name: '#8 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: '\n        var Hello = createReactClass({\n          render: function() {\n            return <>{">" + "<" + "&" + \'"\'}</>;\n          },\n        });\n      ',
    },
    {
      name: '#9 export const Notice = ({ name }: { name: string }) => <p tit…',
      path: '/root/notice.tsx',
      text: '\n      export const Notice = ({ name }: { name: string }) => <p title="it\'s fine">Don&apos;t panic, {name}&rsquo;s here</p>;\n    ',
      settings: { react: { version: '19.0' } },
    },
  ],
  invalid: [
    {
      name: '#14 var Hello = createReactClass({',
      path: '/root/react.tsx',
      text: "\n        var Hello = createReactClass({\n          render: function() {\n            return <div>'</div>;\n          }\n        });\n      ",
      errors: [
        {
          message: "`'` can be escaped with `&apos;`, `&lsquo;`, `&#39;`, `&rsquo;`.",
          line: 4,
          column: 25,
          endLine: null,
          endColumn: null,
        },
      ],
    },
    {
      name: '#18 <script>window.foo = "bar"</script>',
      path: '/root/react.tsx',
      text: '\n        <script>window.foo = "bar"</script>\n      ',
      errors: [
        {
          message: '`"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.',
          line: 2,
          column: 30,
          endLine: null,
          endColumn: null,
        },
        {
          message: '`"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.',
          line: 2,
          column: 34,
          endLine: null,
          endColumn: null,
        },
      ],
    },
    {
      name: '#23 <p>5" tall</p>;',
      path: '/root/react.tsx',
      text: '<p>5" tall</p>;',
      errors: [
        { message: '`"` can be escaped with `&quot;`, `&ldquo;`, `&#34;`, `&rdquo;`.', line: 1, column: 5, endLine: null, endColumn: null },
      ],
    },
  ],
})
