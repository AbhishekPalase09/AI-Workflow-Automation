"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { telegramChannel } from "@/inngest/channels/telegram";
import { inngest } from "@/inngest/client";

export type TelegramToken = Realtime.Token<
  typeof telegramChannel,
  ["status"]
>;

export async function fetchTelegramRealtimeToken(): Promise<TelegramToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: telegramChannel(),
    topics: ["status"],
  });

  return token;
}
