# Flowcheck Reconnaissance Report

This document contains the verified static analysis survey of the Nodebase codebase (`AI-Workflow-Automation`). It serves as the single source of truth for Phase 2 and Phase 3 implementations.

---

## 1. Package & Environment Survey

- **Dependencies**:
  - `handlebars`: `^4.7.9` (Direct dependency in `package.json`)
  - `@xyflow/react`: `^12.11.5`
  - `jotai`: `^2.20.3`
  - `@inngest/realtime`: `^0.4.6`
  - `inngest`: `^3.44.1`
  - `html-entities`: `^2.6.0`
  - `ky`: `^2.1.0`
  - `ai`: `^7.0.123`
- **DevDependencies**:
  - `tsx`: `^4.23.11`
  - `typescript`: `^5`
  - `@biomejs/biome`: `2.2.0`
  - `vitest`: *Not installed* (To be added for tests per Phase 2)
- **TypeScript Configuration (`tsconfig.json`)**:
  - `strict`: `true`
  - `noEmit`: `true`
  - `moduleResolution`: `"bundler"`
  - `paths`: `@/*` maps to `./src/*`

---

## 2. Prisma Database Schema Survey

From [`prisma/schema.prisma`](file:///e:/Programs/projects/AI-Workflow-Automation/prisma/schema.prisma):

### `Node` Model
- `id`: `String @id @default(cuid())`
- `workflowId`: `String`
- `name`: `String`
- `type`: `NodeType`
- `position`: `Json`
- `data`: `Json @default("{}")`
- `credentialId`: `String?`
- Relations: `workflow`, `credential`, `outputConnections ("FromNode")`, `inputConnections ("ToNode")`

### `Connection` Model
- `id`: `String @id @default(cuid())`
- `workflowId`: `String`
- `fromNodeId`: `String` (Source node id)
- `toNodeId`: `String` (Target node id)
- `fromOutput`: `String @default("main")`
- `toInput`: `String @default("main")`
- `@@unique([fromNodeId, toNodeId, fromOutput, toInput])`

### `NodeType` Enum
Values (15 total):
1. `INITIAL`
2. `MANUAL_TRIGGER`
3. `HTTP_REQUEST`
4. `GOOGLE_FORM_TRIGGER`
5. `STRIPE_TRIGGER`
6. `TELEGRAM_TRIGGER`
7. `ANTHROPIC`
8. `GEMINI`
9. `OPENAI`
10. `DISCORD`
11. `SLACK`
12. `EMAIL`
13. `FILE_GENERATOR`
14. `TELEGRAM`
15. `DATABASE`

### `Execution` Model
- `id`: `String @id @default(cuid())`
- `workflowId`: `String`
- `status`: `ExecutionStatus` (`RUNNING`, `SUCCESS`, `FAILED`)
- `error`: `String? @db.Text`
- `errorStack`: `String? @db.Text`
- `startedAt`: `DateTime @default(now())`
- `completedAt`: `DateTime?`
- `inngestEventId`: `String @unique`
- `output`: `Json?` (Stores final execution context)

---

## 3. Inngest Execution Flow & Graph Algorithms

From [`src/inngest/functions.ts`](file:///e:/Programs/projects/AI-Workflow-Automation/src/inngest/functions.ts) and [`src/inngest/utils.ts`](file:///e:/Programs/projects/AI-Workflow-Automation/src/inngest/utils.ts):

1. **Job Dispatch**:
   `sendWorkflowExecution(data)` emits event `workflows/execute.workflow` with unique cuid `id`.
2. **Execution Initialization**:
   - `executeWorkflow` creates `Execution` row with `status: RUNNING` and `inngestEventId: event.id`.
   - `workflow` loaded with `nodes: true, connections: true`.
3. **Reachable Nodes Identification**:
   - Resolves `triggerType` (from event or initial payload).
   - `getTriggerReachableNodes(nodes, connections, triggerType, triggerNodeId)`:
     - Finds start node matching `triggerNodeId` or `triggerType`.
     - Forward BFS over adjacency list (`conn.fromNodeId -> conn.toNodeId`) collects reachable node IDs.
     - Prunes unreachable nodes and calls `topologicalSort(reachableNodes, reachableConnections)`.
4. **Topological Sort**:
   - Uses `toposort(edges)`.
   - On cycle: throws `Error("Workflow contains a cycle")`.
5. **Context Evolution**:
   - Seeded with `event.data.initialData || {}`.
   - Iterates sequentially through sorted nodes:
     ```ts
     const executor = getExecutor(node.type as NodeType);
     context = await executor({
       data: node.data as Record<string, unknown>,
       nodeId: node.id,
       userId,
       context,
       step,
       publish,
     });
     ```
   - Each executor merges its output into `context` under its assigned key and returns the updated `context`.
6. **Execution Finalization**:
   - Success: `status: ExecutionStatus.SUCCESS, output: context, completedAt: new Date()`.
   - Failure: `onFailure` hook updates `status: ExecutionStatus.FAILED, error, errorStack`.

---

## 4. Handlebars Configuration & Templating Behavior

1. **Helper Registration**:
   Every executor file registers:
   ```ts
   Handlebars.registerHelper("json", (context) => {
     const jsonString = JSON.stringify(context, null, 2);
     const safeString = new Handlebars.SafeString(jsonString);
     return safeString;
   });
   ```
2. **Compilation**:
   `Handlebars.compile(templateString)(context)` executes with default settings:
   - `strict`: `false` (missing properties evaluate to `""` / `undefined` instead of throwing)
   - `noEscape`: `false` (HTML entity encoding enabled by default)
3. **Entity Decoding**:
   All text output nodes decode HTML entities using `decode(...)` from `html-entities` to undo Handlebars escaping.

---

## 5. Editor Canvas Architecture

From [`src/features/editor/components/editor.tsx`](file:///e:/Programs/projects/AI-Workflow-Automation/src/features/editor/components/editor.tsx) and [`editor-header.tsx`](file:///e:/Programs/projects/AI-Workflow-Automation/src/features/editor/components/editor-header.tsx):

- **State Holding**:
  - `nodes` and `edges` live in React component state: `useState<Node[]>(workflow.nodes)` and `useState<Edge[]>(workflow.edges)`.
  - `editorAtom` (Jotai) stores `ReactFlowInstance | null` set via `onInit={setEditor}`.
- **Node Component Wrapping**:
  - Nodes wrap [`BaseExecutionNode`](file:///e:/Programs/projects/AI-Workflow-Automation/src/features/executions/components/base-execution-node.tsx) or [`BaseTriggerNode`](file:///e:/Programs/projects/AI-Workflow-Automation/src/features/triggers/components/base-trigger-node.tsx).
  - Both render `NodeStatusIndicator` with status borders (`loading`, `success`, `error`, `initial`).
  - Left handle (`target-1`), right handle (`source-1`).
- **Settings & Dialogs**:
  - Double clicking or clicking settings opens a node-specific dialog (`<Type>Dialog`).
  - Dialog forms are implemented using `react-hook-form` + `zodResolver`.
  - Submitting a dialog calls `setNodes` from `useReactFlow()`, immutably updating `node.data`.
- **Saving**:
  - `EditorSaveButton` reads `editor.getNodes()` and `editor.getEdges()`, then triggers tRPC `saveWorkflow.mutate({ id: workflowId, nodes, edges })`.

---

## 6. Complete NodeType Specification Table (Single Source of Truth)

The table below catalogs every `NodeType` in the platform:

| NodeType | Template Fields (rendered with Handlebars) | Accepts | Variable Name Source | Verbatim Output Expression / Context Key Shape | Throws if variableName Missing |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `INITIAL` | *None* | - | *None* | Passthrough: `return result;` (context untouched) | No |
| `MANUAL_TRIGGER` | *None* | - | *None* | Passthrough: `return result;` (context untouched) | No |
| `GOOGLE_FORM_TRIGGER` | *None* | - | Fixed `"googleForm"` | Seeded by webhook into `initialData.googleForm`:<br>`{ formId?: string, formTitle?: string, responseId?: string, timestamp?: string, respondentEmail?: string, responses?: Record<string, unknown>, raw?: unknown }` | No |
| `STRIPE_TRIGGER` | *None* | - | Fixed `"stripe"` | Seeded by webhook into `initialData.stripe`:<br>`{ eventId?: string, eventType?: string, timestamp?: number, livemode?: boolean, raw?: unknown }` | No |
| `TELEGRAM_TRIGGER` | *None* (plain command string) | - | Fixed `"telegram"` | Seeded by webhook into `initialData.telegram`:<br>`{ updateId?: number, messageId?: number, text?: string, chatId?: number \| string, chatType?: string, chatTitle?: string, sender?: { id?: number \| string, name?: string, username?: string, firstName?: string, lastName?: string, isBot?: boolean, languageCode?: string }, date?: number, callbackData?: string, raw?: unknown }` | No |
| `HTTP_REQUEST` | `data.endpoint`<br>`data.body` (if POST/PUT/PATCH) | `endpoint`: `"scalar"`<br>`body`: `"any"` | `data.variableName` | `return { ...context, [data.variableName]: { httpResponse: { status: response.status, statusText: response.statusText, data: responseData } } }` | Yes (`NonRetriableError`) |
| `OPENAI` | `data.userPrompt`<br>`data.systemPrompt` (optional) | `userPrompt`: `"any"`<br>`systemPrompt`: `"any"` | `data.variableName` | `return { ...context, [data.variableName]: { text } }` | Yes (`NonRetriableError`) |
| `ANTHROPIC` | `data.userPrompt`<br>`data.systemPrompt` (optional) | `userPrompt`: `"any"`<br>`systemPrompt`: `"any"` | `data.variableName` | `return { ...context, [data.variableName]: { text } }` | Yes (`NonRetriableError`) |
| `GEMINI` | `data.userPrompt`<br>`data.systemPrompt` (optional) | `userPrompt`: `"any"`<br>`systemPrompt`: `"any"` | `data.variableName` | `return { ...context, [data.variableName]: { text } }` | Yes (`NonRetriableError`) |
| `DISCORD` | `data.content`<br>`data.username` (optional) | `content`: `"any"`<br>`username`: `"scalar"` | `data.variableName` | `return { ...context, [data.variableName]: { messageContent: content.slice(0, 2000) } }` | Yes (`NonRetriableError`) |
| `SLACK` | `data.content` | `content`: `"any"` | `data.variableName` | `return { ...context, [data.variableName]: { messageContent: content.slice(0, 2000) } }` | Yes (`NonRetriableError`) |
| `EMAIL` | `data.to`<br>`data.subject`<br>`data.body`<br>`data.from` (optional) | `to`: `"scalar"`<br>`subject`: `"scalar"`<br>`from`: `"scalar"`<br>`body`: `"any"` | `data.variableName` | `return { ...context, [data.variableName]: { id: response.id, to, from, subject, hasAttachment: !!attachments?.length } }` | Yes (`NonRetriableError`) |
| `FILE_GENERATOR` | `data.filename`<br>`data.content` | `filename`: `"scalar"`<br>`content`: `"any"` | `data.variableName` | `return { ...context, [data.variableName]: { filename, format, content, base64, mimeType, size } }` | Yes (`NonRetriableError`) |
| `TELEGRAM` | `data.chatId`<br>`data.text` | `chatId`: `"scalar"`<br>`text`: `"any"` | `data.variableName` | `return { ...context, [data.variableName]: { messageId: responseData.result?.message_id, chatId: responseData.result?.chat?.id ?? chatId, chatTitle: responseData.result?.chat?.title, chatUsername: responseData.result?.chat?.username, text: responseData.result?.text ?? text, date: responseData.result?.date, ok: true } }` | Yes (`NonRetriableError`) |
| `DATABASE` | `data.query`<br>`data.connectionString` (optional) | `query`: `"any"`<br>`connectionString`: `"scalar"` | `data.variableName` | `return { ...context, [data.variableName]: { rows, rowCount: res.rowCount ?? rows.length, firstRow: rows.length > 0 ? rows[0] : null, command: res.command, fields } }` | Yes (`NonRetriableError`) |
