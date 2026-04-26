import { beforeEach, describe, expect, it } from 'vitest';
import { findCommentExpansionTargets } from '../content/commentScanner';
import { DEFAULT_SETTINGS } from '../shared/settings';

describe('commentScanner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('finds common expansion controls', () => {
    document.body.innerHTML = `
      <main>
        <button>Load more</button>
        <button>Show more hidden comments</button>
        <a href="#">View full conversation</a>
      </main>
    `;

    const targets = findCommentExpansionTargets(document, DEFAULT_SETTINGS, { mode: 'all-comments' });

    expect(targets.map((target) => target.kind)).toEqual(['load-more', 'show-more', 'full-conversation']);
  });

  it('filters resolved and outdated targets by settings', () => {
    document.body.innerHTML = `
      <main>
        <div class="discussion"><button>Show resolved conversation</button></div>
        <div class="discussion"><button>Show outdated conversation</button></div>
      </main>
    `;

    const targets = findCommentExpansionTargets(
      document,
      { ...DEFAULT_SETTINGS, includeResolvedThreads: false, includeOutdatedThreads: false },
      { mode: 'all-comments' },
    );

    expect(targets).toHaveLength(0);
  });

  it('returns only resolved targets in resolved-only mode', () => {
    document.body.innerHTML = `
      <main>
        <button>Load more</button>
        <button>Show resolved conversation</button>
        <button>Show outdated conversation</button>
      </main>
    `;

    const targets = findCommentExpansionTargets(
      document,
      { ...DEFAULT_SETTINGS, includeResolvedThreads: false },
      { mode: 'resolved-only' },
    );

    expect(targets.map((target) => target.kind)).toEqual(['resolved-thread']);
  });

  it('ignores extension toolbar buttons', () => {
    document.body.innerHTML = `
      <section data-github-pr-comment-tools-root="true"><button>Show comments</button></section>
      <button>Load more</button>
    `;

    const targets = findCommentExpansionTargets(document, DEFAULT_SETTINGS, { mode: 'all-comments' });

    expect(targets).toHaveLength(1);
    expect(targets[0]?.kind).toBe('load-more');
  });
});
