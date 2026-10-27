import type { FlowEdge, FlowNode } from "../../src/features/flowcheck";
import { S, type Schema } from "../../src/features/flowcheck";

export interface EvalWorkflow {
  id: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  triggerPayload?: Record<string, unknown>;
  sampleHttpData?: Record<string, unknown>;
}

// Sample User Schema for HTTP requests
const userSchema: Schema = S.obj(
  {
    id: { s: S.num, req: true },
    name: { s: S.str, req: true },
    email: { s: S.str, req: true },
    roles: { s: S.arr(S.str), req: true },
  },
  { open: false },
);

// Sample Order Schema for HTTP requests
const orderSchema: Schema = S.obj(
  {
    orderId: { s: S.str, req: true },
    total: { s: S.num, req: true },
    items: {
      s: S.arr(
        S.obj(
          {
            sku: { s: S.str, req: true },
            price: { s: S.num, req: true },
            qty: { s: S.num, req: true },
          },
          { open: false },
        ),
      ),
      req: true,
    },
  },
  { open: false },
);

export const EVAL_CORPUS: EvalWorkflow[] = [
  // 1. Minimal Linear: Google Form -> Email
  {
    id: "wf-01",
    name: "Form Notification Email",
    description: "Linear form trigger sending personalized notification email",
    triggerPayload: {
      googleForm: {
        formId: "f1",
        formTitle: "Registration",
        responseId: "r1",
        timestamp: "2026-10-27T10:00:00Z",
        respondentEmail: "student@school.edu",
        responses: { name: "John Doe", course: "Computer Science" },
      },
    },
    nodes: [
      { id: "t1", type: "GOOGLE_FORM_TRIGGER", data: {} },
      {
        id: "e1",
        type: "EMAIL",
        data: {
          variableName: "confirmEmail",
          from: "noreply@school.edu",
          to: "{{googleForm.respondentEmail}}",
          subject: "Registration confirmed for {{googleForm.responses.name}}",
          body: "<p>Thank you for registering for {{googleForm.responses.course}}.</p>",
        },
      },
    ],
    edges: [{ source: "t1", target: "e1" }],
  },

  // 2. Stripe -> Slack notification
  {
    id: "wf-02",
    name: "Stripe Payment Alert",
    description: "Stripe webhook alerting team in Slack",
    triggerPayload: {
      stripe: {
        eventId: "evt_101",
        eventType: "charge.succeeded",
        timestamp: 1700000000,
        livemode: true,
      },
    },
    nodes: [
      { id: "t1", type: "STRIPE_TRIGGER", data: {} },
      {
        id: "s1",
        type: "SLACK",
        data: {
          variableName: "slackAlert",
          webhookUrl: "https://hooks.slack.com/services/test",
          content:
            "Payment Event: {{stripe.eventType}} (ID: {{stripe.eventId}})",
        },
      },
    ],
    edges: [{ source: "t1", target: "s1" }],
  },

  // 3. Telegram Trigger -> Bot Reply
  {
    id: "wf-03",
    name: "Telegram Bot Echo",
    description: "Telegram message trigger replying with bot echo",
    triggerPayload: {
      telegram: {
        updateId: 501,
        messageId: 1001,
        text: "Hello Nodebase",
        chatId: 987654321,
        chatType: "private",
        sender: { id: 987654321, name: "Alice", isBot: false },
        date: 1700000000,
      },
    },
    nodes: [
      { id: "t1", type: "TELEGRAM_TRIGGER", data: {} },
      {
        id: "tg1",
        type: "TELEGRAM",
        data: {
          variableName: "replyMsg",
          chatId: "{{telegram.chatId}}",
          text: "Echo: {{telegram.text}} from {{telegram.sender.name}}",
        },
      },
    ],
    edges: [{ source: "t1", target: "tg1" }],
  },

  // 4. HTTP Fetch -> AI Summarization -> Discord
  {
    id: "wf-04",
    name: "User Lookup & AI Summary",
    description: "HTTP API with sample schema feed to OpenAI then Discord",
    sampleHttpData: {
      id: 42,
      name: "Arthur Dent",
      email: "arthur@galaxy.org",
      roles: ["hitchhiker", "explorer"],
    },
    nodes: [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "http1",
        type: "HTTP_REQUEST",
        data: {
          variableName: "userApi",
          endpoint: "https://api.galaxy.org/users/42",
          method: "GET",
          sampleSchema: userSchema,
        },
      },
      {
        id: "ai1",
        type: "OPENAI",
        data: {
          variableName: "aiBio",
          userPrompt:
            "Create bio for {{userApi.httpResponse.data.name}} ({{userApi.httpResponse.data.email}})",
        },
      },
      {
        id: "d1",
        type: "DISCORD",
        data: {
          variableName: "discordLog",
          webhookUrl: "https://discord.com/api/webhooks/test",
          username: "BioBot",
          content: "Bio generated: {{aiBio.text}}",
        },
      },
    ],
    edges: [
      { source: "t1", target: "http1" },
      { source: "http1", target: "ai1" },
      { source: "ai1", target: "d1" },
    ],
  },

  // 5. Anthropic Claude -> File Generator -> Email with attachment
  {
    id: "wf-05",
    name: "Claude Report Generator",
    description: "AI generation followed by CSV export and email dispatch",
    nodes: [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "claude1",
        type: "ANTHROPIC",
        data: {
          variableName: "reportGen",
          systemPrompt: "You are an analytics assistant.",
          userPrompt: "Generate a report for weekly metrics.",
        },
      },
      {
        id: "fg1",
        type: "FILE_GENERATOR",
        data: {
          variableName: "metricsCsv",
          format: "CSV",
          filename: "weekly_metrics.csv",
          content: "{{reportGen.text}}",
        },
      },
      {
        id: "em1",
        type: "EMAIL",
        data: {
          variableName: "reportMail",
          from: "reports@company.com",
          to: "ceo@company.com",
          subject: "Weekly Metrics Export: {{metricsCsv.filename}}",
          body: "Please find attached {{metricsCsv.filename}} (Size: {{metricsCsv.size}} bytes).",
        },
      },
    ],
    edges: [
      { source: "t1", target: "claude1" },
      { source: "claude1", target: "fg1" },
      { source: "fg1", target: "em1" },
    ],
  },

  // 6. Database Query -> Gemini AI Analysis
  {
    id: "wf-06",
    name: "Database Query & Gemini Analysis",
    description: "Database select followed by Gemini analysis",
    nodes: [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "db1",
        type: "DATABASE",
        data: {
          variableName: "dbUsers",
          connectionString: "postgresql://postgres:secret@localhost:5432/app",
          query: "SELECT id, name FROM users LIMIT 10;",
        },
      },
      {
        id: "gem1",
        type: "GEMINI",
        data: {
          variableName: "userSummary",
          userPrompt:
            "Analyze {{dbUsers.rowCount}} user records: {{json dbUsers.rows}}",
        },
      },
    ],
    edges: [
      { source: "t1", target: "db1" },
      { source: "db1", target: "gem1" },
    ],
  },

  // 7. Branching Workflow: 1 Trigger -> 2 Parallel Notifications
  {
    id: "wf-07",
    name: "Broadcast Alerts",
    description: "Trigger branching into parallel Discord and Slack",
    triggerPayload: {
      stripe: { eventId: "evt_300", eventType: "customer.created" },
    },
    nodes: [
      { id: "t1", type: "STRIPE_TRIGGER", data: {} },
      {
        id: "sl1",
        type: "SLACK",
        data: {
          variableName: "slAlert",
          webhookUrl: "https://slack/hook",
          content: "New customer event: {{stripe.eventType}}",
        },
      },
      {
        id: "dc1",
        type: "DISCORD",
        data: {
          variableName: "dcAlert",
          webhookUrl: "https://discord/hook",
          content: "Stripe customer event: {{stripe.eventId}}",
        },
      },
    ],
    edges: [
      { source: "t1", target: "sl1" },
      { source: "t1", target: "dc1" },
    ],
  },

  // 8. Diamond Merge: HTTP -> Branch (OpenAI & Gemini) -> Merge into Email
  {
    id: "wf-08",
    name: "Multi-Model Consensus Diamond",
    description:
      "Diamond topology merging two AI model responses into one email",
    sampleHttpData: {
      id: 10,
      name: "Project Aurora",
      email: "aurora@dev.local",
      roles: ["core"],
    },
    nodes: [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "h1",
        type: "HTTP_REQUEST",
        data: {
          variableName: "projData",
          endpoint: "https://api.dev.local/projects/10",
          sampleSchema: userSchema,
        },
      },
      {
        id: "aiO",
        type: "OPENAI",
        data: {
          variableName: "gptReview",
          userPrompt: "Review project {{projData.httpResponse.data.name}}",
        },
      },
      {
        id: "aiG",
        type: "GEMINI",
        data: {
          variableName: "gemReview",
          userPrompt: "Review project {{projData.httpResponse.data.name}}",
        },
      },
      {
        id: "finalEmail",
        type: "EMAIL",
        data: {
          variableName: "summaryEmail",
          from: "lead@dev.local",
          to: "team@dev.local",
          subject: "Reviews for {{projData.httpResponse.data.name}}",
          body: "GPT: {{gptReview.text}}\n\nGemini: {{gemReview.text}}",
        },
      },
    ],
    edges: [
      { source: "t1", target: "h1" },
      { source: "h1", target: "aiO" },
      { source: "h1", target: "aiG" },
      { source: "aiO", target: "finalEmail" },
      { source: "aiG", target: "finalEmail" },
    ],
  },

  // 9. HTTP without sample schema (dynamic/open)
  {
    id: "wf-09",
    name: "Dynamic HTTP Without Sample Schema",
    description: "Dynamic HTTP response gracefully handled as unknown/open",
    nodes: [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "http1",
        type: "HTTP_REQUEST",
        data: {
          variableName: "dynApi",
          endpoint: "https://httpbin.org/get",
          method: "GET",
        },
      },
      {
        id: "slack1",
        type: "SLACK",
        data: {
          variableName: "dynSlack",
          webhookUrl: "https://slack.com",
          content:
            "Raw API Status: {{dynApi.httpResponse.status}} - Data: {{json dynApi.httpResponse.data}}",
        },
      },
    ],
    edges: [
      { source: "t1", target: "http1" },
      { source: "http1", target: "slack1" },
    ],
  },

  // 10. Nested Array Access in Template
  {
    id: "wf-10",
    name: "Array Indexing from Order Schema",
    description: "Access array items via index 0",
    sampleHttpData: {
      orderId: "ord-999",
      total: 199.99,
      items: [{ sku: "SKU-A", price: 99.99, qty: 1 }],
    },
    nodes: [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "h1",
        type: "HTTP_REQUEST",
        data: {
          variableName: "orderApi",
          endpoint: "https://store.com/orders/999",
          sampleSchema: orderSchema,
        },
      },
      {
        id: "d1",
        type: "DISCORD",
        data: {
          variableName: "orderDiscord",
          webhookUrl: "https://discord.com",
          content:
            "Order {{orderApi.httpResponse.data.orderId}} first item SKU: {{orderApi.httpResponse.data.items.0.sku}}",
        },
      },
    ],
    edges: [
      { source: "t1", target: "h1" },
      { source: "h1", target: "d1" },
    ],
  },

  // Workflows 11 to 30: Realistic combinations covering all nodes and shapes
  ...Array.from({ length: 20 }, (_, i) => {
    const idx = i + 11;
    const triggers = [
      "MANUAL_TRIGGER",
      "GOOGLE_FORM_TRIGGER",
      "STRIPE_TRIGGER",
      "TELEGRAM_TRIGGER",
    ];
    const triggerType = triggers[i % triggers.length];

    return {
      id: `wf-${idx}`,
      name: `Synthetic Benchmark Workflow ${idx}`,
      description: `Workflow test case #${idx} with trigger ${triggerType}`,
      triggerPayload: {
        googleForm: {
          respondentEmail: "test@org.com",
          responses: { title: "Test" },
        },
        stripe: { eventId: `evt_${idx}`, eventType: "invoice.paid" },
        telegram: { chatId: 123456, text: `Hello ${idx}` },
      },
      sampleHttpData: {
        id: idx,
        name: `Entity ${idx}`,
        email: `entity${idx}@example.com`,
        roles: ["user"],
      },
      nodes: [
        { id: `t_${idx}`, type: triggerType, data: {} },
        {
          id: `http_${idx}`,
          type: "HTTP_REQUEST",
          data: {
            variableName: `apiData_${idx}`,
            endpoint: `https://api.example.com/item/${idx}`,
            sampleSchema: userSchema,
          },
        },
        {
          id: `ai_${idx}`,
          type: idx % 2 === 0 ? "OPENAI" : "GEMINI",
          data: {
            variableName: `aiRes_${idx}`,
            userPrompt: `Process {{apiData_${idx}.httpResponse.data.name}}`,
          },
        },
        {
          id: `out_${idx}`,
          type: idx % 3 === 0 ? "SLACK" : idx % 3 === 1 ? "DISCORD" : "EMAIL",
          data: {
            variableName: `notify_${idx}`,
            webhookUrl: "https://hooks.external.com",
            to: "admin@example.com",
            from: "ops@example.com",
            subject: `Update ${idx}`,
            content: `Summary: {{aiRes_${idx}.text}}`,
            body: `Summary: {{aiRes_${idx}.text}}`,
          },
        },
      ],
      edges: [
        { source: `t_${idx}`, target: `http_${idx}` },
        { source: `http_${idx}`, target: `ai_${idx}` },
        { source: `ai_${idx}`, target: `out_${idx}` },
      ],
    };
  }),

  // Google Form -> Database query with lookup helper for keys with spaces
  {
    id: "wf-googleform-db-lookup",
    name: "Form Ratings Database Lookup Insert",
    description:
      "Database INSERT query using Handlebars lookup helper for fields with spaces",
    triggerPayload: {
      googleForm: {
        formId: "f_survey",
        formTitle: "Student Ratings Survey",
        responseId: "resp_123",
        timestamp: "2026-10-27T10:00:00Z",
        respondentEmail: "student@school.edu",
        responses: {
          "Student Name": "Alice",
          "Rating (1-5)": 5,
        },
      },
    },
    nodes: [
      { id: "t1", type: "GOOGLE_FORM_TRIGGER", data: {} },
      {
        id: "db1",
        type: "DATABASE",
        data: {
          variableName: "dbRatings",
          query:
            'INSERT INTO ratings (student, score) VALUES (\'{{lookup googleForm.responses "Student Name"}}\', {{lookup googleForm.responses "Rating (1-5)"}});',
        },
      },
    ],
    edges: [{ source: "t1", target: "db1" }],
  },
];
