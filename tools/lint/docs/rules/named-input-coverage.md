# named-input-coverage

Hold a hand-kept named input of `hf.json` to its project's sources: every source file is either read by the input or named outside it.

## Rule Details

Some named inputs are a list kept by hand. The `toolchain` input names the modules of `lib-builder` that shape a tarball, and a releasable change to one of them releases every library. A list like that cannot tell a module that was judged and left out from a module nobody added: a new directory under `libs/builder/src` matches no pattern, so a change to it releases the builder alone and nothing fails.

This rule runs on the workspace's `hf.json`. It expands the named input the `input` option names from the file being linted, following the named inputs and the `{ "input": ... }` and `{ "fileset": ... }` entries it holds, then walks `<projectRoot>/src` and asks one question of every file there that is not test material: has someone decided about it?

A file is decided when one of these holds:

- **The input reads it.** A pattern of the input matches it and no `!` pattern of the input keeps it out.
- **The input negates it.** A `!` pattern of the input matches it, whether or not another pattern would have read it. A negation written in the input is a decision in its own right: `!{projectRoot}/**/README.md` decides every README of the project, in directories the input reads and in those it does not. Only a negation that matches the file decides it; a file no pattern matches at all is undecided.
- **The `outside` option names it.** One of the option's globs matches it.

Specs, `__test-utils__` modules and the test setup module are never asked about, since no input that shapes a build reads them. Every other file under `src` is asked about, whatever the workspace classes it as: a module, an asset, and also a `package.json`, a `project.json`, a `tsconfig*.json` or a Markdown file. A `**/*` pattern over a listed directory reads those too, so a manifest or a document kept among the sources as build material is on one of the lists like any module.

An undecided file is reported on the property that defines the input. A directory in which the input reads no file and the option names none is reported once, as the directory, at its outermost such level, even when a negation of the input keeps one of its files out; a new file in a directory the input already partly reads is reported as the file.

The rule also keeps the `outside` option honest. It reports a pattern that matches a file the input reads, once however many files it matches, and a pattern that matches no file the rule asks about, so the list never outlives the modules it excuses. And it reports when the named input is not defined, or when the project has no `src` directory, so that renaming either does not switch the check off.

The input is read as the workspace reads it. A key written twice counts as its last value. The workspace reads `hf.json` as strict JSON and takes a file it cannot parse for an empty one, so a file that carries a comment or a trailing comma defines no named input at all: the rule reports it on the document and checks nothing else until it is repaired. A named input on the way that is not written as a list, or that holds an entry that is neither a string nor an object whose `fileset` or `input` is a string, is reported on the same property, and nothing else is checked until it is repaired.

The walk enters every directory below `src`, whatever its name. A directory called `out`, `coverage`, `tmp` or `_`, or one that starts with a dot, is asked about like any other, because a source tree may use a name that elsewhere means build output or a cache.

### Why?

- **Left out is not forgotten**: every module of the project is on one of two lists, and each entry of the `outside` list carries its reason
- **A cheap place for the second list**: editing a named input re-resolves every task that reads it, while editing a rule's options costs a lint
- **Fails where the change is made**: adding a module fails the workspace lint in the same pull request, not a release later

## Options

`input` and `projectRoot` are required: without either, the rule reports once on the document that it checks nothing. `outside` is empty when left out.

| Option        | Type       | Description                                                                      |
| ------------- | ---------- | -------------------------------------------------------------------------------- |
| `input`       | `string`   | The named input of `hf.json` to check                                            |
| `projectRoot` | `string`   | The project whose `src` directory it is checked against, from the workspace root |
| `outside`     | `string[]` | Globs, relative to the project root, of the source files left out on purpose     |

`projectRoot` is written with `/`. A trailing slash or a leading `./` changes nothing: `libs/builder/` and `./libs/builder` are read as `libs/builder`.

```ts
// lint.config.ts
{
  files: ['hf.json'],
  rules: {
    'workspace/named-input-coverage': [
      'error',
      {
        input: 'toolchain',
        projectRoot: 'libs/builder',
        outside: ['src/index.ts', 'src/memory/**'],
      },
    ],
  },
}
```

## Examples

The examples share this input:

```json
{
  "namedInputs": {
    "toolchain": [
      "{projectRoot}/src/models/**/*",
      "{projectRoot}/src/package/**/*",
      "{projectRoot}/src/bundle/rollup/**/*",
      "!{projectRoot}/src/bundle/rollup/locate.ts"
    ]
  }
}
```

### ❌ Incorrect

A new directory, `libs/builder/src/service`, that neither list names:

**Error**: `libs/builder/src/service is neither read by named input 'toolchain' nor declared outside it. List it in the input when a change to it changes what a build emits; otherwise name it in this rule's 'outside' option.`

A new file beside the directories the input reads, `libs/builder/src/bundle/rewrite.ts`:

**Error**: `libs/builder/src/bundle/rewrite.ts is neither read by named input 'toolchain' nor declared outside it. List it in the input when a change to it changes what a build emits; otherwise name it in this rule's 'outside' option.`

An `outside` entry, `src/models/**`, over files the input reads:

**Error**: `'src/models/**' is declared outside named input 'toolchain', yet the input reads libs/builder/src/models/index.ts.`

An `outside` entry, `src/gone/**`, left behind after its directory was removed:

**Error**: `'src/gone/**' is declared outside named input 'toolchain' but matches no source file of libs/builder.`

An `hf.json` that no longer defines the input:

**Error**: `Named input 'toolchain' is not defined, so nothing says which files of libs/builder it reads.`

An input written as something other than a list, such as `"toolchain": {}`:

**Error**: `Named input 'toolchain' is not written as a list of inputs, so this rule cannot tell which files of libs/builder 'toolchain' reads.`

An input that holds an entry the workspace cannot read, such as `"toolchain": [null]`:

**Error**: `Named input 'toolchain' holds an entry that is not an input (a string, or an object whose 'fileset' or 'input' is a string), so this rule cannot tell which files of libs/builder 'toolchain' reads.`

A `projectRoot` that has no `src` directory:

**Error**: `libs/builder/src does not exist, so named input 'toolchain' cannot be checked against it.`

An `hf.json` that carries a comment or a trailing comma:

**Error**: `hf.json is not strict JSON, so the workspace reads no named input from it. Remove every comment and trailing comma.`

A configuration that sets the rule without `input` or without `projectRoot`:

**Error**: `This rule checks nothing without its 'input' and 'projectRoot' options: the named input to check and the project whose src directory it is checked against.`

### ✅ Correct

Every source file is on one list or the other. `src/bundle/rollup/locate.ts` needs no `outside` entry, because the input negates it:

```text
libs/builder/src/
├── index.ts              outside: 'src/index.ts'
├── memory/monitor.ts     outside: 'src/memory/**'
├── models/
│   ├── index.ts          read by the input
│   └── tsconfig.json     read by the input, as any file of the directory is
└── bundle/rollup/
    ├── run.ts            read by the input
    ├── run.spec.ts       a spec, never asked about
    └── locate.ts         negated in the input
```

## When Not To Use It

- For a named input written as one glob over the whole project, such as `default` or `production`: a new file is read without anyone listing it

## Related Rules

- [main-steps-on-pr](./main-steps-on-pr.md) - Another list of exceptions held to what it excuses
- [lib-tsconfig-paths](./lib-tsconfig-paths.md) - Holds another root file to the directories it describes
