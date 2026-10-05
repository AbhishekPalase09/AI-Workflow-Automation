import { channel, topic } from "@inngest/realtime";

export const TELEGRAM_TRIGGER_CHANNEL_NAME = "telegram-trigger-execution";

export const telegramTriggerChannel = channel(TELEGRAM_TRIGGER_CHANNEL_NAME)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "success" | "error";
    }>(),
  );
