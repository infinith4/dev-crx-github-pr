# GitHub PR Comment and Resolve Chrome Extension

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `.agent/PLANS.md`. A contributor should be able to implement the feature from this file alone, without relying on prior chat context.

## Purpose / Big Picture

GitHub Pull Request pages can hide important review context when many comments, resolved threads, outdated threads, or collapsed comment groups exist. After this feature is implemented, a reviewer can open a PR page and use a Chrome Extension toolbar to expand hidden comments, show resolved or outdated threads, and optionally resolve or unresolve review threads from extension-provided controls.

The extension has two independent capability groups. `Comment` controls only display and expansion behavior, and must work without a GitHub token. `Resolve/Unresolve` controls write review-thread state through the GitHub GraphQL API and must be explicitly enabled by the user with appropriate credentials.

## Progress

- [x] (2026-04-26 06:28 JST) Created the initial implementation plan for a Chrome Extension that separates `Comment` display features from `Resolve/Unresolve` mutation features.
- [x] (2026-04-26 07:08 JST) Scaffolded the Manifest V3 Chrome Extension project with TypeScript, esbuild, Vitest, `manifest.json`, content script, background service worker, and options page.
- [x] (2026-04-26 07:08 JST) Implemented PR page detection and non-mutating comment expansion through a toolbar, DOM scanner, and throttled expansion runner.
- [x] (2026-04-26 07:08 JST) Added options storage for independent `Comment` and `Resolve/Unresolve` feature toggles.
- [x] (2026-04-26 07:08 JST) Added GitHub GraphQL client and background message handling for optional `Resolve/Unresolve` operations.
- [x] (2026-04-26 07:08 JST) Added unit tests for URL parsing, settings normalization, DOM scanner classification, and GraphQL mutation handling.
- [x] (2026-04-26 07:08 JST) Validated with `npm test`, `npm run build`, and `npx tsc --noEmit`.
- [ ] Manually validate the unpacked extension on real GitHub PR pages with collapsed, resolved, and outdated comments.

## Surprises & Discoveries

- Observation: GitHub exposes `resolveReviewThread` and `unresolveReviewThread` GraphQL mutations for changing review thread resolution state.
  Evidence: GitHub GraphQL mutation documentation lists both mutations and returns the affected `PullRequestReviewThread`.
- Observation: Chrome Manifest V3 content scripts can be injected for matching GitHub PR URLs and can communicate with extension storage/background code.
  Evidence: Chrome extension documentation describes `content_scripts` in `manifest.json` and isolated content script execution.
- Observation: jsdom does not calculate normal browser layout values such as `offsetParent` for simple fixture elements.
  Evidence: Initial scanner tests returned no visible targets until `isVisible` treated connected jsdom elements without hidden styles as visible.

## Decision Log

- Decision: Split `Comment` and `Resolve/Unresolve` into independent extension feature groups.
  Rationale: Comment expansion is read-only and can run with minimal permissions, while resolve operations require authentication and can mutate GitHub state.
  Date/Author: 2026-04-26 / Codex

- Decision: Implement the first milestone using DOM-based expansion of GitHub's existing controls.
  Rationale: This gives value without requiring GitHub API credentials and avoids duplicating GitHub's rendering of comment Markdown, reactions, and thread metadata.
  Date/Author: 2026-04-26 / Codex

- Decision: Use GitHub GraphQL only for explicit resolve-state changes.
  Rationale: `Resolve/Unresolve` is a write operation and should be routed through supported API mutations instead of trying to automate private GitHub UI behavior.
  Date/Author: 2026-04-26 / Codex

- Decision: Store all extension settings in `chrome.storage.local` for the first implementation.
  Rationale: The initial product is local-first, token-bearing, and does not require cross-device sync. Keeping the storage path unified reduces implementation complexity while preserving the option to split non-sensitive preferences into sync storage later.
  Date/Author: 2026-04-26 / Codex

## Outcomes & Retrospective

Initial implementation is complete for the documented MVP. The repository now contains a buildable Chrome Extension with a GitHub PR toolbar, read-only comment expansion, independent settings, optional resolve/unresolve GraphQL plumbing, and unit coverage for the core pure modules. Automated validation passes with `npm test`, `npm run build`, and `npx tsc --noEmit`. Remaining validation is manual testing against real GitHub PR pages because live GitHub DOM variants and authenticated resolve actions cannot be proven from local unit tests alone.

