import { testRule } from '../../testing/rule-tester.ts'
import rule from './no-unknown-property.ts'

// why: the workspace runs the rule with its default options; the cases with an `ignore` list or `requireDataLowercase: true` are left out.
testRule(rule, {
  valid: [
    { name: '#1 <App class="bar" />;', path: '/root/react.tsx', text: '<App class="bar" />;' },
    { name: '#4 <Foo.bar for="bar" />;', path: '/root/react.tsx', text: '<Foo.bar for="bar" />;' },
    {
      name: '#23 <svg key="lock" viewBox="box" fill={10} d="d" stroke={1} str…',
      path: '/root/react.tsx',
      text: '<svg key="lock" viewBox="box" fill={10} d="d" stroke={1} strokeWidth={2} strokeLinecap={3} strokeLinejoin={4} transform="something" clipRule="else" x1={5} x2="6" y1="7" y2="8"></svg>',
    },
    {
      name: '#43 <div allowTransparency="true" />',
      path: '/root/react.tsx',
      text: '<div allowTransparency="true" />',
      settings: { react: { version: '16.0.99' } },
    },
    {
      name: '#50 <div {...this.props} class="foo" is="my-elem"></div>;',
      path: '/root/react.tsx',
      text: '<div {...this.props} class="foo" is="my-elem"></div>;',
    },
    { name: '#51 <atom-panel class="foo"></atom-panel>;', path: '/root/react.tsx', text: '<atom-panel class="foo"></atom-panel>;' },
    {
      name: '#86 <div>',
      path: '/root/react.tsx',
      text: '\n        <div>\n          <button popovertarget="my-popover" popovertargetaction="toggle">Open Popover</button>\n\n          <div popover id="my-popover">Greetings, one and all!</div>\n        </div>\n      ',
    },
    {
      name: '#87 export const Field = ({ id, onDown }: { id: string; onDown: …',
      path: '/root/field.tsx',
      text: '\n      export const Field = ({ id, onDown }: { id: string; onDown: () => void }) => (\n        <label htmlFor={id} className="field" aria-label="Name" data-testid="field" onPointerDown={onDown} />\n      );\n    ',
      settings: { react: { version: '19.0' } },
    },
  ],
  invalid: [
    {
      name: '#92 <div allowTransparency="true" />',
      path: '/root/react.tsx',
      text: '<div allowTransparency="true" />',
      settings: { react: { version: '16.1.0' } },
      errors: [{ message: "Unknown property 'allowTransparency' found", line: 1, column: 6, endLine: 1, endColumn: 30 }],
      output: null,
    },
    {
      name: '#109 <div crossOrigin />',
      path: '/root/react.tsx',
      text: '<div crossOrigin />',
      errors: [
        {
          message: "Invalid property 'crossOrigin' found on tag 'div', but it is only allowed on: script, img, video, audio, link, image",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 17,
        },
      ],
      output: null,
    },
    {
      name: '#110 <div as="audio" />',
      path: '/root/react.tsx',
      text: '<div as="audio" />',
      errors: [
        {
          message: "Invalid property 'as' found on tag 'div', but it is only allowed on: link",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 16,
        },
      ],
      output: null,
    },
    {
      name: '#111 <div onAbort={this.abort} onDurationChange={this.durationCha…',
      path: '/root/react.tsx',
      text: '<div onAbort={this.abort} onDurationChange={this.durationChange} onEmptied={this.emptied} onEnded={this.end} onResize={this.resize} onError={this.error} />',
      errors: [
        {
          message: "Invalid property 'onAbort' found on tag 'div', but it is only allowed on: audio, video",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 26,
        },
        {
          message: "Invalid property 'onDurationChange' found on tag 'div', but it is only allowed on: audio, video",
          line: 1,
          column: 27,
          endLine: 1,
          endColumn: 65,
        },
        {
          message: "Invalid property 'onEmptied' found on tag 'div', but it is only allowed on: audio, video",
          line: 1,
          column: 66,
          endLine: 1,
          endColumn: 90,
        },
        {
          message: "Invalid property 'onEnded' found on tag 'div', but it is only allowed on: audio, video",
          line: 1,
          column: 91,
          endLine: 1,
          endColumn: 109,
        },
        {
          message: "Invalid property 'onResize' found on tag 'div', but it is only allowed on: audio, video",
          line: 1,
          column: 110,
          endLine: 1,
          endColumn: 132,
        },
        {
          message:
            "Invalid property 'onError' found on tag 'div', but it is only allowed on: audio, video, img, link, source, script, picture, iframe",
          line: 1,
          column: 133,
          endLine: 1,
          endColumn: 153,
        },
      ],
      output: null,
    },
    {
      name: '#112 <div onLoad={this.load} />',
      path: '/root/react.tsx',
      text: '<div onLoad={this.load} />',
      errors: [
        {
          message:
            "Invalid property 'onLoad' found on tag 'div', but it is only allowed on: script, img, link, picture, iframe, object, source",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 24,
        },
      ],
      output: null,
    },
    {
      name: '#113 <div fill="pink" />',
      path: '/root/react.tsx',
      text: '<div fill="pink" />',
      errors: [
        {
          message:
            "Invalid property 'fill' found on tag 'div', but it is only allowed on: altGlyph, circle, ellipse, g, line, marker, mask, path, polygon, polyline, rect, svg, symbol, text, textPath, tref, tspan, use, animate, animateColor, animateMotion, animateTransform, set",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 17,
        },
      ],
      output: null,
    },
    {
      name: '#114 <div controls={this.controls} loop={true} muted={false} src=…',
      path: '/root/react.tsx',
      text: '<div controls={this.controls} loop={true} muted={false} src={this.videoSrc} playsInline={true} allowFullScreen></div>',
      errors: [
        {
          message: "Invalid property 'controls' found on tag 'div', but it is only allowed on: audio, video",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 30,
        },
        {
          message: "Invalid property 'loop' found on tag 'div', but it is only allowed on: audio, video",
          line: 1,
          column: 31,
          endLine: 1,
          endColumn: 42,
        },
        {
          message: "Invalid property 'muted' found on tag 'div', but it is only allowed on: audio, video",
          line: 1,
          column: 43,
          endLine: 1,
          endColumn: 56,
        },
        {
          message: "Invalid property 'playsInline' found on tag 'div', but it is only allowed on: video",
          line: 1,
          column: 77,
          endLine: 1,
          endColumn: 95,
        },
        {
          message: "Invalid property 'allowFullScreen' found on tag 'div', but it is only allowed on: iframe, video",
          line: 1,
          column: 96,
          endLine: 1,
          endColumn: 111,
        },
      ],
      output: null,
    },
    {
      name: '#115 <div download="foo" />',
      path: '/root/react.tsx',
      text: '<div download="foo" />',
      errors: [
        {
          message: "Invalid property 'download' found on tag 'div', but it is only allowed on: a, area",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 20,
        },
      ],
      output: null,
    },
    {
      name: '#121 <div abbr="abbr" />',
      path: '/root/react.tsx',
      text: '<div abbr="abbr" />',
      errors: [
        {
          message: "Invalid property 'abbr' found on tag 'div', but it is only allowed on: th, td",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 17,
        },
      ],
      output: null,
    },
    {
      name: '#122 <div webkitDirectory="" />',
      path: '/root/react.tsx',
      text: '<div webkitDirectory="" />',
      errors: [
        {
          message: "Invalid property 'webkitDirectory' found on tag 'div', but it is only allowed on: input",
          line: 1,
          column: 6,
          endLine: 1,
          endColumn: 24,
        },
      ],
      output: null,
    },
    {
      name: '#124 <div className="App" data-crash-crash-crash-crash-crash-cras…',
      path: '/root/react.tsx',
      text: '\n        <div className="App" data-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash:c="customValue">\n          Hello, world!\n        </div>\n      ',
      errors: [
        {
          message:
            "Unknown property 'data-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash-crash:c' found",
          line: 2,
          column: 30,
          endLine: 2,
          endColumn: 326,
        },
      ],
      output: null,
    },
    {
      name: '#125 export const Field = ({ id }: { id: string }) => (',
      path: '/root/field.tsx',
      text: '\n      export const Field = ({ id }: { id: string }) => (\n        <label for={id} class="field" />\n      );\n    ',
      settings: { react: { version: '19.0' } },
      errors: [
        { message: "Unknown property 'for' found, use 'htmlFor' instead", line: 3, column: 16, endLine: 3, endColumn: 24 },
        { message: "Unknown property 'class' found, use 'className' instead", line: 3, column: 25, endLine: 3, endColumn: 38 },
      ],
      output:
        '\n      export const Field = ({ id }: { id: string }) => (\n        <label htmlFor={id} className="field" />\n      );\n    ',
    },
  ],
})

testRule(rule, {
  valid: [
    {
      name: 'the SVG radius and animation attributes',
      path: '/root/file.tsx',
      text: '<svg><rect rx="1" ry="2" restart="never" result="blur" /></svg>',
    },
  ],
  invalid: [
    {
      name: 'an unknown property before React 16.1',
      path: '/root/file.tsx',
      text: '<div abc="x" />',
      settings: { react: { version: '16.0.0' } },
      errors: [{ message: "Unknown property 'abc' found", line: 1, column: 6 }],
    },
    {
      name: 'a name starting with data but no data attribute',
      path: '/root/file.tsx',
      text: '<div dataset="x" />',
      errors: [{ message: "Unknown property 'dataset' found", line: 1, column: 6 }],
    },
  ],
})
