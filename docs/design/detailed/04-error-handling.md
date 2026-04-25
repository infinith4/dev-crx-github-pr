# Error Handling Design

## 1. Error Handling Policy

The extension should fail closed for state-changing behavior and degrade gracefully for display-only behavior.

Display-only `Comment` errors should not break the GitHub PR page. The extension should skip failed targets and keep the toolbar usable. `Resolve/Unresolve` errors should prevent UI state changes unless GitHub confirms success.

## 2. Error Categories

| Category | Examples | User Impact | Handling |
| --- | --- | --- | --- |
| Configuration | Missing token, disabled setting | Feature unavailable | Show disabled or auth-required state |
| DOM | Target disappeared, unsupported GitHub markup | Some comments not expanded | Skip target and continue |
| Network | Fetch failed, timeout | Mutation not completed | Show retryable error |
| Authorization | Invalid token, insufficient repo permission | Mutation not completed | Show permission error |
| API | GraphQL errors, unexpected response | Mutation uncertain or failed | Show API error and keep previous UI state |
| Internal | Unexpected exception | Feature run interrupted | Convert to `UNKNOWN_ERROR` and log safely |

## 3. Shared Error Type

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

## 4. Comment Expansion Errors

### 4.1 Target Missing

Condition:

- Scanner found a target, but the element is gone before click.
- GitHub rerendered the thread.

Handling:

- Increment `skipped` or `failed`.
- Do not retry the same target key.
- Continue with the next target.

User message:

```text
Some comments could not be expanded.
```

### 4.2 Click Throws

Condition:

- Calling `element.click()` throws.
- The element is disabled or detached.

Handling:

- Increment `failed`.
- Store development log without sensitive data.
- Continue with the next target.

### 4.3 Max Operations Reached

Condition:

- Expansion count reaches configured maximum.

Handling:

- Stop the run.
- Show status `Completed with limit`.
- Do not treat as fatal.

User message:

```text
Stopped after reaching the expansion limit.
```

### 4.4 No Targets

Condition:

- Scanner finds no targets.

Handling:

- Show `completed`.
- Counts remain zero.

User message:

```text
No hidden comments found.
```

## 5. Settings Errors

### 5.1 Storage Read Failure

Handling:

- Use defaults.
- Force `enableResolveControls=false`.
- Show non-blocking warning in toolbar or console.

### 5.2 Invalid Settings Shape

Handling:

- Merge valid fields with defaults.
- Ignore invalid fields.
- Persist cleaned settings on next save.

### 5.3 Invalid Enterprise Host

Handling:

- Reject the field in options page validation.
- Show a user-facing validation message.

Validation examples:

- Accept `github.example.com`.
- Reject `https://github.example.com/path`.
- Reject empty strings.
- Reject hosts containing spaces.

## 6. Resolve/Unresolve Errors

### 6.1 Resolve Controls Disabled

Condition:

- Content script or background receives a resolve request while `enableResolveControls=false`.

Handling:

- Reject with `PERMISSION_DENIED` or `AUTH_REQUIRED` style disabled state.
- Do not call GitHub API.

Preferred response:

```ts
{
  ok: false,
  error: {
    code: 'PERMISSION_DENIED',
    message: 'Resolve controls are disabled.',
    retryable: false
  }
}
```

### 6.2 Missing Token

Handling:

- Return `AUTH_REQUIRED`.
- Do not call GitHub API.

Message:

```text
Configure a GitHub token to use Resolve/Unresolve.
```

### 6.3 Unsupported Host

Handling:

- Return `UNSUPPORTED_HOST`.
- Do not call GitHub API.

Message:

```text
This GitHub host is not configured.
```

### 6.4 Invalid Thread ID

Handling:

- Return `INVALID_THREAD_ID`.
- Do not call GitHub API.
- Do not render mutation buttons when thread ID is missing.

### 6.5 Network Failure

Handling:

- Return `NETWORK_ERROR`.
- Mark retryable as `true`.
- Keep previous UI state.

### 6.6 GitHub Authorization Failure

Condition:

- HTTP 401 or 403.
- GraphQL error indicates permission denial.

Handling:

- Return `PERMISSION_DENIED`.
- Keep previous UI state.

Message:

```text
GitHub denied this operation. Check token permissions.
```

### 6.7 GraphQL Validation or Mutation Error

Handling:

- Return `GITHUB_API_ERROR`.
- Include concise message.
- Do not expose raw token or headers.

## 7. Bulk Operation Errors

Bulk operations process items independently.

Rules:

- Continue after individual failures.
- Track `success`, `failed`, and `skipped`.
- Show final summary.
- Do not retry automatically unless explicitly implemented.

Bulk result type:

```ts
export type BulkMutationResult = {
  requested: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: ExtensionError[];
};
```

## 8. Logging

Development logging:

- Use a debug setting.
- Avoid noisy default logs.
- Never log tokens.
- Never log authorization headers.

Allowed logs:

- Error code.
- Host.
- PR owner/repo/number.
- Target kind.
- Counts.

Disallowed logs:

- GitHub token.
- Full request headers.
- Full private comment body unless explicitly needed in a local test fixture.

## 9. User-Facing Error Messages

Use concise messages:

- `No hidden comments found.`
- `Stopped after reaching the expansion limit.`
- `Configure a GitHub token to use Resolve/Unresolve.`
- `GitHub denied this operation. Check token permissions.`
- `Network error. Retry the operation.`
- `This GitHub host is not configured.`

## 10. Acceptance Criteria

- Comment expansion continues after a missing DOM target.
- Stop action never reports as an error.
- Missing token prevents API calls.
- Unsupported host prevents API calls.
- Failed resolve mutation does not change local thread state.
- Bulk operation reports partial failures.
- No error path logs token values.
