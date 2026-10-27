import { describe, expect, it } from "vitest";
import {
  computeTemplateInsertion,
  getUnclosedTemplatePrefix,
  hasJsonHelperBeforeCursor,
  insertTemplatePathAtCursor,
  matchScore,
} from "@/features/editor/components/field-diagnostics";
import { analyze, type FlowEdge, type FlowNode } from "@/features/flowcheck";

describe("Autocomplete & Template Prefix Tests", () => {
  describe("getUnclosedTemplatePrefix", () => {
    it("returns empty string when text before cursor ends with exactly {{", () => {
      expect(getUnclosedTemplatePrefix("{{")).toBe("");
      expect(
        getUnclosedTemplatePrefix("SELECT * FROM users WHERE id = {{"),
      ).toBe("");
    });

    it("returns partial variable/path when text ends with unclosed prefix", () => {
      expect(getUnclosedTemplatePrefix("{{db")).toBe("db");
      expect(
        getUnclosedTemplatePrefix("SELECT * FROM users WHERE id = {{db"),
      ).toBe("db");
      expect(getUnclosedTemplatePrefix("SELECT {{googleForm.responses.")).toBe(
        "googleForm.responses.",
      );
      expect(getUnclosedTemplatePrefix("{{myApi.httpResponse.data.us")).toBe(
        "myApi.httpResponse.data.us",
      );
    });

    it("returns null when template is already closed before cursor", () => {
      expect(getUnclosedTemplatePrefix("{{db}}")).toBeNull();
      expect(
        getUnclosedTemplatePrefix("{{db}} and some other text"),
      ).toBeNull();
      expect(getUnclosedTemplatePrefix("hello world")).toBeNull();
    });

    it("returns unclosed prefix when earlier templates are closed but the last is unclosed", () => {
      const text = "Hello {{user.name}} and {{db";
      expect(getUnclosedTemplatePrefix(text)).toBe("db");
    });

    it("handles json helper or whitespace prefixes", () => {
      expect(getUnclosedTemplatePrefix("{{ json db")).toBe("db");
      expect(getUnclosedTemplatePrefix("{{  myVar")).toBe("myVar");
    });
  });

  describe("hasJsonHelperBeforeCursor", () => {
    it("detects json helper after unclosed {{", () => {
      expect(hasJsonHelperBeforeCursor("SELECT {{json db")).toBe(true);
      expect(hasJsonHelperBeforeCursor("SELECT {{ json db")).toBe(true);
      expect(hasJsonHelperBeforeCursor("SELECT {{JSON db")).toBe(true);
    });

    it("returns false when json helper is not present", () => {
      expect(hasJsonHelperBeforeCursor("SELECT {{db")).toBe(false);
      expect(hasJsonHelperBeforeCursor("SELECT {{")).toBe(false);
    });
  });

  describe("computeTemplateInsertion", () => {
    it("1. inserts scalar as plain {{path}}", () => {
      const res = computeTemplateInsertion("user.name", true, "any", false);
      expect(res).toBe("user.name");
    });

    it("2. inserts non-scalar in any-field with json helper", () => {
      const res = computeTemplateInsertion(
        "dbRetrive.rows",
        false,
        "any",
        false,
      );
      expect(res).toBe("json dbRetrive.rows");
    });

    it("3. inserts non-scalar in scalar-field as path (rendered disabled in UI)", () => {
      const res = computeTemplateInsertion(
        "dbRetrive.rows",
        false,
        "scalar",
        false,
      );
      expect(res).toBe("dbRetrive.rows");
    });

    it("4. keeps existing json helper and prevents duplicate json helper", () => {
      const res = computeTemplateInsertion(
        "dbRetrive.rows",
        false,
        "any",
        true,
      );
      expect(res).toBe("json dbRetrive.rows");
      expect(res).not.toContain("json json");
    });
  });

  describe("insertTemplatePathAtCursor", () => {
    it("inserts scalar into any field", () => {
      const result = insertTemplatePathAtCursor(
        "SELECT {{user",
        "user.name",
        13,
        { scalar: true, accepts: "any" },
      );
      expect(result).toBe("SELECT {{user.name}}");
    });

    it("inserts non-scalar into any field with json helper", () => {
      const result = insertTemplatePathAtCursor(
        "SELECT {{db",
        "dbRetrive.rows",
        11,
        { scalar: false, accepts: "any" },
      );
      expect(result).toBe("SELECT {{json dbRetrive.rows}}");
    });

    it("preserves existing json helper and does not duplicate", () => {
      const result = insertTemplatePathAtCursor(
        "SELECT {{json db",
        "dbRetrive.rows",
        16,
        { scalar: false, accepts: "any" },
      );
      expect(result).toBe("SELECT {{json dbRetrive.rows}}");
    });

    it("partial token replacement preserves suffix", () => {
      const fullText = "SELECT {{db.ro WHERE active = true";
      const result = insertTemplatePathAtCursor(
        fullText,
        "dbRetrive.rows",
        14,
        { scalar: false, accepts: "any" },
      );
      expect(result).toBe("SELECT {{json dbRetrive.rows}} WHERE active = true");
    });

    it("cleans up closing brackets if user was typing right before }}", () => {
      const fullText = "SELECT {{db}} AND active = true";
      const result = insertTemplatePathAtCursor(fullText, "db.rowCount", 11, {
        scalar: true,
        accepts: "any",
      });
      expect(result).toBe("SELECT {{db.rowCount}} AND active = true");
    });
  });

  describe("Tolerant Subsequence Matching (matchScore)", () => {
    it("prioritizes exact prefix match", () => {
      const score = matchScore("db", "dbRetrive.rows");
      expect(score).toBe(100);
    });

    it("prioritizes substring match after prefix match", () => {
      const score = matchScore("rows", "dbRetrive.rows");
      expect(score).toBe(80);
    });

    it("matches exact in-order subsequence", () => {
      const score = matchScore("drows", "dbRetrive.rows");
      expect(score).toBe(60);
    });

    it("tolerant separator match: 'db.re' finds dbRetrive.rows", () => {
      const score = matchScore("db.re", "dbRetrive.rows");
      expect(score).toBe(40);
      expect(score).toBeGreaterThan(0);
    });

    it("returns 0 for non-matching queries", () => {
      expect(matchScore("xyz", "dbRetrive.rows")).toBe(0);
    });
  });

  describe("Draft node reactivity verification", () => {
    it("updates diagnostics immediately when analyzing draft data before save", () => {
      const savedNodes: FlowNode[] = [
        { id: "t1", type: "GOOGLE_FORM_TRIGGER", data: {} },
        {
          id: "db1",
          type: "DATABASE",
          data: {
            variableName: "myDb",
            query: "SELECT * FROM users WHERE id = {{unknownVar.id}}",
          },
        },
      ];
      const edges: FlowEdge[] = [{ source: "t1", target: "db1" }];

      // Saved state has E1 error
      const initialDiags = analyze(savedNodes, edges);
      expect(initialDiags.some((d) => d.code === "E1")).toBe(true);

      // User types draft fix in dialog before clicking save
      const draftData = {
        variableName: "myDb",
        query: "SELECT * FROM users WHERE id = {{googleForm.responseId}}",
      };
      const activeNodes = savedNodes.map((n) =>
        n.id === "db1" ? { ...n, data: { ...n.data, ...draftData } } : n,
      );

      // Draft analysis produces zero errors
      const draftDiags = analyze(activeNodes, edges);
      expect(draftDiags.filter((d) => d.severity === "error")).toHaveLength(0);
    });
  });
});
