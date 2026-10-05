"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { databaseChannel } from "@/inngest/channels/database";
import { inngest } from "@/inngest/client";

export type DatabaseToken = Realtime.Token<
  typeof databaseChannel,
  ["status"]
>;

export async function fetchDatabaseRealtimeToken(): Promise<DatabaseToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: databaseChannel(),
    topics: ["status"],
  });

  return token;
}
