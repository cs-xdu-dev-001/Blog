const GITHUB_GRAPHQL_URL = 'https://api.github.com/graphql';

const COMMENT_FIELDS = `
  fragment AdminCommentFields on DiscussionComment {
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
`;

const DISCUSSIONS_QUERY = `
  query AdminDiscussions(
    $owner: String!
    $name: String!
    $categoryId: ID
    $after: String
  ) {
    repository(owner: $owner, name: $name) {
      discussions(
        first: 20
        after: $after
        categoryId: $categoryId
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          number
          title
          url
        }
      }
    }
  }
`;

const COMMENTS_QUERY = `
  query AdminDiscussionComments(
    $owner: String!
    $name: String!
    $number: Int!
    $after: String
  ) {
    repository(owner: $owner, name: $name) {
      discussion(number: $number) {
        comments(first: 50, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            ...AdminCommentFields
            replies(first: 50) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                ...AdminCommentFields
              }
            }
          }
        }
      }
    }
  }
  ${COMMENT_FIELDS}
`;

const REPLIES_QUERY = `
  query AdminCommentReplies($id: ID!, $after: String) {
    node(id: $id) {
      ... on DiscussionComment {
        replies(first: 50, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            ...AdminCommentFields
          }
        }
      }
    }
  }
  ${COMMENT_FIELDS}
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

function publicGraphqlError(errors) {
  const errorTypes = errors.map((error) => String(error?.type || error?.extensions?.code || ''));
  if (errorTypes.includes('MAX_NODE_LIMIT_EXCEEDED')) {
    return new GithubCommentsError('GitHub留言查询超过节点上限', {
      code: 'GITHUB_MAX_NODE_LIMIT',
    });
  }
  if (errorTypes.some((type) => type === 'FORBIDDEN' || type === 'INSUFFICIENT_SCOPES')) {
    return new GithubCommentsError('GitHub Token没有Discussions读写权限', {
      code: 'GITHUB_FORBIDDEN',
    });
  }
  if (errorTypes.includes('NOT_FOUND')) {
    return new GithubCommentsError('GitHub仓库或留言分类不存在', {
      code: 'GITHUB_NOT_FOUND',
    });
  }
  return new GithubCommentsError('GitHub留言请求失败', {
    code: 'GITHUB_GRAPHQL_ERROR',
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
    if (!payload) {
      throw new GithubCommentsError('GitHub留言响应格式无效', {
        code: 'GITHUB_RESPONSE_INVALID',
      });
    }
    if (Array.isArray(payload.errors) && payload.errors.length) {
      throw publicGraphqlError(payload.errors);
    }
    return payload.data || {};
  }

  return {
    async listComments({ repo, categoryId = '' } = {}) {
      const { owner, name } = splitRepo(repo);
      const discussions = [];
      const items = [];
      let discussionCursor = null;

      do {
        const data = await request(DISCUSSIONS_QUERY, {
          owner,
          name,
          categoryId: String(categoryId || '').trim() || null,
          after: discussionCursor,
        });
        const connection = data.repository?.discussions;
        discussions.push(...(connection?.nodes || []));
        discussionCursor = connection?.pageInfo?.hasNextPage
          ? connection.pageInfo.endCursor
          : null;
      } while (discussionCursor);

      for (const discussion of discussions) {
        let commentCursor = null;
        do {
          const data = await request(COMMENTS_QUERY, {
            owner,
            name,
            number: discussion.number,
            after: commentCursor,
          });
          const connection = data.repository?.discussion?.comments;

          for (const comment of connection?.nodes || []) {
            items.push(normalizeComment(comment, discussion));
            for (const reply of comment.replies?.nodes || []) {
              items.push(normalizeComment(reply, discussion, String(comment.id || '')));
            }

            let replyCursor = comment.replies?.pageInfo?.hasNextPage
              ? comment.replies.pageInfo.endCursor
              : null;
            while (replyCursor) {
              const replyData = await request(REPLIES_QUERY, {
                id: comment.id,
                after: replyCursor,
              });
              const replyConnection = replyData.node?.replies;
              for (const reply of replyConnection?.nodes || []) {
                items.push(normalizeComment(reply, discussion, String(comment.id || '')));
              }
              replyCursor = replyConnection?.pageInfo?.hasNextPage
                ? replyConnection.pageInfo.endCursor
                : null;
            }
          }

          commentCursor = connection?.pageInfo?.hasNextPage
            ? connection.pageInfo.endCursor
            : null;
        } while (commentCursor);
      }

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
