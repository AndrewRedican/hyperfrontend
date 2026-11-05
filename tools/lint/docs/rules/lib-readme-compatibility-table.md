# lib-readme-compatibility-table

Keep a publishable library README's compatibility tables, runtimes and operating systems, equal to what its `project.json` declares.

## Rule Details

Where a package runs is declared once, under `metadata.compatibility.environments` in its `project.json`, with the Node.js floor in `engines.node` of its manifest. The documentation site draws its runtime chips from that declaration, the root compatibility matrix is generated from it, and the runtime strip the distribution readme shows is drawn from it. The table under `## Compatibility` in the source readme was the one copy still written by hand, and hand-written copies drift: one readme listed runtimes the declaration has no word for, another left out a runtime the declaration names.

This rule holds the table to the declaration. The table has one row per runtime, in the order the site draws them, and the Node.js row carries the floor the manifest declares:

```markdown
| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ✅     |
| Modern Browsers |    ✅     |
| Web Workers     |    ⚠️     |
```

After it, and after the `hf:media` region around it when there is one, comes a second table for the operating systems `metadata.compatibility.operatingSystems` declares. It sits outside the region because the build replaces the region with the runtime strip in the distribution readme, and the operating systems must reach npm too:

```markdown
| Operating System | Supported |
| ---------------- | :-------: |
| Linux            |    ✅     |
| macOS            |    ✅     |
| Windows          |    ✅     |
```

`full` renders as ✅, `partial` as ⚠️ and `none` as ❌; a runtime or operating system the declaration does not name renders as ❌. A missing operating-system table is added after the region, or after the runtime table when there is no region. Padding is not compared, so a table the formatter has re-aligned still passes. Prose around the table, such as a note on which entry points a partial level applies to, is not the rule's business and stays as written.

### What the rule reports

| Message        | Reported when                                                                      |
| -------------- | ---------------------------------------------------------------------------------- |
| `missingTable` | The Compatibility section holds no table.                                          |
| `tableDrift`   | The first table in the section says something other than the declaration. Fixable. |

The fix replaces the table with the declared one. Running the workspace lint with `--fix` regenerates every drifted table at once.

### Scope

Applies to the `README.md` at the root of every publishable library. A readme with no `## Compatibility` heading is left to `lib-readme-structure`, which reports the missing section.

## Examples

### ❌ Incorrect

```markdown
## Compatibility

| Platform                      | Support |
| ----------------------------- | :-----: |
| Browser                       |   ✅    |
| Node.js                       |   ✅    |
| Deno, Bun, Cloudflare Workers |   ✅    |
```

The declaration has no runtime called Deno, and the table has no row for web workers, which the declaration does name.

### ✅ Correct

```markdown
## Compatibility

| Environment     | Supported |
| --------------- | :-------: |
| Node.js >= 18   |    ✅     |
| Modern Browsers |    ✅     |
| Web Workers     |    ✅     |

| Operating System | Supported |
| ---------------- | :-------: |
| Linux            |    ✅     |
| macOS            |    ✅     |
| Windows          |    ✅     |
```

## When Not To Use It

If a workspace does not declare runtime compatibility in `project.json`, there is nothing to hold the table to.
