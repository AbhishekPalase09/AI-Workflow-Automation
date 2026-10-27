// Pure static data-flow analyzer for Flowcheck (Phase 2.5)
// Non-Negotiable Rule 4: Zero external imports except local/handlebars.

import {
  enumeratePaths,
  isScalar,
  join,
  lookup,
  type PathInfo,
  S,
  type Schema,
} from "./schema";
import { getSignature } from "./signatures";
import { closest } from "./suggest";
import { extractPlaceholders } from "./template";

export interface FlowNode {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface FlowEdge {
  source: string;
  target: string;
}

export type DiagnosticCode =
  | "E1"
  | "E2"
  | "E3"
  | "E4"
  | "E5"
  | "E6"
  | "W1"
  | "W2"
  | "W3";

export interface Diagnostic {
  code: DiagnosticCode;
  severity: "error" | "warning" | "info";
  nodeId: string;
  field?: string;
  message: string;
  line?: number;
  col?: number;
  endCol?: number;
  suggestions?: string[];
}

/**
 * Perform Kahn's topological sort on directed graph.
 * Returns sorted node IDs, or null if cycle is detected.
 */
function kahnToposort(
  nodeIds: string[],
  preds: Map<string, Set<string>>,
  succs: Map<string, Set<string>>,
): string[] | null {
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) {
    inDegree.set(id, preds.get(id)?.size ?? 0);
  }

  const queue: string[] = [];
  for (const id of nodeIds) {
    if ((inDegree.get(id) ?? 0) === 0) {
      queue.push(id);
    }
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    sorted.push(current);

    const neighbors = succs.get(current) ?? new Set();
    for (const next of neighbors) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) {
        queue.push(next);
      }
    }
  }

  if (sorted.length !== nodeIds.length) {
    return null; // Cycle detected
  }

  return sorted;
}

/**
 * Precompute transitive closure (all downstream nodes reachable from each node).
 */
function computeReachability(
  nodeIds: string[],
  succs: Map<string, Set<string>>,
): Map<string, Set<string>> {
  const reach = new Map<string, Set<string>>();

  for (const id of nodeIds) {
    const reachable = new Set<string>();
    const queue = Array.from(succs.get(id) ?? []);
    for (const q of queue) reachable.add(q);

    while (queue.length > 0) {
      const curr = queue.shift();
      if (!curr) break;
      const neighbors = succs.get(curr) ?? new Set();
      for (const n of neighbors) {
        if (!reachable.has(n)) {
          reachable.add(n);
          queue.push(n);
        }
      }
    }
    reach.set(id, reachable);
  }

  return reach;
}

export interface AnalyzeOptions {
  branchSensitive?: boolean;
}

/**
 * Internal computation of must and may variable scopes for all reachable nodes.
 */
