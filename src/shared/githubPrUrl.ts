import type { ExtensionSettings } from './settings';

export type PullRequestRef = {
  host: string;
  owner: string;
  repo: string;
  number: number;
};

export function parsePullRequestUrl(url: string): PullRequestRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length < 4) return null;
  const [owner, repo, pullSegment, numberSegment] = segments;
  if (!owner || !repo || pullSegment !== 'pull') return null;

  const number = Number(numberSegment);
  if (!Number.isInteger(number) || number <= 0) return null;

  return {
    host: parsed.host.toLowerCase(),
    owner,
    repo,
    number,
  };
}

export function isSupportedPullRequestUrl(url: string, settings: ExtensionSettings): boolean {
  const ref = parsePullRequestUrl(url);
  if (!ref) return false;
  return ref.host === 'github.com' || settings.githubEnterpriseHosts.includes(ref.host);
}

export function getGraphqlEndpoint(host: string): string {
  return host === 'github.com' ? 'https://api.github.com/graphql' : `https://${host}/api/graphql`;
}
