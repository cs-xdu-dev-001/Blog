# AI助手稳定性实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将博客AI助手改为端到端SSE流式输出，并补齐活动超时、错误码、结构化日志和失败消息重试。

**Architecture:** 服务层完成校验、限流、检索和上游协议归一化，输出统一事件异步迭代器；Astro API把事件编码为SSE；浏览器增量消费事件并更新同一消息。现有`answer()`保留为兼容入口，公开API切换到`streamAnswer()`。

**Tech Stack:** Astro、Node.js Web Streams、OpenAI兼容Chat Completions/Responses、原生JavaScript、Node.js Test Runner

---

### Task 1: 客户端SSE分帧

**Files:**
- Modify: `public/assistant-core.mjs`
- Modify: `tests/assistantClientCore.test.mjs`

- [ ] 先测试跨数据块事件、多个事件、尾部残片和错误JSON。
- [ ] 实现`consumeAssistantSse(buffer, chunk, flush)`，返回`{ buffer, events }`。
- [ ] 事件结构统一为`{ event, data }`，无效JSON返回`STREAM_PROTOCOL_ERROR`事件。
- [ ] 运行`node --test tests/assistantClientCore.test.mjs`。

### Task 2: 服务端上游流、超时和日志

**Files:**
- Modify: `src/lib/server/assistantService.mjs`
- Modify: `tests/assistantService.test.mjs`

- [ ] 先测试Chat增量流、Responses增量流、普通JSON降级、空响应、HTTP错误、活动超时和日志脱敏。
- [ ] 为请求体增加可选`stream:true`，不影响现有非流式兼容入口。
- [ ] 实现45秒活动超时，每个有效上游数据块刷新计时。
- [ ] 将两种上游协议统一为`delta`文本，处理累计文本不重复。
- [ ] 新增`streamAnswer()`，输出`start`、`sources`、`delta`、`done`、`error`事件。
- [ ] 日志输出单行JSON，只记录请求标识、模式、模型、耗时、状态、错误码和计数。
- [ ] 运行`node --test tests/assistantService.test.mjs`。

### Task 3: Astro SSE接口

**Files:**
- Modify: `src/pages/api/assistant.ts`
- Create: `tests/assistantApiStream.test.mjs`

- [ ] 先测试API返回`text/event-stream`、事件编码和连接前JSON错误。
- [ ] 使用`ReadableStream`逐事件编码，设置`Cache-Control: no-cache, no-transform`和`X-Accel-Buffering: no`。
- [ ] 客户端断开时结束事件迭代器，不把内部错误正文暴露给浏览器。
- [ ] 运行`node --test tests/assistantApiStream.test.mjs`。

### Task 4: 前端流式消息与重试按钮

**Files:**
- Modify: `public/assistant.js`
- Modify: `src/styles/global.css`
- Modify: `tests/assistantClientCore.test.mjs`

- [ ] 先添加源码断言，要求SSE读取、`正在连接`/`正在生成`状态、错误码和`data-assistant-retry`。
- [ ] 抽取提交函数，保存问题与历史快照；重试复用原AI消息，不重复用户消息。
- [ ] 流式阶段使用纯文本增量更新，`done`后统一Markdown渲染并写入会话历史。
- [ ] 用户取消显示“已停止生成”，不出现重试按钮。
- [ ] 错误显示短消息和错误码，仅`retryable:true`时显示“重试”。
- [ ] 重试按钮使用现有黑白样式，不增加说明段落。
- [ ] 运行客户端测试。

### Task 5: 完整验证

**Files:**
- Verify only

- [ ] 运行`node --test`。
- [ ] 运行`npm run build`。
- [ ] 运行`git diff --check`。
- [ ] 浏览器模拟分块SSE，检查首片实时出现、停止生成、超时错误和原位重试。
- [ ] 确认日志中没有API Key、Authorization、完整问题、完整回答和原始IP。