## Context and Orientation

The repository is intended to contain a Chrome Extension for GitHub Pull Request review support. The extension should target pages whose URL matches GitHub PR routes such as `https://github.com/{owner}/{repo}/pull/{number}`. Enterprise GitHub hosts should be supported later through user configuration rather than hard-coding only `github.com`.

Important terms:

`Comment` means a read-only display feature that expands or reveals hidden PR comments, review threads, resolved conversations, outdated conversations, and `Load more` sections. This feature must not change GitHub state.

`Resolve/Unresolve` means a write feature that marks a GitHub pull request review thread as resolved or unresolved. This feature changes server-side GitHub state and must require explicit user opt-in.

`Content script` means JavaScript injected by the Chrome Extension into matching GitHub pages. It can inspect and modify the page DOM, add the extension toolbar, and send messages to the extension background script.

`Background service worker` means the Manifest V3 extension process that can perform privileged extension work such as centralized API calls and storage access.

`GraphQL API` means GitHub's structured API endpoint used for query and mutation operations. The extension should call `resolveReviewThread` and `unresolveReviewThread` only after the user enables resolve controls and configures authentication.

## Plan of Work

First, scaffold a Manifest V3 Chrome Extension with a content script, background service worker, options page, and shared settings module. The content script should run on GitHub PR pages and add a compact toolbar to the PR page without disrupting GitHub's layout.

Second, implement the `Comment` feature group. The content script should scan for GitHub buttons or links that reveal hidden review content, including labels such as `Load more`, `Show more`, `View full conversation`, collapsed resolved threads, and outdated thread controls. It should click these controls gradually with a delay, wait for DOM changes through `MutationObserver`, and stop after a configured maximum number of operations. The toolbar should expose `Show comments`, `Show resolved`, `Stop`, and status counts.

Third, implement settings. The options page should store independent settings in `chrome.storage.sync` or `chrome.storage.local`: `enableCommentExpansion`, `autoExpandComments`, `includeResolvedThreads`, `includeOutdatedThreads`, `enableResolveControls`, `allowBulkResolveUnresolve`, `githubEnterpriseHosts`, and `githubToken`. The token should be optional and only required when resolve controls are enabled.

Fourth, implement the `Resolve/Unresolve` feature group. When `enableResolveControls` is disabled, no mutation buttons should be injected. When enabled and authenticated, the extension should discover review thread identifiers from GitHub page data or a GraphQL query, render per-thread `Resolve` or `Unresolve` controls, and execute GitHub GraphQL mutations through the background service worker. Bulk operations should remain off by default and require a confirmation prompt.

Fifth, add tests. Unit tests should cover URL parsing, settings defaults, DOM scanner classification, and GraphQL request construction. Integration tests should use local HTML fixtures representing PR pages with collapsed comments and resolved threads. End-to-end tests should load the extension in Chromium and verify that the toolbar expands fixture content and that resolve controls remain hidden unless enabled.

## Concrete Steps

Work from the repository root:

    C:\Projects\github\infinith4\dev-crx-github-pr

Create or update these expected files during implementation:

    manifest.json
    src/content/index.ts
    src/content/commentScanner.ts
    src/content/toolbar.ts
    src/background/index.ts
    src/background/githubGraphql.ts
    src/options/index.html
    src/options/index.ts
    src/shared/settings.ts
    src/shared/githubPrUrl.ts
    src/test/commentScanner.test.ts
    src/test/settings.test.ts
    src/test/githubGraphql.test.ts

The initial implementation should add a Manifest V3 manifest similar in structure to:

    manifest_version: 3
    permissions: storage
    host_permissions: https://github.com/*
    content_scripts: matches https://github.com/*/*/pull/*
    background: service_worker compiled from src/background/index.ts
    options_page: compiled options page

The `Comment` feature should be implemented before API writes. A successful first milestone is visible when a PR page shows an extension toolbar and clicking `Show comments` expands collapsed comment controls without requiring a token.

