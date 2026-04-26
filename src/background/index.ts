import { getGraphqlEndpoint, isSupportedPullRequestUrl, parsePullRequestUrl } from '../shared/githubPrUrl';
import { fail, ok, type ExtensionMessage, type ExtensionResponse, type SettingsResponse } from '../shared/messages';
import {
  SETTINGS_KEY,
  TOKEN_KEY,
  mergeSettings,
  normalizeStoredSettings,
  type ExtensionSettings,
} from '../shared/settings';
import { resolveReviewThread, unresolveReviewThread, type GitHubMutationResult } from './githubGraphql';

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  void handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  try {
    switch (message.type) {
      case 'GET_SETTINGS':
        return ok<SettingsResponse>(toSettingsResponse(await readSettings()));
      case 'OPEN_OPTIONS':
        chrome.runtime.openOptionsPage();
        return ok({ opened: true });
      case 'RESOLVE_THREAD':
        return mutateThread(message.threadId, message.prUrl, 'resolve');
      case 'UNRESOLVE_THREAD':
        return mutateThread(message.threadId, message.prUrl, 'unresolve');
      default:
        return fail('UNKNOWN_ERROR', 'Unknown extension message.');
    }
  } catch {
    return fail('UNKNOWN_ERROR', 'Unexpected extension error.');
  }
}

async function mutateThread(
  threadId: string,
  prUrl: string,
  action: 'resolve' | 'unresolve',
): Promise<ExtensionResponse<GitHubMutationResult>> {
  if (!threadId.trim()) {
    return fail('INVALID_THREAD_ID', 'Review thread id is missing.');
  }

  const settings = await readSettings();
  if (!settings.enableResolveControls) {
    return fail('PERMISSION_DENIED', 'Resolve controls are disabled.');
  }
  if (!settings.githubToken) {
    return fail('AUTH_REQUIRED', 'Configure a GitHub token to use Resolve/Unresolve.');
  }
  if (!isSupportedPullRequestUrl(prUrl, settings)) {
    return fail('UNSUPPORTED_HOST', 'This GitHub host is not configured.');
  }

  const pr = parsePullRequestUrl(prUrl);
  if (!pr) return fail('UNSUPPORTED_HOST', 'This GitHub host is not configured.');

  const endpoint = getGraphqlEndpoint(pr.host);
  return action === 'resolve'
    ? resolveReviewThread(threadId, settings.githubToken, endpoint)
    : unresolveReviewThread(threadId, settings.githubToken, endpoint);
}

async function readSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.local.get([SETTINGS_KEY, TOKEN_KEY]);
  return mergeSettings(stored[SETTINGS_KEY], stored[TOKEN_KEY]);
}

function toSettingsResponse(settings: ExtensionSettings): SettingsResponse {
  const { githubToken: _githubToken, ...safeSettings } = settings;
  return {
    settings: normalizeStoredSettings(safeSettings),
    hasToken: Boolean(settings.githubToken),
  };
}
