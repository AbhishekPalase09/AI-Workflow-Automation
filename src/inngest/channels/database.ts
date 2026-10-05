import { channel, topic } from "@inngest/realtime";

export const DATABASE_CHANNEL_NAME = "database-execution";

export const databaseChannel = channel(DATABASE_CHANNEL_NAME)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "success" | "error";
    }>(),
  );
