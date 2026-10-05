import type { NodeExecutor } from "@/features/executions/types";
import { telegramTriggerChannel } from "@/inngest/channels/telegram-trigger";

type TelegramTriggerData = Record<string, unknown>;

export const telegramTriggerExecutor: NodeExecutor<TelegramTriggerData> = async ({
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    telegramTriggerChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  const result = await step.run("telegram-trigger", async () => context);

  await publish(
    telegramTriggerChannel().status({
      nodeId,
      status: "success",
    }),
  );

  return result;
};
