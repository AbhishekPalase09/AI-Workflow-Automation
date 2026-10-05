import { channel, topic } from "@inngest/realtime";

export const FILE_GENERATOR_CHANNEL_NAME = "file-generator-execution";

export const fileGeneratorChannel = channel(FILE_GENERATOR_CHANNEL_NAME)
  .addTopic(
    topic("status").type<{
      nodeId: string;
      status: "loading" | "success" | "error";
    }>(),
  );
