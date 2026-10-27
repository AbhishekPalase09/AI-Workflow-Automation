import { useNodes } from "@xyflow/react";
import { AlertCircle, AlertTriangle, Info, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getSignature } from "@/features/flowcheck";
import { cn } from "@/lib/utils";
import {
  useAvailablePaths,
  useNodeDiagnostics,
} from "../hooks/use-flow-diagnostics";

interface FieldDiagnosticsProps {
  nodeId?: string;
  field: string;
  value?: string;
  accepts?: "scalar" | "any";
  cursorIndex?: number;
  onQuickFix?: (suggestion: string) => void;
  onApplyQuickFix?: (suggestion: string) => void;
  onSelectPath?: (insertedText: string) => void;
  className?: string;
}

/**
 * Checks if the text before the cursor ends with an unclosed "{{"
 * and extracts the partial path (e.g. "" for "{{", "db" for "{{db").
 * Returns null if not in an unclosed template.
 */
export function getUnclosedTemplatePrefix(
  textBeforeCursor: string,
): string | null {
  const lastOpen = textBeforeCursor.lastIndexOf("{{");
  if (lastOpen === -1) return null;

  // Check if there is a "}}" after this last "{{"
  const lastClose = textBeforeCursor.indexOf("}}", lastOpen);
  if (lastClose !== -1) return null; // already closed before cursor

  // Extract text after "{{"
  const afterOpen = textBeforeCursor.slice(lastOpen + 2);

  // Strip leading '{', leading whitespace, and optional helper ('json ' or 'lookup ')
  const clean = afterOpen
    .replace(/^\{+/, "")
    .trimStart()
    .replace(/^(?:json|lookup)\s+/i, "");

  const match = clean.match(/^([a-zA-Z0-9_$.]*)$/);
  if (match) {
    return match[1];
  }
  return null;
}

/**
 * Checks if the text before the cursor already includes the Handlebars "json" helper.
 */
export function hasJsonHelperBeforeCursor(textBeforeCursor: string): boolean {
  const lastOpen = textBeforeCursor.lastIndexOf("{{");
  if (lastOpen === -1) return false;
  const afterOpen = textBeforeCursor.slice(lastOpen + 2);
  return /^\s*json\s+/i.test(afterOpen);
}

/**
 * Checks if the text before the cursor is inside a Handlebars "lookup" helper.
 */
export function hasLookupHelperBeforeCursor(textBeforeCursor: string): boolean {
  const lastOpen = textBeforeCursor.lastIndexOf("{{");
  if (lastOpen === -1) return false;
  const afterOpen = textBeforeCursor.slice(lastOpen + 2);
  return /^\s*lookup\s+/i.test(afterOpen);
}

/**
 * Subsequence matching helper: checks if `sub` is an in-order subsequence of `str`.
 */
export function isSubsequence(sub: string, str: string): boolean {
  let i = 0;
  let j = 0;
  while (i < sub.length && j < str.length) {
    if (sub[i] === str[j]) {
      i++;
    }
    j++;
  }
  return i === sub.length;
}

/**
 * Tolerant scoring for autocomplete suggestions:
 * 1. Exact prefix match -> 100
 * 2. Exact substring match -> 80
 * 3. Exact character subsequence -> 60
 * 4. Separator-tolerant subsequence (e.g. "db.re" matching "dbRetrive.rows") -> 40
 */
export function matchScore(query: string, target: string): number {
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 1;

  // 1. Exact prefix match
  if (t.startsWith(q)) return 100;

  // 2. Exact substring match
  if (t.includes(q)) return 80;

  // 3. Exact character subsequence
  if (isSubsequence(q, t)) return 60;

  // 4. Dot/separator-tolerant subsequence (e.g. "db.re" matching "dbRetrive.rows")
  const qClean = q.replace(/[._\-\s]/g, "");
  const tClean = t.replace(/[._\-\s]/g, "");
  if (qClean && isSubsequence(qClean, tClean)) return 40;

  return 0;
}

/**
 * Computes the template insertion expression given the path, its scalar kind,
 * whether the field accepts "scalar" or "any", whether the text already has "json ",
 * and whether the text is inside a "lookup " helper.
 */
export function computeTemplateInsertion(
  path: string,
  scalar: boolean,
  accepts: "scalar" | "any",
  hasExistingJson: boolean,
  hasExistingLookup = false,
): string {
  if (hasExistingLookup) {
    // In lookup argument position, always insert plain path without json helper
    return `lookup ${path}`;
  }
  if (hasExistingJson) {
    // Keep existing json helper, do not add a second one
    return `json ${path}`;
  }
  if (!scalar && accepts === "any") {
    // Non-scalar in an "any" field inserts json helper
    return `json ${path}`;
  }
  // Scalar, or scalar-only field
  return path;
}

/**
 * Inserts a chosen template path at the current cursor position,
 * cleanly replacing the unclosed "{{" and partial path.
 */
export function insertTemplatePathAtCursor(
  fullText: string,
  path: string,
  cursorPos?: number | null,
  options?: {
    scalar?: boolean;
    accepts?: "scalar" | "any";
  },
): string {
  const currentCursor =
    cursorPos !== null &&
    cursorPos !== undefined &&
    cursorPos <= fullText.length
      ? cursorPos
      : fullText.length;
  const beforeCursor = fullText.slice(0, currentCursor);
  const afterCursor = fullText.slice(currentCursor);

  const lastOpen = beforeCursor.lastIndexOf("{{");
  const hasExistingJson = hasJsonHelperBeforeCursor(beforeCursor);
  const hasExistingLookup = hasLookupHelperBeforeCursor(beforeCursor);
  const accepts = options?.accepts ?? "any";
  const scalar = options?.scalar ?? true;

  const inner = computeTemplateInsertion(
    path,
    scalar,
    accepts,
    hasExistingJson,
    hasExistingLookup,
  );

  if (lastOpen === -1) {
    const inserted = `{{${inner}}}`;
    return fullText ? `${fullText} ${inserted}` : inserted;
  }

  const prefix = fullText.slice(0, lastOpen);
  let suffix = afterCursor;
  if (suffix.startsWith("}}")) {
    suffix = suffix.slice(2);
  } else if (suffix.startsWith("}")) {
    suffix = suffix.slice(1);
  }

  return `${prefix}{{${inner}}}${suffix}`;
}

export function FieldDiagnostics({
  nodeId,
  field,
  value,
  accepts: propAccepts,
  cursorIndex,
  onQuickFix,
  onApplyQuickFix = onQuickFix,
  onSelectPath,
  className,
}: FieldDiagnosticsProps) {
  const { diagnostics } = useNodeDiagnostics(nodeId);
  const availablePaths = useAvailablePaths(nodeId);
  const nodes = useNodes();

  // Resolve accepts ("scalar" | "any") from prop or node signature
  const resolvedAccepts: "scalar" | "any" = useMemo(() => {
    if (propAccepts) return propAccepts;
    if (!nodeId) return "any";
    const currentNode = nodes.find((n) => n.id === nodeId);
    if (!currentNode?.type) return "any";
    const signature = getSignature(currentNode.type);
    const inputDef = signature
      ?.inputs(currentNode.data || {})
      .find((i) => i.field === field);
    return inputDef?.accepts ?? "any";
  }, [propAccepts, nodeId, nodes, field]);

  // Track cursor position in active input/textarea via standard selectionchange
  const [internalCursorPos, setInternalCursorPos] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const handleSelection = () => {
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        setInternalCursorPos(el.selectionStart);
      }
    };
    document.addEventListener("selectionchange", handleSelection);
    return () => {
      document.removeEventListener("selectionchange", handleSelection);
    };
  }, []);

  const activeCursor =
    cursorIndex !== undefined ? cursorIndex : internalCursorPos;

  const textBeforeCursor = useMemo(() => {
    const str = value ?? "";
    if (
      activeCursor !== null &&
      activeCursor >= 0 &&
      activeCursor <= str.length
    ) {
      return str.slice(0, activeCursor);
    }
    return str;
  }, [value, activeCursor]);

  const fieldDiagnostics = useMemo(
    () => diagnostics.filter((d) => d.field === field),
    [diagnostics, field],
  );

  const unclosedPrefix = useMemo(
    () => getUnclosedTemplatePrefix(textBeforeCursor),
    [textBeforeCursor],
  );
  const isTypingPlaceholder = unclosedPrefix !== null;
  const typedPrefix = (unclosedPrefix ?? "").toLowerCase();
  const hasExistingJson = hasJsonHelperBeforeCursor(textBeforeCursor);
  const hasExistingLookup = hasLookupHelperBeforeCursor(textBeforeCursor);

  // Filter out E6 syntax errors for this field while typing in an unclosed placeholder so it does not flash
  const visibleDiagnostics = useMemo(() => {
    if (isTypingPlaceholder) {
      return fieldDiagnostics.filter((d) => d.code !== "E6");
    }
    return fieldDiagnostics;
  }, [fieldDiagnostics, isTypingPlaceholder]);

  // Autocomplete suggestions scored and ordered
  const scoredSuggestions = useMemo(() => {
    if (!isTypingPlaceholder || availablePaths.length === 0) return [];

    return availablePaths
      .map((info) => ({
        info,
        score: matchScore(typedPrefix, info.path),
      }))
      .filter((item) => item.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.info.path.localeCompare(b.info.path),
      )
      .slice(0, 10)
      .map((item) => item.info);
  }, [isTypingPlaceholder, availablePaths, typedPrefix]);

  if (visibleDiagnostics.length === 0 && scoredSuggestions.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-col gap-1.5 mt-1.5", className)}>
      {scoredSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-muted/60 border rounded-md text-xs shadow-sm">
          <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
            <Sparkles className="size-2.5 text-primary" /> Suggestions:
          </span>
          {scoredSuggestions.map((item) => {
            const isScalarOnlyField = resolvedAccepts === "scalar";
            // If inside lookup helper, object/array is expected as first argument, so do NOT disable
            const isDisabled =
              !hasExistingLookup && isScalarOnlyField && !item.scalar;
            const insertText = computeTemplateInsertion(
              item.path,
              item.scalar,
              resolvedAccepts,
              hasExistingJson,
              hasExistingLookup,
            );

            return (
              <button
                key={item.path}
                type="button"
                disabled={isDisabled}
                title={isDisabled ? "needs a single value" : undefined}
                onMouseDown={(e) => {
                  // Prevent button from stealing focus from the input/textarea
                  e.preventDefault();
                }}
                onClick={() => {
                  if (isDisabled) return;
                  const newText = insertTemplatePathAtCursor(
                    value || "",
                    item.path,
                    activeCursor,
                    { scalar: item.scalar, accepts: resolvedAccepts },
                  );
                  if (onSelectPath) {
                    onSelectPath(newText);
                  } else if (onApplyQuickFix) {
                    onApplyQuickFix(newText);
                  }
                }}
                className={cn(
                  "inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono border rounded transition-colors",
                  isDisabled
                    ? "opacity-50 cursor-not-allowed bg-muted/40 text-muted-foreground border-border"
                    : "bg-background text-foreground border-input hover:bg-accent cursor-pointer",
                )}
              >
                <span>{`{{${insertText}}}`}</span>
                {!item.scalar && (
                  <span className="ml-1 text-[9px] px-1 py-0.2 rounded bg-muted-foreground/15 text-muted-foreground font-sans uppercase font-medium">
                    {item.kind === "arr" ? "array" : "object"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {visibleDiagnostics.map((diag) => {
        const isError = diag.severity === "error";
        const isWarning = diag.severity === "warning";
        const isInfo = diag.severity === "info";

        return (
          <div
            key={`${diag.code}-${diag.line ?? 0}-${diag.col ?? 0}-${diag.message}`}
            className={cn(
              "flex flex-col gap-1 text-xs rounded-md p-1.5 border",
              isError &&
                "bg-destructive/10 text-destructive border-destructive/20",
              isWarning &&
                "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
              isInfo && "bg-muted text-muted-foreground border-border",
            )}
          >
            <div className="flex items-start gap-1.5">
              {isError && <AlertCircle className="size-3.5 mt-0.5 shrink-0" />}
              {isWarning && (
                <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
              )}
              {isInfo && <Info className="size-3.5 mt-0.5 shrink-0" />}
              <span className="leading-snug">{diag.message}</span>
            </div>

            {diag.code === "E1" && diag.suggestions?.[0] && onApplyQuickFix && (
              <div className="flex items-center gap-1.5 mt-0.5 ml-5">
                <button
                  type="button"
                  onClick={() => onApplyQuickFix(diag.suggestions?.[0] ?? "")}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-background text-foreground border border-input rounded hover:bg-accent transition-colors"
                >
                  <Sparkles className="size-2.5 text-primary" />
                  Did you mean <strong>{diag.suggestions[0]}</strong>?
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function applyVariableQuickFix(
  text: string | undefined,
  suggestion: string,
  targetVar?: string,
): string {
  if (!text) return `{{${suggestion}}}`;
  if (targetVar) {
    return text.replace(
      new RegExp(`\\{\\{\\s*${targetVar}`, "g"),
      `{{${suggestion}`,
    );
  }
  return text.replace(/\{\{\s*([a-zA-Z0-9_$]+)/, `{{${suggestion}`);
}

export function insertTemplatePath(currentText: string, path: string): string {
  return insertTemplatePathAtCursor(currentText, path, null);
}
