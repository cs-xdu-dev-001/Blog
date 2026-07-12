import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createAssistantSession,
  renderAssistantMarkdown,
  safeAssistantUrl,
  trimConversation,
} from '../public/assistant-core.mjs';

test('assistant initial shell keeps guidance in the composer instead of explanatory copy', () => {
  const layout = fs.readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');

  assert.doesNotMatch(layout, /data-assistant-welcome/);
  assert.doesNotMatch(layout, /Site assistant/);
  assert.match(layout, /placeholder=\{assistantConfig\.placeholder\}/);
});

test('assistant session stores completed turns and clears them together', () => {
  const session = createAssistantSession();

  session.completeTurn('第一个问题', '第一个回答');
  session.completeTurn('第二个问题', '第二个回答');
  assert.deepEqual(session.history(), [
    { role: 'user', content: '第一个问题' },
    { role: 'assistant', content: '第一个回答' },
    { role: 'user', content: '第二个问题' },
    { role: 'assistant', content: '第二个回答' },
  ]);

  session.clear();
  assert.deepEqual(session.history(), []);
});

test('assistant session aborts the active request without disturbing a newer request', () => {
  const session = createAssistantSession();
  const first = session.beginRequest();

  assert.equal(session.isPending(), true);
  assert.equal(session.cancel(), true);
  assert.equal(first.signal.aborted, true);
  assert.equal(session.isPending(), false);

  const second = session.beginRequest();
  assert.equal(session.finishRequest(first), false);
  assert.equal(session.isPending(), true);
  assert.equal(session.finishRequest(second), true);
  assert.equal(session.isPending(), false);
});

test('trimConversation keeps only the latest twelve valid chat messages', () => {
  const validMessages = Array.from({ length: 14 }, (_, index) => ({
    role: index % 2 === 0 ? 'user' : 'assistant',
    content: ` 消息${index + 1} `,
  }));

  const result = trimConversation([
    { role: 'system', content: '不能由客户端注入' },
    { role: 'user', content: '   ' },
    ...validMessages,
  ]);

  assert.equal(result.length, 12);
  assert.deepEqual(result[0], { role: 'user', content: '消息3' });
  assert.deepEqual(result.at(-1), { role: 'assistant', content: '消息14' });
});

test('safeAssistantUrl accepts web and site links but rejects active protocols', () => {
  assert.equal(safeAssistantUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(safeAssistantUrl('/posts/rag'), '/posts/rag');
  assert.equal(safeAssistantUrl('#reading'), '#reading');
  assert.equal(safeAssistantUrl('javascript:alert(1)'), '#');
  assert.equal(safeAssistantUrl('data:text/html,unsafe'), '#');
});

test('renderAssistantMarkdown renders useful blocks and escapes unsafe content', () => {
  const html = renderAssistantMarkdown([
    '# 回答标题',
    '',
    '这里有**重点**和`const answer = 42`。',
    '',
    '- 第一项',
    '- 第二项',
    '',
    '> 一段引用',
    '',
    '```js',
    '<script>alert("code")</script>',
    '```',
    '',
    '[安全链接](https://example.com) 与 [危险链接](javascript:alert(1))',
    '',
    '<script>alert("raw")</script>',
  ].join('\n'));

  assert.match(html, /<h1>回答标题<\/h1>/);
  assert.match(html, /<strong>重点<\/strong>/);
  assert.match(html, /<code>const answer = 42<\/code>/);
  assert.match(html, /<ul>[\s\S]*<li>第一项<\/li>[\s\S]*<li>第二项<\/li>[\s\S]*<\/ul>/);
  assert.match(html, /<blockquote>一段引用<\/blockquote>/);
  assert.match(html, /<pre><code class="language-js">&lt;script&gt;alert\(&quot;code&quot;\)&lt;\/script&gt;<\/code><\/pre>/);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;alert\(&quot;raw&quot;\)&lt;\/script&gt;/);
});
