"use client";

import { type Node, type NodeProps, useReactFlow } from "@xyflow/react";
import { memo, useState } from "react";
import { FILE_GENERATOR_CHANNEL_NAME } from "@/inngest/channels/file-generator";
import { useNodeStatus } from "../../hooks/use-node-status";
import { BaseExecutionNode } from "../base-execution-node";
import { fetchFileGeneratorRealtimeToken } from "./actions";
import type { FileFormatType } from "./dialog";
import { FileGeneratorDialog, type FileGeneratorFormValues } from "./dialog";

type FileGeneratorNodeData = {
  variableName?: string;
  format?: FileFormatType;
  filename?: string;
  content?: string;
};

type FileGeneratorNodeType = Node<FileGeneratorNodeData>;

export const FileGeneratorNode = memo(
  (props: NodeProps<FileGeneratorNodeType>) => {
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
          nodeId={props.id}
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
  },
);

FileGeneratorNode.displayName = "FileGeneratorNode";
