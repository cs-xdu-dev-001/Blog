import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  runAdminAgent,
  streamAdminAgent,
} from '../src/lib/server/adminAgentService.mjs';

const config = {
  assistant: {
    apiBaseUrl: 'https://example.com/v1',
    apiKey: 'test-key',
    model: 'test-model',
    apiMode: 'chat',
  },
};

test('admin agent rejects an empty message', async () => {
  const result = await runAdminAgent({}, { config });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    code: 'INVALID_REQUEST',
    error: '请输入消息',
  });
});

test('admin agent limits history and note context before calling the model', async () => {
  let captured;
  const history = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: `message-${index}`,
  }));

  const result = await runAdminAgent({
    message: '帮我分析',
    title: '测试笔记',
    document: 'a'.repeat(35000),
    history,
  }, {
    config,
    requestText: async (input) => {
      captured = input;
      return { ok: true, text: '{"message":"可以","proposal":null}' };
    },
  });

  assert.equal(result.ok, true);
  assert.equal(captured.messages.length, 5);
  assert.deepEqual(
    captured.messages.slice(0, 4).map((message) => message.content),
    history.slice(-4).map((message) => message.content),
  );
  assert.equal(captured.messages.at(-1).role, 'user');
  assert.match(captured.messages.at(-1).content, /测试笔记/);
  assert.equal(captured.messages.at(-1).content.includes('a'.repeat(30000)), true);
  assert.equal(captured.messages.at(-1).content.includes('a'.repeat(30001)), false);
  assert.equal(captured.model, 'gpt-5.5');
});

test('selected editing sends only the selection and adjacent paragraphs', async () => {
  let captured;
  await runAdminAgent({
    message: '润色',
    document: '不应发送的整篇正文',
    selection: '当前句子',
    before: '上一段',
    after: '下一段',
  }, {
    config,
    requestText: async (input) => {
      captured = input;
      return {
        ok: true,
        text: '{"message":"完成","proposal":{"scope":"selection","markdown":"新句子"}}',
      };
    },
  });

  const context = captured.messages.at(-1).content;
  assert.match(context, /上一段/);
  assert.match(context, /当前句子/);
  assert.match(context, /下一段/);
  assert.doesNotMatch(context, /不应发送的整篇正文/);
});

test('admin agent returns a normal answer without a proposal', async () => {
  const result = await runAdminAgent({
    message: '解释这一段',
    document: '正文',
  }, {
    config,
    requestText: async () => ({
      ok: true,
      text: '```json\n{"message":"这段内容在说明测试流程。","proposal":null}\n```',
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    message: '这段内容在说明测试流程。',
    proposal: null,
  });
});

test('admin agent returns a reviewable Markdown proposal', async () => {
  const result = await runAdminAgent({
    message: '把选中内容改成二级标题',
    document: '# 正文',
    selection: '原内容',
  }, {
    config,
    requestText: async () => ({
      ok: true,
      text: JSON.stringify({
        message: '已生成修改建议。',
        proposal: { scope: 'selection', markdown: '## 新结构' },
      }),
    }),
  });

  assert.deepEqual(result, {
    ok: true,
    message: '已生成修改建议。',
    proposal: {
      scope: 'selection',
      markdown: '## 新结构',
    },
  });
});

test('admin agent prompt requires an edit proposal for direct editing requests', async () => {
  let captured;
  await runAdminAgent({
    message: '直接修改左边的正文',
    document: '# 原正文',
  }, {
    config,
    requestText: async (input) => {
      captured = input;
      return {
        ok: true,
        text: '{"message":"已生成修改建议。","proposal":{"scope":"document","markdown":"# 新正文"}}',
      };
    },
  });

  assert.match(captured.systemText, /不得回答.*不能修改/);
  assert.match(captured.systemText, /必须返回proposal/);
});

test('admin agent honors an explicit editing scope', async () => {
  let captured;
  const result = await runAdminAgent({
    message: '润色',
    document: '# 原正文',
    selection: '原句',
    scopePreference: 'document',
  }, {
    config,
    requestText: async (input) => {
      captured = input;
      return {
        ok: true,
        text: '{"message":"已生成修改建议。","proposal":{"scope":"document","markdown":"# 新正文"}}',
      };
    },
  });

  assert.equal(result.ok, true);
  assert.match(captured.messages.at(-1).content, /本次操作范围：整篇正文/);
  assert.match(captured.systemText, /明确指定整篇正文时，proposal\.scope必须为document/);
});

test('admin agent rejects an invalid structured response', async () => {
  const result = await runAdminAgent({
    message: '润色',
    document: '正文',
  }, {
    config,
    requestText: async () => ({ ok: true, text: 'not json' }),
  });

  assert.deepEqual(result, {
    ok: false,
    status: 502,
    code: 'AGENT_RESPONSE_INVALID',
    error: '模型返回格式异常，请重试',
  });
});

test('admin agent endpoint requires admin access and forwards abort signals', () => {
  const url = new URL('../src/pages/api/admin/assistant/agent.ts', import.meta.url);
  const source = fs.existsSync(url) ? fs.readFileSync(url, 'utf8') : '';

  assert.match(source, /requireAdmin\(context\)/);
  assert.match(source, /streamAdminAgent/);
  assert.match(source, /signal:\s*context\.request\.signal/);
  assert.match(source, /text\/event-stream/);
  assert.match(source, /encodeAssistantSse/);
  assert.match(source, /status:\s*405/);
});

test('admin agent stream exposes progress without leaking private reasoning', async () => {
  const events = [];
  for await (const event of streamAdminAgent({
    message: '润色',
    document: '原文',
  }, {
    config,
    requestText: async () => ({
      ok: true,
      text: '{"message":"已完成","proposal":{"scope":"document","markdown":"新文"}}',
    }),
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.filter((event) => event.event === 'phase').map((event) => event.data.label),
    ['读取当前笔记', '分析修改目标', '生成修改建议'],
  );
  assert.equal(events.at(-1).event, 'result');
  assert.equal(events.at(-1).data.message, '已完成');
  assert.equal(JSON.stringify(events).includes('chain-of-thought'), false);
});

test('quick editing streams Markdown deltas before the final proposal', async () => {
  const events = [];
  async function* streamText(input) {
    assert.equal(input.model, 'gpt-5.5');
    yield { type: 'delta', text: '润色' };
    yield { type: 'delta', text: '结果' };
    yield { type: 'done', text: '润色结果' };
  }

  for await (const event of streamAdminAgent({
    action: 'polish',
    message: '润色',
    document: '原文',
  }, { config, streamText })) {
    events.push(event);
  }

  assert.deepEqual(
    events.filter((event) => event.event === 'delta').map((event) => event.data.text),
    ['润色', '结果'],
  );
  assert.deepEqual(events.at(-1), {
    event: 'result',
    data: {
      message: '修改建议已生成',
      proposal: { scope: 'document', markdown: '润色结果' },
    },
  });
});