function computeScopes(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options?: AnalyzeOptions,
): {
  sortedNodes: FlowNode[];
  mustScopes: Map<string, Map<string, Schema>>;
  mayScopes: Map<string, Map<string, Schema>>;
  reachableNodeIds: Set<string>;
  hasCycle: boolean;
} {
  const nodeMap = new Map<string, FlowNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // 1. Drop edges referencing missing nodes & build preds/succs
  const validEdges = edges.filter(
    (e) => nodeMap.has(e.source) && nodeMap.has(e.target),
  );

  const preds = new Map<string, Set<string>>();
  const succs = new Map<string, Set<string>>();
  for (const id of nodeMap.keys()) {
    preds.set(id, new Set());
    succs.set(id, new Set());
  }

  for (const e of validEdges) {
    succs.get(e.source)?.add(e.target);
    preds.get(e.target)?.add(e.source);
  }

  // 2. Kahn topological sort
  const allNodeIds = Array.from(nodeMap.keys());
  const sortedIds = kahnToposort(allNodeIds, preds, succs);
  if (!sortedIds) {
    return {
      sortedNodes: [],
      mustScopes: new Map(),
      mayScopes: new Map(),
      reachableNodeIds: new Set(),
      hasCycle: true,
    };
  }

  // 3. Identify triggers and restrict to reachable nodes
  const triggerNodes = nodes.filter((n) => {
    const sig = getSignature(n.type);
    return sig?.isTrigger ?? false;
  });

  const reachableNodeIds = new Set<string>();
  const queue: string[] = [];

  for (const t of triggerNodes) {
    reachableNodeIds.add(t.id);
    queue.push(t.id);
  }

  // If no triggers are present, treat all root nodes (inDegree === 0) as entry points
  if (triggerNodes.length === 0) {
    for (const id of allNodeIds) {
      if ((preds.get(id)?.size ?? 0) === 0) {
        reachableNodeIds.add(id);
        queue.push(id);
      }
    }
  }

  while (queue.length > 0) {
    const currId = queue.shift();
    if (!currId) break;
    const nextIds = succs.get(currId) ?? new Set();
    for (const nextId of nextIds) {
      if (!reachableNodeIds.has(nextId)) {
        reachableNodeIds.add(nextId);
        queue.push(nextId);
      }
    }
  }

  // Filter sorted nodes to reachable only
  const sortedReachableIds = sortedIds.filter((id) => reachableNodeIds.has(id));
  const sortedNodes = sortedReachableIds
    .map((id) => nodeMap.get(id))
    .filter((n): n is FlowNode => Boolean(n));

  const mustScopes = new Map<string, Map<string, Schema>>();
  const mayScopes = new Map<string, Map<string, Schema>>();

  for (const node of sortedNodes) {
    // Collect active predecessors that are reachable
    const nodePreds = Array.from(preds.get(node.id) ?? []).filter((p) =>
      reachableNodeIds.has(p),
    );

    const must = new Map<string, Schema>();
    const may = new Map<string, Schema>();

    if (nodePreds.length > 0) {
      // Build output map of each predecessor p: (must(p) ∪ {var(p) -> out(p)})
      const predMustOutputs: Array<Map<string, Schema>> = [];
      const predMayOutputs: Array<Map<string, Schema>> = [];

      for (const pId of nodePreds) {
        const pNode = nodeMap.get(pId);
        const pSig = pNode ? getSignature(pNode.type) : undefined;
        const pVar = pNode && pSig ? pSig.variableName(pNode.data) : undefined;
        const pOut = pNode && pSig ? pSig.output(pNode.data) : S.unknown;

        const pMust = new Map(mustScopes.get(pId) ?? new Map());
        const pMay = new Map(mayScopes.get(pId) ?? new Map());

        if (pVar) {
          pMust.set(pVar, pOut);
          pMay.set(pVar, pOut);
        }

        predMustOutputs.push(pMust);
        predMayOutputs.push(pMay);
      }

      if (options?.branchSensitive) {
        // Ablation: Intersection across predecessors
        // A variable is in must iff it is present in ALL predecessors
        const allVarsInPreds = new Set<string>();
        for (const pMap of predMustOutputs) {
          for (const k of pMap.keys()) allVarsInPreds.add(k);
        }

        for (const v of allVarsInPreds) {
          const inAll = predMustOutputs.every((pMap) => pMap.has(v));
          if (inAll) {
            // Join schemas from each branch
            const branchSchemas: Schema[] = [];
            for (const pMap of predMustOutputs) {
              const s = pMap.get(v);
              if (s) branchSchemas.push(s);
            }
            const joined = branchSchemas.reduce(
              (acc, curr) => join(acc, curr),
              S.never,
            );
            must.set(v, joined);
          }
        }
      } else {
        // Nodebase Engine Default: Union across all predecessors (all reachable ancestors guaranteed executed)
        for (const pMap of predMustOutputs) {
          for (const [v, schema] of pMap.entries()) {
            const existing = must.get(v);
            if (existing) {
              must.set(v, join(existing, schema));
            } else {
              must.set(v, schema);
            }
          }
        }
      }

      // Compute may(node): union across all predecessors
      for (const pMap of predMayOutputs) {
        for (const [v, schema] of pMap.entries()) {
          const existing = may.get(v);
          if (existing) {
            may.set(v, join(existing, schema));
          } else {
            may.set(v, schema);
          }
        }
      }
    }

    mustScopes.set(node.id, must);
    mayScopes.set(node.id, may);
  }

  return {
    sortedNodes,
    mustScopes,
    mayScopes,
    reachableNodeIds,
    hasCycle: false,
  };
}

/**
 * Compute the visible variable schema map at a given node.
 */
