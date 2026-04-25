# Sequence Design

## 1. Scope

This document defines runtime sequences for initialization, comment expansion, settings changes, resolve/unresolve operations, and bulk operations.

## 2. Content Script Initialization

```mermaid
sequenceDiagram
    participant Chrome as Chrome
    participant App as ContentApp
    participant Url as githubPrUrl
    participant Settings as SettingsRepository
    participant Toolbar as ToolbarController
    participant Resolve as ResolveControls

    Chrome->>App: Execute content script
    App->>Url: parsePullRequestUrl(location.href)
    alt PR URL
        App->>Settings: getSettings()
        Settings-->>App: ExtensionSettings
        App->>Toolbar: mount(page container)
        Toolbar-->>App: handlers registered
        App->>Resolve: render(document, settings)
        App->>App: bind navigation observer
    else Not PR URL
        App->>Toolbar: unmount()
        App->>Resolve: remove(document)
    end
```

Detailed behavior:

1. `initContentApp()` parses `location.href`.
2. If unsupported, it removes extension UI and exits.
3. If supported, it loads settings.
4. It mounts the toolbar if no toolbar root exists.
5. It wires toolbar handlers to the expansion runner and background messages.
6. It renders resolve controls only when settings allow.
7. It subscribes to storage changes and GitHub client-side navigation.

Failure behavior:

- If settings loading fails, use defaults with `enableResolveControls=false`.
- If toolbar insertion point cannot be found, append near the top of the PR main content when possible.
- If no safe insertion point exists, log a development warning and exit without throwing.

## 3. Show Comments

```mermaid
sequenceDiagram
    participant User as User
    participant Toolbar as ToolbarController
    participant Runner as CommentExpansionRunner
    participant Scanner as CommentScanner
    participant Page as GitHub Page

    User->>Toolbar: Click Show comments
    Toolbar->>Runner: start('all-comments')
    Runner->>Scanner: findCommentExpansionTargets(document, settings, all-comments)
    Scanner-->>Runner: targets
    Runner-->>Toolbar: update remaining count
    loop each target
        Runner->>Runner: check stopped and max operations
        Runner->>Page: element.click()
        Page-->>Runner: DOM changes
        Runner->>Runner: wait debounce delay
        Runner->>Scanner: rescan
        Scanner-->>Runner: new targets
        Runner-->>Toolbar: update counts
    end
    Runner-->>Toolbar: final ExpansionResult
```

Important rules:

- The runner must not run two expansion jobs at the same time.
- A second `Show comments` click while running should be ignored or converted to a status message.
- The target queue must deduplicate by target key.
- The runner must stop when there are no new targets after a scan.

## 4. Show Resolved

```mermaid
sequenceDiagram
    participant User as User
    participant Toolbar as ToolbarController
    participant Runner as CommentExpansionRunner
    participant Scanner as CommentScanner

    User->>Toolbar: Click Show resolved
    Toolbar->>Runner: start('resolved-only')
    Runner->>Scanner: findCommentExpansionTargets(document, settings, resolved-only)
    Scanner-->>Runner: resolved-thread targets
    Runner-->>Toolbar: update progress
    Runner-->>Toolbar: final result
```

Important rules:

- `Show resolved` is display-only.
- It must not call GitHub GraphQL mutations.
- It should scan resolved thread controls even when the general `includeResolvedThreads` setting is off, because the user explicitly chose the resolved-only command.

## 5. Stop Expansion

```mermaid
sequenceDiagram
    participant User as User
    participant Toolbar as ToolbarController
    participant Runner as CommentExpansionRunner

    User->>Toolbar: Click Stop
    Toolbar->>Runner: stop()
    Runner->>Runner: set stopped flag
    Runner-->>Toolbar: stopped status after current operation
```

Important rules:

- Stop must be synchronous from the user's perspective; the toolbar should immediately show `Stopped` or `Stopping`.
- The runner may finish the currently executing click.
- It must not start another click after the stopped flag is set.

