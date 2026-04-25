# Background API Module Detailed Design

## 1. Scope

The background API module receives content script messages, validates resolve operations, reads authentication settings, and calls GitHub GraphQL.

## 2. Files

- `src/background/index.ts`
- `src/background/githubGraphql.ts`

## 3. Message Handler

`src/background/index.ts` registers:

```ts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message).then(sendResponse);
  return true;
});
```

Rules:

- Always return `true` for async responses.
- Always resolve with `ExtensionResponse`.
- Never throw raw errors to Chrome runtime.

## 4. Supported Messages

```ts
type SupportedBackgroundMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'RESOLVE_THREAD'; threadId: string; prUrl: string }
  | { type: 'UNRESOLVE_THREAD'; threadId: string; prUrl: string };
```

## 5. Resolve Validation

Validation order:

1. Message type is known.
2. `threadId` is non-empty.
3. `prUrl` parses to supported PR reference.
4. Settings load successfully or fall back safely.
5. `enableResolveControls=true`.
6. Token exists.
7. Endpoint is HTTPS and allowed.

If any validation fails, return an error and do not call `fetch`.

## 6. GraphQL Client

`src/background/githubGraphql.ts` exports:

```ts
export async function resolveReviewThread(
  threadId: string,
  token: string,
  endpoint: string,
): Promise<GitHubMutationResult>;

export async function unresolveReviewThread(
  threadId: string,
  token: string,
  endpoint: string,
): Promise<GitHubMutationResult>;
```

Internal function:

```ts
async function requestGraphql<T>(
  endpoint: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T>;
```

## 7. HTTP Request

Request:

```text
POST {endpoint}
Authorization: Bearer {token}
Content-Type: application/json
Accept: application/json
```

Body:

```json
{
  "query": "...",
  "variables": {
    "threadId": "..."
  }
}
```

## 8. Response Handling

Rules:

- HTTP 401 or 403 maps to `PERMISSION_DENIED`.
- Non-2xx HTTP maps to `GITHUB_API_ERROR`.
- Failed `fetch` maps to `NETWORK_ERROR`.
- GraphQL `errors` maps to `GITHUB_API_ERROR`, unless clearly permission-related.
- Missing expected response fields maps to `GITHUB_API_ERROR`.

## 9. Endpoint Selection

Function:

```ts
export function getGraphqlEndpoint(host: string): string;
```

Rules:

- `github.com` maps to `https://api.github.com/graphql`.
- Enterprise host maps to `https://{host}/api/graphql`.
- Only configured Enterprise hosts are allowed.
- Reject non-HTTPS endpoints.

## 10. Tests

Required tests:

- Missing token returns `AUTH_REQUIRED` and does not call `fetch`.
- Disabled resolve controls return error and do not call `fetch`.
- HTTP 403 maps to `PERMISSION_DENIED`.
- GraphQL errors map to `GITHUB_API_ERROR`.
- Successful resolve returns `isResolved=true`.
- Successful unresolve returns `isResolved=false`.
