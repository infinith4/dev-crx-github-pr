import { isSupportedPullRequestUrl } from '../shared/githubPrUrl';
import type { ExtensionResponse, SettingsResponse } from '../shared/messages';
import { DEFAULT_SETTINGS, type ExtensionSettings } from '../shared/settings';
import { CommentExpansionRunner } from './commentExpansionRunner';
import { renderResolveControls, removeResolveControls } from './resolveControls';
import { ToolbarController, type ToolbarState } from './toolbar';

let toolbar: ToolbarController | null = null;
let runner: CommentExpansionRunner | null = null;
let observer: MutationObserver | null = null;
let lastUrl = '';
let autoExpandedUrls = new Set<string>();
let currentSettings: ExtensionSettings = DEFAULT_SETTINGS;
let hasToken = false;

void initContentApp();

export async function initContentApp(): Promise<void> {
  const settingsResponse = await loadSettings();
  currentSettings = { ...settingsResponse.settings };
  hasToken = settingsResponse.hasToken;

  if (!isSupportedPullRequestUrl(location.href, currentSettings)) {
    disposeContentApp();
    return;
  }

  lastUrl = location.href;
  const container = findInsertionContainer();
  if (!container) return;

  toolbar = toolbar ?? new ToolbarController();
  toolbar.mount(container, {
    showComments: () => void startExpansion('all-comments'),
    showResolved: () => void startExpansion('resolved-only'),
    stop: () => stopExpansion(),
    openSettings: () => void chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' }),
  });

  updateToolbar({
    status: 'ready',
    expanded: 0,
    remaining: 0,
    failed: 0,
    skipped: 0,
    resolveTools: resolveToolsState(),
  });

  refreshResolveControls();
  bindPageObserver();

  if (currentSettings.autoExpandComments && currentSettings.enableCommentExpansion && !autoExpandedUrls.has(location.href)) {
    autoExpandedUrls.add(location.href);
    void startExpansion('all-comments');
  }
}

export function disposeContentApp(): void {
  runner?.stop();
  runner = null;
  toolbar?.unmount();
  toolbar = null;
  observer?.disconnect();
  observer = null;
  removeResolveControls(document);
}

async function startExpansion(mode: 'all-comments' | 'resolved-only'): Promise<void> {
  if (!currentSettings.enableCommentExpansion) {
    updateToolbar(baseState('ready', 'Comment expansion is disabled.'));
    return;
  }
  if (runner?.isRunning()) {
    updateToolbar(baseState('expanding', 'Expansion is already running.'));
    return;
  }

  runner = new CommentExpansionRunner({
    root: document,
    settings: currentSettings,
    onProgress: (progress) => {
      updateToolbar({
        status: progress.running ? 'expanding' : progress.stopped ? 'stopped' : 'completed',
        expanded: progress.expanded,
        remaining: progress.remaining,
        failed: progress.failed,
        skipped: progress.skipped,
        resolveTools: resolveToolsState(),
      });
    },
  });

  const result = await runner.start(mode);
  updateToolbar({
    status: result.stopped ? 'stopped' : 'completed',
    expanded: result.expanded,
    remaining: 0,
    failed: result.failed,
    skipped: result.skipped,
    resolveTools: resolveToolsState(),
    message: result.expanded === 0 && result.failed === 0 ? 'No hidden comments found.' : undefined,
  });
}

function stopExpansion(): void {
  runner?.stop();
  updateToolbar(baseState('stopping'));
}

function refreshResolveControls(): void {
  if (currentSettings.enableResolveControls) {
    renderResolveControls(document, currentSettings, { hasToken, prUrl: location.href });
  } else {
    removeResolveControls(document);
  }
}

function bindPageObserver(): void {
  if (observer) return;
  observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      void initContentApp();
      return;
    }
    refreshResolveControls();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function findInsertionContainer(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('#discussion_bucket') ??
    document.querySelector<HTMLElement>('[data-testid="issue-viewer-issue-container"]') ??
    document.querySelector<HTMLElement>('main') ??
    document.body
  );
}

async function loadSettings(): Promise<SettingsResponse> {
  try {
    const response = (await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' })) as ExtensionResponse<SettingsResponse>;
    if (response.ok) return response.data;
  } catch {
    // Fall through to safe defaults.
  }
  return { settings: DEFAULT_SETTINGS, hasToken: false };
}

function updateToolbar(state: ToolbarState): void {
  toolbar?.updateState(state);
}

function baseState(status: ToolbarState['status'], message?: string): ToolbarState {
  return {
    status,
    expanded: 0,
    remaining: 0,
    failed: 0,
    skipped: 0,
    resolveTools: resolveToolsState(),
    message,
  };
}

function resolveToolsState(): ToolbarState['resolveTools'] {
  if (!currentSettings.enableResolveControls) return 'disabled';
  return hasToken ? 'enabled' : 'auth-required';
}