export function scopeAt(
  nodes: FlowNode[],
  edges: FlowEdge[],
  nodeId: string,
  options?: AnalyzeOptions,
): Map<string, Schema> {
  const { mayScopes } = computeScopes(nodes, edges, options);
  return mayScopes.get(nodeId) ?? new Map();
}

/**
 * Compute all available paths visible at a given node for autocomplete.
 */
export function availablePathsAt(
  nodes: FlowNode[],
  edges: FlowEdge[],
  nodeId: string,
  options?: AnalyzeOptions,
): PathInfo[] {
  const scope = scopeAt(nodes, edges, nodeId, options);
  const paths: PathInfo[] = [];
  const seen = new Set<string>();
  for (const [varName, schema] of scope.entries()) {
    for (const info of enumeratePaths(schema, varName)) {
      if (!seen.has(info.path)) {
        seen.add(info.path);
        paths.push(info);
      }
    }
  }
  return paths;
}

/**
 * Validate a workflow graph for execution.
 * Returns { ok: boolean, errors: string[] }.
 */
export function validateWorkflowGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options?: AnalyzeOptions,
): { ok: boolean; errors: string[] } {
  const diagnostics = analyze(nodes, edges, options);
  const errors = diagnostics
    .filter((d) => d.severity === "error")
    .map((d) => `${d.nodeId}: ${d.message}`);

  return {
    ok: errors.length === 0,
    errors,
  };
}

/**
 * Primary static data-flow analysis algorithm.
 * Guarantees zero unhandled exceptions (never throws).
 */
