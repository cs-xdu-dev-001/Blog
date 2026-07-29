# Content References and Admin AI Speed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `[[`-driven internal links with public backlinks and make admin editing requests use a scoped, truly streamed `gpt-5.5` path.

**Architecture:** A focused server service supplies reference search and backlink lookup without adding a relation table. Milkdown owns the caret popover and inserts ordinary Markdown links. Admin quick-edit commands use a dedicated streaming function with an admin-only model override; free-form Agent requests keep the existing structured proposal path.

**Tech Stack:** Astro, SQLite, Milkdown/ProseMirror, browser Fetch/SSE, Node test runner.

---

### Task 1: Public reference search and backlinks

**Files:**
- Create: `src/lib/server/contentReferenceService.mjs`
- Create: `src/pages/api/admin/references.ts`
- Create: `tests/contentReferenceService.test.mjs`

- [ ] **Step 1: Write the failing service tests**

Cover public notes, topics, books, watch and food results; stable URLs; query filtering; and backlink filtering:

```js
test('searches only public reference targets with stable URLs', () => {
  const service = createContentReferenceService(fakeRepositories);
  assert.deepEqual(service.search('Agent').map(({ type, url }) => ({ type, url })), [
    { type: 'post', url: '/posts/agent-notes' },
    { type: 'topic', url: '/topics/agent-system' },
  ]);
});

test('returns only published unlocked notes that link to the target URL', () => {
  const service = createContentReferenceService(fakeRepositories);
  assert.deepEqual(service.backlinks('/watch/12').map((item) => item.slug), ['film-note']);
});
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/contentReferenceService.test.mjs
```

Expected: FAIL because `contentReferenceService.mjs` does not exist.

- [ ] **Step 3: Implement the minimal service**

Expose:

```js
export function createContentReferenceService(deps = {}) {
  return {
    search(queryInput = '', { limit = 8 } = {}) {},
    backlinks(targetUrl, { limit = 8 } = {}) {},
  };
}

export const contentReferenceService = createContentReferenceService();
```

Normalize results to `{ type, typeLabel, title, subtitle, url }`. Backlinks query published, non-locked posts and match the exact Markdown link destination.

- [ ] **Step 4: Add the authenticated search route**

