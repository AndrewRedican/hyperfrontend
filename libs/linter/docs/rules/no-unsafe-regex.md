# no-unsafe-regex

Forbid regular expressions that risk catastrophic backtracking, and expressions built from values the code does not spell out.

## Rule Details

A pattern with a repetition nested inside another, such as `/^(a+)+$/`, can take exponential time on a crafted input, which is a denial-of-service hole (ReDoS) wherever the input is untrusted. The rule reads every regular expression literal and every `RegExp(...)`, `new RegExp(...)` and [`createRegExp(...)`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/regexp/#api-createRegExp) call whose pattern is a string or a template without substitutions, and reports a pattern that:

- holds a repetition inside another repetition, judged by star height the way the [safe-regex](https://www.npmjs.com/package/safe-regex2) package judges it, `?` counted as a repetition;
- holds more than 25 repetitions in all;
- names a quantifier upper bound past 1000, as in `{1,100000}`;
- cannot be read, such as one with a lookbehind.

A `RegExp` or [`createRegExp`](https://www.hyperfrontend.dev/docs/libraries/utils/immutable-api/built-in-copy/regexp/#api-createRegExp) call whose pattern is computed (a variable, a call, a template with substitutions) is reported too, since the pattern may come from input. The rule does not fix.

## Options

This rule has no options. The thresholds are fixed: a bound of 1000 and 25 repetitions. Settings that similar rules offer, such as configurable thresholds, ignored patterns, extra factory functions or turning off the dynamic-construction check, are not supported.

## Examples

### ❌ Incorrect

```ts
const nested = /^(a+)+$/
const starred = /([a-zA-Z]+)*$/
const bounded = /a{1,100000}/

const dynamic = new RegExp(userInput)
const templated = new RegExp(`^${prefix}`)
```

### ✅ Correct

```ts
const flat = /^a+$/
const word = /[a-zA-Z]+$/
const bounded = /a{1,100}/

const constant = new RegExp('^[a-z]+$', 'i')
```

## Limitations

Like safe-regex, the check does not look inside a repeated group with alternatives, so overlapping alternatives such as `/(a|a)+/` pass, and an exact bound such as `{5000}` is not measured.

See [OWASP on ReDoS](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS) for background.
