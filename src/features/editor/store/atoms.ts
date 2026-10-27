import type { ReactFlowInstance } from "@xyflow/react";
import { atom } from "jotai";
import type { Diagnostic, PathInfo } from "@/features/flowcheck";

export const editorAtom = atom<ReactFlowInstance | null>(null);

export interface DiagnosticsState {
  all: Diagnostic[];
  byNode: Map<string, Diagnostic[]>;
  availablePathsByNode: Map<string, PathInfo[]>;
  errorCount: number;
  warningCount: number;
}

export const diagnosticsAtom = atom<DiagnosticsState>({
  all: [],
  byNode: new Map(),
  availablePathsByNode: new Map(),
  errorCount: 0,
  warningCount: 0,
});

export interface DraftNodeState {
  nodeId: string;
  data: Record<string, unknown>;
}

export const draftNodeAtom = atom<DraftNodeState | null>(null);
