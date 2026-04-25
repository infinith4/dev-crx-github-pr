# Comment Scanner Module Detailed Design

## 1. Scope

The comment scanner identifies GitHub PR page controls that can reveal hidden review content. It does not click elements, call APIs, or update UI.

## 2. File

`src/content/commentScanner.ts`

## 3. Public API

```ts
export function findCommentExpansionTargets(
  root: ParentNode,
  settings: ExtensionSettings,
  options: CommentScannerOptions,
): CommentExpansionTarget[];
```

## 4. Target Types

```ts
export type CommentExpansionTargetKind =
  | 'load-more'
  | 'show-more'
  | 'resolved-thread'
  | 'outdated-thread'
  | 'full-conversation';
```

## 5. Candidate Selection

Selectors:

```text
button
a
[role="button"]
summary
```

Filtering:

- Exclude invisible elements.
- Exclude disabled buttons.
- Exclude elements inside the extension toolbar.
- Exclude elements already marked as clicked for the current run.

Visibility check:

- `element.offsetParent !== null` when available.
- `getComputedStyle(element).visibility !== "hidden"`.
- `getComputedStyle(element).display !== "none"`.

## 6. Text Normalization

```ts
function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
```

Sources:

- `textContent`
- `aria-label`
- `title`
- nearest container text excerpt

## 7. Classification Rules

| Kind | Signals |
| --- | --- |
| `load-more` | text includes `load more` |
| `show-more` | text includes `show more`, `view more`, or `show hidden` |
| `full-conversation` | text includes `view full conversation` |
| `resolved-thread` | text includes `resolved`, or nearby container includes resolved state and target expands it |
| `outdated-thread` | text includes `outdated`, or nearby container includes outdated state and target expands it |

Precedence:

1. `full-conversation`
2. `resolved-thread`
3. `outdated-thread`
4. `load-more`
5. `show-more`

## 8. Settings Filtering

Rules:

- In `all-comments` mode, skip `resolved-thread` when `includeResolvedThreads=false`.
- In `all-comments` mode, skip `outdated-thread` when `includeOutdatedThreads=false`.
- In `resolved-only` mode, return only `resolved-thread` targets.
- In `resolved-only` mode, ignore `includeResolvedThreads` because the user explicitly selected the command.

## 9. Target Key

Generate `key` from:

```text
{kind}:{normalized-label}:{container-index}:{element-index}
```

Container identity should prefer:

- closest review thread id attribute if present.
- closest file path or discussion container.
- DOM index fallback.

## 10. Test Fixtures

Create fixture snippets for:

- `Load more` button.
- `Show more` button.
- `View full conversation` link.
- Resolved conversation collapsed row.
- Outdated conversation collapsed row.
- Hidden disabled button.
- Extension toolbar button that must be ignored.

Required assertions:

- Correct kind classification.
- Settings filter resolved and outdated targets.
- `resolved-only` returns only resolved targets.
- Invisible and disabled elements are excluded.
