# Flowcheck: Codebase Discrepancies & Verification Log

This document records all discrepancies between the flowcheck specifications/assumptions and the actual implementation in the Nodebase codebase (per Non-Negotiable Rule 1).

---

## 1. Schema & Model Discrepancies

### A. Connection Model Column Names
- **Prompt Assumption / Conventional Names**: `source`, `target` or `fromNode`, `toNode`.
- **Actual Prisma Schema (`prisma/schema.prisma`)**:
  - `Connection.fromNodeId` (foreign key to `Node.id`)
  - `Connection.toNodeId` (foreign key to `Node.id`)
  - `Connection.fromOutput` (default `"main"`)
  - `Connection.toInput` (default `"main"`)
- **Resolution**:
  - In `src/features/flowcheck`, the pure analysis interface uses `{ source: string; target: string }` (`FlowEdge`).
  - When bridging from Prisma `Connection` models (e.g. in tRPC pre-run gate and Inngest step), map:
    `source = conn.fromNodeId`, `target = conn.toNodeId`.
  - When bridging from React Flow `Edge` objects in the editor, `edge.source` and `edge.target` are used directly.

### B. Node Model Config Storage
- **Prompt Assumption**: Configuration stored as `data Json`.
- **Actual Prisma Schema**: `Node.data Json @default("{}")` and `Node.type NodeType`. Matches assumption.

### C. Trigger Output Keys vs Variable Names
- **Prompt Assumption**: Triggers may use `data.variableName`.
- **Actual Implementation**:
  - `MANUAL_TRIGGER` / `INITIAL`: Do not write any new key; they pass through `context` untouched.
  - `GOOGLE_FORM_TRIGGER`: Injected into context by `/api/webhooks/google-form` with fixed root key `googleForm`.
  - `STRIPE_TRIGGER`: Injected into context by `/api/webhooks/stripe` with fixed root key `stripe`.
  - `TELEGRAM_TRIGGER`: Injected into context by `/api/webhooks/telegram` with fixed root key `telegram`.
- **Resolution**: Trigger signatures use fixed variable names (`"googleForm"`, `"stripe"`, `"telegram"`), while `MANUAL_TRIGGER` and `INITIAL` have no output variable name.

---

## 2. Executor Context Structure & Nesting Discrepancies

### A. HTTP_REQUEST Node Output Structure
- **Prompt Example**: `{{fetchUser.httpResponse.data.email}}`
- **Actual Code (`src/features/executions/components/http-request/executor.ts`)**:
  ```ts
  const responsePayload = {
    httpResponse: {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
    },
  };
  return {
    ...context,
    [data.variableName]: responsePayload,
  };
  ```
  Resulting path: `context[variableName].httpResponse.status`, `context[variableName].httpResponse.data`.
- **Verification**: Exactly matches the prompt example `{{fetchUser.httpResponse.data.email}}`.

### B. AI Nodes (`OPENAI`, `ANTHROPIC`, `GEMINI`)
- **Actual Return**:
  ```ts
  return {
    ...context,
    [data.variableName]: {
      text,
    },
  };
  ```
- Resulting path: `{{aiNode.text}}`.

### C. Messaging Nodes (`DISCORD`, `SLACK`)
- **Actual Return**:
  ```ts
  return {
    ...context,
    [data.variableName]: {
      messageContent: content.slice(0, 2000),
    },
  };
  ```
- Resulting path: `{{discordNode.messageContent}}`, `{{slackNode.messageContent}}`.

### D. Email Node (`EMAIL`)
- **Actual Return**:
  ```ts
  return {
    ...context,
    [data.variableName]: {
      id: response.id,
      to,
      from,
      subject,
      hasAttachment: !!attachments?.length,
    },
  };
  ```

### E. File Generator Node (`FILE_GENERATOR`)
- **Actual Return**:
  ```ts
  return {
    ...context,
    [data.variableName]: {
      filename,
      format,
      content,
      base64,
      mimeType,
      size,
    },
  };
  ```

