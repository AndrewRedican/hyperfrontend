# no-unsafe-regex

Disallow potentially unsafe regular expressions that could cause ReDoS.

## Rule Details

This rule detects regular expressions that may be vulnerable to Regular Expression Denial of Service (ReDoS) attacks.

### Why?

- **Security**: Malicious input can cause exponential backtracking
- **Performance**: Even non-malicious input can cause hangs with bad patterns
- **Reliability**: ReDoS can make your application unresponsive

## Examples

### ❌ Incorrect

```typescript
// Catastrophic backtracking patterns
const regex1 = /^(a+)+$/
const regex2 = /(a|a)+/
const regex3 = /([a-zA-Z]+)*$/

// Exponential quantifier bounds
const regex4 = /a{1,100000}/
```

### ✅ Correct

```typescript
const regex1 = /^a+$/
const regex2 = /a+/
const regex3 = /[a-zA-Z]+$/

// Reasonable quantifier bounds
const regex4 = /a{1,100}/
```

## Options

```typescript
{
  // Maximum allowed quantifier bound (default: 1000)
  maxQuantifierBound: number,

  // Maximum star-height for safe-regex2 (default: 25)
  maxStarHeight: number,

  // Flag dynamic RegExp construction (default: true)
  flagDynamicConstruction: boolean,

  // Flag template interpolation (default: 'warn')
  flagTemplateInterpolation: 'error' | 'warn' | 'off',

  // Additional RegExp factory functions to check
  regexpFactoryFunctions: string[],

  // Patterns to ignore
  ignorePatterns: string[]
}
```

## When Not To Use It

If you're confident your regex patterns are safe or you validate regex input through other means.

## References

- [safe-regex2](https://www.npmjs.com/package/safe-regex2)
- [ReDoS attacks explained](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
