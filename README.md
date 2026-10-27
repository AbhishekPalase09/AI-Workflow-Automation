# ⚡ Nodebase — AI Workflow Automation Platform

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-blue?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.9-2D3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Inngest](https://img.shields.io/badge/Inngest-3.44-000000?style=flat-square&logo=inngest)](https://www.inngest.com/)
[![tRPC](https://img.shields.io/badge/tRPC-v11-2596BE?style=flat-square&logo=trpc)](https://trpc.io/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Better--Auth](https://img.shields.io/badge/Better--Auth-1.3-black?style=flat-square)](https://www.better-auth.com/)
[![Polar.sh](https://img.shields.io/badge/Polar.sh-Billing-0052FF?style=flat-square)](https://polar.sh/)
[![Biome](https://img.shields.io/badge/Linter-Biome-60A5FA?style=flat-square&logo=biome)](https://biomejs.dev/)

**Nodebase** is a next-generation visual automation platform designed for orchestrating complex, multi-step AI pipelines and backend integrations. Similar to *n8n*, *Zapier*, and *Make*, Nodebase empowers users to visually compose, test, and run directed acyclic graph (DAG) workflows powered by state-of-the-art AI models, external webhooks, and durable background queues.

---

## 📑 Table of Contents

- [Overview & Highlights](#-overview--highlights)
- [System Architecture](#-system-architecture)
- [Workflow Engine & Lifecycle](#-workflow-engine--lifecycle)
- [Node & Trigger Ecosystem](#-node--trigger-ecosystem)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Available Scripts](#-available-scripts)
- [Extending the Platform](#-extending-the-platform-adding-nodes)
- [Developer Onboarding & Learning](#-developer-onboarding--learning)

---

## 🌟 Overview & Highlights

- **Interactive Node Canvas**: Drag, drop, link, and configure nodes on an infinite canvas built with `@xyflow/react` (React Flow) and Jotai.
- **Durable DAG Orchestration**: Workflows are treated as directed acyclic graphs. Dependencies are mathematically resolved with cycle-detecting topological sort (`toposort`), executing reliably step-by-step via **Inngest**.
- **Real-Time Execution Streaming**: Live node status changes (`loading`, `success`, `error`) are streamed instantly to the frontend using `@inngest/realtime` channels and Server-Sent Events (SSE).
- **Multi-LLM Integrations**: Native nodes for **OpenAI** (GPT-4), **Anthropic** (Claude 3.5 Sonnet), and **Google Gemini** (1.5 Pro/Flash) using the Vercel AI SDK (`ai`), with full Handlebars context interpolation.
- **Multi-Source Event Triggers**: Launch workflows manually from the canvas or trigger them automatically via incoming webhooks from **Google Forms**, **Stripe Events**, or **Telegram Bots**.
- **Comprehensive Action Catalog**: Trigger HTTP Requests (REST APIs with headers, parameters, and variable interpolation), send Resend emails, push Discord webhooks, post to Slack, send Telegram messages, run SQL database queries, and generate files.
- **Secure Credentials Vault**: Store and manage user-scoped API keys (OpenAI, Gemini, Anthropic, Resend, Telegram, Database) linked securely to execution nodes.
- **SaaS Billing & Authentication**: Fully featured authentication powered by **Better-Auth** with paid subscription gating and checkout powered by **Polar.sh**.
- **End-to-End Type Safety**: 100% typed from PostgreSQL tables (Prisma) through the backend (tRPC v11) to the React 19 UI (TanStack Query).

---

## 📐 System Architecture

```mermaid
graph TD
    subgraph Client ["Frontend (Next.js 15 + React 19)"]
        UI[Dashboard & Workflows UI]
        Canvas[XYFlow Node Graph Canvas]
        SSE[Inngest Realtime Channels Listener]
    end

    subgraph API ["API & RPC Layer"]
        tRPC[tRPC v11 Routers]
        Webhooks[Webhook Handlers: Google Form / Stripe / Telegram]
        Auth[Better-Auth + Polar.sh Plugin]
    end

    subgraph Data ["Data & State"]
        PG[(PostgreSQL / Neon DB)]
        Prisma[Prisma ORM 7]
        Vault[User Credentials Vault]
    end

    subgraph Engine ["Orchestration Engine (Inngest)"]
        Queue[Inngest Event Bus]
        Worker[executeWorkflow Durable Runner]
        TopoSort[Topological Sort & Cycle Detector]
        ChannelPub[Inngest Realtime Publisher]
    end

    subgraph Integrations ["External Services & AI"]
        OpenAI[OpenAI API]
        Anthropic[Anthropic Claude API]
        Gemini[Google Gemini API]
        Services[Discord / Slack / Resend / Telegram / DB]
    end

    Canvas -->|Mutate & Save| tRPC
    Canvas -->|Run Workflow| tRPC
    tRPC -->|Read / Write| Prisma
    Webhooks -->|Inbound Events| Queue
    tRPC -->|Dispatch Job| Queue
    Prisma --> PG
    Prisma --> Vault

    Queue --> Worker
    Worker --> TopoSort
    Worker -->|Fetch Graph & Credentials| Prisma
    Worker -->|Invoke Step| OpenAI
    Worker -->|Invoke Step| Anthropic
    Worker -->|Invoke Step| Gemini
    Worker -->|Invoke Step| Services

    Worker -->|Publish Status| ChannelPub
    ChannelPub -.->|Live SSE Updates| SSE
    SSE -.->|Update Node Border/State| Canvas
```

---

## 🔄 Workflow Engine & Lifecycle

1. **Graph Construction**: The user arranges nodes and connections in the visual editor. Connections define source and target handles (`fromOutput` $\rightarrow$ `toInput`).
2. **Persistence**: The canvas auto-synchronizes with the database using tRPC (`workflows.update`), updating the `Node` and `Connection` relational records in an atomic transaction.
3. **Trigger Ingestion**:
   - **Manual**: Triggered directly by the user on the canvas via `workflows.execute`.
   - **Webhook Triggers**: External webhooks (`/api/webhooks/google-form`, `/api/webhooks/stripe`, `/api/webhooks/telegram`) parse inbound payloads and emit an execution event.
4. **Graph Resolution**: `getTriggerReachableNodes` uses topological sorting to prune unreachable nodes, confirm graph acyclicity, and determine the exact linear execution path.
5. **Durable Step Execution**:
   - Inngest executes each node in sequence within isolated `step.run` / `step.ai.wrap` boundaries.
   - Dynamic context values (e.g. `{{googleForm.respondentEmail}}` or `{{aiResult.text}}`) are resolved at runtime via **Handlebars**.
6. **Live Telemetry**: During each step, status events (`loading`, `success`, `error`) are published over Inngest Realtime channels to visually update the node in the canvas.

---

## 🧩 Node & Trigger Ecosystem

### 🎯 Triggers
| Trigger | Type | Description |
| :--- | :--- | :--- |
| **Manual Trigger** | `MANUAL_TRIGGER` | Starts workflow execution on-demand directly from the editor header. |
| **Google Form Trigger** | `GOOGLE_FORM_TRIGGER` | Listens for form submissions via webhook with respondent answers and metadata. |
| **Stripe Trigger** | `STRIPE_TRIGGER` | Listens for Stripe webhooks (`payment_intent.succeeded`, subscriptions, etc.). |
| **Telegram Trigger** | `TELEGRAM_TRIGGER` | Triggers when inbound messages are received by a registered Telegram bot. |

### 🤖 AI Generation Nodes
| Node | Type | Capabilities |
| :--- | :--- | :--- |
| **OpenAI** | `OPENAI` | Generates text using OpenAI models (`gpt-4`, etc.) with user/system prompts and Handlebars interpolation. |
| **Anthropic** | `ANTHROPIC` | Claude models (`claude-3-5-sonnet`) for reasoning, classification, and text generation. |
| **Google Gemini** | `GEMINI` | Multimodal and text generation via Google's Gemini models. |

### ⚙️ Action & Integration Nodes
| Node | Type | Capabilities |
| :--- | :--- | :--- |
| **HTTP Request** | `HTTP_REQUEST` | Perform customizable REST calls (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`) with headers and dynamic JSON bodies. |
| **Send Email** | `EMAIL` | Sends transactional HTML/plain-text emails using the Resend API. |
| **Discord** | `DISCORD` | Posts rich webhook messages and alerts directly into Discord channels. |
| **Slack** | `SLACK` | Sends automated notifications and structured messages to Slack channels. |
| **Telegram** | `TELEGRAM` | Dispatches outbound messages through a Telegram bot. |
| **Database** | `DATABASE` | Executes parameterized SQL queries directly against configured databases. |
| **File Generator** | `FILE_GENERATOR` | Generates dynamic files and formatted output documents. |

---

## 🛠 Tech Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Framework** | [Next.js 15 (App Router)](https://nextjs.org/) | React 19, Server Components, Route Groups, Turbopack |
| **Canvas UI** | [@xyflow/react](https://reactflow.dev/) | Zoom/pan canvas, interactive handles, custom node rendering |
| **Orchestration** | [Inngest](https://www.inngest.com/) | Durable execution, retry policies, `@inngest/realtime` SSE channels |
| **Database & ORM** | [PostgreSQL (Neon)](https://neon.tech/) + [Prisma ORM 7](https://www.prisma.io/) | `@prisma/adapter-pg` / neon serverless adapter, connection pooling |
| **API Layer** | [tRPC v11](https://trpc.io/) + [TanStack React Query v5](https://tanstack.com/query) | Full end-to-end type safety, optimistic caching, automatic invalidation |
| **AI Layer** | [Vercel AI SDK](https://sdk.vercel.ai/) | Standardized unified interface for OpenAI, Anthropic, and Google |
| **Templating** | [Handlebars](https://handlebarsjs.com/) | Safe variable expansion and context interpolation (`{{json context}}`) |
| **Auth & Billing** | [Better-Auth](https://www.better-auth.com/) + [Polar.sh](https://polar.sh/) | Credential authentication, session cookies, and SaaS subscription tiers |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/) | Modern dark-mode interface with accessible primitive components |
| **State** | [Jotai](https://jotai.org/) + [Nuqs](https://nuqs.47ng.com/) | Atomic client state for editor sidebars and URL search params |
| **Monitoring** | [Sentry](https://sentry.io/) | Full Next.js server, client, and edge error monitoring |
| **Tooling** | [Biome](https://biomejs.dev/) + [mprocs](https://github.com/pvolok/mprocs) | Ultra-fast linter/formatter & concurrent development process runner |

---

## 📂 Project Structure

```
AI-Workflow-Automation/
├── prisma/
│   ├── schema.prisma                  # Prisma data models (User, Workflow, Node, Connection, Credential)
│   └── migrations/                    # Database SQL migration history
├── src/
│   ├── app/                           # Next.js App Router root
│   │   ├── (auth)/                    # Authentication route group (Sign In / Sign Up)
│   │   ├── (dashboard)/               # Protected dashboard layout
│   │   │   ├── (editor)/workflows/    # Full-screen visual node editor
│   │   │   └── (rest)/                # Standard layout (workflows, credentials, executions)
│   │   ├── api/                       # API routes
│   │   │   ├── auth/[...all]/         # Better-Auth server endpoints
│   │   │   ├── inngest/               # Inngest function webhook serve handler
│   │   │   ├── trpc/[trpc]/           # tRPC HTTP handler
│   │   │   └── webhooks/              # Inbound triggers (Google Form, Stripe, Telegram)
│   │   ├── globals.css                # Global Tailwind CSS 4 theme rules
│   │   └── layout.tsx                 # Root layout with tRPC & Theme providers
│   ├── components/                    # Shared reusable UI primitives & layout components
│   │   ├── ui/                        # Radix UI + Tailwind design tokens
│   │   ├── app-sidebar.tsx            # Main navigation sidebar
│   │   ├── node-selector.tsx          # Node addition sheet/modal
│   │   └── entity-components.tsx      # Paginated tables, search headers, empty states
│   ├── config/
│   │   ├── constants.tsx              # App-wide constants (pagination limits, defaults)
│   │   └── node-components.ts         # NodeType to React Flow component registry
│   ├── features/                      # Modular feature-driven domains
│   │   ├── auth/                      # Auth forms and user session utilities
│   │   ├── credentials/               # User credentials vault (CRUD, tRPC routers, dialogs)
│   │   ├── editor/                    # Graph editor canvas, header, toolbar, Jotai atoms
│   │   ├── executions/                # Execution nodes (OpenAI, Gemini, HTTP, Slack, Discord, etc.)
│   │   ├── subscriptions/             # Polar.sh subscription hooks & Pro tier gating
│   │   ├── triggers/                  # Trigger nodes (Manual, Google Form, Stripe, Telegram)
│   │   └── workflows/                 # Workflow management, hooks, routers, and CRUD views
│   ├── generated/prisma/              # Generated Prisma Client artifacts
│   ├── hooks/                         # Shared utility React hooks
│   ├── inngest/                       # Inngest orchestration logic
│   │   ├── channels/                  # Realtime SSE channel definitions per node type
│   │   ├── client.ts                  # Inngest client setup
│   │   ├── functions.ts               # Background workflow execution job definition
│   │   └── utils.ts                   # Topological sorting, cycle checking, and event dispatchers
│   ├── lib/                           # Singleton clients (Prisma, Polar, Better-Auth)
│   └── trpc/                          # tRPC initialization, client setup, and root API router
├── mprocs.yaml                        # Multi-process configuration for Next.js + Inngest
├── ONBOARDING.md                      # Comprehensive developer guide & learning roadmap
├── package.json                       # Dependencies, scripts, and package metadata
└── tsconfig.json                      # Strict TypeScript compiler configuration
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **PostgreSQL**: Local Postgres instance or cloud database (e.g. [Neon.tech](https://neon.tech/))
- **Inngest CLI**: Bundled in `devDependencies` (no global installation required)

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/AI-Workflow-Automation.git
cd AI-Workflow-Automation
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Fill in your database URL, auth secret, and service keys (see [Environment Variables Reference](#-environment-variables)).

### 3. Initialize the Database

Run migrations to apply the schema to your database and generate the Prisma Client:

```bash
npx prisma migrate dev
npx prisma generate
```

### 4. Start the Development Servers

You can launch both the **Next.js app** and the **Inngest Dev Server** simultaneously with:

```bash
npm run dev:all
```

*(This uses `mprocs` to run processes concurrently).*

Alternatively, run them in separate terminals:

```bash
# Terminal 1: Next.js dev server (http://localhost:3000)
npm run dev

# Terminal 2: Inngest dev dashboard (http://localhost:8288)
npm run inngest:dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application and [http://localhost:8288](http://localhost:8288) to inspect Inngest background events.

### 5. Webhook Development (Optional)

To test incoming webhooks (Google Forms, Stripe, Telegram) locally, run ngrok:

```bash
npm run ngrok:dev
```

---

## 🔑 Environment Variables

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string (supports Neon pooling) | `postgresql://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require` |
| `NEXT_PUBLIC_APP_URL` | Canonical public URL of the application | `http://localhost:3000` |
| `BETTER_AUTH_SECRET` | Cryptographic secret for signing sessions | Generate via `openssl rand -hex 32` |
| `BETTER_AUTH_URL` | Canonical URL for Better-Auth endpoints | `http://localhost:3000` |
| `POLAR_ACCESS_TOKEN` | Polar.sh API access token for SaaS billing | `polar_at_...` |
| `POLAR_SERVER` | Polar environment (`sandbox` or `production`) | `sandbox` |
| `POLAR_SUCCESS_URL` | Redirect target after successful checkout | `http://localhost:3000/workflows` |
| `POLAR_WEBHOOK_SECRET`| Webhook verification secret from Polar dashboard | `whsec_...` |
| `INNGEST_EVENT_KEY` | Inngest event sending key (production) | Optional in local development |
| `INNGEST_SIGNING_KEY`| Inngest signing key for endpoint verification | Optional in local development |
| `SENTRY_AUTH_TOKEN` | Sentry authentication token for build source maps | Optional |

---

## 📜 Available Scripts

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run dev` | `next dev --turbopack` | Starts the Next.js dev server with Turbopack. |
| `npm run dev:all` | `dotenv -- mprocs` | Starts Next.js and Inngest concurrently using `mprocs`. |
| `npm run inngest:dev` | `inngest-cli dev` | Starts local Inngest background dev server & dashboard. |
| `npm run ngrok:dev` | `ngrok http 3000` | Exposes local server over an HTTP tunnel for webhook testing. |
| `npm run build` | `next build --turbopack` | Builds optimized production bundle. |
| `npm run start` | `next start` | Runs production server. |
| `npm run lint` | `biome check` | Runs Biome linter check on the codebase. |
| `npm run format` | `biome format --write` | Formats all files automatically using Biome. |

---

## 🧩 Extending the Platform (Adding Nodes)

Adding a new action or trigger to Nodebase is structured and modular:

1. **Update Database Schema**:
   Add the node identifier to `enum NodeType` in [`prisma/schema.prisma`](file:///e:/Programs/projects/AI-Workflow-Automation/prisma/schema.prisma):
   ```prisma
   enum NodeType {
     // ...
     CUSTOM_ACTION
   }
   ```
   Run `npx prisma migrate dev --name add_custom_action` and `npx prisma generate`.

2. **Create Node Canvas UI**:
   Under `src/features/executions/components/custom-action/node.tsx`, build the React Flow component wrapping `BaseExecutionNode`:
   ```tsx
   import { BaseExecutionNode } from "../base-execution-node";
   import type { NodeProps } from "@xyflow/react";

   export const CustomActionNode = (props: NodeProps) => {
     return (
       <BaseExecutionNode {...props} title="Custom Action" icon={SparklesIcon}>
         {/* Custom input fields */}
       </BaseExecutionNode>
     );
   };
   ```

3. **Implement the Node Executor**:
   Under `src/features/executions/components/custom-action/executor.ts`:
   ```tsx
   import type { NodeExecutor } from "@/features/executions/types";

   export const customActionExecutor: NodeExecutor = async ({ data, context, step, publish }) => {
     return await step.run("custom-action", async () => {
       // Perform work and return merged context
       return { ...context, customOutput: "result" };
     });
   };
   ```

4. **Register Components**:
   - Register the component in [`src/config/node-components.ts`](file:///e:/Programs/projects/AI-Workflow-Automation/src/config/node-components.ts).
   - Register the executor in [`src/features/executions/lib/executor-registry.ts`](file:///e:/Programs/projects/AI-Workflow-Automation/src/features/executions/lib/executor-registry.ts).
   - Add the node card to [`src/components/node-selector.tsx`](file:///e:/Programs/projects/AI-Workflow-Automation/src/components/node-selector.tsx) to make it selectable.

---

## 🎓 Developer Onboarding & Learning

For a deeper dive into architecture, internal designs, data models, and a **Step-by-Step Learning Roadmap** (designed for developers progressing from basic React to full-stack mastery), check out:

👉 **[Developer Onboarding Guide (`ONBOARDING.md`)](file:///e:/Programs/projects/AI-Workflow-Automation/ONBOARDING.md)**

---

## 📄 License

This project is licensed under the MIT License.