### F. Telegram Outbound Node (`TELEGRAM`)
- **Actual Return**:
  ```ts
  return {
    ...context,
    [data.variableName]: {
      messageId: responseData.result?.message_id,
      chatId: responseData.result?.chat?.id ?? chatId,
      chatTitle: responseData.result?.chat?.title,
      chatUsername: responseData.result?.chat?.username,
      text: responseData.result?.text ?? text,
      date: responseData.result?.date,
      ok: true,
    },
  };
  ```

### G. Database Node (`DATABASE`)
- **Actual Return**:
  ```ts
  return {
    ...context,
    [data.variableName]: {
      rows,
      rowCount: res.rowCount ?? rows.length,
      firstRow: rows.length > 0 ? rows[0] : null,
      command: res.command,
      fields,
    },
  };
  ```

---

## 3. Editor State & Lifecycle Discrepancies

### A. Graph State Storage in Editor
- **Prompt Query**: Is graph state held in React Flow's `useNodesState` or a Jotai atom?
- **Actual Code (`src/features/editor/components/editor.tsx`)**:
  - `nodes` and `edges` are stored in React `useState<Node[]>` and `useState<Edge[]>`.
  - `editorAtom` (Jotai) stores only the `ReactFlowInstance | null` initialized via `onInit={setEditor}`.
  - Node changes are handled by `applyNodeChanges` and edge changes by `applyEdgeChanges`.
  - Node data updates from settings dialogs are applied via `setNodes` from `useReactFlow()`.
- **Resolution for `use-flow-diagnostics.ts`**:
  - The diagnostics hook can accept `(nodes, edges)` directly from `Editor` or use `useReactFlow().getNodes()` and `getEdges()`. Providing `FlowDiagnosticsProvider` inside `ReactFlow` gives child components (including `BaseExecutionNode` and dialogs) immediate access to reactive diagnostics.

---

## 4. Handlebars Environment & Helpers Discrepancies

### A. Helper Registrations
- **Codebase Helper**: Each executor registers:
  ```ts
  Handlebars.registerHelper("json", (context) => {
    const jsonString = JSON.stringify(context, null, 2);
    const safeString = new Handlebars.SafeString(jsonString);
    return safeString;
  });
  ```
- **Custom Options**: At runtime, `Handlebars.compile(str)(context)` is called with default options (not `strict: true` and not `noEscape: true`).
- **HTML Entity Decoding**: All executors (except AI nodes) unescape output using `decode(rawContent)` from `html-entities`.
- **Resolution**: The parser and analyzer recognize the `json` helper and treat non-`json` helpers gracefully without raising false errors.

---

## 5. Dependency Audit

- `handlebars`: Already listed in `dependencies` (`^4.7.9`).
- `vitest`: Added to `devDependencies` (`^3.0.0`) with `--legacy-peer-deps` due to Node 20 types in repo.
- `tsx`: Already present in `devDependencies` (`^4.23.11`).

---

## 6. Build & Runtime Environment Discrepancies

### A. Next.js 15 Turbopack Build on Windows
- **Issue**: `next build --turbopack` fails on Windows with `[Error [PageNotFoundError]: Cannot find module for page: /credentials/[credentialId]]` during page data collection due to a known Turbopack bug on Windows with dynamic route paths.
- **Resolution**: Updated `package.json` `"build"` script from `next build --turbopack` to `next build`. Normal Webpack build succeeds cleanly generating all 15 routes.

---

## 7. Unverified Signatures (API Keys Not Provided)

Per user instruction ("You can skip test for openai and anthropic as the api keys are notprovided") and Non-Negotiable Rule 1 / Section 3:
1. **`OPENAI` (`src/features/flowcheck/__tests__/contract/openai.contract.test.ts`)**:
   - Marked `it.todo("output context conforms to signature.output(data) - skipped: OpenAI API key not provided")`.
   - Verified statically against executor code: produces `{ text: string }`.
2. **`ANTHROPIC` (`src/features/flowcheck/__tests__/contract/anthropic.contract.test.ts`)**:
   - Marked `it.todo("output context conforms to signature.output(data) - skipped: Anthropic API key not provided")`.
   - Verified statically against executor code: produces `{ text: string }`.


