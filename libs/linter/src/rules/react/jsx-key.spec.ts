import { testRule } from '../../testing/rule-tester'
import rule from './jsx-key'

// why: the workspace runs the rule with its default options; the cases with fragment, spread or duplicate checks are left out.
testRule(rule, {
  valid: [
    { name: '#2 [1, 2, 3].map(function () {})', path: '/root/react.tsx', text: '[1, 2, 3].map(function () {})' },
    {
      name: '#7 [1, 2 ,3].map(x => x && <App x={x} key={x} />);',
      path: '/root/react.tsx',
      text: '[1, 2 ,3].map(x => x && <App x={x} key={x} />);',
    },
    {
      name: '#8 [1, 2 ,3].map(x => x ? <App x={x} key="1" /> : <OtherApp x={…',
      path: '/root/react.tsx',
      text: '[1, 2 ,3].map(x => x ? <App x={x} key="1" /> : <OtherApp x={x} key="2" />);',
    },
    {
      name: '#10 Array.from([1, 2, 3], function(x) { return <App key={x} /> }…',
      path: '/root/react.tsx',
      text: 'Array.from([1, 2, 3], function(x) { return <App key={x} /> });',
    },
    { name: '#16 var App = () => <div />;', path: '/root/react.tsx', text: 'var App = () => <div />;' },
    { name: '#17 [1, 2, 3].map(function(x) { return; });', path: '/root/react.tsx', text: '[1, 2, 3].map(function(x) { return; });' },
    { name: '#19 foo(() => <></>);', path: '/root/react.tsx', text: 'foo(() => <></>);' },
    { name: '#21 <App {...{}} />;', path: '/root/react.tsx', text: '<App {...{}} />;' },
    {
      name: '#25 function Component(props) {',
      path: '/root/react.tsx',
      text: '\n        function Component(props) {\n          return hasPayment ? (\n            <div className="stuff">\n              <BookingDetailSomething {...props} />\n              {props.modal && props.calculatedPrice && (\n                <SomeOtherThing items={props.something} discount={props.discount} />\n              )}\n            </div>\n          ) : null;\n        }\n      ',
    },
    {
      name: "#26 import React, { FC, useRef, useState } from 'react';",
      path: '/root/react.tsx',
      text: "\n        import React, { FC, useRef, useState } from 'react';\n\n        import './ResourceVideo.sass';\n        import VimeoVideoPlayInModal from '../vimeoVideoPlayInModal/VimeoVideoPlayInModal';\n\n        type Props = {\n          videoUrl: string;\n          videoTitle: string;\n        };\n        const ResourceVideo: FC<Props> = ({\n          videoUrl,\n          videoTitle,\n        }: Props): JSX.Element => {\n          return (\n            <div className=\"resource-video\">\n              <VimeoVideoPlayInModal videoUrl={videoUrl} />\n              <h3>{videoTitle}</h3>\n            </div>\n          );\n        };\n\n        export default ResourceVideo;\n      ",
    },
    {
      name: '#27 // testrule.jsx',
      path: '/root/react.tsx',
      text: '\n        // testrule.jsx\n        const trackLink = () => {};\n        const getAnalyticsUiElement = () => {};\n\n        const onTextButtonClick = (e, item) => trackLink([, getAnalyticsUiElement(item), item.name], e);\n      ',
    },
    {
      name: '#28 function Component({ allRatings }) {',
      path: '/root/react.tsx',
      text: '\n        function Component({ allRatings }) {\n          return (\n            <RatingDetailsStyles>\n              {Object.entries(allRatings)?.map(([key, value], index) => {\n                const rate = value?.split(/(?=[%, /])/);\n\n                if (!rate) return null;\n\n                return (\n                  <li key={`${entertainment.tmdbId}${index}`}>\n                    <img src={`/assets/rating/${key}.png`} />\n                    <span className="rating-details--rate">{rate?.[0]}</span>\n                    <span className="rating-details--rate-suffix">{rate?.[1]}</span>\n                  </li>\n                );\n              })}\n            </RatingDetailsStyles>\n          );\n        }\n      ',
    },
    {
      name: "#29 const baz = foo?.bar?.()?.[1] ?? 'qux';",
      path: '/root/react.tsx',
      text: "\n        const baz = foo?.bar?.()?.[1] ?? 'qux';\n\n        qux()?.map()\n\n        const directiveRanges = comments?.map(tryParseTSDirective)\n      ",
    },
    {
      name: '#30 import { observable } from "mobx";',
      path: '/root/react.tsx',
      text: '\n        import { observable } from "mobx";\n\n        export interface ClusterFrameInfo {\n          frameId: number;\n          processId: number;\n        }\n\n        export const clusterFrameMap = observable.map<string, ClusterFrameInfo>();\n      ',
    },
    {
      name: "#33 import Act from 'react';",
      path: '/root/react.tsx',
      text: "\n        import Act from 'react';\n        import { Children as ReactChildren } from 'react';\n\n        const { Children } = Act;\n        const { toArray } = Children;\n\n        Act.Children.toArray([1, 2 ,3].map(x => <App />));\n        Act.Children.toArray(Array.from([1, 2 ,3], x => <App />));\n        Children.toArray([1, 2 ,3].map(x => <App />));\n        Children.toArray(Array.from([1, 2 ,3], x => <App />));\n        // ReactChildren.toArray([1, 2 ,3].map(x => <App />));\n        // ReactChildren.toArray(Array.from([1, 2 ,3], x => <App />));\n        // toArray([1, 2 ,3].map(x => <App />));\n        // toArray(Array.from([1, 2 ,3], x => <App />));\n      ",
      settings: { react: { pragma: 'Act', fragment: 'Frag' } },
    },
    {
      name: '#37 interface Item { id: string; name: string }',
      path: '/root/list.tsx',
      text: '\n      interface Item { id: string; name: string }\n      export const List = ({ items }: { items: Item[] }) => <ul>{items.map((item: Item) => <li key={item.id}>{item.name}</li>)}</ul>;\n    ',
      settings: { react: { version: '19.0' } },
    },
  ],
  invalid: [
    {
      name: '#40 [<App />];',
      path: '/root/react.tsx',
      text: '[<App />];',
      errors: [{ message: 'Missing "key" prop for element in array', line: 1, column: 2, endLine: 1, endColumn: 9 }],
    },
    {
      name: '#61 const TestO = () => {',
      path: '/root/react.tsx',
      text: '\n        const TestO = () => {\n          const list = [1, 2, 3, 4, 5];\n\n          return (\n            <div>\n              {list.map(item => {\n                if (item < 2) {\n                  return <div>{item}</div>;\n                } else if (item < 5) {\n                  return <div></div>\n                }  else {\n                  return <div></div>\n                }\n\n                return <div />;\n              })}\n            </div>\n          );\n        };\n      ',
      errors: [
        { message: 'Missing "key" prop for element in iterator', line: 9, column: 26, endLine: 9, endColumn: 43 },
        { message: 'Missing "key" prop for element in iterator', line: 11, column: 26, endLine: 11, endColumn: 37 },
        { message: 'Missing "key" prop for element in iterator', line: 13, column: 26, endLine: 13, endColumn: 37 },
        { message: 'Missing "key" prop for element in iterator', line: 16, column: 24, endLine: 16, endColumn: 31 },
      ],
    },
  ],
})
