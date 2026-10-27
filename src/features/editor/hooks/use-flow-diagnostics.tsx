"use client";

import { useAtomValue, useSetAtom } from "jotai";
import {
  createContext,
  type ReactNode,
  useContext,
  useDeferredValue,
  useEffect,
  useMemo,
} from "react";
import {
  analyze,
  availablePathsAt,
  type Diagnostic,
  type FlowEdge,
  type FlowNode,
  type PathInfo,
} from "@/features/flowcheck";
import {
  type DiagnosticsState,
  diagnosticsAtom,
  draftNodeAtom,
} from "../store/atoms";

const FlowDiagnosticsContext = createContext<DiagnosticsState>({
  all: [],
  byNode: new Map(),
  availablePathsByNode: new Map(),
  errorCount: 0,
  warningCount: 0,
});

export const FlowDiagnosticsProvider = ({
  nodes,
  edges,
  children,
}: {
  nodes: Array<{ id: string; type?: string; data?: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string }>;
  children: ReactNode;
}) => {
  const setDiagnosticsAtom = useSetAtom(diagnosticsAtom);
  const draftNode = useAtomValue(draftNodeAtom);

  const flowNodes: FlowNode[] = useMemo(
    () =>
      nodes.map((n) => {
        const isDraft = draftNode && draftNode.nodeId === n.id;
        return {
          id: n.id,
          type: n.type || "INITIAL",
          data: isDraft
            ? {
                ...((n.data as Record<string, unknown>) || {}),
                ...draftNode.data,
              }
            : (n.data as Record<string, unknown>) || {},
        };
      }),
    [nodes, draftNode],
  );

  const flowEdges: FlowEdge[] = useMemo(
    () =>
      edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    [edges],
  );

  const deferredNodes = useDeferredValue(flowNodes);
  const deferredEdges = useDeferredValue(flowEdges);

  const diagnosticsState = useMemo<DiagnosticsState>(() => {
    const all = analyze(deferredNodes, deferredEdges);
    const byNode = new Map<string, Diagnostic[]>();
    const availablePathsByNode = new Map<string, PathInfo[]>();
    let errorCount = 0;
    let warningCount = 0;

    for (const d of all) {
      const list = byNode.get(d.nodeId) || [];
      list.push(d);
      byNode.set(d.nodeId, list);

      if (d.severity === "error") {
        errorCount++;
      } else if (d.severity === "warning") {
        warningCount++;
      }
    }

    for (const n of deferredNodes) {
      availablePathsByNode.set(
        n.id,
        availablePathsAt(deferredNodes, deferredEdges, n.id),
      );
    }

    return { all, byNode, availablePathsByNode, errorCount, warningCount };
  }, [deferredNodes, deferredEdges]);

  // Sync with global atom for EditorHeader and external consumers
  useEffect(() => {
    setDiagnosticsAtom(diagnosticsState);
  }, [diagnosticsState, setDiagnosticsAtom]);

  return (
    <FlowDiagnosticsContext.Provider value={diagnosticsState}>
      {children}
    </FlowDiagnosticsContext.Provider>
  );
};

export function useFlowDiagnostics(): DiagnosticsState {
  return useContext(FlowDiagnosticsContext);
}

export function useAvailablePaths(nodeId?: string): PathInfo[] {
  const { availablePathsByNode } = useFlowDiagnostics();
  return useMemo(
    () => (nodeId ? availablePathsByNode.get(nodeId) || [] : []),
    [availablePathsByNode, nodeId],
  );
}

export function useNodeDiagnostics(nodeId?: string): {
  diagnostics: Diagnostic[];
  errorCount: number;
  warningCount: number;
  hasErrors: boolean;
  hasWarnings: boolean;
} {
  const { byNode } = useFlowDiagnostics();
  const diagnostics = useMemo(
    () => (nodeId ? byNode.get(nodeId) || [] : []),
    [byNode, nodeId],
  );

  const errorCount = useMemo(
    () => diagnostics.filter((d) => d.severity === "error").length,
    [diagnostics],
  );

  const warningCount = useMemo(
    () => diagnostics.filter((d) => d.severity === "warning").length,
    [diagnostics],
  );

  return {
    diagnostics,
    errorCount,
    warningCount,
    hasErrors: errorCount > 0,
    hasWarnings: warningCount > 0,
  };
}

/**
 * Synchronize a dialog's live uncommitted form values with Flowcheck's global draft state.
 * Diagnostics update in real-time as the user types, before clicking "Save".
 */
export function useSyncDraftNode(
  nodeId: string | undefined,
  formData: Record<string, unknown> | undefined,
  isOpen: boolean,
) {
  const setDraft = useSetAtom(draftNodeAtom);

  useEffect(() => {
    if (isOpen && nodeId && formData) {
      setDraft({ nodeId, data: formData });
    } else {
      setDraft((curr) => (curr?.nodeId === nodeId ? null : curr));
    }
  }, [isOpen, nodeId, formData, setDraft]);

  useEffect(() => {
    return () => {
      setDraft((curr) => (curr?.nodeId === nodeId ? null : curr));
    };
  }, [nodeId, setDraft]);
}
