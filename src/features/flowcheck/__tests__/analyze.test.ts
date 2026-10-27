import { describe, expect, it } from "vitest";
import {
  analyze,
  type FlowEdge,
  type FlowNode,
  validateWorkflowGraph,
} from "../analyze";
import { S } from "../schema";

describe("Static Data-Flow Analyzer (Phase 2.5)", () => {
  it("emits E5 on graph cycle and terminates immediately", () => {
    const nodes: FlowNode[] = [
      { id: "1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "2",
        type: "HTTP_REQUEST",
        data: { variableName: "req1", endpoint: "https://api.com" },
      },
      {
        id: "3",
        type: "HTTP_REQUEST",
        data: { variableName: "req2", endpoint: "https://api.com" },
      },
    ];
    const edges: FlowEdge[] = [
      { source: "1", target: "2" },
      { source: "2", target: "3" },
      { source: "3", target: "2" }, // Cycle!
    ];

    const diags = analyze(nodes, edges);
    expect(diags).toHaveLength(1);
    expect(diags[0].code).toBe("E5");
    expect(diags[0].severity).toBe("error");
    expect(diags[0].message).toContain("cycle");
  });

  it("emits E1 with closest typo suggestion when variable is unknown", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "h1",
        type: "HTTP_REQUEST",
        data: { variableName: "fetchUser", endpoint: "https://api.com/users" },
      },
      {
        id: "ai1",
        type: "OPENAI",
        data: {
          variableName: "summarize",
          userPrompt: "Summarize this: {{fetchUsr.httpResponse.data}}",
        },
      },
    ];
    const edges: FlowEdge[] = [
      { source: "t1", target: "h1" },
      { source: "h1", target: "ai1" },
    ];

    const diags = analyze(nodes, edges);
    const e1 = diags.find((d) => d.code === "E1");
    expect(e1).toBeDefined();
    expect(e1?.nodeId).toBe("ai1");
    expect(e1?.field).toBe("userPrompt");
    expect(e1?.suggestions).toContain("fetchUser");
  });

  it("emits E1 when referencing non-ancestor node", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "h1",
        type: "HTTP_REQUEST",
        data: { variableName: "nodeA", endpoint: "https://api.com" },
      },
      {
        id: "h2",
        type: "HTTP_REQUEST",
        data: {
          variableName: "nodeB",
          endpoint: "https://api.com/{{nodeA.httpResponse.status}}",
        },
      },
    ];
    // Notice: t1 -> h1, but h2 is disconnected from h1!
    const edges: FlowEdge[] = [
      { source: "t1", target: "h1" },
      { source: "t1", target: "h2" },
    ];

    const diags = analyze(nodes, edges);
    const e1 = diags.find((d) => d.nodeId === "h2" && d.code === "E1");
    expect(e1).toBeDefined();
  });

  it("emits E2 on missing property on a closed schema", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "ai1",
        type: "OPENAI",
        data: { variableName: "genText", userPrompt: "Hello" },
      },
      {
        id: "slack1",
        type: "SLACK",
        data: {
          variableName: "notify",
          content: "Result: {{genText.nonExistentProperty}}",
        },
      },
    ];
    const edges: FlowEdge[] = [
      { source: "t1", target: "ai1" },
      { source: "ai1", target: "slack1" },
    ];

    const diags = analyze(nodes, edges);
    const e2 = diags.find((d) => d.code === "E2");
    expect(e2).toBeDefined();
    expect(e2?.nodeId).toBe("slack1");
    expect(e2?.message).toContain("nonExistentProperty");
  });

  it("emits E3 when scalar field receives object/array without json helper", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "db1",
        type: "DATABASE",
        data: { variableName: "myDb", query: "SELECT * FROM users" },
      },
      {
        id: "http1",
        type: "HTTP_REQUEST",
        data: {
          variableName: "myCall",
          // endpoint accepts: "scalar", but myDb.rows is an array!
          endpoint: "https://api.com/{{myDb.rows}}",
        },
      },
    ];
    const edges: FlowEdge[] = [
      { source: "t1", target: "db1" },
      { source: "db1", target: "http1" },
    ];

    const diags = analyze(nodes, edges);
    const e3 = diags.find((d) => d.code === "E3");
    expect(e3).toBeDefined();
    expect(e3?.nodeId).toBe("http1");
    expect(e3?.field).toBe("endpoint");
  });

  it("emits E4 for duplicate variable names on reachable nodes with common descendant", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "n1",
        type: "OPENAI",
        data: { variableName: "duplicateVar", userPrompt: "prompt 1" },
      },
      {
        id: "n2",
        type: "OPENAI",
        data: { variableName: "duplicateVar", userPrompt: "prompt 2" },
      },
      {
        id: "n3",
        type: "SLACK",
        data: { variableName: "notify", content: "Done" },
      },
    ];
    const edges: FlowEdge[] = [
      { source: "t1", target: "n1" },
      { source: "t1", target: "n2" },
      { source: "n1", target: "n3" },
      { source: "n2", target: "n3" },
    ];

    const diags = analyze(nodes, edges);
    const e4 = diags.find((d) => d.code === "E4");
    expect(e4).toBeDefined();
    expect(e4?.message).toContain("duplicateVar");
  });

  it("guarantees diamond/merge ancestors run in topological order with zero W1 by default", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "branchA",
        type: "OPENAI",
        data: { variableName: "varOnlyInA", userPrompt: "hi" },
      },
      {
        id: "branchB",
        type: "SLACK",
        data: { variableName: "varInB", content: "hi" },
      },
      {
        id: "mergeNode",
        type: "DISCORD",
        data: {
          variableName: "discordOut",
          content: "Value: {{varOnlyInA.text}} and {{varInB.messageId}}",
        },
      },
    ];
    const edges: FlowEdge[] = [
      { source: "t1", target: "branchA" },
      { source: "t1", target: "branchB" },
      { source: "branchA", target: "mergeNode" },
      { source: "branchB", target: "mergeNode" },
    ];

    // Default mode: Topological union -> both branch variables are in must(mergeNode)
    const diags = analyze(nodes, edges);
    const w1s = diags.filter(
      (d) =>
        d.nodeId === "mergeNode" &&
        d.code === "W1" &&
        d.message.includes("may be undefined on some execution paths"),
    );
    expect(w1s).toHaveLength(0);

    // Branch-sensitive ablation mode: intersection over parents -> both are only in may(mergeNode)
    const branchSensitiveDiags = analyze(nodes, edges, {
      branchSensitive: true,
    });
    const bsW1s = branchSensitiveDiags.filter(
      (d) =>
        d.nodeId === "mergeNode" &&
        d.code === "W1" &&
        d.message.includes("may be undefined on some execution paths"),
    );
    expect(bsW1s.length).toBeGreaterThan(0);
  });

  it("emits W2 (info) when accessing property on open dynamic object", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "GOOGLE_FORM_TRIGGER", data: {} },
      {
        id: "slack1",
        type: "SLACK",
        data: {
          variableName: "slackMsg",
          content: "Email: {{googleForm.respondentEmail}}",
        },
      },
    ];
    const edges: FlowEdge[] = [{ source: "t1", target: "slack1" }];

    const diags = analyze(nodes, edges);
    // googleForm is open object, respondentEmail is optional property -> maybe/unchecked
    const warnings = diags.filter((d) => d.severity === "error");
    expect(warnings).toHaveLength(0); // Never an error on open trigger data
  });

  it("emits W3 when object/array is used in any-accepting field without json helper", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "db1",
        type: "DATABASE",
        data: { variableName: "myDb", query: "SELECT * FROM users" },
      },
      {
        id: "slack1",
        type: "SLACK",
        data: {
          variableName: "notify",
          content: "Rows: {{myDb.rows}}", // myDb.rows is array in message content
        },
      },
    ];
    const edges: FlowEdge[] = [
      { source: "t1", target: "db1" },
      { source: "db1", target: "slack1" },
    ];

    const diags = analyze(nodes, edges);
    const w3 = diags.find((d) => d.code === "W3");
    expect(w3).toBeDefined();
    expect(w3?.message).toContain("json");
  });

  it("ignores unreachable nodes (emits zero diagnostics for them)", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "unreachable",
        type: "SLACK",
        data: {
          variableName: "msg",
          content: "{{completelyBogusVariable.missing}}",
        },
      },
    ];
    const edges: FlowEdge[] = []; // disconnected

    const diags = analyze(nodes, edges);
    expect(diags).toHaveLength(0);
  });

  it("treats unknown node types gracefully without throwing or reporting errors", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      { id: "custom1", type: "CUSTOM_UNKNOWN_TYPE", data: { foo: "bar" } },
      {
        id: "slack1",
        type: "SLACK",
        data: { variableName: "s1", content: "Static content" },
      },
    ];
    const edges: FlowEdge[] = [
      { source: "t1", target: "custom1" },
      { source: "custom1", target: "slack1" },
    ];

    const diags = analyze(nodes, edges);
    expect(diags).toHaveLength(0);
  });

  it("NO FALSE ERROR: A correct 6-node workflow yields zero errors", () => {
    const nodes: FlowNode[] = [
      { id: "t1", type: "MANUAL_TRIGGER", data: {} },
      {
        id: "http1",
        type: "HTTP_REQUEST",
        data: {
          variableName: "fetchUser",
          endpoint: "https://api.github.com/user",
          method: "GET",
          sampleSchema: S.obj({
            login: S.str,
            id: S.num,
          }),
        },
      },
      {
        id: "ai1",
        type: "OPENAI",
        data: {
          variableName: "greeting",
          userPrompt:
            "Generate a welcoming message for {{fetchUser.httpResponse.data.login}}",
        },
      },
      {
        id: "slack1",
        type: "SLACK",
        data: {
          variableName: "slackNotice",
          content: "AI Generated: {{greeting.text}}",
        },
      },
      {
        id: "discord1",
        type: "DISCORD",
        data: {
          variableName: "discordNotice",
          content:
            "Status: {{fetchUser.httpResponse.status}} - {{greeting.text}}",
        },
      },
      {
        id: "email1",
        type: "EMAIL",
        data: {
          variableName: "emailNotice",
          to: "admin@example.com",
          subject: "New user: {{fetchUser.httpResponse.data.login}}",
          body: "Hello! Message: {{greeting.text}}",
        },
      },
    ];

    const edges: FlowEdge[] = [
      { source: "t1", target: "http1" },
      { source: "http1", target: "ai1" },
      { source: "ai1", target: "slack1" },
      { source: "slack1", target: "discord1" },
      { source: "discord1", target: "email1" },
    ];

    const diags = analyze(nodes, edges);
    const errors = diags.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });

  describe("validateWorkflowGraph gate", () => {
    it("returns ok: true when workflow has no error-level diagnostics", () => {
      const nodes: FlowNode[] = [
        { id: "t1", type: "MANUAL_TRIGGER", data: {} },
        {
          id: "http1",
          type: "HTTP_REQUEST",
          data: {
            variableName: "fetchUser",
            endpoint: "https://api.github.com/users/octocat",
          },
        },
      ];
      const edges: FlowEdge[] = [{ source: "t1", target: "http1" }];

      const res = validateWorkflowGraph(nodes, edges);
      expect(res.ok).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    it("returns ok: false with error messages when workflow contains errors", () => {
      const nodes: FlowNode[] = [
        { id: "t1", type: "MANUAL_TRIGGER", data: {} },
        {
          id: "ai1",
          type: "OPENAI",
          data: {
            variableName: "greeting",
            userPrompt: "Hello {{missingVar.data}}",
          },
        },
      ];
      const edges: FlowEdge[] = [{ source: "t1", target: "ai1" }];

      const res = validateWorkflowGraph(nodes, edges);
      expect(res.ok).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0]).toContain("ai1");
      expect(res.errors[0]).toContain("missingVar");
    });
  });

  describe("E6 SYNTAX_ERROR diagnostics and pre-run gate", () => {
    it("emits E6 error on unclosed template brace '{{x'", () => {
      const nodes: FlowNode[] = [
        { id: "t1", type: "MANUAL_TRIGGER", data: {} },
        {
          id: "gem1",
          type: "GEMINI",
          data: {
            variableName: "geminiOut",
            userPrompt: "Translate: {{db.re",
          },
        },
      ];
      const edges: FlowEdge[] = [{ source: "t1", target: "gem1" }];
      const diags = analyze(nodes, edges);

      const e6 = diags.find((d) => d.code === "E6");
      expect(e6).toBeDefined();
      expect(e6?.severity).toBe("error");
      expect(e6?.nodeId).toBe("gem1");
      expect(e6?.field).toBe("userPrompt");
      expect(e6?.message).toContain("Unclosed {{");

      // Verify pre-run gate blocks execution
      const gate = validateWorkflowGraph(nodes, edges);
      expect(gate.ok).toBe(false);
      expect(gate.errors.some((e) => e.includes("gem1"))).toBe(true);
    });

    it("emits E6 error on trailing dot '{{a.}}'", () => {
      const nodes: FlowNode[] = [
        { id: "t1", type: "MANUAL_TRIGGER", data: {} },
        {
          id: "db1",
          type: "DATABASE",
          data: {
            variableName: "myDb",
            query: "SELECT * FROM users WHERE id = {{a.}}",
          },
        },
      ];
      const edges: FlowEdge[] = [{ source: "t1", target: "db1" }];
      const diags = analyze(nodes, edges);

      const e6 = diags.find((d) => d.code === "E6");
      expect(e6).toBeDefined();
      expect(e6?.severity).toBe("error");
      expect(e6?.nodeId).toBe("db1");
      expect(e6?.field).toBe("query");
      expect(e6?.message.toLowerCase()).toContain("trailing dot");
    });

    it("emits E6 error on helper with trailing dot '{{json dbRetrive.}}'", () => {
      const nodes: FlowNode[] = [
        { id: "t1", type: "GOOGLE_FORM_TRIGGER", data: {} },
        {
          id: "gem1",
          type: "GEMINI",
          data: {
            variableName: "ai",
            userPrompt: "Process: {{json dbRetrive.}}",
          },
        },
      ];
      const edges: FlowEdge[] = [{ source: "t1", target: "gem1" }];
      const diags = analyze(nodes, edges);

      const e6 = diags.find((d) => d.code === "E6");
      expect(e6).toBeDefined();
      expect(e6?.severity).toBe("error");
      expect(e6?.field).toBe("userPrompt");
    });

    it("emits E6 error on unclosed block helper '{{#if a}}'", () => {
      const nodes: FlowNode[] = [
        { id: "t1", type: "MANUAL_TRIGGER", data: {} },
        {
          id: "slack1",
          type: "SLACK",
          data: {
            variableName: "msg",
            content: "{{#if cond}} Active user",
          },
        },
      ];
      const edges: FlowEdge[] = [{ source: "t1", target: "slack1" }];
      const diags = analyze(nodes, edges);

      const e6 = diags.find((d) => d.code === "E6");
      expect(e6).toBeDefined();
      expect(e6?.severity).toBe("error");
      expect(e6?.nodeId).toBe("slack1");
    });

    it("yields zero E6 errors on valid templates", () => {
      const nodes: FlowNode[] = [
        { id: "t1", type: "GOOGLE_FORM_TRIGGER", data: {} },
        {
          id: "email1",
          type: "EMAIL",
          data: {
            variableName: "mail",
            to: "{{googleForm.respondentEmail}}",
            subject: "Form submitted: {{googleForm.formTitle}}",
            body: "Responses: {{json googleForm.responses}}",
          },
        },
      ];
      const edges: FlowEdge[] = [{ source: "t1", target: "email1" }];
      const diags = analyze(nodes, edges);

      const e6Errors = diags.filter((d) => d.code === "E6");
      expect(e6Errors).toHaveLength(0);
    });
  });
});
