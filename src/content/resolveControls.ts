import type { ExtensionResponse } from '../shared/messages';
import type { ExtensionSettings } from '../shared/settings';

const CONTROL_ATTR = 'data-gh-pr-tools-resolve-control';
const THREAD_SELECTOR = '[id*="discussion"], [data-testid*="thread"], [class*="review-thread"], [class*="discussion"]';

export type ResolveControlsOptions = {
  hasToken: boolean;
  prUrl: string;
};

export function renderResolveControls(root: ParentNode, settings: ExtensionSettings, options: ResolveControlsOptions): void {
  if (!settings.enableResolveControls) return;

  const threadContainers = Array.from(root.querySelectorAll<HTMLElement>(THREAD_SELECTOR));
  for (const container of threadContainers) {
    if (container.querySelector(`[${CONTROL_ATTR}="true"]`)) continue;

    const threadId = findThreadId(container);
    if (!threadId) continue;

    const controls = document.createElement('span');
    controls.setAttribute(CONTROL_ATTR, 'true');
    controls.className = 'gh-pr-tools-resolve-controls';

    const resolved = isResolvedContainer(container);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gh-pr-tools-resolve-controls__button';
    button.textContent = resolved ? 'Unresolve' : 'Resolve';
    button.disabled = !options.hasToken;
    button.title = options.hasToken ? '' : 'Configure a GitHub token to use Resolve/Unresolve.';
    button.addEventListener('click', () => {
      void mutateThread(button, threadId, resolved ? 'UNRESOLVE_THREAD' : 'RESOLVE_THREAD', options.prUrl);
    });

    controls.append(button);
    container.prepend(controls);
  }
}

export function removeResolveControls(root: ParentNode): void {
  root.querySelectorAll(`[${CONTROL_ATTR}="true"]`).forEach((element) => element.remove());
}

function findThreadId(container: HTMLElement): string | null {
  const direct =
    container.getAttribute('data-thread-id') ||
    container.getAttribute('data-resolvable-thread-id') ||
    container.getAttribute('data-github-thread-id');
  if (direct) return direct;

  const withId = container.querySelector<HTMLElement>('[data-thread-id], [data-resolvable-thread-id], [data-github-thread-id]');
  return (
    withId?.getAttribute('data-thread-id') ||
    withId?.getAttribute('data-resolvable-thread-id') ||
    withId?.getAttribute('data-github-thread-id') ||
    null
  );
}

function isResolvedContainer(container: HTMLElement): boolean {
  return /\bresolved\b/i.test(container.textContent ?? '');
}

async function mutateThread(
  button: HTMLButtonElement,
  threadId: string,
  type: 'RESOLVE_THREAD' | 'UNRESOLVE_THREAD',
  prUrl: string,
): Promise<void> {
  button.disabled = true;
  const originalText = button.textContent ?? '';
  button.textContent = 'Working...';

  try {
    const response = await chrome.runtime.sendMessage({ type, threadId, prUrl }) as ExtensionResponse;
    if (!response.ok) {
      button.textContent = response.error.message;
      return;
    }
    button.textContent = type === 'RESOLVE_THREAD' ? 'Resolved' : 'Unresolved';
  } catch {
    button.textContent = 'Request failed';
  } finally {
    window.setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1800);
  }
}
