import assert from 'node:assert/strict';
import test from 'node:test';
import { createGithubCommentsService } from '../src/lib/server/githubCommentsService.mjs';

const repo = 'cs-xdu-dev-001/Blog';
const categoryId = 'DIC_kwDOTTfuNc4DB4et';

test('GitHub comments require a server-side token', async () => {
  const service = createGithubCommentsService({ token: '', fetchImpl: async () => {
    throw new Error('fetch should not run');
  } });

  await assert.rejects(
    () => service.listComments({ repo, categoryId }),
    (error) => error.code === 'TOKEN_MISSING' && error.status === 503,
  );
});

test('GitHub comments flatten discussion comments and replies without exposing the token', async () => {
  const requests = [];
  const service = createGithubCommentsService({
    token: 'github_pat_secret',
    fetchImpl: async (url, options) => {
      const request = { url, options, body: JSON.parse(options.body) };
      requests.push(request);
      if (request.body.query.includes('query AdminDiscussions')) {
        return Response.json({
          data: {
            repository: {
              discussions: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{
                  id: 'D_1',
                  number: 1,
                  title: '/',
                  url: 'https://github.com/example/discussions/1',
                }],
              },
            },
          },
        });
      }
      return Response.json({
        data: {
          repository: {
            discussion: {
              comments: {
                pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{
                id: 'DC_1',
                bodyText: '第一条留言',
                url: 'https://github.com/example/discussions/1#discussioncomment-1',
                createdAt: '2026-07-25T01:00:00Z',
                updatedAt: '2026-07-25T01:00:00Z',
                isMinimized: false,
                author: {
                  login: 'reader',
                  avatarUrl: 'https://avatars.githubusercontent.com/u/1',
                  url: 'https://github.com/reader',
                },
                replies: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [{
                    id: 'DCR_1',
                    bodyText: '博主回复',
                    url: 'https://github.com/example/discussions/1#discussioncomment-2',
                    createdAt: '2026-07-25T02:00:00Z',
                    updatedAt: '2026-07-25T02:00:00Z',
                    isMinimized: false,
                    author: {
                      login: 'owner',
                      avatarUrl: 'https://avatars.githubusercontent.com/u/2',
                      url: 'https://github.com/owner',
                    },
                  }],
                },
              }],
            },
          },
        },
      },
      });
    },
  });

  const result = await service.listComments({ repo, categoryId });
  const discussionRequest = requests.find(({ body }) => body.query.includes('query AdminDiscussions'));

  assert.equal(discussionRequest.url, 'https://api.github.com/graphql');
  assert.equal(discussionRequest.options.headers.authorization, 'Bearer github_pat_secret');
  assert.equal(discussionRequest.body.variables.owner, 'cs-xdu-dev-001');
  assert.equal(discussionRequest.body.variables.name, 'Blog');
  assert.equal(discussionRequest.body.variables.categoryId, categoryId);
  assert.deepEqual(result.items.map((item) => item.id), ['DCR_1', 'DC_1']);
  assert.equal(result.items[0].isReply, true);
  assert.equal(result.items[0].parentId, 'DC_1');
  assert.equal(result.items[1].author.login, 'reader');
  assert.equal(result.total, 2);
  assert.doesNotMatch(JSON.stringify(result), /github_pat_secret/);
});

