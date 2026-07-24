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
  let request;
  const service = createGithubCommentsService({
    token: 'github_pat_secret',
    fetchImpl: async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return Response.json({
        data: {
          repository: {
            discussions: {
              nodes: [{
                id: 'D_1',
                number: 1,
                title: '/',
                url: 'https://github.com/example/discussions/1',
                comments: {
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
              }],
            },
          },
        },
      });
    },
  });

  const result = await service.listComments({ repo, categoryId });

  assert.equal(request.url, 'https://api.github.com/graphql');
  assert.equal(request.options.headers.authorization, 'Bearer github_pat_secret');
  assert.equal(request.body.variables.owner, 'cs-xdu-dev-001');
  assert.equal(request.body.variables.name, 'Blog');
  assert.equal(request.body.variables.categoryId, categoryId);
  assert.deepEqual(result.items.map((item) => item.id), ['DCR_1', 'DC_1']);
  assert.equal(result.items[0].isReply, true);
  assert.equal(result.items[0].parentId, 'DC_1');
  assert.equal(result.items[1].author.login, 'reader');
  assert.equal(result.total, 2);
  assert.doesNotMatch(JSON.stringify(result), /github_pat_secret/);
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
