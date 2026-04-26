import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveReviewThread, unresolveReviewThread } from '../background/githubGraphql';

describe('githubGraphql', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-HTTPS endpoints', async () => {
    const response = await resolveReviewThread('thread-1', 'token', 'http://example.com/graphql');
    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe('UNSUPPORTED_HOST');
  });

  it('maps permission responses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 403 })));

    const response = await resolveReviewThread('thread-1', 'token', 'https://api.github.com/graphql');

    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe('PERMISSION_DENIED');
  });

  it('resolves a thread', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: {
            resolveReviewThread: {
              thread: { id: 'thread-1', isResolved: true },
            },
          },
        }),
      ),
    );

    const response = await resolveReviewThread('thread-1', 'token', 'https://api.github.com/graphql');

    expect(response).toEqual({ ok: true, data: { threadId: 'thread-1', isResolved: true } });
  });

  it('unresolves a thread', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: {
            unresolveReviewThread: {
              thread: { id: 'thread-1', isResolved: false },
            },
          },
        }),
      ),
    );

    const response = await unresolveReviewThread('thread-1', 'token', 'https://api.github.com/graphql');

    expect(response).toEqual({ ok: true, data: { threadId: 'thread-1', isResolved: false } });
  });
});