test('GitHub comments paginate discussions, comments and replies without a nested oversized query', async () => {
  const requests = [];
  const service = createGithubCommentsService({
    token: 'github_pat_secret',
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      requests.push(body);

      if (body.query.includes('query AdminDiscussions')) {
        if (!body.variables.after) {
          return Response.json({
            data: {
              repository: {
                discussions: {
                  pageInfo: { hasNextPage: true, endCursor: 'discussion-page-2' },
                  nodes: [{
                    id: 'D_1',
                    number: 1,
                    title: '/',
                    url: 'https://github.com/example/discussions/1',
                  }],
                },
              },
            },
          });
        }
        return Response.json({
          data: {
            repository: {
              discussions: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{
                  id: 'D_2',
                  number: 2,
                  title: '/writing',
                  url: 'https://github.com/example/discussions/2',
                }],
              },
            },
          },
        });
      }

      if (body.query.includes('query AdminDiscussionComments')) {
        const isFirstDiscussion = body.variables.number === 1;
        return Response.json({
          data: {
            repository: {
              discussion: {
                comments: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [{
                    id: isFirstDiscussion ? 'DC_1' : 'DC_2',
                    bodyText: isFirstDiscussion ? '首页留言' : '笔记留言',
                    url: `https://github.com/example/discussions/${body.variables.number}#comment`,
                    createdAt: isFirstDiscussion
                      ? '2026-07-25T01:00:00Z'
                      : '2026-07-25T03:00:00Z',
                    updatedAt: '2026-07-25T03:00:00Z',
                    isMinimized: false,
                    author: { login: 'reader', avatarUrl: '', url: '' },
                    replies: {
                      pageInfo: {
                        hasNextPage: isFirstDiscussion,
                        endCursor: isFirstDiscussion ? 'reply-page-2' : null,
                      },
                      nodes: isFirstDiscussion ? [{
                        id: 'DCR_1',
                        bodyText: '第一页回复',
                        url: 'https://github.com/example/discussions/1#reply-1',
                        createdAt: '2026-07-25T02:00:00Z',
                        updatedAt: '2026-07-25T02:00:00Z',
                        isMinimized: false,
                        author: { login: 'owner', avatarUrl: '', url: '' },
                      }] : [],
                    },
                  }],
                },
              },
            },
          },
        });
      }

      if (body.query.includes('query AdminCommentReplies')) {
        return Response.json({
          data: {
            node: {
              replies: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{
                  id: 'DCR_2',
                  bodyText: '第二页回复',
                  url: 'https://github.com/example/discussions/1#reply-2',
                  createdAt: '2026-07-25T04:00:00Z',
                  updatedAt: '2026-07-25T04:00:00Z',
                  isMinimized: false,
                  author: { login: 'owner', avatarUrl: '', url: '' },
                }],
              },
            },
          },
        });
      }

      throw new Error('unexpected query');
    },
  });

  const result = await service.listComments({ repo, categoryId });

  assert.deepEqual(
    result.items.map((item) => item.id),
    ['DCR_2', 'DC_2', 'DCR_1', 'DC_1'],
  );
  assert.equal(result.discussions, 2);
  assert.equal(requests.filter((body) => body.query.includes('query AdminDiscussions')).length, 2);
  assert.equal(requests.filter((body) => body.query.includes('query AdminDiscussionComments')).length, 2);
  assert.equal(requests.filter((body) => body.query.includes('query AdminCommentReplies')).length, 1);
  assert.ok(requests.every((body) => !/discussions\([\s\S]*comments\(/.test(body.query)));
});

test('GitHub comments delete a discussion comment by node id', async () => {
  let requestBody;
  const service = createGithubCommentsService({
    token: 'github_pat_secret',
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return Response.json({
        data: {
          deleteDiscussionComment: {
            clientMutationId: 'deleted',
          },
        },
      });
    },
  });

  const deleted = await service.deleteComment('DC_1');

  assert.equal(deleted, true);
  assert.equal(requestBody.variables.id, 'DC_1');
  assert.match(requestBody.query, /deleteDiscussionComment/);
});

test('GitHub comments return stable permission errors', async () => {
  const service = createGithubCommentsService({
    token: 'invalid',
    fetchImpl: async () => new Response('forbidden', { status: 403 }),
  });

  await assert.rejects(
    () => service.listComments({ repo, categoryId }),
    (error) => error.code === 'GITHUB_FORBIDDEN'
      && error.status === 502
      && !String(error.message).includes('invalid'),
  );
});

test('GitHub comments identify GraphQL node limit errors', async () => {
  const service = createGithubCommentsService({
    token: 'github_pat_secret',
    fetchImpl: async () => Response.json({
      data: null,
      errors: [{
        type: 'MAX_NODE_LIMIT_EXCEEDED',
        message: 'This query requests too many possible nodes.',
      }],
    }),
  });

  await assert.rejects(
    () => service.listComments({ repo, categoryId }),
    (error) => error.code === 'GITHUB_MAX_NODE_LIMIT'
      && error.message === 'GitHub留言查询超过节点上限',
  );
});
