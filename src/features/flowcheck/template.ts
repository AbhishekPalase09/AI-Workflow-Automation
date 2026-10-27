// Pure Handlebars template placeholder extractor for Flowcheck (Phase 2.2)
// Non-Negotiable Rule 4: Zero external imports except local/handlebars.

import Handlebars from "handlebars";

export interface Placeholder {
  root: string;
  path: string[];
  helper?: string;
  rendered: boolean;
  argIndex?: number;
  line: number;
  col: number;
  endCol: number;
  raw: string;
}

export interface ExtractResult {
  placeholders: Placeholder[];
  parseError?: string;
  errorLine?: number;
  errorCol?: number;
}

/**
 * Simplifies a raw Handlebars compiler parse error to one clean readable line,
 * extracting line and column numbers if available.
 */
export function simplifyHandlebarsError(rawError: string): {
  message: string;
  line?: number;
  col?: number;
} {
  const lineMatch = rawError.match(/Parse error on line (\d+):/i);
  const line = lineMatch ? Number.parseInt(lineMatch[1], 10) : undefined;

  const lines = rawError.split("\n");
  const caretLineIdx = lines.findIndex((l) => /^-*\^/.test(l.trim()));
  let col: number | undefined;
  if (caretLineIdx !== -1) {
    const caretLine = lines[caretLineIdx];
    const caretPos = caretLine.indexOf("^");
    if (caretPos !== -1) {
      col = caretPos;
    }
  }

  const lastLine = lines[lines.length - 1]?.trim() || "";
  let message = "Unclosed {{ or malformed expression";

  if (rawError.startsWith("Malformed expression with trailing dot")) {
    message = rawError;
  } else if (
    lastLine.includes("got 'INVALID'") ||
    lastLine.includes("got 'EOF'") ||
    lastLine.toLowerCase().includes("unclosed")
  ) {
    message = "Unclosed {{ or malformed expression";
  } else if (lastLine.startsWith("Expecting ")) {
    message = `Malformed expression: ${lastLine}`;
  } else if (lastLine.length > 0) {
    message = lastLine;
  }

  return { message, line, col };
}

