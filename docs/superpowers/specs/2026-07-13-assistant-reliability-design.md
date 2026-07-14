# AI助手稳定性设计

## 目标

将博客AI助手从“等待完整JSON后一次性展示”改为端到端SSE流式输出，并为超时、上游错误、空响应和协议异常提供可识别的错误码、可重试交互和结构化服务端日志。

## 范围

- 同时支持OpenAI兼容的`chat/completions`和`responses`接口。
- 浏览器通过现有`POST /api/assistant`接收SSE事件。
- 失败后由用户点击消息内的重试按钮，不做服务端自动重试。
- 服务端日志输出到标准输出/标准错误，由PM2、systemd或容器日志系统收集。
- 不增加日志数据库、管理端日志页面、WebSocket或新的UI组件库。

## 请求链路

1. 浏览器提交问题和最近对话上下文。
2. API生成`requestId`，完成参数校验和限流。
3. 服务端检索博客内容并请求上游模型。
4. 上游片段被统一转换为博客SSE事件并立即写回浏览器。
5. 浏览器持续更新同一条AI消息，结束后才写入会话历史。
6. 请求失败时，服务端发送结构化错误事件；浏览器保留原问题和历史快照供手动重试。

## SSE协议

每个事件使用标准SSE格式：

```text
event: start
data: {"requestId":"..."}

event: delta
data: {"text":"..."}

event: sources
data: {"sources":[]}

event: done
data: {"requestId":"..."}

event: error
data: {"requestId":"...","code":"UPSTREAM_TIMEOUT","message":"响应超时","retryable":true}
```

事件职责：

- `start`：连接建立，返回请求标识。
- `delta`：追加回答片段。
- `sources`：发送站内参考来源。
- `done`：回答完整结束。
- `error`：返回稳定错误码、面向用户的短消息和是否允许重试。

## 上游兼容

### Chat Completions

请求增加`stream: true`，解析`choices[0].delta.content`。如果第三方中转站忽略流式参数并返回JSON，则读取`choices[0].message.content`并生成一个`delta`事件。

### Responses

解析`response.output_text.delta`、`response.output_text.done`和`response.completed`。累计事件与最终完整文本同时出现时，以增量文本为主，不重复追加最终文本。普通JSON响应继续读取`output_text`或`output[].content[].text`。

## 超时

- 默认上游活动超时为45秒。
- 发出请求后开始计时，每收到一个有效上游数据块就刷新计时。
- 活动超时触发后中止上游请求并返回`UPSTREAM_TIMEOUT`。
- 用户主动停止使用现有AbortController，不显示为服务器故障，也不提供重试按钮。
- 浏览器状态由“正在连接”切换为“正在生成”；超时后显示“响应超时”。

## 错误模型

| 错误码 | 场景 | 可重试 |
| --- | --- | --- |
| `UPSTREAM_TIMEOUT` | 上游在活动超时内没有数据 | 是 |
| `UPSTREAM_HTTP_ERROR` | 上游返回非2xx状态 | 429、5xx可重试，其他状态不可重试 |
| `EMPTY_RESPONSE` | 流结束但没有任何文本 | 是 |
| `STREAM_PROTOCOL_ERROR` | SSE或JSON格式无法解析 | 是 |
| `RATE_LIMITED` | 博客自身限流 | 否 |
| `INTERNAL_ERROR` | 未预期服务端错误 | 是 |

错误事件不透传上游响应正文、密钥、代理地址或内部堆栈。HTTP接口在SSE连接建立前发生的校验错误仍使用JSON和对应HTTP状态。

## 手动重试

- 失败消息内显示“重试”按钮。
- 每条失败消息保存原问题、提交时的历史快照和消息节点引用。
- 点击后复用原请求，替换原失败消息，不重复插入用户消息。
- 正在生成时点击其他重试按钮无效；当前请求仍可通过发送按钮停止。
- 重试成功后按正常流程写入会话历史，并移除重试按钮。

## 服务端日志

日志为单行JSON，字段包括：

- `timestamp`
- `level`
- `event`
- `requestId`
- `durationMs`
- `mode`
- `model`
- `upstreamStatus`
- `errorCode`
- `retryable`

记录事件：`assistant.request.started`、`assistant.stream.started`、`assistant.request.completed`和`assistant.request.failed`。

日志不得包含API Key、Authorization头、完整问题、完整回答、原始IP和检索正文。可记录问题字符数、历史轮数、来源数量和输出字符数。

## 模块边界

- `assistantService.mjs`：参数校验、限流、检索、上游请求、协议解析和统一事件生成。
- `api/assistant.ts`：把服务层事件编码为SSE响应，处理连接建立前的JSON错误。
- `assistant-core.mjs`：提供SSE分帧解析、错误归一化等可单测纯函数。
- `assistant.js`：管理流式消息、状态、取消和重试交互。
- `global.css`：补充重试按钮与流式状态样式，不改变窗口整体设计。

## 验证

- 单元测试覆盖两种上游协议的流式与普通JSON响应。
- 覆盖增量与最终文本并存时不重复、空响应、超时、非2xx错误和客户端SSE分帧。
- 覆盖重试不重复用户消息、成功后写入历史、取消不显示故障。
- 运行`node --test`、`npm run build`和`git diff --check`。
- 使用本地浏览器验证实时片段、停止生成和失败后重试。
