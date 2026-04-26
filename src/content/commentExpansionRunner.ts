import type { ExtensionSettings } from '../shared/settings';
import { findCommentExpansionTargets, type CommentExpansionTarget } from './commentScanner';

export type ExpansionMode = 'all-comments' | 'resolved-only';

export type ExpansionResult = {
  expanded: number;
  failed: number;
  skipped: number;
  stopped: boolean;
};

export type ExpansionProgress = ExpansionResult & {
  remaining: number;
  running: boolean;
};

export type ExpansionRunnerOptions = {
  root: ParentNode;
  settings: ExtensionSettings;
  delayMs?: number;
  maxOperations?: number;
  onProgress?: (progress: ExpansionProgress) => void;
};

export class CommentExpansionRunner {
  private readonly root: ParentNode;
  private readonly settings: ExtensionSettings;
  private readonly delayMs: number;
  private readonly maxOperations: number;
  private readonly onProgress?: (progress: ExpansionProgress) => void;
  private running = false;
  private stopped = false;
  private seenTargetKeys = new Set<string>();

  constructor(options: ExpansionRunnerOptions) {
    this.root = options.root;
    this.settings = options.settings;
    this.delayMs = options.delayMs ?? 450;
    this.maxOperations = options.maxOperations ?? 100;
    this.onProgress = options.onProgress;
  }

  async start(mode: ExpansionMode): Promise<ExpansionResult> {
    if (this.running) {
      return { expanded: 0, failed: 0, skipped: 0, stopped: false };
    }

    this.running = true;
    this.stopped = false;
    this.seenTargetKeys = new Set();

    let expanded = 0;
    let failed = 0;
    let skipped = 0;

    try {
      while (!this.stopped && expanded + failed + skipped < this.maxOperations) {
        const target = this.nextTarget(mode);
        if (!target) break;

        this.seenTargetKeys.add(target.key);
        this.emit({ expanded, failed, skipped, stopped: this.stopped, remaining: this.countRemaining(mode), running: true });

        try {
          if (!document.contains(target.element)) {
            skipped += 1;
            continue;
          }
          target.element.click();
          expanded += 1;
          await delay(this.delayMs);
        } catch {
          failed += 1;
        }
      }
    } finally {
      this.running = false;
      this.emit({ expanded, failed, skipped, stopped: this.stopped, remaining: this.countRemaining(mode), running: false });
    }

    return { expanded, failed, skipped, stopped: this.stopped };
  }

  stop(): void {
    this.stopped = true;
  }

  isRunning(): boolean {
    return this.running;
  }

  private nextTarget(mode: ExpansionMode): CommentExpansionTarget | null {
    const targets = findCommentExpansionTargets(this.root, this.settings, { mode });
    return targets.find((target) => !this.seenTargetKeys.has(target.key)) ?? null;
  }

  private countRemaining(mode: ExpansionMode): number {
    return findCommentExpansionTargets(this.root, this.settings, { mode }).filter(
      (target) => !this.seenTargetKeys.has(target.key),
    ).length;
  }

  private emit(progress: ExpansionProgress): void {
    this.onProgress?.({ ...progress, stopped: this.stopped });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
