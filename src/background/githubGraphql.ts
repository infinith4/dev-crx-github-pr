import { fail, type ExtensionResponse } from '../shared/messages';

export type GitHubMutationResult = {
  threadId: string;
  isResolved: boolean;
};

type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string; type?: string }>;
};

type ResolveResponse = {
  resolveReviewThread?: {
    thread?: {
      id: string;
      isResolved: boolean;
    };
  };
};

type UnresolveResponse = {
  unresolveReviewThread?: {
    thread?: {
      id: string;
      isResolved: boolean;
    };
  };
};

const RESOLVE_MUTATION = `
  mutation ResolveReviewThread($threadId: ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
      }
    }
  }
`;

const UNRESOLVE_MUTATION = `
  mutation UnresolveReviewThread($threadId: ID!) {
    unresolveReviewThread(input: { threadId: $threadId }) {
      thread {
        id
        isResolved
      }
    }
  }
`;

export async function resolveReviewThread(
  threadId: string,
  token: string,
  endpoint: string,
): Promise<ExtensionResponse<GitHubMutationResult>> {
  const response = await requestGraphql<ResolveResponse>(endpoint, token, RESOLVE_MUTATION, { threadId });
  if (!response.ok) return response;

  const thread = response.data.resolveReviewThread?.thread;
  if (!thread || !thread.isResolved) {
    return fail('GITHUB_API_ERROR', 'GitHub did not confirm the thread was resolved.');
  }
  return { ok: true, data: { threadId: thread.id, isResolved: thread.isResolved } };
}

export async function unresolveReviewThread(
  threadId: string,
  token: string,
  endpoint: string,
): Promise<ExtensionResponse<GitHubMutationResult>> {
  const response = await requestGraphql<UnresolveResponse>(endpoint, token, UNRESOLVE_MUTATION, { threadId });
  if (!response.ok) return response;

  const thread = response.data.unresolveReviewThread?.thread;
  if (!thread || thread.isResolved) {
    return fail('GITHUB_API_ERROR', 'GitHub did not confirm the thread was unresolved.');
  }
  return { ok: true, data: { threadId: thread.id, isResolved: thread.isResolved } };
}

async function requestGraphql<T>(
  endpoint: string,
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<ExtensionResponse<T>> {
  if (!endpoint.startsWith('https://')) {
    return fail('UNSUPPORTED_HOST', 'Only HTTPS GitHub API endpoints are supported.');
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    return fail('NETWORK_ERROR', 'Network error. Retry the operation.', true);
  }

  if (response.status === 401 || response.status === 403) {
    return fail('PERMISSION_DENIED', 'GitHub denied this operation. Check token permissions.');
  }
  if (!response.ok) {
    return fail('GITHUB_API_ERROR', `GitHub API returned HTTP ${response.status}.`, response.status >= 500);
  }

  const payload = (await response.json()) as GraphqlResponse<T>;
  if (payload.errors?.length) {
    const message = payload.errors[0]?.message ?? 'GitHub GraphQL returned an error.';
    const permissionError = /permission|access|forbidden|resource not accessible/i.test(message);
    return fail(permissionError ? 'PERMISSION_DENIED' : 'GITHUB_API_ERROR', message);
  }
  if (!payload.data) {
    return fail('GITHUB_API_ERROR', 'GitHub GraphQL response did not include data.');
  }

  return { ok: true, data: payload.data };
}
