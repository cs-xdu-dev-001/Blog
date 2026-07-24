const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

const COMMENTS_QUERY = `
  query AdminComments($owner: String!, $name: String!, $categoryId: ID) {
    repository(owner: $owner, name: $name) {
      discussions(
        first: 50
        categoryId: $categoryId
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        nodes {
          id
          number
          title
          url
          comments(first: 100) {
            nodes {
              id
              bodyText
              url
              createdAt
              updatedAt
              isMinimized
              author {
                login
                avatarUrl
                url
              }
              replies(first: 100) {
                nodes {
                  id
                  bodyText
                  url
                  createdAt
                  updatedAt
                  isMinimized
                  author {
                    login
                    avatarUrl
                    url
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const DELETE_COMMENT_MUTATION = `
  mutation DeleteAdminComment($id: ID!) {
    deleteDiscussionComment(input: { id: $id }) {
      clientMutationId
    }
  }
`;

export class GithubCommentsError extends Error {
  constructor(message, { code = 'GITHUB_COMMENTS_ERROR', status = 502 } = {}) {
    super(message);
    this.name = 'GithubCommentsError';
    this.code = code;
    this.status = status;
  }
}

function splitRepo(repo) {
  const parts = String(repo || '').trim().split('/');
  if (parts.length !== 2 || parts.some((part) => !part)) {
    throw new GithubCommentsError('GitHub留言仓库配置无效', {
      code: 'REPO_INVALID',
      status: 400,
    });
  }
  return { owner: parts[0], name: parts[1] };
}

function publicUpstreamError(status) {
  if (status === 401) {
    return new GithubCommentsError('GitHub Token无效或已过期', {
      code: 'GITHUB_UNAUTHORIZED',
    });
  }
  if (status === 403) {
    return new GithubCommentsError('GitHub Token没有Discussions读写权限', {
      code: 'GITHUB_FORBIDDEN',
    });
  }
  if (status === 404) {
    return new GithubCommentsError('GitHub仓库不存在或未授权', {
      code: 'GITHUB_NOT_FOUND',
    });
  }
  return new GithubCommentsError('GitHub留言服务暂时不可用', {
    code: 'GITHUB_UPSTREAM_ERROR',
  });
}

function normalizeAuthor(author) {
  return {
    login: String(author?.login || 'ghost'),
    avatarUrl: String(author?.avatarUrl || ''),
    url: String(author?.url || ''),
  };
}

function normalizeComment(comment, discussion, parentId = '') {
  return {
    id: String(comment?.id || ''),
    body: String(comment?.bodyText || ''),
    url: String(comment?.url || discussion.url || ''),
    createdAt: String(comment?.createdAt || ''),
    updatedAt: String(comment?.updatedAt || ''),
    isMinimized: Boolean(comment?.isMinimized),
    isReply: Boolean(parentId),
    parentId,
    author: normalizeAuthor(comment?.author),
    discussion: {
      id: String(discussion.id || ''),
      number: Number(discussion.number || 0),
      title: String(discussion.title || ''),
      url: String(discussion.url || ''),
    },
  };
}

export function createGithubCommentsService({
  token,
  fetchImpl = globalThis.fetch,
} = {}) {
  function resolveToken() {
    const value = token === undefined ? process.env.GITHUB_DISCUSSIONS_TOKEN : token;
    const normalized = String(value || '').trim();
    if (!normalized) {
      throw new GithubCommentsError('未配置GITHUB_DISCUSSIONS_TOKEN', {
        code: 'TOKEN_MISSING',
        status: 503,
      });
    }
    return normalized;
  }

  async function request(query, variables) {
    const response = await fetchImpl(GITHUB_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${resolveToken()}`,
        'content-type': 'application/json',
        'user-agent': 'Dev-Notes-CMS',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ query, variables }),
    }).catch(() => {
      throw new GithubCommentsError('无法连接GitHub留言服务', {
        code: 'GITHUB_NETWORK_ERROR',
      });
    });

    if (!response.ok) throw publicUpstreamError(response.status);
    const payload = await response.json().catch(() => null);
    if (!payload || Array.isArray(payload.errors) && payload.errors.length) {
      throw new GithubCommentsError('GitHub留言请求失败，请检查仓库和Token权限', {
        code: 'GITHUB_GRAPHQL_ERROR',
      });
    }
    return payload.data || {};
  }

  return {
    async listComments({ repo, categoryId = '' } = {}) {
      const { owner, name } = splitRepo(repo);
      const data = await request(COMMENTS_QUERY, {
        owner,
        name,
        categoryId: String(categoryId || '').trim() || null,
      });
      const discussions = data.repository?.discussions?.nodes || [];
      const items = [];

      discussions.forEach((discussion) => {
        (discussion.comments?.nodes || []).forEach((comment) => {
          items.push(normalizeComment(comment, discussion));
          (comment.replies?.nodes || []).forEach((reply) => {
            items.push(normalizeComment(reply, discussion, String(comment.id || '')));
          });
        });
      });

      items.sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
      return {
        items,
        total: items.length,
        discussions: discussions.length,
      };
    },

    async deleteComment(id) {
      const commentId = String(id || '').trim();
      if (!/^[A-Za-z0-9_=-]{3,200}$/.test(commentId)) {
        throw new GithubCommentsError('留言ID无效', {
          code: 'COMMENT_ID_INVALID',
          status: 400,
        });
      }
      const data = await request(DELETE_COMMENT_MUTATION, { id: commentId });
      return Boolean(data.deleteDiscussionComment);
    },
  };
}

export const githubCommentsService = createGithubCommentsService();