export function analyze(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options?: AnalyzeOptions,
): Diagnostic[] {
  try {
    const { sortedNodes, mustScopes, mayScopes, reachableNodeIds, hasCycle } =
      computeScopes(nodes, edges, options);

    if (hasCycle) {
      return [
        {
          code: "E5",
          severity: "error",
          nodeId: "root",
          message: "Workflow contains a cycle",
        },
      ];
    }

    const diagnostics: Diagnostic[] = [];

    // Check E4: Duplicate variable names across reachable nodes with common descendants
    const validEdges = edges.filter(
      (e) => reachableNodeIds.has(e.source) && reachableNodeIds.has(e.target),
    );
    const succs = new Map<string, Set<string>>();
    for (const n of sortedNodes) succs.set(n.id, new Set());
    for (const e of validEdges) succs.get(e.source)?.add(e.target);

    const reachability = computeReachability(
      sortedNodes.map((n) => n.id),
      succs,
    );

    const varToNodes = new Map<string, FlowNode[]>();
    for (const node of sortedNodes) {
      const sig = getSignature(node.type);
      const varName = sig ? sig.variableName(node.data) : undefined;
      if (varName) {
        const list = varToNodes.get(varName) ?? [];
        list.push(node);
        varToNodes.set(varName, list);
      }
    }

    const e4Reported = new Set<string>();

    for (const [varName, nodeGroup] of varToNodes.entries()) {
      if (nodeGroup.length < 2) continue;

      for (let i = 0; i < nodeGroup.length; i++) {
        for (let j = i + 1; j < nodeGroup.length; j++) {
          const a = nodeGroup[i];
          const b = nodeGroup[j];

          const aReachesB = reachability.get(a.id)?.has(b.id) ?? false;
          const bReachesA = reachability.get(b.id)?.has(a.id) ?? false;

          let hasCommonDescendant = false;
          const aReach = reachability.get(a.id) ?? new Set();
          const bReach = reachability.get(b.id) ?? new Set();
          for (const d of aReach) {
            if (bReach.has(d)) {
              hasCommonDescendant = true;
              break;
            }
          }

          if (aReachesB || bReachesA || hasCommonDescendant) {
            if (!e4Reported.has(b.id)) {
              e4Reported.add(b.id);
              diagnostics.push({
                code: "E4",
                severity: "error",
                nodeId: b.id,
                message: `Duplicate variable name "${varName}" conflicts with another node in the workflow.`,
              });
            }
          }
        }
      }
    }

    // Process template input fields for each sorted node
    for (const node of sortedNodes) {
      try {
        const sig = getSignature(node.type);
        if (!sig) continue; // Unknown node type -> zero errors

        const must = mustScopes.get(node.id) ?? new Map();
        const may = mayScopes.get(node.id) ?? new Map();
        const inputs = sig.inputs(node.data);

        for (const input of inputs) {
          if (!input.template) continue;

          const { placeholders, parseError, errorLine, errorCol } =
            extractPlaceholders(input.template);
          if (parseError) {
            diagnostics.push({
              code: "E6",
              severity: "error",
              nodeId: node.id,
              field: input.field,
              line: errorLine,
              col: errorCol,
              message: parseError,
            });
            continue;
          }

          for (const p of placeholders) {
            const root = p.root;
            const inMust = must.has(root);
            const inMay = may.has(root);

            if (!inMust && !inMay) {
              // E1: Root variable not found in ancestor outputs
              const candidateKeys = Array.from(may.keys());
              const suggestions = closest(root, candidateKeys);
              diagnostics.push({
                code: "E1",
                severity: "error",
                nodeId: node.id,
                field: input.field,
                line: p.line,
                col: p.col,
                endCol: p.endCol,
                suggestions,
                message: `Unknown variable "${root}".${
                  suggestions.length > 0
                    ? ` Did you mean "${suggestions[0]}"?`
                    : ""
                }`,
              });
              continue;
            }

            // Root exists in may (or must)
            if (!inMust && inMay) {
              // W1: Root is only present on some branches
              diagnostics.push({
                code: "W1",
                severity: "warning",
                nodeId: node.id,
                field: input.field,
                line: p.line,
                col: p.col,
                endCol: p.endCol,
                message: `Variable "${root}" may be undefined on some execution paths.`,
              });
            }

            // Path lookup
            const rootSchema = must.get(root) ?? may.get(root);
            if (!rootSchema) continue;
            const lookupRes = lookup(rootSchema, p.path);

            if (lookupRes.status === "missing") {
              const failingKey =
                lookupRes.failedAt || p.path[p.path.length - 1];
              diagnostics.push({
                code: "E2",
                severity: "error",
                nodeId: node.id,
                field: input.field,
                line: p.line,
                col: p.col,
                endCol: p.endCol,
                message: `Property "${failingKey}" does not exist on "${root}${
                  p.path.length > 1
                    ? `.${p.path.slice(0, p.path.indexOf(failingKey)).join(".")}`
                    : ""
                }".`,
              });
              continue;
            }

            if (lookupRes.status === "maybe") {
              const failingKey =
                lookupRes.failedAt || p.path[p.path.length - 1];
              diagnostics.push({
                code: "W1",
                severity: "warning",
                nodeId: node.id,
                field: input.field,
                line: p.line,
                col: p.col,
                endCol: p.endCol,
                message: `Property "${failingKey}" may be undefined at runtime.`,
              });
            } else if (lookupRes.status === "unchecked") {
              diagnostics.push({
                code: "W2",
                severity: "info",
                nodeId: node.id,
                field: input.field,
                line: p.line,
                col: p.col,
                endCol: p.endCol,
                message: `Property "${p.path.join(
                  ".",
                )}" on dynamic object cannot be verified at design time.`,
              });
            }

            // Type check: Non-scalar resolution in template placeholder
            const isJsonHelper = p.helper === "json";
            if (!isJsonHelper && !isScalar(lookupRes.schema)) {
              if (input.accepts === "scalar") {
                diagnostics.push({
                  code: "E3",
                  severity: "error",
                  nodeId: node.id,
                  field: input.field,
                  line: p.line,
                  col: p.col,
                  endCol: p.endCol,
                  message: `Field "${input.field}" expects a scalar value, but "${root}${
                    p.path.length > 0 ? `.${p.path.join(".")}` : ""
                  }" resolves to an object or array.`,
                });
              } else {
                diagnostics.push({
                  code: "W3",
                  severity: "warning",
                  nodeId: node.id,
                  field: input.field,
                  line: p.line,
                  col: p.col,
                  endCol: p.endCol,
                  message: `Expression "${root}${
                    p.path.length > 0 ? `.${p.path.join(".")}` : ""
                  }" resolves to an object or array; use {{json ...}} to serialize it.`,
                });
              }
            }
          }
        }
      } catch {}
    }

    return diagnostics;
  } catch {
    // Top-level fallback: never throw
    return [];
  }
}