The `Resolve/Unresolve` feature should be implemented after settings and authentication exist. A successful second milestone is visible when enabling resolve controls adds per-thread controls and a successful mutation updates the thread state or reports a clear API error.

## Validation and Acceptance

The read-only comment feature is accepted when all of these behaviors are true:

- Opening a GitHub PR page injects one toolbar and does not duplicate it during navigation or DOM updates.
- With `Enable comment expansion` on, pressing `Show comments` expands available hidden comments and increments an expanded count.
- With `Include resolved threads` off, resolved-thread expansion controls are skipped.
- With `Include resolved threads` on, resolved-thread expansion controls are included.
- Pressing `Stop` cancels queued expansion work.
- No GitHub token is needed for any read-only comment expansion behavior.

The resolve feature is accepted when all of these behaviors are true:

- With `Enable resolve controls` off, no extension-provided resolve or unresolve buttons appear.
- With `Enable resolve controls` on and no token configured, the toolbar shows a clear authentication-required state and performs no mutation.
- With a valid token and required repository permissions, clicking a per-thread `Resolve` button calls `resolveReviewThread`.
- With a valid token and required repository permissions, clicking a per-thread `Unresolve` button calls `unresolveReviewThread`.
- Bulk resolve or unresolve controls are hidden unless `Allow bulk resolve/unresolve` is enabled.
- Bulk operations require confirmation before any mutation is sent.

Run the project test command once it exists. If the project uses npm, the expected validation commands are:

    npm test
    npm run build

Expected result: tests pass, build completes, and no extension permission warnings exceed the documented host and storage needs.

## Idempotence and Recovery

The content script must be idempotent. Running initialization multiple times on the same page should reuse or replace the existing extension toolbar instead of adding duplicates. Comment expansion should track controls already clicked during the current run and should tolerate controls disappearing after GitHub re-renders part of the page.

API mutations must be explicit and recoverable. If a resolve mutation fails, the UI should keep the previous state and show the error. Bulk operations should process threads one by one and report partial success rather than assuming all mutations succeeded.

Settings changes should take effect without requiring extension reinstall. If a user disables resolve controls, injected resolve buttons should be removed or disabled on the next content-script refresh.

## Artifacts and Notes

Initial feature grouping:

    Comment:
      enableCommentExpansion
      autoExpandComments
      includeResolvedThreads
      includeOutdatedThreads

    Resolve/Unresolve:
      enableResolveControls
      allowBulkResolveUnresolve
      githubToken

Suggested toolbar shape:

    [Show comments] [Show resolved] [Resolve tools: Off] [Stop] [Settings]
    expanded: 0, remaining: 0, failed: 0

## Interfaces and Dependencies

The extension should use Chrome Manifest V3 APIs and TypeScript.

In `src/shared/settings.ts`, define a settings type equivalent to:

    export type ExtensionSettings = {
      enableCommentExpansion: boolean;
      autoExpandComments: boolean;
      includeResolvedThreads: boolean;
      includeOutdatedThreads: boolean;
      enableResolveControls: boolean;
      allowBulkResolveUnresolve: boolean;
      githubEnterpriseHosts: string[];
      githubToken?: string;
    };

In `src/shared/githubPrUrl.ts`, define:

    export type PullRequestRef = {
      host: string;
      owner: string;
      repo: string;
      number: number;
    };

    export function parsePullRequestUrl(url: string): PullRequestRef | null;

In `src/content/commentScanner.ts`, define:

    export type CommentExpansionTarget = {
      element: HTMLElement;
      kind: 'load-more' | 'show-more' | 'resolved-thread' | 'outdated-thread' | 'full-conversation';
      label: string;
    };

    export function findCommentExpansionTargets(root: ParentNode, settings: ExtensionSettings): CommentExpansionTarget[];

In `src/background/githubGraphql.ts`, define:

    export async function resolveReviewThread(threadId: string, token: string, endpoint?: string): Promise<void>;
    export async function unresolveReviewThread(threadId: string, token: string, endpoint?: string): Promise<void>;

Revision note: Created initial plan from the user request to document a Chrome Extension that can independently enable comment expansion and resolve/unresolve operations.
