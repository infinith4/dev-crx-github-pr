import { describe, expect, it } from 'vitest';
import { DEFAULT_STORED_SETTINGS, mergeSettings, normalizeEnterpriseHosts, normalizeStoredSettings } from '../shared/settings';

describe('settings', () => {
  it('fills defaults for missing settings', () => {
    expect(normalizeStoredSettings({})).toEqual(DEFAULT_STORED_SETTINGS);
  });

  it('normalizes Enterprise hosts', () => {
    expect(normalizeEnterpriseHosts([' GitHub.Example.COM ', 'github.com', 'bad/path', 'github.example.com'])).toEqual([
      'github.example.com',
    ]);
  });

  it('merges non-empty token', () => {
    expect(mergeSettings({}, ' token-value ').githubToken).toBe('token-value');
    expect(mergeSettings({}, '   ').githubToken).toBeUndefined();
  });
});
