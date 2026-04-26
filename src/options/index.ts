import {
  SETTINGS_KEY,
  TOKEN_KEY,
  normalizeEnterpriseHosts,
  normalizeStoredSettings,
  type StoredSettings,
} from '../shared/settings';

const form = document.querySelector<HTMLFormElement>('#options-form');
const statusElement = document.querySelector<HTMLElement>('#status');

const fields = {
  enableCommentExpansion: checkbox('enableCommentExpansion'),
  autoExpandComments: checkbox('autoExpandComments'),
  includeResolvedThreads: checkbox('includeResolvedThreads'),
  includeOutdatedThreads: checkbox('includeOutdatedThreads'),
  enableResolveControls: checkbox('enableResolveControls'),
  allowBulkResolveUnresolve: checkbox('allowBulkResolveUnresolve'),
  githubToken: input('githubToken'),
  githubEnterpriseHosts: textarea('githubEnterpriseHosts'),
};

void load();

fields.enableResolveControls.addEventListener('change', updateFieldState);
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  void save();
});

async function load(): Promise<void> {
  const stored = await chrome.storage.local.get([SETTINGS_KEY]);
  const settings = normalizeStoredSettings(stored[SETTINGS_KEY]);

  fields.enableCommentExpansion.checked = settings.enableCommentExpansion;
  fields.autoExpandComments.checked = settings.autoExpandComments;
  fields.includeResolvedThreads.checked = settings.includeResolvedThreads;
  fields.includeOutdatedThreads.checked = settings.includeOutdatedThreads;
  fields.enableResolveControls.checked = settings.enableResolveControls;
  fields.allowBulkResolveUnresolve.checked = settings.allowBulkResolveUnresolve;
  fields.githubEnterpriseHosts.value = settings.githubEnterpriseHosts.join('\n');
  updateFieldState();
}

async function save(): Promise<void> {
  const hosts = parseHosts(fields.githubEnterpriseHosts.value);
  if (!hosts.valid) {
    setStatus(hosts.message);
    return;
  }

  const settings: StoredSettings = {
    schemaVersion: 1,
    enableCommentExpansion: fields.enableCommentExpansion.checked,
    autoExpandComments: fields.autoExpandComments.checked,
    includeResolvedThreads: fields.includeResolvedThreads.checked,
    includeOutdatedThreads: fields.includeOutdatedThreads.checked,
    enableResolveControls: fields.enableResolveControls.checked,
    allowBulkResolveUnresolve:
      fields.enableResolveControls.checked && fields.allowBulkResolveUnresolve.checked,
    githubEnterpriseHosts: hosts.hosts,
  };

  const updates: Record<string, unknown> = { [SETTINGS_KEY]: settings };
  const token = fields.githubToken.value.trim();
  if (token) {
    updates[TOKEN_KEY] = token;
    fields.githubToken.value = '';
  }

  await chrome.storage.local.set(updates);
  setStatus(
    settings.enableResolveControls && !token
      ? 'Saved. Resolve controls require a saved token.'
      : 'Saved.',
  );
  updateFieldState();
}

function updateFieldState(): void {
  fields.allowBulkResolveUnresolve.disabled = !fields.enableResolveControls.checked;
}

function parseHosts(value: string): { valid: true; hosts: string[] } | { valid: false; message: string } {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const invalid = lines.find((line) => normalizeEnterpriseHosts([line]).length === 0);
  if (invalid) {
    return { valid: false, message: `Invalid Enterprise host: ${invalid}` };
  }
  return { valid: true, hosts: normalizeEnterpriseHosts(lines) };
}

function setStatus(message: string): void {
  if (statusElement) statusElement.textContent = message;
}

function checkbox(id: string): HTMLInputElement {
  return required<HTMLInputElement>(id);
}

function input(id: string): HTMLInputElement {
  return required<HTMLInputElement>(id);
}

function textarea(id: string): HTMLTextAreaElement {
  return required<HTMLTextAreaElement>(id);
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing options element: ${id}`);
  return element as T;
}
