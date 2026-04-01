# prefer-inline-single-use

Prefer inlining const variables that are only used once.

## Rule Details

This rule flags `const` declarations where the variable is only referenced once in the code. In such cases, the value should be inlined directly at the usage site instead of creating an intermediate variable.

### Why?

- **Reduced indirection**: Eliminates unnecessary variable declarations
- **Clearer code flow**: Values are visible at the point of use
- **Smaller surface area**: Fewer identifiers to track mentally
- **No performance impact**: The compiler would inline these anyway

## Examples

### ❌ Incorrect

```typescript
const value = 42
console.log(value)

const message = 'hello'
greet(message)

const config = { timeout: 1000 }
setup(config)

const fn = () => compute()
execute(fn)
```

### ✅ Correct

```typescript
console.log(42)

greet('hello')

setup({ timeout: 1000 })

execute(() => compute())
```

### ✅ Correct (multiple uses)

```typescript
const shared = 42
console.log(shared)
process(shared)
```

### ✅ Correct (exported)

```typescript
export const API_URL = 'https://api.example.com'
fetch(API_URL)
```

## Fixable

This rule is auto-fixable. It will:

1. Replace the single reference with the initializer value
2. Remove the variable declaration
3. Add parentheses where needed for correct precedence

## When Not To Use It

- When you prefer explicit variable names for documentation purposes
- When dealing with complex expressions where a name aids readability
- If the variable name serves as self-documentation

## Safe Expressions

The rule only suggests inlining for expressions without side effects:

- Literals (numbers, strings, booleans, null)
- Identifiers (variable references)
- Template literals
- Array expressions (without spreads)
- Object expressions (without computed keys)
- Arrow functions and function expressions
- Binary and logical expressions
- Unary expressions
- Conditional expressions
- Type assertions (as, angle bracket)

## Excluded Cases

The rule will NOT flag:

- Variables used more than once
- Variables never used (handled by `no-unused-vars`)
- `let` or `var` declarations
- Exported declarations
- Function calls (may have side effects)
- `await` expressions
- `new` expressions
- Destructuring patterns
- Multiple declarators (`const a = 1, b = 2`)
- Variables referenced in loop conditions
- Self-referential initializers
