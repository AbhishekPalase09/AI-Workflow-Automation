import { useReactFlow, type NodeProps, type Node } from "@xyflow/react";
import { memo, useState } from "react";
import { BaseTriggerNode } from "../base-trigger-node";
import { TelegramTriggerDialog, type TelegramTriggerFormValues } from "./dialog";
import { useNodeStatus } from "@/features/executions/hooks/use-node-status";
import { fetchTelegramTriggerRealtimeToken } from "./actions";
import { TELEGRAM_TRIGGER_CHANNEL_NAME } from "@/inngest/channels/telegram-trigger";

type TelegramTriggerNodeType = Node<TelegramTriggerFormValues>;

export const TelegramTrigger = memo((props: NodeProps<TelegramTriggerNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: TELEGRAM_TRIGGER_CHANNEL_NAME,
    topic: "status",
    refreshToken: fetchTelegramTriggerRealtimeToken,
  });

  const handleOpenSettings = () => setDialogOpen(true);

  const handleSubmit = (values: TelegramTriggerFormValues) => {
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

  const nodeData = props.data as TelegramTriggerFormValues | undefined;
  const description = nodeData?.command
    ? `Command: ${nodeData.command}`
    : "When message is received";

  return (
    <>
      <TelegramTriggerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseTriggerNode
        {...props}
        icon="/logos/telegram.svg"
        name="Telegram Trigger"
        description={description}
        status={nodeStatus}
        onSettings={handleOpenSettings}
        onDoubleClick={handleOpenSettings}
      />
    </>
  );
});

TelegramTrigger.displayName = "TelegramTrigger";
