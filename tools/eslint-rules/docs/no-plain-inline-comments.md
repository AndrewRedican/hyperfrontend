# no-plain-inline-comments

Disallow plain inline comments unless they use allowed hint prefixes or are tooling directives.

## Rule Details

This rule flags `//` comments that don't serve a specific, recognized purpose. Comments must either:

1. Be a recognized tooling directive (TypeScript, ESLint, Istanbul, bundlers, etc.)
2. Start with an allowed hint prefix followed by a colon

The goal is to encourage intentional, categorized comments that provide genuine value rather than noise.

### Allowed Hint Prefixes

| Prefix     | Purpose                                               |
| ---------- | ----------------------------------------------------- |
| `why:`     | Explains the rationale behind a non-obvious decision  |
| `how:`     | Describes a non-obvious implementation approach       |
| `context:` | Provides background or external reference             |
| `magic:`   | Documents the origin or meaning of a hard-coded value |
| `todo:`    | Marks known work to be done                           |
| `fixme:`   | Marks a known defect                                  |
| `note:`    | A general callout that doesn't fit other categories   |
| `ref:`     | Links to an external resource, ticket, or spec        |

### Recognized Tooling Directives

- TypeScript: `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `@ts-check`
- ESLint: `eslint-disable`, `eslint-enable`, `eslint-disable-line`, `eslint-disable-next-line`
- Coverage: `istanbul ignore`, `c8 ignore`
- Bundlers: `webpackChunkName`, `@vite-ignore`
- Other: `prettier-ignore`, `sourceMappingURL`, `falls through`

### Excluded Files

This rule does not apply to configuration files such as:

- `tsconfig*.json`
- `jest.config.*`
- `eslint.config.*`
- `vite.config.*`
- `webpack.config.*`
- And other common configuration patterns

## Examples

### ❌ Incorrect

```ts
// Initialize the counter
let counter = 0

const x = 1 // increment later

// This handles the edge case
function process() {}
```

### ✅ Correct

```ts
// why: Counter starts at 0 to match the API's 0-based indexing
let counter = 0

// magic: 86400 = seconds in a day (60 * 60 * 24)
const SECONDS_PER_DAY = 86400

// todo: Add validation once schema is finalized
function process() {}

// ref: https://github.com/org/repo/issues/123
function workaround() {}

// @ts-expect-error - legacy API returns any
const result = legacyCall()

// eslint-disable-next-line no-console
console.log('Debug')
```

## When Not To Use It

If your team prefers unrestricted commenting or has different commenting conventions, you can disable this rule.

## Options

This rule has no options.

## Fixable

This rule is auto-fixable using `--fix`. The fixer removes the plain inline comment entirely.

**Note**: The fixer assumes that if a comment doesn't fit the allowed categories, it's likely redundant or should be rewritten. Review the changes after auto-fixing to ensure important information isn't lost.
