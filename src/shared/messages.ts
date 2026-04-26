import type { ExtensionSettings } from './settings';

export type ExtensionErrorCode =
  | 'AUTH_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'NETWORK_ERROR'
  | 'GITHUB_API_ERROR'
  | 'INVALID_THREAD_ID'
  | 'UNSUPPORTED_HOST'
  | 'DOM_TARGET_MISSING'
  | 'UNKNOWN_ERROR';

export type ExtensionError = {
  code: ExtensionErrorCode;
  message: string;
  retryable: boolean;
};

export type ExtensionMessage =
  | { type: 'GET_SETTINGS' }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'RESOLVE_THREAD'; threadId: string; prUrl: string }
  | { type: 'UNRESOLVE_THREAD'; threadId: string; prUrl: string };

export type ExtensionResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: ExtensionError };

export type SettingsResponse = {
  settings: Omit<ExtensionSettings, 'githubToken'>;
  hasToken: boolean;
};

export function ok<T>(data: T): ExtensionResponse<T> {
  return { ok: true, data };
}

export function fail(code: ExtensionErrorCode, message: string, retryable = false): ExtensionResponse<never> {
  return { ok: false, error: { code, message, retryable } };
}
