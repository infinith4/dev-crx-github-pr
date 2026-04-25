# Infrastructure Design

## 1. Scope

This product is a client-side Chrome Extension. There is no dedicated backend service in the initial design. Runtime infrastructure consists of the browser extension package, Chrome extension APIs, GitHub web pages, Chrome storage, and GitHub API endpoints.

## 2. Runtime Environment

Supported runtime:

- Chromium-based browsers that support Manifest V3.
- GitHub.com Pull Request pages for MVP.
- GitHub Enterprise hosts after host configuration support is implemented.

Unsupported for MVP:

- Firefox extension packaging.
- Safari extension packaging.
- Server-side synchronization.
- Organization-managed policy deployment.

## 3. Extension Package

The extension package should contain:

```text
manifest.json
dist/
  background.js
  content.js
  options.html
  options.js
  styles.css
icons/
  icon-16.png
  icon-48.png
  icon-128.png
```

Source files should live under `src/` and be built into `dist/`.

## 4. Manifest V3 Configuration

Initial manifest intent:

```json
{
  "manifest_version": 3,
  "name": "GitHub PR Comment Tools",
  "version": "0.1.0",
  "permissions": ["storage"],
  "host_permissions": ["https://github.com/*"],
  "content_scripts": [
    {
      "matches": ["https://github.com/*/*/pull/*"],
      "js": ["dist/content.js"],
      "css": ["dist/styles.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  "options_page": "dist/options.html"
}
```

If GitHub Enterprise hosts are supported dynamically, the design should use `optional_host_permissions` and request host access after the user configures a host.

## 5. Storage Infrastructure

Use Chrome storage for settings.

Recommended storage split:

- `chrome.storage.sync` for non-sensitive preferences.
- `chrome.storage.local` for GitHub token if token-based authentication is implemented.

Settings should include a schema version:

```ts
export type PersistedSettings = {
  schemaVersion: 1;
  enableCommentExpansion: boolean;
  autoExpandComments: boolean;
  includeResolvedThreads: boolean;
  includeOutdatedThreads: boolean;
  enableResolveControls: boolean;
  allowBulkResolveUnresolve: boolean;
  githubEnterpriseHosts: string[];
  githubToken?: string;
};
```

Future migrations should read older schema versions and write the newest schema.

## 6. Network Infrastructure

The MVP `Comment` feature requires no network calls from the extension. It uses GitHub's existing page behavior.

`Resolve/Unresolve` requires GitHub GraphQL calls.

Endpoint mapping:

- GitHub.com: `https://api.github.com/graphql`
- GitHub Enterprise: `https://{enterprise-host}/api/graphql` unless the target Enterprise version requires a different endpoint configured by the user.

Network calls should be made by the background service worker.

## 7. Build Tooling

The repository should use a TypeScript-capable build pipeline. A minimal setup can use Vite, tsup, or esbuild. The selected tool must support:

- TypeScript compilation.
- Multiple entry points for content, background, and options.
- Copying static assets.
- Emitting Manifest V3 compatible JavaScript.

Expected commands:

```text
npm run build
npm test
```

If no package setup exists yet, implementation should create one with minimal dependencies.

## 8. Local Development

Local manual verification flow:

1. Run the extension build.
2. Open `chrome://extensions`.
3. Enable developer mode.
4. Load the repository build output as an unpacked extension.
5. Open a GitHub PR page.
6. Confirm toolbar injection and comment expansion behavior.

For automated development, use fixture HTML pages and Playwright to load the extension into Chromium.

## 9. Deployment

Initial deployment is unpacked extension installation for local use.

Later deployment options:

- Chrome Web Store package.
- Organization-managed extension deployment.
- Internal release artifact attached to GitHub Releases.

Before public distribution:

- Review extension permissions.
- Review token handling.
- Add privacy policy if token storage or API access is included.
- Add release build verification.

## 10. Observability

The extension should not send telemetry in the initial design.

Local observability:

- Toolbar status counts.
- Extension console logs in development mode.
- Structured error messages in the toolbar.
- Optional debug mode in settings for verbose logging.

Debug logs must not include GitHub tokens.

## 11. Configuration Matrix

| Configuration | Comment Expansion | Resolve Controls | Token Required |
| --- | --- | --- | --- |
| Default | Enabled manually | Disabled | No |
| Read-only reviewer | Enabled | Disabled | No |
| Resolve reviewer | Optional | Enabled | Yes |
| Enterprise read-only | Enabled | Disabled | No |
| Enterprise resolve reviewer | Optional | Enabled | Yes |

## 12. Infrastructure Risks

- GitHub UI changes can break DOM scanning. Mitigation: use multi-signal scanning and tests with fixtures.
- Manifest host permissions can become too broad. Mitigation: start with GitHub.com and request Enterprise hosts explicitly.
- Token storage increases security review burden. Mitigation: keep token optional and only needed for resolve controls.
- GitHub Enterprise API endpoints can vary. Mitigation: allow endpoint override if host-derived default fails.
