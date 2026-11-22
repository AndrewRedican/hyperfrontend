# lib-pkg-inherited-fields

Disallow the fields the build writes from the workspace's root manifest in publishable library package.json files.

## Rule Details

The build writes four fields of every published package from the workspace's root `package.json`:

- `repository` - Where the sources live; the build adds the package's own `directory`
- `bugs` - Where issues are reported
- `homepage` - The project's home page
- `author` - Who publishes the package

This rule reports each of them in the `package.json` of a publishable library, on the property that states it, and the fix removes the property. A key written twice is reported both times.

A field is reported only where the root manifest states it. Where the root manifest states no value for a field, the build keeps the library's own value, so that value is the one published and the rule leaves it alone. The directory is added to a `repository` the root manifest writes as an object with a `url`; a root `repository` written as one string is copied as it is.

The rule reports nothing for the root manifest itself, for a private package, an application, an end-to-end project or a tool, or for a file outside a workspace.

### Why?

- **One source of truth**: The root manifest states the fields once, and the build copies them into every package
- **No drift**: A value in a library's manifest is never published, and the version flow links a changelog to the root manifest's repository before it reads a library's own, so a stale value goes unnoticed until the root stops stating the field
- **Correct links**: The build derives `directory` from where the library sits, so a moved library never publishes an old path

## Examples

### ❌ Incorrect

```json
{
  "name": "@hyperfrontend/my-lib",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/AndrewRedican/hyperfrontend.git",
    "directory": "libs/my-lib"
  },
  "homepage": "https://github.com/AndrewRedican/hyperfrontend#readme"
}
```

### ✅ Correct

```json
{
  "name": "@hyperfrontend/my-lib",
  "license": "MIT"
}
```

## Fixable

This rule is auto-fixable: it removes each reported property with the comma that joined it to its neighbour, and leaves every other character of the manifest as it was written.

## When Not To Use It

If your build publishes a library's `package.json` as it is written, without taking these fields from the root manifest.

## Related Rules

- [lib-pkg-fields](./lib-pkg-fields.md)
- [lib-pkg-no-main](./lib-pkg-no-main.md)
