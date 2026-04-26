import { describe, expect, it } from 'vitest';
import { getGraphqlEndpoint, isSupportedPullRequestUrl, parsePullRequestUrl } from '../shared/githubPrUrl';
import { DEFAULT_SETTINGS } from '../shared/settings';

describe('githubPrUrl', () => {
  it('parses a GitHub pull request URL', () => {
    expect(parsePullRequestUrl('https://github.com/octo-org/octo-repo/pull/123')).toEqual({
      host: 'github.com',
      owner: 'octo-org',
      repo: 'octo-repo',
      number: 123,
    });
  });

  it('rejects non-pull-request URLs', () => {
    expect(parsePullRequestUrl('https://github.com/octo-org/octo-repo/issues/123')).toBeNull();
    expect(parsePullRequestUrl('http://github.com/octo-org/octo-repo/pull/123')).toBeNull();
  });

  it('supports configured Enterprise hosts', () => {
    const settings = { ...DEFAULT_SETTINGS, githubEnterpriseHosts: ['github.example.com'] };
    expect(isSupportedPullRequestUrl('https://github.example.com/a/b/pull/1', settings)).toBe(true);
    expect(isSupportedPullRequestUrl('https://other.example.com/a/b/pull/1', settings)).toBe(false);
  });

  it('maps GraphQL endpoints', () => {
    expect(getGraphqlEndpoint('github.com')).toBe('https://api.github.com/graphql');
    expect(getGraphqlEndpoint('github.example.com')).toBe('https://github.example.com/api/graphql');
  });
});