interface HbsPathExpression {
  type: "PathExpression";
  data?: boolean;
  depth: number;
  parts: string[];
  original: string;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

function isPathExpression(node: unknown): node is HbsPathExpression {
  return (
    typeof node === "object" &&
    node !== null &&
    (node as { type?: unknown }).type === "PathExpression"
  );
}

function processPathExpression(
  pathNode: HbsPathExpression,
  helper?: string,
  rendered = false,
  argIndex?: number,
): Placeholder | null {
  // Ignore @data variables (e.g. @index, @first, @root)
  if (pathNode.data) {
    return null;
  }

  // Ignore parent scope paths (../x)
  if (pathNode.depth > 0) {
    return null;
  }

  // Ignore 'this' or empty paths
  if (!pathNode.parts || pathNode.parts.length === 0) {
    return null;
  }

  const root = pathNode.parts[0];
  if (root === "this" || root === ".") {
    return null;
  }

  return {
    root,
    path: pathNode.parts.slice(1),
    helper,
    rendered,
    argIndex,
    line: pathNode.loc?.start?.line ?? 1,
    col: pathNode.loc?.start?.column ?? 0,
    endCol:
      pathNode.loc?.end?.column ??
      (pathNode.original ? pathNode.original.length : 0),
    raw: pathNode.original,
  };
}

interface HbsStatement {
  type: string;
  path?: unknown;
  params?: unknown[];
  program?: { body?: unknown[] };
  inverse?: { body?: unknown[] };
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
}

function hasTrailingDotParam(statements: unknown[]): {
  found: boolean;
  line?: number;
  col?: number;
  text?: string;
} {
  for (const rawStmt of statements) {
    if (!rawStmt || typeof rawStmt !== "object") continue;
    const stmt = rawStmt as HbsStatement;

    if (stmt.params && Array.isArray(stmt.params)) {
      for (const p of stmt.params) {
        if (
          isPathExpression(p) &&
          (p.original === "." || p.original?.endsWith("."))
        ) {
          return {
            found: true,
            line: p.loc?.start?.line ?? stmt.loc?.start?.line ?? 1,
            col: p.loc?.start?.column ?? stmt.loc?.start?.column ?? 0,
            text: p.original,
          };
        }
      }
    }

    if (stmt.program?.body) {
      const inner = hasTrailingDotParam(stmt.program.body);
      if (inner.found) return inner;
    }
    if (stmt.inverse?.body) {
      const inner = hasTrailingDotParam(stmt.inverse.body);
      if (inner.found) return inner;
    }
  }
  return { found: false };
}

function walkStatements(
  statements: unknown[],
  placeholders: Placeholder[],
): void {
  for (const rawStmt of statements) {
    if (!rawStmt || typeof rawStmt !== "object") continue;
    const stmt = rawStmt as HbsStatement;

    switch (stmt.type) {
      case "MustacheStatement": {
        // Zero params -> bare path variable reference (or triple-stash bare path reference)
        if (!stmt.params || stmt.params.length === 0) {
          if (isPathExpression(stmt.path)) {
            const p = processPathExpression(stmt.path, undefined, true);
            if (p) placeholders.push(p);
          }
        } else {
          // Has params: path is helper name (e.g. {{json myVar.field}} or {{lookup googleForm.responses "X"}})
          const helperName = isPathExpression(stmt.path)
            ? stmt.path.original
            : undefined;

          let argIdx = 0;
          for (const param of stmt.params) {
            if (isPathExpression(param)) {
              const p = processPathExpression(param, helperName, false, argIdx);
              if (p) placeholders.push(p);
            }
            // Do NOT descend into SubExpressions or Literals: treat as unknown without errors
            argIdx++;
          }
        }
        break;
      }

      case "BlockStatement": {
        // Record parameter paths of the block helper
        const helperName = isPathExpression(stmt.path)
          ? stmt.path.original
          : undefined;

        if (stmt.params) {
          let argIdx = 0;
          for (const param of stmt.params) {
            if (isPathExpression(param)) {
              const p = processPathExpression(param, helperName, false, argIdx);
              if (p) placeholders.push(p);
            }
            argIdx++;
          }
        }

        // Descend only into #if and #unless blocks
        if (helperName === "if" || helperName === "unless") {
          if (stmt.program?.body) {
            walkStatements(stmt.program.body, placeholders);
          }
          if (stmt.inverse?.body) {
            walkStatements(stmt.inverse.body, placeholders);
          }
        }
        // Do NOT descend into #each, #with, or unknown block helpers
        break;
      }

      default:
        break;
    }
  }
}

/**
 * Extract template placeholders using Handlebars.parse AST.
 * Never throws.
 */
export function extractPlaceholders(tpl: string): ExtractResult {
  if (!tpl || typeof tpl !== "string") {
    return { placeholders: [] };
  }

  // Pre-check for trailing dot in template placeholder expressions: e.g. {{a.}} or {{json dbRetrive.}}
  const trailingDotRegex =
    /(?:\{\{|\{\{\{)[^}]*?\b([a-zA-Z0-9_$.]+\.)\s*(?:\}\}|\}\}\})/g;
  const tdMatch = trailingDotRegex.exec(tpl);
  if (tdMatch) {
    const matchIndex = tdMatch.index;
    const beforeMatch = tpl.slice(0, matchIndex);
    const line = beforeMatch.split("\n").length;
    const lastNewline = beforeMatch.lastIndexOf("\n");
    const col = lastNewline === -1 ? matchIndex : matchIndex - lastNewline - 1;

    return {
      placeholders: [],
      parseError: `Malformed expression with trailing dot: "${tdMatch[1]}"`,
      errorLine: line,
      errorCol: col,
    };
  }

  try {
    const ast = Handlebars.parse(tpl);

    // Also check AST for any trailing dot parameter (e.g. {{json db .}})
    if (ast && Array.isArray(ast.body)) {
      const tdAst = hasTrailingDotParam(ast.body);
      if (tdAst.found) {
        return {
          placeholders: [],
          parseError: "Malformed expression with trailing dot",
          errorLine: tdAst.line,
          errorCol: tdAst.col,
        };
      }
    }

    const placeholders: Placeholder[] = [];
    if (ast && Array.isArray(ast.body)) {
      walkStatements(ast.body, placeholders);
    }
    return { placeholders };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const simplified = simplifyHandlebarsError(message);
    return {
      placeholders: [],
      parseError: simplified.message,
      errorLine: simplified.line,
      errorCol: simplified.col,
    };
  }
}
