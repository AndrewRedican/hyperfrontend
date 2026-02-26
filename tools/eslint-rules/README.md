# @hyperfrontend/eslint-rules

Custom ESLint rules for the hyperfrontend monorepo.

## Rules

### no-unwanted-barrel-files

Prevents unwanted `index.ts` (barrel) files in library projects. This rule enforces that only explicitly declared entry points in `package.json` should have corresponding `index.ts` files.

#### When does this rule apply?

The rule applies when ALL of the following are true:

1. The file is named `index.ts`
2. The file is within a project that has a `project.json` file
3. The `project.json` contains BOTH `build` AND `publish` targets
4. The `project.json` has `"projectType": "library"`

#### Validation Logic

- If no `exports` field in `package.json`: Only `src/index.ts` is allowed (main entry point)
- If `exports` field exists: Only `index.ts` files that match declared export paths are allowed

#### Examples

**Valid (main entry point):**

```typescript
// libs/my-lib/src/index.ts
export * from './lib'
```

**Valid (declared export):**

```jsonc
// libs/my-lib/package.json
{
  "exports": {
    "./browser": "./src/browser/index.js",
  },
}
```

```typescript
// libs/my-lib/src/browser/index.ts - Allowed because it's declared
export * from './implementation'
```

**Invalid (undeclared barrel file):**

```typescript
// libs/my-lib/src/lib/helpers/index.ts - ERROR: Not a declared entry point
export * from './string-helpers'
```

#### How to Fix

1. **Delete the barrel file** and update imports to reference implementation files directly
2. **Or add a corresponding export** to `package.json` if it should be a public entry point

## Development

```bash
# Run tests
npx nx test eslint-rules

# Run linting
npx nx lint eslint-rules
```

## References

- [ESLint Custom Rules Documentation](https://eslint.org/docs/latest/extend/custom-rules)
