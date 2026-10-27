import { describe, expect, it } from "vitest";
import { extractPlaceholders } from "../template";

describe("Template Extraction (Phase 2.2)", () => {
  it("extracts plain variable reference", () => {
    const tpl = "Hello {{user.name}}!";
    const res = extractPlaceholders(tpl);
    expect(res.parseError).toBeUndefined();
    expect(res.placeholders).toHaveLength(1);
    expect(res.placeholders[0]).toMatchObject({
      root: "user",
      path: ["name"],
      helper: undefined,
      raw: "user.name",
    });
  });

  it("extracts json helper argument", () => {
    const tpl = "Payload: {{json apiCall.httpResponse.data}}";
    const res = extractPlaceholders(tpl);
    expect(res.placeholders).toHaveLength(1);
    expect(res.placeholders[0]).toMatchObject({
      root: "apiCall",
      path: ["httpResponse", "data"],
      helper: "json",
    });
  });

  it("extracts triple-stash reference", () => {
    const tpl = "<div>{{{htmlContent.body}}}</div>";
    const res = extractPlaceholders(tpl);
    expect(res.placeholders).toHaveLength(1);
    expect(res.placeholders[0]).toMatchObject({
      root: "htmlContent",
      path: ["body"],
    });
  });

  it("descends into #if and #unless blocks", () => {
    const tpl = `
      {{#if cond.isActive}}
        User is {{user.email}}
      {{else}}
        Fallback to {{default.email}}
      {{/if}}
      {{#unless user.isBanned}}
        Welcome {{user.name}}
      {{/unless}}
    `;
    const res = extractPlaceholders(tpl);
    const roots = res.placeholders.map((p) => p.root);
    expect(roots).toContain("cond");
    expect(roots).toContain("user");
    expect(roots).toContain("default");
  });

  it("does NOT descend into #each blocks (skips inner scoped properties)", () => {
    const tpl = `
      {{#each users.list}}
        Hello {{this.name}} and {{email}}
      {{/each}}
    `;
    const res = extractPlaceholders(tpl);
    // Only users.list parameter of #each should be extracted, not this.name or email
    expect(res.placeholders).toHaveLength(1);
    expect(res.placeholders[0]).toMatchObject({
      root: "users",
      path: ["list"],
    });
  });

  it("handles space in bracketed segments {{a.[b c]}}", () => {
    const tpl = "{{data.[first name]}}";
    const res = extractPlaceholders(tpl);
    expect(res.placeholders).toHaveLength(1);
    expect(res.placeholders[0]).toMatchObject({
      root: "data",
      path: ["first name"],
    });
  });

  it("handles array indices {{items.[0]}} and {{items.0}}", () => {
    const tpl = "{{items.[0].id}} and {{items.0.name}}";
    const res = extractPlaceholders(tpl);
    expect(res.placeholders).toHaveLength(2);
    expect(res.placeholders[0].path).toEqual(["0", "id"]);
    expect(res.placeholders[1].path).toEqual(["0", "name"]);
  });

  it("returns parseError on malformed template without throwing", () => {
    const tpl = "{{#unclosedTag";
    const res = extractPlaceholders(tpl);
    expect(res.parseError).toBeDefined();
    expect(res.placeholders).toHaveLength(0);
  });

  it("detects unclosed template expression {{x", () => {
    const res = extractPlaceholders("Hello {{x and more");
    expect(res.parseError).toBeDefined();
    expect(res.placeholders).toHaveLength(0);
  });

  it("detects trailing dot in template expression {{a.}}", () => {
    const res = extractPlaceholders("SELECT * FROM users WHERE id = {{a.}}");
    expect(res.parseError).toBeDefined();
    expect(res.parseError).toContain("trailing dot");
    expect(res.placeholders).toHaveLength(0);
  });

  it("detects trailing dot with helper {{json dbRetrive.}}", () => {
    const res = extractPlaceholders("Payload: {{json dbRetrive.}}");
    expect(res.parseError).toBeDefined();
    expect(res.parseError).toContain("trailing dot");
    expect(res.placeholders).toHaveLength(0);
  });

  it("detects unclosed block helper {{#if a}} without closing tag", () => {
    const res = extractPlaceholders("{{#if a}} some content");
    expect(res.parseError).toBeDefined();
    expect(res.placeholders).toHaveLength(0);
  });

  it("computes correct positions across multi-line templates", () => {
    const tpl = "Line 1\nLine 2 {{target.val}}";
    const res = extractPlaceholders(tpl);
    expect(res.placeholders[0].line).toBe(2);
  });
});
