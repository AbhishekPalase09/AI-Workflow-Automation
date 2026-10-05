"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseExecutionNode } from "../base-execution-node";
import { FileGeneratorDialog, type FileGeneratorFormValues } from "./dialog";
import { useNodeStatus } from "../../hooks/use-node-status";
import { fetchFileGeneratorRealtimeToken } from "./actions";
import { FILE_GENERATOR_CHANNEL_NAME } from "@/inngest/channels/file-generator";

type FileGeneratorNodeData = {
  variableName?: string;
  format?: string;
  filename?: string;
  content?: string;
};

type FileGeneratorNodeType = Node<FileGeneratorNodeData>;

export const FileGeneratorNode = memo((props: NodeProps<FileGeneratorNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: FILE_GENERATOR_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchFileGeneratorRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: FileGeneratorFormValues) => {
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
  const description = nodeData?.filename
    ? `${nodeData.format || "File"}: ${nodeData.filename}`
    : "Not configured";

  return (
    <>
      <FileGeneratorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon="/logos/file-generator.svg"
        name="File Generator"
        status={nodeStatus}
        description={description}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

FileGeneratorNode.displayName = "FileGeneratorNode";
