import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { editAssistantMarkdown } from '../src/lib/server/assistantService.mjs';

function read(relativePath) {
  const url = new URL(`../${relativePath}`, import.meta.url);
  return fs.existsSync(url) ? fs.readFileSync(url, 'utf8') : '';
}

test('admin writing assistant preserves Markdown and requests a replacement only', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({
      choices: [{ message: { content: '- 第一项\n- 第二项\n\n```js\nconst ok = true;\n```' } }],
    });
  };

  try {
    const result = await editAssistantMarkdown({
      document: '# 原文\n\n- 第一项\n- 第二项',
      selection: '- 第一项\n- 第二项',
      instruction: '润色，但保留列表格式',
    }, {
      config: {
        assistant: {
          apiBaseUrl: 'https://example.com/v1',
          apiKey: 'test-key',
          model: 'test-model',
          apiMode: 'chat',
        },
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.text, '- 第一项\n- 第二项\n\n```js\nconst ok = true;\n```');
    assert.equal(calls[0].url, 'https://example.com/v1/chat/completions');
    assert.equal(calls[0].body.stream, false);
    assert.match(calls[0].body.messages[0].content, /只返回替换后的Markdown/);
    assert.match(calls[0].body.messages.at(-1).content, /- 第一项\n- 第二项/);
    assert.doesNotMatch(calls[0].body.messages.at(-1).content, /# 原文/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin writing assistant reports missing API configuration without a fallback answer', async () => {
  const result = await editAssistantMarkdown({
    document: '正文',
    selection: '',
    instruction: '润色',
  }, {
    config: { assistant: { apiKey: ' ' } },
  });

  assert.deepEqual(result, {
    ok: false,
    status: 503,
    code: 'ASSISTANT_NOT_CONFIGURED',
    error: 'AI接口尚未配置',
  });
});

test('admin writing assistant uses streaming for responses-only gateways', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return new Response([
      'data: {"type":"response.output_text.delta","delta":"润色后的"}',
      '',
      'data: {"type":"response.output_text.delta","delta":"内容"}',
      '',
      'data: [DONE]',
      '',
    ].join('\n'), {
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    const result = await editAssistantMarkdown({
      document: '原始内容',
      instruction: '润色',
    }, {
      config: {
        assistant: {
          apiBaseUrl: 'https://example.com/v1',
          apiKey: 'test-key',
          model: 'test-model',
          apiMode: 'responses',
        },
      },
    });

    assert.equal(requestBody.stream, true);
    assert.deepEqual(result, { ok: true, text: '润色后的内容' });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('admin writing assistant keeps the original document unchanged until the result is accepted', () => {
  const endpoint = read('src/pages/api/admin/assistant/write.ts');
  const editor = read('src/scripts/admin-post-milkdown.js');
  const styles = read('src/styles/global.css');

  assert.match(endpoint, /requireAdmin\(context\)/);
  assert.match(endpoint, /editAssistantMarkdown/);
  assert.match(endpoint, /context\.request\.signal/);

  assert.match(editor, /import\s+\{\s*CrepeBuilder\s*\}\s+from\s+'@milkdown\/crepe\/builder'/);
  assert.doesNotMatch(editor, /@milkdown\/crepe\/feature\/ai/);
  assert.doesNotMatch(editor, /callCommand\('RunAI'/);
  assert.doesNotMatch(editor, /\/api\/admin\/assistant\/write/);
  assert.match(editor, /data-ai-review/);
  assert.match(editor, /data-ai-review-original/);
  assert.match(editor, /data-ai-review-result/);
  assert.match(editor, /data-ai-review-accept/);
  assert.match(editor, /data-ai-review-reject/);
  assert.match(editor, /root\.closest\('\.post-editor-write'\)/);
  assert.match(editor, /replaceRange\(review\.result,\s*\{\s*from:\s*review\.from,\s*to:\s*review\.to\s*\}\)/);
  assert.match(editor, /crepe\.setReadonly\(true\)/);
  assert.match(editor, /crepe\.setReadonly\(false\)/);
  assert.match(editor, /\.addFeature\(toolbar/);
  assert.match(editor, /buildToolbar:\s*\(builder\)/);
  assert.match(editor, /addItem\('ai'/);
  assert.match(editor, /admin-agent:open/);
  assert.match(editor, /event\.key === '\.'/);
  assert.match(editor, /\/ai/);
  assert.doesNotMatch(editor, /createAIPalette/);
  assert.match(styles, /\.post-editor-ai-review/);
  assert.match(styles, /\.post-editor-ai-review\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
  assert.match(styles, /\.post-editor-ai-review-document\s*\{[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/s);
  assert.match(styles, /\.post-ai-review-change/);
  assert.match(styles, /\.post-editor-ai-review\s*>\s*header\s*\{[^}]*cursor:\s*default;/s);
});
