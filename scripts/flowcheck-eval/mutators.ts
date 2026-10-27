import type { EvalWorkflow } from "./corpus";

export type FaultClass =
  | "typo"
  | "nonAncestor"
  | "unknownField"
  | "deletedVariable"
  | "typeMisuse"
  | "duplicateName"
  | "syntax";

export interface Mutant {
  workflowId: string;
  name: string;
  faultClass: FaultClass;
  description: string;
  workflow: EvalWorkflow;
}

function cloneWorkflow(wf: EvalWorkflow): EvalWorkflow {
  return {
    ...wf,
    nodes: wf.nodes.map((n) => ({
      ...n,
      data: JSON.parse(JSON.stringify(n.data)),
    })),
    edges: wf.edges.map((e) => ({ ...e })),
    triggerPayload: wf.triggerPayload
      ? JSON.parse(JSON.stringify(wf.triggerPayload))
      : undefined,
    sampleHttpData: wf.sampleHttpData
      ? JSON.parse(JSON.stringify(wf.sampleHttpData))
      : undefined,
  };
}

/**
 * 1. TYPO: Mutate one character of a root variable in a template string.
 */
export function mutateTypo(wf: EvalWorkflow): Mutant | null {
  const mutantWf = cloneWorkflow(wf);

  for (const node of mutantWf.nodes) {
    for (const [key, val] of Object.entries(node.data)) {
      if (typeof val === "string" && val.includes("{{")) {
        const match = val.match(/\{\{([a-zA-Z0-9_$]+)/);
        if (match?.[1]) {
          const originalVar = match[1];
          const typoVar = `${originalVar}x`;
          node.data[key] = val.replace(`{{${originalVar}`, `{{${typoVar}`);
          return {
            workflowId: wf.id,
            name: `${wf.name} (Typo in ${node.id}.${key})`,
            faultClass: "typo",
            description: `Replaced variable "${originalVar}" with typo "${typoVar}" in node "${node.id}" field "${key}"`,
            workflow: mutantWf,
          };
        }
      }
    }
  }
  return null;
}

/**
 * 2. NON-ANCESTOR: Downstream/sibling node references a variable that has not run yet.
 */
export function mutateNonAncestor(wf: EvalWorkflow): Mutant | null {
  const mutantWf = cloneWorkflow(wf);
  if (mutantWf.nodes.length < 3) return null;

  // Find a variable from a late node
  const lastNode = mutantWf.nodes[mutantWf.nodes.length - 1];
  const lastVar =
    typeof lastNode.data.variableName === "string"
      ? lastNode.data.variableName
      : undefined;
  if (!lastVar) return null;

  // Insert reference to lastVar into the first non-trigger node
  const earlyNode = mutantWf.nodes[1];
  for (const [key, val] of Object.entries(earlyNode.data)) {
    if (typeof val === "string") {
      earlyNode.data[key] = `{{${lastVar}.text || ${lastVar}.status}} - ${val}`;
      return {
        workflowId: wf.id,
        name: `${wf.name} (Non-ancestor ref in ${earlyNode.id})`,
        faultClass: "nonAncestor",
        description: `Early node "${earlyNode.id}" references future variable "${lastVar}" from downstream node "${lastNode.id}"`,
        workflow: mutantWf,
      };
    }
  }
  return null;
}

/**
 * 3. UNKNOWN FIELD: Reference a non-existent property on a closed schema.
 */
export function mutateUnknownField(wf: EvalWorkflow): Mutant | null {
  const mutantWf = cloneWorkflow(wf);

  for (const node of mutantWf.nodes) {
    for (const [key, val] of Object.entries(node.data)) {
      if (typeof val === "string" && val.includes("httpResponse.data.")) {
        // Mutate a known property access to a non-existent property
        node.data[key] = val.replace(
          "httpResponse.data.name",
          "httpResponse.data.nonExistentField",
        );
        return {
          workflowId: wf.id,
          name: `${wf.name} (Unknown field in ${node.id}.${key})`,
          faultClass: "unknownField",
          description: `Referenced nonexistent property "nonExistentField" on closed schema in node "${node.id}"`,
          workflow: mutantWf,
        };
      }
    }
  }
  return null;
}

/**
 * 4. DELETED VARIABLE: Remove or rename variableName from an upstream producer.
 */
export function mutateDeletedVariable(wf: EvalWorkflow): Mutant | null {
  const mutantWf = cloneWorkflow(wf);

  // Find an upstream producer that has a variableName
  for (const node of mutantWf.nodes) {
    if (
      typeof node.data.variableName === "string" &&
      node.data.variableName.length > 0
    ) {
      const oldVar = node.data.variableName;
      node.data.variableName = "renamedUnusedVar";
      return {
        workflowId: wf.id,
        name: `${wf.name} (Renamed producer ${node.id})`,
        faultClass: "deletedVariable",
        description: `Renamed variableName "${oldVar}" to "renamedUnusedVar" on node "${node.id}" leaving downstream consumers dangling`,
        workflow: mutantWf,
      };
    }
  }
  return null;
}

/**
 * 5. TYPE MISUSE: Insert an object-valued reference into a scalar-only field.
 */
export function mutateTypeMisuse(wf: EvalWorkflow): Mutant | null {
  const mutantWf = cloneWorkflow(wf);

  // Find an HTTP_REQUEST or EMAIL node with scalar fields (endpoint, to, from, subject)
  for (const node of mutantWf.nodes) {
    if (
      node.type === "HTTP_REQUEST" &&
      typeof node.data.endpoint === "string"
    ) {
      // Find an upstream variable that produces an object (e.g. googleForm or userApi.httpResponse)
      node.data.endpoint = "{{googleForm}}";
      return {
        workflowId: wf.id,
        name: `${wf.name} (Type misuse in ${node.id}.endpoint)`,
        faultClass: "typeMisuse",
        description: `Object reference {{googleForm}} passed into scalar-only URL field in node "${node.id}"`,
        workflow: mutantWf,
      };
    }
    if (node.type === "EMAIL" && typeof node.data.to === "string") {
      node.data.to = "{{googleForm}}";
      return {
        workflowId: wf.id,
        name: `${wf.name} (Type misuse in ${node.id}.to)`,
        faultClass: "typeMisuse",
        description: `Object reference {{googleForm}} passed into scalar recipient field in node "${node.id}"`,
        workflow: mutantWf,
      };
    }
  }
  return null;
}

/**
 * 6. DUPLICATE NAME: Assign duplicate variableName to two nodes reaching a common descendant.
 */
export function mutateDuplicateName(wf: EvalWorkflow): Mutant | null {
  const mutantWf = cloneWorkflow(wf);

  // Find two nodes that have variableNames
  const namedNodes = mutantWf.nodes.filter(
    (n) =>
      typeof n.data.variableName === "string" && n.data.variableName.length > 0,
  );
  if (namedNodes.length >= 2) {
    const targetName = namedNodes[0].data.variableName as string;
    namedNodes[1].data.variableName = targetName;
    return {
      workflowId: wf.id,
      name: `${wf.name} (Duplicate variableName "${targetName}")`,
      faultClass: "duplicateName",
      description: `Both nodes "${namedNodes[0].id}" and "${namedNodes[1].id}" share duplicate variableName "${targetName}"`,
      workflow: mutantWf,
    };
  }
  return null;
}

/**
 * 7. SYNTAX: Inject a template syntax error (unclosed brace or trailing dot).
 */
export function mutateSyntax(wf: EvalWorkflow): Mutant | null {
  const mutantWf = cloneWorkflow(wf);

  for (const node of mutantWf.nodes) {
    for (const [key, val] of Object.entries(node.data)) {
      if (typeof val === "string" && val.includes("{{")) {
        // Alternate between trailing dot and unclosed brace
        const useTrailingDot = wf.id.charCodeAt(0) % 2 === 0;

        if (useTrailingDot) {
          const match = val.match(/\{\{([a-zA-Z0-9_$.]+)\}\}/);
          if (match?.[1]) {
            const originalExpr = match[1];
            const dottedExpr = `${originalExpr}.`;
            node.data[key] = val.replace(
              `{{${originalExpr}}}`,
              `{{${dottedExpr}}}`,
            );
            return {
              workflowId: wf.id,
              name: `${wf.name} (Trailing dot in ${node.id}.${key})`,
              faultClass: "syntax",
              description: `Injected trailing dot into expression "{{${dottedExpr}}}" in node "${node.id}" field "${key}"`,
              workflow: mutantWf,
            };
          }
        } else {
          const match = val.match(/\{\{([a-zA-Z0-9_$.]+)\}\}/);
          if (match?.[1]) {
            const originalExpr = match[1];
            node.data[key] = val.replace(
              `{{${originalExpr}}}`,
              `{{${originalExpr}`,
            );
            return {
              workflowId: wf.id,
              name: `${wf.name} (Unclosed brace in ${node.id}.${key})`,
              faultClass: "syntax",
              description: `Removed closing braces in "{{${originalExpr}" in node "${node.id}" field "${key}"`,
              workflow: mutantWf,
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Generate full mutant suite across all fault classes for a given workflow.
 */
export function generateMutants(wf: EvalWorkflow): Mutant[] {
  const mutators = [
    mutateTypo,
    mutateNonAncestor,
    mutateUnknownField,
    mutateDeletedVariable,
    mutateTypeMisuse,
    mutateDuplicateName,
    mutateSyntax,
  ];

  const mutants: Mutant[] = [];
  for (const fn of mutators) {
    const m = fn(wf);
    if (m) mutants.push(m);
  }
  return mutants;
}
