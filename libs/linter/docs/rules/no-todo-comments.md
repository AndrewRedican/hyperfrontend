# no-todo-comments

Forbid TODO markers, in any spelling, in comments.

## Rule Details

Work left for later belongs in an issue tracker, where it has an owner and stays visible; a TODO in the code goes stale unseen. The rule reports every occurrence of the marker in line, block and JSDoc comments, in any letter case and spelled as one word, hyphenated or spaced (TODO, to-do, to do), the `@todo` tag included. The marker must stand alone: a letter, digit, underscore or hyphen next to it makes it part of a longer word, so `path-to-document`, `auto download` and `todo-app` pass. The rule does not fix.

## Options

This rule has no options.

## Examples

### ❌ Incorrect

```ts
// TODO: fix validation
```

```ts
/* TO-DO: refactor this */
```

```ts
/** @todo add error handling */
```

### ✅ Correct

```ts
// note: validates the input format
// see path-to-document for details
// prevents an auto download of files
// the todo-app package handles this
```

## When Not To Use It

When TODO comments are an accepted part of a project's workflow. The `todo:` prefix that [no-plain-inline-comments](./no-plain-inline-comments.md) allows is reported here, so a project that turns both rules on gives up that prefix.

## Limitations

The spaced spelling is matched in ordinary prose too: a comment such as "the steps to do first" is reported.
