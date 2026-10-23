# no-plain-inline-comments

Require every line comment to open with a hint prefix such as `why:` or to be a tooling directive.

## Rule Details

A comment that restates the next line is noise, and one that explains a decision is easy to lose among them. The rule asks each `//` comment to say what kind of note it is, by opening with one of the hint prefixes below (in any letter case), or to be a directive some tool reads. Any other line comment is reported. Block comments are not read.

| Prefix     | Purpose                                                |
| ---------- | ------------------------------------------------------ |
| `why:`     | The rationale behind a decision that is not obvious    |
| `how:`     | An implementation approach that is not obvious         |
| `context:` | Background or an outside constraint                    |
| `magic:`   | The origin or meaning of a hard-coded value            |
| `todo:`    | Known work to be done                                  |
| `fixme:`   | A known defect                                         |
| `note:`    | A callout that fits no other kind                      |
| `ref:`     | A link to an outside resource, ticket or specification |
| `compat:`  | A shim kept only for a runtime below a version bound   |

A `compat:` comment names the runtime and the first version at which the shim can go, then why it exists, as in `compat: node<22 the WebSocket global arrived in Node 22`; searching for `compat: node<` then lists every shim a raised Node floor would retire.

The directives recognised are TypeScript's (`@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `@ts-check`, triple-slash references), the linter's own (`lint-disable`, `lint-enable` and their line forms) and `eslint-env`, coverage hints (`istanbul ignore`, `c8 ignore`), bundler hints ([webpack's magic comments](https://webpack.js.org/api/module-methods/#magic-comments), `@vite-ignore`, `@rollup-plugin-ignore`), `prettier-ignore`, `//# sourceMappingURL=` and `//# sourceURL=`, fall-through markers (`// falls through`, `// fallthrough`, `// no default`), and `<hf:…>` region markers.

A comment that fills an otherwise empty function or catch body is left alone, and configuration files are skipped altogether: any file whose name contains a configuration name such as `tsconfig*.json`, `lint.config.*`, `eslint.config.*`, `vite.config.*`, `jest.config.*`, `webpack.config.*`, `rollup.config.*`, `prettier.config.*` or `package.json`.

The fix deletes the comment: its whole line when it stands alone, or the comment and the space before it when it trails code. Review the result, since a plain comment that held something worth keeping is better rewritten with a prefix.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
// Initialize the counter
let counter = 0

const x = 1 // increment later
```

### ✅ Correct

```ts
// why: the API's indexes start at 0
let counter = 0

// magic: 86400 = seconds in a day (60 * 60 * 24)
const SECONDS_PER_DAY = 86400

// ref: https://github.com/org/repo/issues/123
function workaround() {}

try {
  workaround()
} catch {
  // ignored on purpose
}

// lint-disable-next-line no-console
console.log('Debug')
```

## When Not To Use It

When a team prefers unrestricted commenting. A project that writes many comments spanning several lines should know that each continuation line is a comment of its own and must carry a prefix too.
