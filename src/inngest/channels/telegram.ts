import { channel, topic } from "@inngest/realtime";

export const TELEGRAM_CHANNEL_NAME = "telegram-execution";

export const telegramChannel = channel(TELEGRAM_CHANNEL_NAME)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "success" | "error";
    }>(),
  );
