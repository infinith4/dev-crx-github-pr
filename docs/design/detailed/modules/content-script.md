# Content Script Module Detailed Design

## 1. Scope

The content script owns all interaction with the GitHub PR page DOM. It injects the extension toolbar, scans for hidden comment controls, runs read-only expansion actions, and renders optional resolve controls.

## 2. Entry Point

File: `src/content/index.ts`

Exports:

```ts
export async function initContentApp(): Promise<void>;
export function disposeContentApp(): void;
```

Initialization steps:

1. Parse `location.href`.
2. Load settings through the shared settings repository or background message.
3. If the URL is unsupported, remove existing extension UI.
4. Create or reuse toolbar root.
5. Bind toolbar events.
6. Create `CommentExpansionRunner`.
7. Render resolve controls if enabled.
8. Attach navigation and storage listeners.

## 3. DOM Root

The toolbar root should use:

```text
data-github-pr-comment-tools-root="true"
```

Rules:

- If an existing root is found, update it rather than adding another one.
- If the page is no longer a PR page, remove it.
- CSS should be scoped to this root where possible.

## 4. Navigation Handling

GitHub uses client-side navigation in some contexts. The content script should detect URL changes with a lightweight interval or observer.

State:

```ts
let currentUrl = location.href;
let navigationTimer: number | undefined;
```

Rules:

- Debounce reinitialization.
- Reset expansion runner on PR URL change.
- Re-render toolbar and resolve controls after navigation.

## 5. Toolbar Event Mapping

| Toolbar Event | Content Action |
| --- | --- |
| `show-comments` | `runner.start('all-comments')` |
| `show-resolved` | `runner.start('resolved-only')` |
| `stop` | `runner.stop()` |
| `open-settings` | send `OPEN_OPTIONS` message |

Rules:

- Ignore `show-comments` if `enableCommentExpansion=false`.
- Ignore new expansion starts while another run is active.
- Show a toolbar message instead of throwing.

## 6. Auto Expansion

If `autoExpandComments=true`, the content script may start `show-comments` after initialization.

Rules:

- Auto expansion should run only once per PR URL.
- Auto expansion must respect `enableCommentExpansion`.
- Auto expansion must not trigger resolve mutations.

## 7. Resolve Controls

Resolve controls are rendered only when `enableResolveControls=true`.

Rules:

- If token availability is false, render disabled controls or toolbar auth state.
- If thread ID is unavailable, skip that thread.
- On click, send a background message and wait for success before updating UI.

## 8. Cleanup

`disposeContentApp()` must:

- Remove toolbar event listeners.
- Stop active expansion runner.
- Remove resolve controls.
- Disconnect observers.
- Clear timers.

## 9. Tests

Required tests:

- Calling init twice produces one toolbar.
- Unsupported URL produces no toolbar.
- PR URL change resets run state.
- `show-resolved` calls runner with `resolved-only`.
- Resolve controls are not rendered when disabled.
