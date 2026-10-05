import { Connection, Node } from "@/generated/prisma";
import toposort from "toposort";
import { inngest } from "./client";

export const topologicalSort = (
  nodes: Node[],
  connections: Connection[],
): Node[] => {
  //If no connections, return node as-is (they're all independent)
  if (connections.length === 0) {
    return nodes;
  }

  //Create edges array for toposort
  const edges: [string, string][] = connections.map((conn) => [
    conn.fromNodeId,
    conn.toNodeId,
  ]);

  // Add nodes with no connections as self-edges to ensure they're included
  const connectedNodeIds = new Set<string>();
  for (const conn of connections) {
    connectedNodeIds.add(conn.fromNodeId);
    connectedNodeIds.add(conn.toNodeId);
  }

  for (const node of nodes) {
    if (!connectedNodeIds.has(node.id)) {
      edges.push([node.id, node.id]);
    }
  }


  // Perform topological sort
  let sortedNodeIds: string[];
  
  try {
    sortedNodeIds = toposort(edges);
    // Remove duplicates (from self-edges)
    sortedNodeIds = [...new Set(sortedNodeIds)];
  } catch (error) {
    if (error instanceof Error && error.message.includes("Cyclic")) {
      throw new Error("Workflow contains a cycle");
    }
    throw error;
  }
 

  // Map sorted IDs back to node objects
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return sortedNodeIds.map((id) => nodeMap.get(id)!).filter(Boolean);
};

export const getTriggerReachableNodes = (
  nodes: Node[],
  connections: Connection[],
  triggerType?: string,
  triggerNodeId?: string,
): Node[] => {
  let startNode: Node | undefined;

  if (triggerNodeId) {
    startNode = nodes.find((n) => n.id === triggerNodeId);
  }

  if (!startNode && triggerType) {
    startNode = nodes.find((n) => n.type === triggerType);
  }

  // If no specific trigger was identified, run standard toposort for all nodes
  if (!startNode) {
    return topologicalSort(nodes, connections);
  }

  // Build adjacency list for forward traversal
  const adjacency = new Map<string, string[]>();
  for (const conn of connections) {
    const list = adjacency.get(conn.fromNodeId) || [];
    list.push(conn.toNodeId);
    adjacency.set(conn.fromNodeId, list);
  }

  // Traverse to find all downstream nodes reachable from the trigger
  const reachableIds = new Set<string>();
  const queue = [startNode.id];
  reachableIds.add(startNode.id);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const neighbors = adjacency.get(currentId) || [];
    for (const nextId of neighbors) {
      if (!reachableIds.has(nextId)) {
        reachableIds.add(nextId);
        queue.push(nextId);
      }
    }
  }

  const reachableNodes = nodes.filter((n) => reachableIds.has(n.id));
  const reachableConnections = connections.filter(
    (c) => reachableIds.has(c.fromNodeId) && reachableIds.has(c.toNodeId),
  );

  return topologicalSort(reachableNodes, reachableConnections);
};

export const sendWorkflowExecution = async (data: {
    workflowId: string;
    [key: string]: any;
}) => {
  return inngest.send({
    name: "workflows/execute.workflow",
    data,
  });
};