import Handlebars from "handlebars";
import { getSignature } from "../../src/features/flowcheck";
import type { EvalWorkflow } from "./corpus";

export interface OracleResult {
  success: boolean;
  error?: string;
  failedNodeId?: string;
  failedField?: string;
}

// Register the standard "json" helper matching runtime
Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  return new Handlebars.SafeString(jsonString);
});

/**
 * Topological sort helper for the oracle
 */
function toposort(
  nodes: EvalWorkflow["nodes"],
  edges: EvalWorkflow["edges"],
): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }

  for (const e of edges) {
    if (inDegree.has(e.target)) {
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
    if (adj.has(e.source)) {
      adj.get(e.source)?.push(e.target);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift();
    if (!curr) break;
    order.push(curr);
    for (const next of adj.get(curr) ?? []) {
      const d = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  return order;
}

/**
 * Execute the workflow templates in topological order against synthetic concrete data.
 */
export function runOracle(wf: EvalWorkflow): OracleResult {
  try {
    const order = toposort(wf.nodes, wf.edges);
    const nodeMap = new Map(wf.nodes.map((n) => [n.id, n]));

    // Initialize context with sample trigger payloads
    const context: Record<string, unknown> = {
      ...(wf.triggerPayload || {}),
    };

    for (const nodeId of order) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const sig = getSignature(node.type);

      // 1. Evaluate template fields in strict Handlebars mode
      if (sig) {
        const inputs = sig.inputs(node.data);
        for (const input of inputs) {
          const tplString = input.template;
          if (typeof tplString === "string" && tplString.includes("{{")) {
            try {
              const compiled = Handlebars.compile(tplString, { strict: true });
              const rendered = compiled(context);

              // Check if unescaped/un-helper object resolved to [object Object]
              if (
                typeof rendered === "string" &&
                rendered.includes("[object Object]")
              ) {
                return {
                  success: false,
                  error: `Template in node "${node.id}" field "${input.field}" rendered unformatted object: "${rendered}"`,
                  failedNodeId: node.id,
                  failedField: input.field,
                };
              }

              // Check if scalar-required field contains an object
              if (input.accepts === "scalar" && typeof rendered === "string") {
                if (
                  rendered.includes("[object Object]") ||
                  rendered.startsWith("{") ||
                  rendered.startsWith("[")
                ) {
                  return {
                    success: false,
                    error: `Field "${input.field}" expects a scalar but received object: "${rendered}"`,
                    failedNodeId: node.id,
                    failedField: input.field,
                  };
                }
              }
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return {
                success: false,
                error: `Handlebars runtime execution failed in node "${node.id}" field "${input.field}": ${msg}`,
                failedNodeId: node.id,
                failedField: input.field,
              };
            }
          }
        }
      }

      // 2. Produce synthetic concrete output for this node
      const varName = sig?.variableName(node.data);
      if (varName) {
        let concreteOutput: unknown;

        switch (node.type) {
          case "HTTP_REQUEST":
            concreteOutput = {
              httpResponse: {
                status: 200,
                statusText: "OK",
                data: wf.sampleHttpData || { id: 1, name: "Sample Item" },
              },
            };
            break;

          case "OPENAI":
          case "ANTHROPIC":
          case "GEMINI":
            concreteOutput = {
              text: "Synthesized AI response text",
            };
            break;

          case "DATABASE":
            concreteOutput = {
              rowCount: 3,
              rows: [
                { id: 1, name: "Row A" },
                { id: 2, name: "Row B" },
              ],
            };
            break;

          case "FILE_GENERATOR":
            concreteOutput = {
              filename: (node.data.filename as string) || "output.txt",
              size: 512,
              mimeType: "text/plain",
            };
            break;

          case "DISCORD":
          case "SLACK":
          case "EMAIL":
          case "TELEGRAM":
            concreteOutput = {
              success: true,
              id: "msg_12345",
            };
            break;

          default:
            concreteOutput = { success: true };
            break;
        }

        context[varName] = concreteOutput;
      }
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