`GET /api/admin/references?q=...` must call `requireAdmin`, reject empty queries with an empty result, and return `{ items }`.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --test tests/contentReferenceService.test.mjs tests/adminAuthMiddleware.test.mjs
```

Expected: PASS.

### Task 2: Milkdown `[[` reference picker

**Files:**
- Create: `src/scripts/admin-post-references.js`
- Modify: `src/scripts/admin-post-milkdown.js`
- Modify: `src/styles/global.css`
- Create: `tests/adminPostReferences.test.mjs`

- [ ] **Step 1: Write failing source and helper tests**

```js
test('buildReferenceMarkdown creates a normal Markdown link', () => {
  assert.equal(
    buildReferenceMarkdown({ title: 'Agent系统', url: '/topics/agent-system' }),
    '[Agent系统](/topics/agent-system)',
  );
});
```

Also assert that the Milkdown boot file registers the reference picker and that the picker calls `/api/admin/references`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/adminPostReferences.test.mjs
```

Expected: FAIL because the reference module is missing.

- [ ] **Step 3: Implement the picker**

`admin-post-references.js` exports `buildReferenceMarkdown` and `attachPostReferencePicker`. The picker:

- detects `[[query` immediately before the caret;
- debounces search by 120ms;
- anchors one compact list beside the caret;
- supports ArrowUp, ArrowDown, Enter and Escape;
- replaces the trigger text with `[title](url)` through Milkdown `replaceRange`;
- closes on blur, selection change or successful insertion.

- [ ] **Step 4: Register after Milkdown creation**

Call `attachPostReferencePicker({ root, crepe })` only after `await crepe.create()`. Add restrained popover styles matching the existing editor.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --test tests/adminPostReferences.test.mjs
```

Expected: PASS.

### Task 3: Backlinks on public detail pages

**Files:**
- Create: `src/components/ContentBacklinks.astro`
- Modify: `src/pages/posts/[slug].astro`
- Modify: `src/pages/reading/[slug].astro`
- Modify: `src/pages/watch/[id].astro`
- Modify: `src/pages/food/[id].astro`
- Modify: `src/pages/topics/[slug].astro`
- Modify: `src/styles/global.css`
- Create: `tests/contentBacklinksSource.test.mjs`

- [ ] **Step 1: Write failing rendering tests**

Assert that each detail route asks `contentReferenceService.backlinks()` with its canonical URL and renders `ContentBacklinks`. Assert that the component renders nothing for an empty array.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/contentBacklinksSource.test.mjs
```

Expected: FAIL because the component and route integrations are absent.

- [ ] **Step 3: Implement the shared component and route calls**

The component receives:

```ts
interface Props {
  items: Array<{ title: string; url: string; description?: string }>;
}
```

Render a compact “相关笔记” list only when `items.length > 0`. Do not add explanatory small text or a homepage block.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
node --test tests/contentReferenceService.test.mjs tests/contentBacklinksSource.test.mjs
```

Expected: PASS.

### Task 4: Scoped admin quick-edit requests

**Files:**
- Modify: `src/scripts/admin-post-milkdown.js`
- Modify: `src/scripts/admin-post-agent.js`
- Modify: `src/lib/server/adminAgentService.mjs`
- Modify: `tests/adminAgentEditorBridge.test.mjs`
- Create: `tests/adminAgentScope.test.mjs`

- [ ] **Step 1: Write failing scope tests**

```js
test('selection requests omit the full document and include adjacent paragraphs', () => {
  const context = buildAdminAgentContext(inputWithSelection);
  assert.equal(context.scope, 'selection');
  assert.equal(context.document, '');
  assert.match(context.surrounding, /previous paragraph/);
  assert.match(context.surrounding, /next paragraph/);
});
```

Assert that command buttons send a machine-readable quick-edit action and history is limited to four messages.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/adminAgentScope.test.mjs tests/adminAgentEditorBridge.test.mjs
```

Expected: FAIL because scoped context and quick-edit action are not implemented.

- [ ] **Step 3: Extend the editor bridge context**

`captureContext()` must return `selection`, `before`, `after`, and `document`. For selection scope, the browser request sends `selection`, `before`, and `after` but sends an empty `document`.

- [ ] **Step 4: Split quick-edit from free-form Agent requests**

Command buttons pass `action: polish|continue|shorten|rewrite|structure`. Free-form messages keep `action: chat`. Reduce retained history from eight to four messages.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
node --test tests/adminAgentScope.test.mjs tests/adminAgentEditorBridge.test.mjs
```

Expected: PASS.

### Task 5: True streaming with admin-only `gpt-5.5`

**Files:**
- Modify: `src/lib/server/assistantService.mjs`
- Modify: `src/lib/server/adminAgentService.mjs`
- Modify: `src/pages/api/admin/assistant/agent.ts`
- Modify: `src/scripts/admin-post-agent.js`
- Modify: `tests/adminWritingAssistant.test.mjs`
- Create: `tests/adminAgentStreaming.test.mjs`

- [ ] **Step 1: Write failing streaming tests**

Assert that:

- admin quick-edit request bodies use `model: 'gpt-5.5'`;
- both chat-completions and Responses requests set `stream: true`;
- upstream deltas are yielded before completion;
- interrupted streams never emit a confirmable result;
- public assistant requests continue using configured `assistant.model`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
node --test tests/adminAgentStreaming.test.mjs tests/adminWritingAssistant.test.mjs
```

Expected: FAIL because quick-edit is not truly streamed and has no admin-only model override.

- [ ] **Step 3: Add a reusable upstream text stream**

Export an async generator from `assistantService.mjs`:

```js
export async function* streamAssistantText({
  systemText,
  messages,
  maxTokens,
  model,
  config,
  signal,
}) {}
```

Use existing SSE frame parsing for both API modes. `model` overrides only this request and never mutates site configuration.

- [ ] **Step 4: Stream quick-edit events**

`streamAdminAgent()` detects a quick-edit action, builds a plain-Markdown editing prompt, calls `streamAssistantText({ model: 'gpt-5.5' })`, and yields:

```text
event: delta
data: {"text":"..."}

event: result
data: {"message":"修改建议已生成","proposal":{"scope":"selection","markdown":"..."}}
```

Only emit `result` after a clean upstream completion.

- [ ] **Step 5: Render deltas in the editor review layer**

The browser accumulates `delta` text and calls a bridge method that updates the existing review layer in place. Confirmation remains disabled until the final `result` event.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
node --test tests/adminAgentStreaming.test.mjs tests/adminWritingAssistant.test.mjs tests/adminAgentEditorBridge.test.mjs
```

Expected: PASS.

### Task 6: Complete verification

**Files:**
- Modify only files needed to fix discovered regressions.

- [ ] **Step 1: Run focused tests**

```powershell
node --test tests/contentReferenceService.test.mjs tests/adminPostReferences.test.mjs tests/contentBacklinksSource.test.mjs tests/adminAgentScope.test.mjs tests/adminAgentStreaming.test.mjs
```

Expected: all pass.

- [ ] **Step 2: Run the full test suite**

```powershell
node --test tests/*.test.mjs
```

Expected: zero failures.

- [ ] **Step 3: Run the production build and diff check**

```powershell
npm run build
git diff --check
```

Expected: build complete and no whitespace errors.

- [ ] **Step 4: Report without committing**

Summarize changed behavior, measured request reduction, test count and build status. Do not commit or push until the user explicitly asks for Git.