## 6. Settings Change

```mermaid
sequenceDiagram
    participant User as User
    participant Options as OptionsPage
    participant Storage as ChromeStorage
    participant App as ContentApp
    participant Toolbar as ToolbarController
    participant Resolve as ResolveControls

    User->>Options: Change setting
    Options->>Storage: Save
    Storage-->>App: onChanged
    App->>Storage: getSettings()
    Storage-->>App: ExtensionSettings
    App->>Toolbar: update state
    alt Resolve enabled
        App->>Resolve: render(document, settings)
    else Resolve disabled
        App->>Resolve: remove(document)
    end
```

Important rules:

- Changes should affect future operations immediately.
- A currently running comment expansion should keep its initial settings until stopped or finished.
- Disabling resolve controls should remove or disable injected resolve buttons.

## 7. Resolve Thread

```mermaid
sequenceDiagram
    participant User as User
    participant ResolveUI as ResolveControls
    participant BG as Background
    participant Settings as SettingsRepository
    participant API as GitHubGraphqlClient
    participant GitHub as GitHub GraphQL API

    User->>ResolveUI: Click Resolve
    ResolveUI->>BG: RESOLVE_THREAD(threadId, prUrl)
    BG->>Settings: getSettings()
    Settings-->>BG: ExtensionSettings
    BG->>BG: validate enabled, token, host, threadId
    alt invalid
        BG-->>ResolveUI: ExtensionResponse error
    else valid
        BG->>API: resolveReviewThread(threadId, token, endpoint)
        API->>GitHub: POST GraphQL mutation
        GitHub-->>API: mutation result
        API-->>BG: GitHubMutationResult
        BG-->>ResolveUI: ExtensionResponse ok
        ResolveUI-->>User: Mark resolved in extension UI
    end
```

Important rules:

- The UI must not mark a thread as resolved until the API succeeds.
- If the API returns a permission error, show a concise permission message.
- The raw token must not leave the background service worker.

## 8. Unresolve Thread

The `Unresolve` sequence is the same as `Resolve Thread`, except:

- The message type is `UNRESOLVE_THREAD`.
- The background worker calls `unresolveReviewThread`.
- The UI marks the thread as unresolved only after success.

## 9. Bulk Resolve/Unresolve

```mermaid
sequenceDiagram
    participant User as User
    participant ResolveUI as ResolveControls
    participant Queue as BulkMutationQueue
    participant BG as Background

    User->>ResolveUI: Click bulk action
    ResolveUI->>ResolveUI: Confirm action
    alt canceled
        ResolveUI-->>User: No change
    else confirmed
        ResolveUI->>Queue: enqueue selected thread ids
        loop one thread at a time
            Queue->>BG: RESOLVE_THREAD or UNRESOLVE_THREAD
            BG-->>Queue: success or error
            Queue-->>ResolveUI: update counts
        end
        ResolveUI-->>User: show final bulk result
    end
```

Important rules:

- Bulk operations are not part of MVP.
- Bulk operations are hidden unless explicitly enabled.
- Process sequentially in initial implementation.
- Continue after individual failures and report partial results.

## 10. GitHub Client-Side Navigation

```mermaid
sequenceDiagram
    participant GitHub as GitHub SPA Navigation
    participant App as ContentApp
    participant Toolbar as ToolbarController
    participant Resolve as ResolveControls

    GitHub-->>App: URL or DOM changes
    App->>App: debounce navigation check
    App->>App: parse current URL
    alt still supported PR
        App->>Toolbar: ensure mounted once
        App->>Resolve: refresh controls
    else unsupported
        App->>Toolbar: unmount
        App->>Resolve: remove
    end
```

Important rules:

- Navigation handling must be debounced.
- Toolbar roots from old PR pages must be cleaned up.
- Expansion run state should reset on PR URL change.
