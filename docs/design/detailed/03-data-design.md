# Data Design

## 1. Scope

The extension has no server-side database. Persistent data is stored in Chrome storage, and runtime data lives in memory per browser tab or background service worker request. This document defines storage schemas, runtime data structures, and external API payloads.

## 2. Persistent Settings

Storage keys:

- `settings`: non-sensitive extension settings.
- `githubToken`: optional token used only for `Resolve/Unresolve`.

Recommended separation:

- Store `settings` in `chrome.storage.sync` or `chrome.storage.local`.
- Store `githubToken` in `chrome.storage.local`.

### 2.1 Settings Schema

```ts
export type StoredSettings = {
  schemaVersion: 1;
  enableCommentExpansion: boolean;
  autoExpandComments: boolean;
  includeResolvedThreads: boolean;
  includeOutdatedThreads: boolean;
  enableResolveControls: boolean;
  allowBulkResolveUnresolve: boolean;
  githubEnterpriseHosts: string[];
};
```

Defaults:

```ts
export const DEFAULT_STORED_SETTINGS: StoredSettings = {
  schemaVersion: 1,
  enableCommentExpansion: true,
  autoExpandComments: false,
  includeResolvedThreads: true,
  includeOutdatedThreads: false,
  enableResolveControls: false,
  allowBulkResolveUnresolve: false,
  githubEnterpriseHosts: [],
};
```

### 2.2 Token Schema

```ts
export type StoredToken = {
  githubToken?: string;
};
```

Rules:

- Missing token is valid.
- Empty string should be normalized to `undefined`.
- The options page should not print the token after it is saved.

## 3. Runtime Settings

Runtime settings combine stored settings and token only where needed.

```ts
export type ExtensionSettings = StoredSettings & {
  githubToken?: string;
};
```

Content script rule:

- The content script may receive `enableResolveControls` and a boolean token availability state.
- The content script should not require the raw token for rendering.

Background rule:

- The background service worker reads the raw token immediately before API calls.

## 4. Pull Request Reference

```ts
export type PullRequestRef = {
  host: string;
  owner: string;
  repo: string;
  number: number;
};
```

Examples:

```text
https://github.com/octo-org/octo-repo/pull/123
=> { host: "github.com", owner: "octo-org", repo: "octo-repo", number: 123 }
```

Validation rules:

- Protocol must be `https:`.
- `owner` and `repo` must be non-empty.
- `number` must be a positive integer.
- Host must be `github.com` or configured as an Enterprise host.

## 5. Comment Expansion Target

```ts
export type CommentExpansionTargetKind =
  | 'load-more'
  | 'show-more'
  | 'resolved-thread'
  | 'outdated-thread'
  | 'full-conversation';

export type CommentExpansionTarget = {
  element: HTMLElement;
  kind: CommentExpansionTargetKind;
  label: string;
  key: string;
  disabled: boolean;
  visible: boolean;
};
```

`key` generation should combine:

- Target kind.
- Normalized label.
- Closest thread container identity when available.
- DOM index fallback.

The key only needs to be stable within one expansion run.

## 6. Expansion Run State

```ts
export type ExpansionRunState = {
  mode: 'all-comments' | 'resolved-only';
  running: boolean;
  stopped: boolean;
  expanded: number;
  failed: number;
  skipped: number;
  remaining: number;
  seenTargetKeys: Set<string>;
  startedAt: number;
  finishedAt?: number;
};
```

Rules:

- State is per tab and per run.
- State is not persisted.
- State resets when PR URL changes.
- `seenTargetKeys` prevents repeated clicks on the same control.

## 7. Toolbar State

```ts
export type ToolbarState = {
  status:
    | 'ready'
    | 'expanding'
    | 'stopping'
    | 'stopped'
    | 'completed'
    | 'error';
  expanded: number;
  remaining: number;
  failed: number;
  skipped: number;
  resolveTools: 'disabled' | 'auth-required' | 'enabled';
  message?: string;
};
```

Display mapping:

- `ready`: controls are available.
- `expanding`: expansion runner is active.
- `stopping`: user clicked stop and the current operation is finishing.
- `stopped`: run was canceled.
- `completed`: run finished.
- `error`: an unexpected error occurred.

## 8. Review Thread Reference

```ts
export type ReviewThreadRef = {
  threadId: string;
  isResolved: boolean;
  filePath?: string;
  line?: number;
  authorLogin?: string;
  lastCommentBodyExcerpt?: string;
};
```

Rules:

- `threadId` is required for mutations.
- If `threadId` cannot be found, do not render resolve mutation controls.
- Other fields are optional and used for mapping GraphQL query results to DOM containers.

## 9. Background Message Data

```ts
export type ResolveThreadMessage = {
  type: 'RESOLVE_THREAD';
  threadId: string;
  prUrl: string;
};

export type UnresolveThreadMessage = {
  type: 'UNRESOLVE_THREAD';
  threadId: string;
  prUrl: string;
};
```

Response:

```ts
export type ExtensionResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: ExtensionError };
```

## 10. Error Data

```ts
export type ExtensionError = {
  code:
    | 'AUTH_REQUIRED'
    | 'PERMISSION_DENIED'
    | 'NETWORK_ERROR'
    | 'GITHUB_API_ERROR'
    | 'INVALID_THREAD_ID'
    | 'UNSUPPORTED_HOST'
    | 'DOM_TARGET_MISSING'
    | 'UNKNOWN_ERROR';
  message: string;
  retryable: boolean;
};
```

Error mapping:

| Source | Code | Retryable |
| --- | --- | --- |
| Missing token | `AUTH_REQUIRED` | false |
| Unsupported host | `UNSUPPORTED_HOST` | false |
| Empty thread ID | `INVALID_THREAD_ID` | false |
| HTTP 401 or 403 | `PERMISSION_DENIED` | false |
| Fetch failure | `NETWORK_ERROR` | true |
| GraphQL errors | `GITHUB_API_ERROR` | depends on error |
| Missing DOM target | `DOM_TARGET_MISSING` | false |

## 11. GitHub GraphQL Payloads

### 11.1 Resolve Mutation Request

```json
{
  "query": "mutation ResolveReviewThread($threadId: ID!) { resolveReviewThread(input: { threadId: $threadId }) { thread { id isResolved } } }",
  "variables": {
    "threadId": "PRRT_kw..."
  }
}
```

### 11.2 Unresolve Mutation Request

```json
{
  "query": "mutation UnresolveReviewThread($threadId: ID!) { unresolveReviewThread(input: { threadId: $threadId }) { thread { id isResolved } } }",
  "variables": {
    "threadId": "PRRT_kw..."
  }
}
```

### 11.3 Mutation Response

```ts
export type GitHubMutationResult = {
  threadId: string;
  isResolved: boolean;
};
```

Validation:

- Resolve response should return `isResolved=true`.
- Unresolve response should return `isResolved=false`.
- If response state does not match requested action, return `GITHUB_API_ERROR`.

## 12. Settings Migration

Schema version starts at `1`.

Migration behavior:

- Missing settings should be filled from defaults.
- Unknown fields should be ignored.
- Invalid arrays such as non-string Enterprise hosts should be filtered.
- Future schema versions should add explicit migration functions.
