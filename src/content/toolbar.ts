export type ToolbarState = {
  status: 'ready' | 'expanding' | 'stopping' | 'stopped' | 'completed' | 'error';
  expanded: number;
  remaining: number;
  failed: number;
  skipped: number;
  resolveTools: 'disabled' | 'auth-required' | 'enabled';
  message?: string;
};

export type ToolbarHandlers = {
  showComments: () => void;
  showResolved: () => void;
  stop: () => void;
  openSettings: () => void;
};

const ROOT_ATTR = 'data-github-pr-comment-tools-root';

export class ToolbarController {
  private root: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private counts: HTMLElement | null = null;
  private resolveTools: HTMLElement | null = null;
  private handlers: ToolbarHandlers | null = null;

  mount(container: HTMLElement, handlers: ToolbarHandlers): HTMLElement {
    this.handlers = handlers;
    const existing = document.querySelector<HTMLElement>(`[${ROOT_ATTR}="true"]`);
    this.root = existing ?? document.createElement('section');
    this.root.setAttribute(ROOT_ATTR, 'true');
    this.root.className = 'gh-pr-tools';

    if (!existing) {
      container.prepend(this.root);
    }

    this.render();
    this.updateState({
      status: 'ready',
      expanded: 0,
      remaining: 0,
      failed: 0,
      skipped: 0,
      resolveTools: 'disabled',
    });
    return this.root;
  }

  updateState(state: ToolbarState): void {
    if (!this.status || !this.counts || !this.resolveTools) return;
    this.status.textContent = state.message ?? labelForStatus(state.status);
    this.counts.textContent = `expanded: ${state.expanded} remaining: ${state.remaining} failed: ${state.failed} skipped: ${state.skipped}`;
    this.resolveTools.textContent = `Resolve tools: ${labelForResolveTools(state.resolveTools)}`;
  }

  unmount(): void {
    this.root?.remove();
    this.root = null;
    this.status = null;
    this.counts = null;
    this.resolveTools = null;
    this.handlers = null;
  }

  private render(): void {
    if (!this.root) return;
    this.root.textContent = '';

    const title = document.createElement('strong');
    title.className = 'gh-pr-tools__title';
    title.textContent = 'PR Comment Tools';

    const actions = document.createElement('div');
    actions.className = 'gh-pr-tools__actions';
    actions.append(
      this.button('Show comments', () => this.handlers?.showComments()),
      this.button('Show resolved', () => this.handlers?.showResolved()),
      this.button('Stop', () => this.handlers?.stop()),
      this.button('Settings', () => this.handlers?.openSettings()),
    );

    this.resolveTools = document.createElement('span');
    this.resolveTools.className = 'gh-pr-tools__resolve';

    this.status = document.createElement('span');
    this.status.className = 'gh-pr-tools__status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');

    this.counts = document.createElement('span');
    this.counts.className = 'gh-pr-tools__counts';

    const meta = document.createElement('div');
    meta.className = 'gh-pr-tools__meta';
    meta.append(this.status, this.counts, this.resolveTools);

    this.root.append(title, actions, meta);
  }

  private button(label: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'gh-pr-tools__button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }
}

function labelForStatus(status: ToolbarState['status']): string {
  switch (status) {
    case 'expanding':
      return 'Expanding';
    case 'stopping':
      return 'Stopping';
    case 'stopped':
      return 'Stopped';
    case 'completed':
      return 'Completed';
    case 'error':
      return 'Error';
    case 'ready':
      return 'Ready';
  }
}

function labelForResolveTools(status: ToolbarState['resolveTools']): string {
  switch (status) {
    case 'enabled':
      return 'On';
    case 'auth-required':
      return 'Auth required';
    case 'disabled':
      return 'Off';
  }
}
