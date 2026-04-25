# Non-Functional Design

## 1. Performance

The extension must remain lightweight on large PR pages.

Requirements:

- Toolbar injection should complete within 500 ms after content script execution on typical PR pages.
- DOM scans should be scoped to PR conversation and review containers where possible.
- Expansion clicks should be throttled to avoid rapid repeated GitHub UI actions.
- The default maximum expansion operation count should be bounded.
- `MutationObserver` callbacks should be debounced.

Recommended defaults:

- Expansion click delay: 300 to 700 ms.
- DOM rescan debounce: 200 ms.
- Maximum operations per run: 100.
- Bulk mutation concurrency: 1 for initial implementation.

## 2. Reliability

GitHub PR pages are dynamic and may re-render during navigation.

Requirements:

- Initialization must be idempotent.
- The toolbar must not duplicate after GitHub client-side navigation.
- Missing or changed DOM targets must not crash the extension.
- Expansion should stop naturally when no new targets are found.
- API failures must return structured errors.

Recovery behavior:

- If a DOM target disappears, skip it and continue.
- If a GraphQL mutation fails, preserve the previous UI state and show an error.
- If settings cannot be loaded, use safe defaults with resolve controls disabled.

## 3. Maintainability

The implementation should isolate fragile GitHub DOM knowledge.

Requirements:

- Keep DOM target detection inside `src/content/commentScanner.ts`.
- Keep GitHub API calls inside `src/background/githubGraphql.ts`.
- Keep settings defaults and schema in `src/shared/settings.ts`.
- Keep URL parsing in `src/shared/githubPrUrl.ts`.
- Avoid mixing toolbar rendering, DOM scanning, and API mutation logic in one file.

The scanner should be covered by fixture-based tests so future GitHub DOM changes can be handled by updating one module.

## 4. Usability

The toolbar should support repeated review workflows without becoming intrusive.

Requirements:

- The toolbar should be compact and visually compatible with GitHub.
- Primary actions must be clear: `Show comments`, `Show resolved`, `Stop`, and `Settings`.
- Resolve status must be visible but not dominant.
- Disabled states must explain what is missing, such as authentication.
- Progress counts must be understandable without opening developer tools.

The extension should avoid modal dialogs except for risky bulk operations.

## 5. Accessibility

Requirements:

- Toolbar controls must be keyboard reachable.
- Buttons must have accessible names.
- Status updates should be exposed through an accessible live region when practical.
- Color must not be the only signal for success, failure, or disabled states.
- Focus should not be stolen during background expansion except when the user opens settings or confirmation dialogs.

## 6. Security and Privacy

Requirements:

- Read-only comment expansion must not require credentials.
- Resolve controls must be disabled by default.
- Tokens must not be rendered into the page.
- Tokens must not be logged.
- No telemetry should be sent in the initial implementation.

Privacy stance:

- The extension processes PR page content locally.
- Network calls are limited to GitHub API calls required for enabled resolve operations.
- No external analytics service is used.

## 7. Compatibility

MVP compatibility:

- Chrome or Chromium browsers with Manifest V3 support.
- GitHub.com PR pages.

Post-MVP compatibility:

- GitHub Enterprise hosts configured by the user.
- Additional Chromium browsers such as Edge, if Manifest V3 behavior is compatible.

Non-goals:

- Firefox extension packaging.
- Safari extension packaging.
- Mobile browsers.

## 8. Testability

Requirements:

- Pure modules should be testable without a browser extension runtime.
- DOM scanning should be testable with HTML fixtures.
- Background API calls should be testable with mocked `fetch`.
- Content script initialization should be tested for idempotence.

Test levels:

- Unit tests for URL parser, settings, scanner, and GraphQL request construction.
- Integration tests for toolbar plus scanner on fixture DOM.
- E2E tests for extension loading and user flows in Chromium.

Acceptance:

- `npm test` passes.
- `npm run build` passes.
- Fixture tests prove that resolve controls are absent by default.
- Fixture tests prove that comment expansion works without a token.

## 9. Operability

Requirements:

- The toolbar should show run status and failures.
- Debug logging should be disabled by default.
- Debug logs must be opt-in and must not include token values.
- The options page should show enough configuration state to diagnose disabled resolve controls.

Useful status labels:

- `Ready`
- `Expanding`
- `Stopped`
- `Authentication required`
- `Permission denied`
- `Completed with failures`

## 10. Scalability Limits

The extension operates within one browser tab and one PR page at a time.

Expected limits:

- Large PR with hundreds of comments.
- Dozens of resolved or outdated threads.
- Multiple PR tabs open independently.

Design constraints:

- Do not share expansion run state across tabs.
- Do not keep long-lived in-memory caches that assume a PR page remains unchanged.
- Keep API mutation queues per tab or per request.

## 11. Quality Gates

Before MVP completion:

- PR page toolbar injection is idempotent.
- Comment expansion is throttled and cancelable.
- Settings persist.
- Resolve controls are disabled by default.
- Unit tests cover settings and scanner behavior.

Before enabling resolve operations:

- GitHub token is never exposed in DOM.
- Missing token and permission errors are handled.
- Individual resolve and unresolve operations are tested with mocked API responses.
- Bulk operations remain disabled unless explicitly enabled.
