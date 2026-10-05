"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { DatabaseDialog, DatabaseFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchDatabaseRealtimeToken } from "./actions";
import { DATABASE_CHANNEL_NAME } from "@/inngest/channels/database";

type DatabaseNodeData = {
  variableName?: string;
  credentialId?: string;
  connectionString?: string;
  query?: string;
  ssl?: "require" | "disable";
};

type DatabaseNodeType = Node<DatabaseNodeData>;

export const DatabaseNode = memo((props: NodeProps<DatabaseNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: DATABASE_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchDatabaseRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: DatabaseFormValues) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === props.id) {
          return {
            ...node,
            data: {
              ...node.data,
              ...values,
            },
          };
        }
        return node;
      }),
    );
  };

  const nodeData = props.data;
  const description = nodeData?.query
    ? nodeData.query.slice(0, 30).replace(/\n/g, " ")
    : "Not configured";

  return (
    <>
      <DatabaseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon="/logos/database.svg"
        name="Database"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

DatabaseNode.displayName = "DatabaseNode";
