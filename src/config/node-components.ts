import { InitialNode } from "@/components/inital-node";
import { NodeType } from "@/generated/prisma";
import type { NodeTypes } from "@xyflow/react";


export const NodeComponents = {
  [NodeType.INITIAL] :InitialNode,
} as const satisfies NodeTypes;

export type RegisteredNodeType = keyof typeof NodeComponents;