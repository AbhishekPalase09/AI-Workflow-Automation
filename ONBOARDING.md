# 🚀 Nodebase (AI Workflow Automation) — Developer Onboarding Guide

Welcome to the **Nodebase / AI-Workflow-Automation** repository! This document is designed to give you a complete, top-to-bottom understanding of the project's architecture, data flows, core concepts, and development workflows.

If you are joining with **basic React experience**, don't worry! We have included a **[Step-by-Step Learning Roadmap](#-learning-roadmap-from-basic-react-to-this-codebase)** specifically structured to guide you through all prerequisites and modern technologies used here.

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Tech Stack Architecture](#-tech-stack-architecture)
3. [Repository Directory Structure](#-repository-directory-structure)
4. [Data Model & Database Schema (Prisma)](#-data-model--database-schema-prisma)
5. [Core Architectural Flows](#-core-architectural-flows)
   - [A. Visual Workflow Canvas (React Flow + Jotai)](#a-visual-workflow-canvas-react-flow--jotai)
   - [B. Type-Safe Client-Server Communication (tRPC)](#b-type-safe-client-server-communication-trpc)
   - [C. Workflow Orchestration Engine (Inngest + Topological Sort)](#c-workflow-orchestration-engine-inngest--topological-sort)
   - [D. Authentication & Subscriptions (Better-Auth + Polar.sh)](#d-authentication--subscriptions-better-auth--polarsh)
6. [How to Add a New Workflow Node (Step-by-Step Guide)](#-how-to-add-a-new-workflow-node)
7. [Local Environment Setup & Commands](#-local-environment-setup--commands)
8. [Environment Variables Reference](#-environment-variables-reference)
9. [🎓 Learning Roadmap: From Basic React to This Codebase](#-learning-roadmap-from-basic-react-to-this-codebase)

---

## 🌟 Project Overview

**Nodebase** is a modern, web-based visual automation platform (similar to *n8n*, *Zapier*, or *Make*). It allows users to build, configure, and execute automated multi-step workflows using an interactive node-graph canvas.

### Core Features:
- **Interactive Visual Canvas**: Drag, drop, connect, and configure workflow nodes using `@xyflow/react` (React Flow).
- **DAG Workflow Execution**: Workflows are directed acyclic graphs (DAGs) resolved via topological sorting and executed step-by-step by background job workers.
- **Durable Background Execution**: Powered by [Inngest](https://www.inngest.com/), allowing asynchronous execution, error retries, and step-level logging.
- **End-to-End Type Safety**: Complete TypeScript integration from the Postgres database (Prisma) through the backend (tRPC) to the React UI.
- **Authentication & Monetization**: User authentication via [Better-Auth](https://www.better-auth.com/) and SaaS subscriptions managed via [Polar.sh](https://polar.sh/).

---

## 🛠 Tech Stack Architecture

| Layer | Technologies | Purpose |
| :--- | :--- | :--- |
| **Framework** | [Next.js 15 (App Router)](https://nextjs.org/) + [React 19](https://react.dev/) | React Server Components (RSC), Client Components, Server Actions, Route Groups |
| **Language** | [TypeScript 5](https://www.typescriptlang.org/) | Strict end-to-end type safety |
| **Database & ORM** | [PostgreSQL (Neon)](https://neon.tech/) + [Prisma ORM 7](https://www.prisma.io/) | Relational database schema, connection pooling (`@prisma/adapter-pg` / neon), and typed queries |
| **API Layer** | [tRPC v11](https://trpc.io/) + [TanStack React Query v5](https://tanstack.com/query) | Type-safe RPC procedures, caching, invalidation, and data synchronization |
| **Canvas / Graph UI** | [@xyflow/react (React Flow)](https://reactflow.dev/) | Interactive node graph, zoom/pan canvas, handles, custom node components |
| **State Management** | [Jotai](https://jotai.org/) + React Hooks + [Nuqs](https://nuqs.47ng.com/) | Atomic client state for editor sidebars, search params in URL state |
| **Orchestration / Queue**| [Inngest](https://www.inngest.com/) + [Toposort](https://github.com/marcelklehr/toposort) | Serverless event-driven background job orchestration with topological ordering |
| **Auth & Billing** | [Better-Auth](https://www.better-auth.com/) + [Polar.sh SDK](https://polar.sh/) | Session/credential auth, customer portal, checkout, subscription-gated procedures |
| **UI & Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/) | Modern dark/light interface, modular accessible components |
| **Tooling & Linter** | [Biome](https://biomejs.dev/) + [mprocs](https://github.com/pvolok/mprocs) | Blazing-fast linting/formatting and multi-process local dev runner |

---

## 📂 Repository Directory Structure

```
AI-Workflow-Automation/
├── prisma/
│   ├── schema.prisma              # Database models (User, Workflow, Node, Connection)
│   └── migrations/                # Database SQL migration history
├── src/
│   ├── app/                       # Next.js App Router root
│   │   ├── (auth)/                # Auth route group (sign-in, sign-up pages)
│   │   ├── (dashboard)/           # Protected dashboard layout & routes
│   │   │   ├── (editor)/workflows # Full-screen node editor canvas page
│   │   │   └── (rest)/            # Standard layout (workflows list, credentials, executions)
│   │   ├── api/                   # API route handlers
│   │   │   ├── auth/[...all]/     # Better-Auth endpoint handler
│   │   │   ├── inngest/           # Inngest webhook & function serve endpoint
│   │   │   └── trpc/[trpc]/       # tRPC HTTP batch request handler
│   │   ├── globals.css            # Tailwind CSS 4 theme & custom utilities
│   │   └── layout.tsx             # Root layout with Query/TRPC Providers
│   ├── components/                # Shared global UI components
│   │   ├── ui/                    # Reusable primitives (Buttons, Dialogs, Dropdowns, Cards)
│   │   ├── app-sidebar.tsx        # Navigation sidebar for dashboard
│   │   ├── node-selector.tsx      # Sheet/Modal to pick new node types
│   │   └── entity-components.tsx  # Shared list, pagination, and empty state components
│   ├── config/
│   │   ├── constants.tsx          # App-wide constants (pagination limits, defaults)
│   │   └── node-components.ts     # Mapping of NodeType enum -> React Flow node component
│   ├── features/                  # Feature-driven modular architecture
│   │   ├── auth/                  # Login, Register forms, Auth wrappers
│   │   ├── editor/                # Flow canvas, editor header, node addition buttons, Jotai atoms
│   │   ├── executions/            # Execution logic, base node UI, HTTP request executor
│   │   ├── subscriptions/         # Polar.sh subscription hooks & premium gating
│   │   ├── triggers/              # Trigger nodes (e.g. Manual Trigger) and executors
│   │   └── workflows/             # Workflow CRUD, hooks, pagination params, tRPC router
│   ├── generated/
│   │   └── prisma/                # Prisma client output code (auto-generated)
│   ├── hooks/                     # Custom React hooks (e.g., use-entity-search)
│   ├── inngest/
│   │   ├── client.ts              # Inngest client initialization
│   │   ├── functions.ts           # Background jobs (executeWorkflow function)
│   │   └── utils.ts               # Graph topological sorting algorithm
│   ├── lib/                       # Utility and singleton client modules
│   │   ├── auth.ts                # Better-Auth server configuration & Polar plugin
│   │   ├── auth-client.ts         # Better-Auth browser client
│   │   ├── db.ts                  # Prisma Client singleton
│   │   └── polar.ts               # Polar API SDK client singleton
│   └── trpc/                      # tRPC infrastructure
│       ├── init.ts                # Context, procedure middlewares (protected, premium)
│       ├── client.tsx             # tRPC React Query provider & client setup
│       ├── server.tsx             # Server-side caller for Server Components
│       └── routers/
│           └── _app.ts            # Root API router assembling feature routers
├── mprocs.yaml                    # Multi-process config to run Next.js + Inngest simultaneously
├── package.json                   # Dependencies and npm scripts
└── tsconfig.json                  # TypeScript compiler settings and path aliases (`@/*`)
```

---

## 🗄 Data Model & Database Schema (Prisma)

The database schema is defined in [`prisma/schema.prisma`](file:///e:/Programs/projects/AI-Workflow-Automation/prisma/schema.prisma):

```mermaid
erDiagram
    User ||--o{ Session : "has"
    User ||--o{ Account : "has"
    User ||--o{ Workflow : "owns"
    Workflow ||--o{ Node : "contains"
    Workflow ||--o{ Connection : "contains"
    Node ||--o{ Connection : "outgoing (FromNode)"
    Node ||--o{ Connection : "incoming (ToNode)"

    User {
        string id PK
        string name
        string email UK
        boolean emailVerified
        datetime createdAt
    }

    Workflow {
        string id PK
        string name
        string userId FK
        datetime createdAt
        datetime updatedAt
    }

    Node {
        string id PK
        string workflowId FK
        string name
        NodeType type
        json position
        json data
        datetime createdAt
    }

    Connection {
        string id PK
        string workflowId FK
        string fromNodeId FK
        string toNodeId FK
        string fromOutput
        string toInput
    }
```

### Models Explained:
1. **User, Session, Account, Verification**: Managed by **Better-Auth** for secure authentication (passwords, social OAuth, session cookies).
2. **Workflow**: Top-level entity representing a user's automated workflow.
3. **Node**: A step in the workflow graph.
   - `type`: Enum `NodeType` (`INITIAL`, `MANUAL_TRIGGER`, `HTTP_REQUEST`).
   - `position`: Coordinates `{ x, y }` on the visual canvas.
   - `data`: JSON payload containing node-specific configuration (e.g. endpoint URL, HTTP method, headers, body).
4. **Connection**: A directed edge connecting two nodes (`fromNodeId` $\rightarrow$ `toNodeId`), with handle identifiers (`fromOutput`, `toInput`).

---

## 🔄 Core Architectural Flows

### A. Visual Workflow Canvas (React Flow + Jotai)
- The editor route (`/workflows/[workflowId]`) loads the workflow data using tRPC (`trpc.workflows.getOne.useQuery`).
- Server `Node` and `Connection` models are transformed into React Flow `Node` and `Edge` objects.
- **NodeComponents** ([`src/config/node-components.ts`](file:///e:/Programs/projects/AI-Workflow-Automation/src/config/node-components.ts)) maps each `NodeType` to its custom React UI:
  - `INITIAL` $\rightarrow$ `<InitialNode />`
  - `MANUAL_TRIGGER` $\rightarrow$ `<ManualTriggerNode />`
  - `HTTP_REQUEST` $\rightarrow$ `<HttpRequestNode />`
- Saving changes dispatches a tRPC mutation (`trpc.workflows.update.useMutation`) which performs an atomic database transaction replacing the nodes and edges.

### B. Type-Safe Client-Server Communication (tRPC)
All backend communication uses **tRPC** instead of manual REST fetch calls.
- **Procedures**:
  - `baseProcedure`: Public endpoint.
  - `protectedProcedure`: Verifies Better-Auth session via headers.
  - `premiumProcedure`: Verifies active paid subscription with Polar.sh.
- **Routers**:
  - `workflows.getMany`: Paginated & searchable list of user workflows.
  - `workflows.getOne`: Fetches a workflow with all its nodes & connections.
  - `workflows.create`: Creates a new workflow (gated by `premiumProcedure`).
  - `workflows.update`: Synchronizes node positions, data, and edge connections.
  - `workflows.execute`: Dispatches the workflow execution to Inngest.

### C. Workflow Orchestration Engine (Inngest + Topological Sort)
When the user clicks **"Execute"** on the canvas:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Editor as React Flow Canvas
    participant tRPC as tRPC Server
    participant InngestClient as Inngest Event Queue
    participant InngestRunner as Inngest Worker
    participant DB as PostgreSQL (Prisma)
    participant Executor as Executor Registry

    User->>Editor: Clicks "Execute Workflow"
    Editor->>tRPC: mutate(workflows.execute, { id })
    tRPC->>InngestClient: inngest.send("workflows/execute.workflow", { workflowId })
    tRPC-->>Editor: Execution triggered
    InngestClient->>InngestRunner: Pick up execute-workflow job
    InngestRunner->>DB: Fetch workflow with nodes & connections
    InngestRunner->>InngestRunner: topologicalSort(nodes, connections)
    loop For each sorted node in DAG
        InngestRunner->>Executor: getExecutor(node.type)(node.data, context, step)
        Executor-->>InngestRunner: Return updated step context
    end
    InngestRunner-->>User: Workflow complete with final context
```

1. `topologicalSort` checks for graph cycles and calculates the exact linear execution order of dependent nodes.
2. Inngest iterates sequentially through the sorted nodes, passing the execution `context` from one node output to the next node input.

### D. Authentication & Subscriptions (Better-Auth + Polar.sh)
- **Better-Auth** handles user authentication and session cookies at `/api/auth/[...all]`.
- **Polar.sh Plugin** automatically creates a Polar Customer on signup.
- Upgrading to "Pro" redirects the user to the Polar Checkout portal.
- Subscriptions are verified on the fly in `premiumProcedure` via `polarClient.customers.getStateExternal`.

---

## 🧩 How to Add a New Workflow Node

Follow this checklist whenever you want to add a new trigger or action to the platform:

1. **Update Prisma Schema**:
   Add the new type to `enum NodeType` in [`prisma/schema.prisma`](file:///e:/Programs/projects/AI-Workflow-Automation/prisma/schema.prisma):
   ```prisma
   enum NodeType {
     INITIAL
     MANUAL_TRIGGER
     HTTP_REQUEST
     SEND_EMAIL // <-- New Node Type
   }
   ```
   Run: `npx prisma migrate dev --name add_send_email_node` and `npx prisma generate`.

2. **Create the Node Component UI**:
   Under `src/features/executions/components/send-email/node.tsx`, create the React Flow node component wrapping `BaseExecutionNode`:
   ```tsx
   export const SendEmailNode = (props: NodeProps) => {
     return (
       <BaseExecutionNode {...props} title="Send Email" icon={MailIcon}>
         {/* Custom input fields for recipient, subject, body */}
       </BaseExecutionNode>
     );
   };
   ```

3. **Implement the Node Executor**:
   Create `src/features/executions/components/send-email/executor.ts`:
   ```tsx
   import { NodeExecutor } from "@/features/executions/types";

   export const sendEmailExecutor: NodeExecutor = async ({ data, context, step }) => {
     return await step.run("send-email", async () => {
       // Perform the actual work (e.g. Resend / SendGrid API call)
       return { ...context, emailSent: true };
     });
   };
   ```

4. **Register in Registries**:
   - In [`src/config/node-components.ts`](file:///e:/Programs/projects/AI-Workflow-Automation/src/config/node-components.ts): Add to `NodeComponents`.
   - In [`src/features/executions/lib/executor-registry.ts`](file:///e:/Programs/projects/AI-Workflow-Automation/src/features/executions/lib/executor-registry.ts): Add to `executorRegistry`.
   - In [`src/components/node-selector.tsx`](file:///e:/Programs/projects/AI-Workflow-Automation/src/components/node-selector.tsx): Add the node card so users can select it in the editor.

---

## 💻 Local Environment Setup & Commands

### Prerequisites:
- **Node.js**: v20+ or v22+
- **PostgreSQL Database**: Local Postgres instance or a free cloud instance on [Neon.tech](https://neon.tech/)
- **Inngest CLI**: Installed automatically via `devDependencies`

### 1. Installation
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and fill in the required connection strings and secrets (see section below).

### 3. Database Initialization
```bash
# Push schema migrations to your database
npx prisma migrate dev

# Generate typed Prisma client
npx prisma generate
```

### 4. Running the Development Server
You can run both Next.js and the Inngest local Dev Server concurrently with a single command:
```bash
npm run dev:all
```
*(Uses `mprocs` to run `npm run dev` and `npm run inngest:dev` simultaneously).*

Or run them in separate terminals:
```bash
# Terminal 1: Next.js dev server (http://localhost:3000)
npm run dev

# Terminal 2: Inngest dev server dashboard (http://localhost:8288)
npm run inngest:dev
```

### 5. Quality & Code Formatting
```bash
# Run Biome linter check
npm run lint

# Auto-format all code
npm run format
```

---

## 🔑 Environment Variables Reference

Create a `.env` file in the root directory:

```env
# Database (PostgreSQL / Neon)
DATABASE_URL="postgresql://user:password@ep-sample.region.neon.tech/neondb?sslmode=require"

# Next.js Public URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Better-Auth Configuration
BETTER_AUTH_SECRET="your_generated_random_secret_string"
BETTER_AUTH_URL="http://localhost:3000"

# Polar.sh SaaS & Subscriptions
POLAR_ACCESS_TOKEN="polar_at_..."
POLAR_SERVER="sandbox" # or 'production'
POLAR_SUCCESS_URL="http://localhost:3000/workflows"
POLAR_WEBHOOK_SECRET="whsec_..."

# Inngest Background Tasks (Optional for local development)
INNGEST_EVENT_KEY=""
INNGEST_SIGNING_KEY=""

# Sentry Monitoring (Optional)
SENTRY_AUTH_TOKEN=""
```

---

## 🎓 Learning Roadmap: From Basic React to This Codebase

If you are coming from basic React (components, `useState`, `useEffect`, basic props), here is a step-by-step curriculum to learn everything needed to become fully confident working on this codebase.

```mermaid
flowchart TD
    A[Basic React] --> B[1. Modern TypeScript Essentials]
    B --> C[2. Next.js 15 App Router & Server Components]
    C --> D[3. Databases & Prisma ORM]
    D --> E[4. Full-Stack Type-Safe APIs with tRPC & React Query]
    E --> F[5. Visual Graph Canvas with React Flow & Jotai]
    F --> G[6. Event-Driven Background Jobs with Inngest & DAGs]
    G --> H[7. Modern Auth & Billing Architecture]
    H --> I[🚀 Full Nodebase Master Developer]
```

---

### Step 1: Modern TypeScript Essentials
*Why needed*: This entire project is strictly typed. You will see generic types, Zod schemas, and utility types everywhere.

- [ ] **TypeScript Basics**: Types, Interfaces, Type Assertions, Union & Intersection Types.
- [ ] **Generics**: Generic functions `function identity<T>(arg: T): T` and generic React components.
- [ ] **Advanced TS Keywords**: `keyof`, `typeof`, `as const`, and `satisfies` (used in [`src/config/node-components.ts`](file:///e:/Programs/projects/AI-Workflow-Automation/src/config/node-components.ts)).
- [ ] **Zod Schema Validation**: `z.object({...})`, `z.infer<typeof schema>`, parsing inputs on server routes.
- 🔗 *Recommended Resource*: [TypeScript for Beginners (Total TypeScript)](https://www.totaltypescript.com/tutorials) & [Zod Official Docs](https://zod.dev/)

---

### Step 2: Next.js 15 App Router Architecture
*Why needed*: Nodebase uses Next.js 15 App Router with Turbopack, route groups, and server layouts.

- [ ] **App Router File Conventions**: `layout.tsx`, `page.tsx`, `route.ts`, `loading.tsx`, `error.tsx`.
- [ ] **Route Groups**: Folder names wrapped in parentheses like `(auth)` and `(dashboard)` (they group pages without affecting the URL path).
- [ ] **Server Components vs Client Components**:
  - When to use `"use client"` (for interactivity, hooks, canvas).
  - Server components (default, can fetch data directly on the server).
- [ ] **Dynamic & Catch-all Routes**: `[workflowId]`, `[...all]`.
- 🔗 *Recommended Resource*: [Next.js App Router Documentation](https://nextjs.org/docs/app)

---

### Step 3: Relational Databases & Prisma ORM
*Why needed*: Nodebase stores workflows, graph nodes, and connections in a relational PostgreSQL database.

- [ ] **Relational Database Basics**: Tables, Primary Keys (`@id`), Foreign Keys (`@relation`), Unique constraints, 1-to-many relationships.
- [ ] **Prisma Schema Syntax**: Models, Enums, Attributes (`@default(cuid())`, `@updatedAt`, `onDelete: Cascade`).
- [ ] **Prisma Client CRUD Queries**: `findUniqueOrThrow`, `findMany`, `create`, `update`, `deleteMany`.
- [ ] **Database Transactions**: `prisma.$transaction(async (tx) => { ... })` (see how workflow saving deletes and recreates nodes atomically in [`src/features/workflows/server/routers.ts`](file:///e:/Programs/projects/AI-Workflow-Automation/src/features/workflows/server/routers.ts)).
- [ ] **Prisma Migrations**: `npx prisma migrate dev`.
- 🔗 *Recommended Resource*: [Prisma Official Quickstart Guide](https://www.prisma.io/docs/getting-started)

---

### Step 4: Type-Safe APIs with tRPC & TanStack React Query
*Why needed*: Nodebase does not use `fetch("/api/...")`. It calls backend procedures with instant TypeScript autocomplete and automatic query caching.

- [ ] **Understanding RPC (Remote Procedure Call)**: Calling server functions directly from client code like local functions.
- [ ] **tRPC Concepts**:
  - `Router`: Collection of API endpoints (`createTRPCRouter`).
  - `Query` vs `Mutation`: Reading data vs modifying data.
  - `Middleware & Procedures`: `protectedProcedure`, checking auth sessions before executing handler.
- [ ] **TanStack React Query**:
  - `useQuery` (loading, error, caching, `refetch`).
  - `useMutation` (executing changes, `onSuccess`, cache invalidation `utils.workflows.getMany.invalidate()`).
- 🔗 *Recommended Resource*: [tRPC Documentation](https://trpc.io/docs) & [TanStack Query Guide](https://tanstack.com/query/latest)

---

### Step 5: Visual Graph Canvas (React Flow / XYFlow) & State
*Why needed*: The core user interface of this project is a graphical node editor.

- [ ] **React Flow Basics**: `<ReactFlow />`, `nodes`, `edges`, `onNodesChange`, `onEdgesChange`, `onConnect`.
- [ ] **Custom Nodes & Handles**:
  - Node props (`id`, `data`, `selected`).
  - `<Handle type="source" position={...} />` and `<Handle type="target" position={...} />`.
- [ ] **Atomic State with Jotai**: `atom`, `useAtom`, `useSetAtom` for lightweight global state (e.g. sidebar toggle states).
- 🔗 *Recommended Resource*: [React Flow Quickstart](https://reactflow.dev/learn)

---

### Step 6: Background Jobs, Inngest & Graph Algorithms (DAGs)
*Why needed*: Running workflows requires background workers and graph theory to execute steps in order.

- [ ] **Directed Acyclic Graphs (DAG)**: Understanding nodes and directed edges where execution cannot have infinite loops.
- [ ] **Topological Sorting**: How [`toposort`](file:///e:/Programs/projects/AI-Workflow-Automation/src/inngest/utils.ts) orders dependent nodes so parent nodes always run before child nodes.
- [ ] **Inngest Fundamentals**:
  - Sending events: `inngest.send({ name: "...", data: {...} })`.
  - Defining durable functions: `inngest.createFunction`.
  - Multi-step execution: `step.run("step-name", async () => { ... })`.
- 🔗 *Recommended Resource*: [Inngest Getting Started Guide](https://www.inngest.com/docs)

---

### Step 7: Auth & Billing Systems (Better-Auth & Polar.sh)
*Why needed*: Handles user authentication, cookie sessions, and paid pro subscriptions.

- [ ] **Better-Auth Basics**: Session cookies, Prisma adapter, `auth.api.getSession`.
- [ ] **SaaS Billing Patterns**: Checkout sessions, webhooks, gating premium features via middleware.
- 🔗 *Recommended Resource*: [Better-Auth Documentation](https://www.better-auth.com/) & [Polar.sh Documentation](https://docs.polar.sh/)

---

## 🤝 Need Help or Contributing?

- **Issues & Discussions**: Discuss workflow improvements or bug fixes with the team.
- **Code Standards**: Always run `npm run lint` and `npm run format` with Biome before pushing changes.
- **Have Fun Building!** Automation engines are powerful systems with lots of room for creative node expansions.
