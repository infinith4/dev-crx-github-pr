export type StoredSettings = {
  schemaVersion: 1;
  enableCommentExpansion: boolean;
  autoExpandComments: boolean;
  includeResolvedThreads: boolean;
  includeOutdatedThreads: boolean;
  enableResolveControls: boolean;
  allowBulkResolveUnresolve: boolean;
  githubEnterpriseHosts: string[];
};

export type ExtensionSettings = StoredSettings & {
  githubToken?: string;
};

export const DEFAULT_STORED_SETTINGS: StoredSettings = {
  schemaVersion: 1,
  enableCommentExpansion: true,
  autoExpandComments: true,
  includeResolvedThreads: true,
  includeOutdatedThreads: false,
  enableResolveControls: false,
  allowBulkResolveUnresolve: false,
  githubEnterpriseHosts: [],
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  ...DEFAULT_STORED_SETTINGS,
};

export const SETTINGS_KEY = 'settings';
export const TOKEN_KEY = 'githubToken';

export function normalizeHost(value: string): string | null {
  const host = value.trim().toLowerCase();
  if (!host || host === 'github.com') return null;
  if (host.includes('/') || host.includes(':') || /\s/.test(host)) return null;
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

export function normalizeEnterpriseHosts(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(values.map((value) => (typeof value === 'string' ? normalizeHost(value) : null)).filter(Boolean)),
  ) as string[];
}

export function normalizeStoredSettings(value: unknown): StoredSettings {
  const input = isRecord(value) ? value : {};
  return {
    schemaVersion: 1,
    enableCommentExpansion: readBoolean(input.enableCommentExpansion, DEFAULT_STORED_SETTINGS.enableCommentExpansion),
    autoExpandComments: readBoolean(input.autoExpandComments, DEFAULT_STORED_SETTINGS.autoExpandComments),
    includeResolvedThreads: readBoolean(input.includeResolvedThreads, DEFAULT_STORED_SETTINGS.includeResolvedThreads),
    includeOutdatedThreads: readBoolean(input.includeOutdatedThreads, DEFAULT_STORED_SETTINGS.includeOutdatedThreads),
    enableResolveControls: readBoolean(input.enableResolveControls, DEFAULT_STORED_SETTINGS.enableResolveControls),
    allowBulkResolveUnresolve: readBoolean(
      input.allowBulkResolveUnresolve,
      DEFAULT_STORED_SETTINGS.allowBulkResolveUnresolve,
    ),
    githubEnterpriseHosts: normalizeEnterpriseHosts(input.githubEnterpriseHosts),
  };
}

export function mergeSettings(stored: unknown, token: unknown): ExtensionSettings {
  const settings: ExtensionSettings = normalizeStoredSettings(stored);
  if (typeof token === 'string' && token.trim()) {
    settings.githubToken = token.trim();
  }
  return settings;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
