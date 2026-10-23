# react/no-deprecated

Forbid React APIs that the configured React version deprecates.

## Rule Details

Deprecated APIs warn at run time and disappear in a later major version. This rule reports a deprecated API when it is read as a member, such as [`ReactDOM.render`](https://react.dev/reference/react-dom/render), imported by name from `'react'`, `'react-dom'`, `'react-dom/server'` or `'react-addons-perf'`, or destructured from one of those modules' objects or `require` calls. It also reports the legacy lifecycle methods [`componentWillMount`](https://react.dev/reference/react/Component#unsafe_componentwillmount), [`componentWillReceiveProps`](https://react.dev/reference/react/Component#unsafe_componentwillreceiveprops) and [`componentWillUpdate`](https://react.dev/reference/react/Component#unsafe_componentwillupdate) on class components and [`createReactClass`](https://legacy.reactjs.org/docs/react-without-es6.html) objects, from React 16.9. The message names the version, the replacement and, where there is one, a page explaining the change. The list runs from React 0.12 to the React 18 root API changes. It does not fix.

The rule reads the React version from the settings (`{ react: { version: '17.0' } }`) and reports only what that version already deprecates; without a version, or with `'detect'`, it assumes the newest and reports everything. The pragma (`{ react: { pragma: 'Preact' } }`, or a `@jsx` comment in the file) is the object the core APIs are read from.

Reimplements [eslint-plugin-react's `no-deprecated`](https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/no-deprecated.md).

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```tsx
import { render } from 'react-dom'
import { Component } from 'react'

render(<App />, document.getElementById('root'))

export class Clock extends Component {
  componentWillMount() {
    this.setState({ now: Date.now() })
  }
}
```

### ✅ Correct

```tsx
import { createRoot } from 'react-dom/client'
import { Component } from 'react'

createRoot(document.getElementById('root')!).render(<App />)

export class Clock extends Component {
  componentDidMount() {
    this.setState({ now: Date.now() })
  }
}
```

## Limitations

The version is never detected from the installed package; a project on an older React must set it, or it sees reports for deprecations it has not reached.
