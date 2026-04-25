# GitHub PR Comment and Resolve Chrome Extension PRD

## 1. Overview

This product is a Chrome Extension that improves GitHub Pull Request review visibility. It helps reviewers reveal comments that GitHub has collapsed or hidden because a PR has many comments, resolved conversations, outdated review threads, or lazy-loaded discussion sections.

The product has two independently configurable feature groups:

- `Comment`: read-only controls that expand hidden or collapsed PR comments.
- `Resolve/Unresolve`: optional write controls that resolve or unresolve GitHub review threads.

`Comment` must work without a GitHub token. `Resolve/Unresolve` must require explicit opt-in and authentication because it changes GitHub state.

## 2. Goals

- Make hidden PR review context easier to reveal from the PR page.
- Allow users to choose whether they only want comment display support or also want resolve-state operations.
- Keep default permissions and behavior conservative.
- Avoid disrupting GitHub's existing UI and review workflow.
- Support GitHub Enterprise hosts through configuration after the GitHub.com MVP.

## 3. Non-Goals

- Replacing GitHub's native review UI.
- Rendering comments from scratch in a separate review client.
- Editing, deleting, or creating review comments.
- Automatically resolving conversations without explicit user action.
- Supporting non-Chromium browsers in the initial MVP.

## 4. Personas

Primary persona: reviewer of large PRs who needs to inspect all review context before approval or merge.

Secondary persona: PR author who wants to find resolved and unresolved review threads quickly.

Admin persona: team member who configures GitHub Enterprise hosts and extension defaults for internal repositories.

## 5. Functional Requirements

### FR-001: PR Page Detection

Priority: Must

The extension shall run on GitHub Pull Request pages matching routes such as `https://github.com/{owner}/{repo}/pull/{number}`.

Acceptance criteria:

- Given a GitHub PR page, the extension injects its toolbar.
- Given a non-PR GitHub page, the extension does not inject PR-specific controls.
- Given a configured GitHub Enterprise host, the extension can treat matching PR routes as supported.

### FR-002: Independent Feature Toggles

Priority: Must

The extension shall expose independent settings for `Comment` and `Resolve/Unresolve`.

Acceptance criteria:

- A user can enable `Comment` while keeping `Resolve/Unresolve` disabled.
- A user can disable `Comment` while keeping `Resolve/Unresolve` disabled.
- `Resolve/Unresolve` controls never appear unless explicitly enabled.

### FR-003: Comment Expansion

Priority: Must

The extension shall provide a `Show comments` control that expands hidden or collapsed comments on the current PR page.

Acceptance criteria:

- The extension detects common GitHub controls such as `Load more`, `Show more`, and `View full conversation`.
- The extension clicks expansion controls gradually instead of firing all actions at once.
- The extension shows expanded, remaining, and failed counts.
- The extension provides a stop action to cancel queued expansion work.

### FR-004: Resolved Thread Display

Priority: Must

The extension shall allow resolved threads to be included or excluded from comment expansion.

Acceptance criteria:

- When `Include resolved threads` is off, resolved thread expansion controls are skipped.
- When `Include resolved threads` is on, resolved thread expansion controls are included.
- The user can run `Show resolved` to focus on resolved conversations.

### FR-005: Outdated Thread Display

Priority: Should

The extension shall allow outdated review threads to be included or excluded from comment expansion.

Acceptance criteria:

- When `Include outdated threads` is off, outdated thread controls are skipped.
- When `Include outdated threads` is on, outdated thread controls are included.

### FR-006: Resolve/Unresolve Controls

Priority: Should

The extension shall optionally add per-thread `Resolve` and `Unresolve` controls.

Acceptance criteria:

- Controls are hidden by default.
- Controls appear only when `Enable resolve controls` is enabled.
- If authentication is missing, controls are disabled and the UI explains that authentication is required.
- Clicking `Resolve` calls GitHub GraphQL `resolveReviewThread`.
- Clicking `Unresolve` calls GitHub GraphQL `unresolveReviewThread`.

### FR-007: Bulk Resolve/Unresolve

Priority: Could

The extension shall optionally provide bulk resolve and unresolve operations.

Acceptance criteria:

- Bulk controls are hidden unless `Allow bulk resolve/unresolve` is enabled.
- Bulk actions require confirmation before sending mutations.
- Partial success and failure counts are reported.

### FR-008: Settings

Priority: Must

The extension shall provide an options page for user settings.

Acceptance criteria:

- Settings persist across browser sessions.
- The options page includes `Enable comment expansion`, `Auto expand comments`, `Include resolved threads`, `Include outdated threads`, `Enable resolve controls`, `Allow bulk resolve/unresolve`, `GitHub token`, and `GitHub Enterprise hosts`.
- Token configuration is optional unless resolve controls are enabled.

## 6. Non-Functional Requirements

### NFR-001: Safety

Priority: Must

The extension shall default to read-only behavior. Any GitHub state mutation must require explicit user enablement and action.

### NFR-002: Performance

Priority: Must

The extension shall avoid rapid repeated clicks and excessive DOM scanning. Expansion should be throttled and cancelable.

### NFR-003: Resilience

Priority: Must

GitHub DOM structures may change. The extension shall use multiple detection signals such as accessible labels, button text, URL context, and nearby semantic containers.

### NFR-004: Security

Priority: Must

GitHub tokens shall be used only for API requests required by resolve controls. The extension shall not send tokens to non-GitHub endpoints.

### NFR-005: Usability

Priority: Should

The toolbar shall be compact, readable, and visually consistent with GitHub's interface.

## 7. User Stories

### US-001: Expand Hidden Comments

As a reviewer, I want to click `Show comments` on a PR so that hidden review comments become visible without manually opening each collapsed section.

Given I am on a GitHub PR page
When I click `Show comments`
Then the extension expands available hidden comment sections
And I can see progress counts.

### US-002: Keep Resolve Tools Disabled

As a reviewer, I want comment expansion without mutation features so that I can inspect PRs without granting write-capable credentials.

Given `Enable resolve controls` is disabled
When I open a PR page
Then no extension-provided resolve or unresolve controls are shown.

### US-003: Enable Resolve Tools

As a reviewer, I want to enable resolve controls only when needed so that I can resolve or reopen review threads from the extension.

Given `Enable resolve controls` is enabled
And a valid GitHub token is configured
When I click `Resolve` on a review thread
Then the extension marks that thread as resolved through GitHub GraphQL.

### US-004: Include Resolved Threads

As a PR author, I want to show resolved threads so that I can review the history of addressed comments.

Given `Include resolved threads` is enabled
When I click `Show resolved`
Then resolved conversations are expanded or surfaced on the PR page.

## 8. Release Scope

MVP release:

- Manifest V3 extension scaffold.
- GitHub.com PR page detection.
- Toolbar injection.
- `Comment` display toggles.
- Manual `Show comments`, `Show resolved`, and `Stop`.
- Options page with persisted settings.
- Tests for URL parsing, settings, and DOM scanner.

Post-MVP:

- GitHub GraphQL integration.
- Per-thread `Resolve` / `Unresolve`.
- Bulk resolve and unresolve.
- GitHub Enterprise host support.
- Broader E2E coverage against fixture PR pages.

## 9. Success Metrics

- Reviewers can expand hidden comments on large PRs with one action.
- Comment expansion works without a GitHub token.
- Resolve controls remain absent unless explicitly enabled.
- Manual validation succeeds on PR pages with collapsed, resolved, and outdated review content.
- Automated tests cover scanner behavior and settings behavior.
