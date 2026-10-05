"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { fileGeneratorChannel } from "@/inngest/channels/file-generator";
import { inngest } from "@/inngest/client";

export type FileGeneratorToken = Realtime.Token<
  typeof fileGeneratorChannel,
  ["status"]
>;

export async function fetchFileGeneratorRealtimeToken(): Promise<FileGeneratorToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: fileGeneratorChannel(),
    topics: ["status"],
  });

  return token;
}
