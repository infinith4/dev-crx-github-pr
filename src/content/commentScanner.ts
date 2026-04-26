import type { ExtensionSettings } from '../shared/settings';

export type CommentExpansionTargetKind =
  | 'load-more'
  | 'show-more'
  | 'resolved-thread'
  | 'outdated-thread'
  | 'full-conversation';

export type CommentExpansionTarget = {
  element: HTMLElement;
  kind: CommentExpansionTargetKind;
  label: string;
  key: string;
  disabled: boolean;
  visible: boolean;
};

export type CommentScannerOptions = {
  mode: 'all-comments' | 'resolved-only';
};

const CANDIDATE_SELECTOR = 'button, a, [role="button"], summary';
const EXTENSION_ROOT_SELECTOR = '[data-github-pr-comment-tools-root="true"]';

export function findCommentExpansionTargets(
  root: ParentNode,
  settings: ExtensionSettings,
  options: CommentScannerOptions,
): CommentExpansionTarget[] {
  const candidates = Array.from(root.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR));
  const targets: CommentExpansionTarget[] = [];

  candidates.forEach((element, index) => {
    if (element.closest(EXTENSION_ROOT_SELECTOR)) return;

    const disabled = isDisabled(element);
    const visible = isVisible(element);
    if (disabled || !visible) return;

    const label = getElementLabel(element);
    const nearbyText = getNearbyText(element);
    const kind = classifyControl(label, nearbyText);
    if (!kind || !isAllowedBySettings(kind, settings, options)) return;

    targets.push({
      element,
      kind,
      label: label || element.tagName.toLowerCase(),
      key: buildTargetKey(element, kind, label, index),
      disabled,
      visible,
    });
  });

  return dedupeTargets(targets);
}

function classifyControl(label: string, nearbyText: string): CommentExpansionTargetKind | null {
  const normalizedLabel = normalizeText(label);
  const combined = normalizeText(`${label} ${nearbyText}`);
  if (normalizedLabel.includes('view full conversation')) return 'full-conversation';
  if (isResolvedTarget(combined, normalizedLabel)) return 'resolved-thread';
  if (isOutdatedTarget(combined, normalizedLabel)) return 'outdated-thread';
  if (normalizedLabel.includes('load more')) return 'load-more';
  if (
    normalizedLabel.includes('show more') ||
    normalizedLabel.includes('view more') ||
    normalizedLabel.includes('show hidden')
  ) {
    return 'show-more';
  }
  return null;
}

function isAllowedBySettings(
  kind: CommentExpansionTargetKind,
  settings: ExtensionSettings,
  options: CommentScannerOptions,
): boolean {
  if (options.mode === 'resolved-only') return kind === 'resolved-thread';
  if (kind === 'resolved-thread') return settings.includeResolvedThreads;
  if (kind === 'outdated-thread') return settings.includeOutdatedThreads;
  return true;
}

function isResolvedTarget(combined: string, label: string): boolean {
  return combined.includes('resolved') && (label.includes('show') || label.includes('view') || label.includes('conversation'));
}

function isOutdatedTarget(combined: string, label: string): boolean {
  return combined.includes('outdated') && (label.includes('show') || label.includes('view') || label.includes('conversation'));
}

function getElementLabel(element: HTMLElement): string {
  return normalizeText(
    [
      element.textContent ?? '',
      element.getAttribute('aria-label') ?? '',
      element.getAttribute('title') ?? '',
    ].join(' '),
  );
}

function getNearbyText(element: HTMLElement): string {
  const container =
    element.closest('[data-testid], [id*="discussion"], [class*="discussion"], [class*="review"], details') ??
    element.parentElement;
  if (!container || container === document.body || container.tagName.toLowerCase() === 'main') return '';
  return normalizeText((container?.textContent ?? '').slice(0, 600));
}

function buildTargetKey(
  element: HTMLElement,
  kind: CommentExpansionTargetKind,
  label: string,
  index: number,
): string {
  const container = element.closest<HTMLElement>('[id], [data-testid], details, [class*="discussion"]');
  const containerId =
    container?.id || container?.getAttribute('data-testid') || container?.tagName.toLowerCase() || 'container';
  return `${kind}:${label}:${containerId}:${index}`;
}

function dedupeTargets(targets: CommentExpansionTarget[]): CommentExpansionTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (seen.has(target.key)) return false;
    seen.add(target.key);
    return true;
  });
}

function isDisabled(element: HTMLElement): boolean {
  return (
    element.getAttribute('aria-disabled') === 'true' ||
    (element instanceof HTMLButtonElement && element.disabled) ||
    element.hasAttribute('disabled')
  );
}

function isVisible(element: HTMLElement): boolean {
  const style = globalThis.getComputedStyle?.(element);
  if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
  if (element.hidden) return false;
  if (element.offsetParent !== null || style?.position === 'fixed' || element.getClientRects().length > 0) {
    return true;
  }

  // Test DOMs such as jsdom do not calculate layout. Treat styled, connected
  // elements as visible when no layout engine can provide geometry.
  return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}
