"use server";

import { getSubscriptionToken, type Realtime } from "@inngest/realtime";
import { telegramTriggerChannel } from "@/inngest/channels/telegram-trigger";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import ky from "ky";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type TelegramTriggerToken = Realtime.Token<
  typeof telegramTriggerChannel,
  ["status"]
>;

export async function fetchTelegramTriggerRealtimeToken(): Promise<TelegramTriggerToken> {
  const token = await getSubscriptionToken(inngest, {
    channel: telegramTriggerChannel(),
    topics: ["status"],
  });

  return token;
}

export async function setTelegramWebhookAction({
  botToken,
  credentialId,
  userId,
  webhookUrl,
}: {
  botToken?: string;
  credentialId?: string;
  userId?: string;
  webhookUrl: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    let token = botToken?.trim();

    if (!token && credentialId) {
      let uid = userId;
      if (!uid) {
        try {
          const session = await auth.api.getSession({
            headers: await headers(),
          });
          uid = session?.user?.id;
        } catch {
          // session retrieval fallback
        }
      }

      const credential = await prisma.credential.findFirst({
        where: uid ? { id: credentialId, userId: uid } : { id: credentialId },
      });

      if (credential?.value) {
        token = credential.value.trim();
      }
    }

    if (!token && process.env.TELEGRAM_BOT_TOKEN) {
      token = process.env.TELEGRAM_BOT_TOKEN.trim();
    }

    if (!token) {
      return {
        success: false,
        message: "Bot token is required to set the webhook.",
      };
    }

    const response = await ky
      .post(`https://api.telegram.org/bot${token}/setWebhook`, {
        json: {
          url: webhookUrl,
          allowed_updates: ["message", "edited_message", "channel_post", "callback_query"],
        },
        timeout: 10000,
      })
      .json<{ ok: boolean; description?: string }>();

    if (response.ok) {
      return {
        success: true,
        message: response.description || "Webhook registered successfully with Telegram!",
      };
    } else {
      return {
        success: false,
        message: response.description || "Telegram returned an error setting webhook.",
      };
    }
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      message: `Failed to set webhook: ${err.message}`,
    };
  }
}
