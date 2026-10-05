import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import ky, { HTTPError } from "ky";
import type { NodeExecutor } from "@/features/executions/types";
import { telegramChannel } from "@/inngest/channels/telegram";
import prisma from "@/lib/db";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type TelegramData = {
  variableName?: string;
  credentialId?: string;
  botToken?: string;
  chatId?: string;
  text?: string;
  parseMode?: "HTML" | "Markdown" | "None";
};

interface TelegramApiResponse {
  ok: boolean;
  result?: {
    message_id: number;
    chat?: {
      id: number;
      title?: string;
      username?: string;
      type?: string;
    };
    date?: number;
    text?: string;
  };
  description?: string;
  error_code?: number;
}

export const telegramExecutor: NodeExecutor<TelegramData> = async ({
  data,
  nodeId,
  userId,
  context,
  step,
  publish,
}) => {
  await publish(
    telegramChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  if (!data.chatId) {
    await publish(
      telegramChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Telegram node: Chat ID is required");
  }

  if (!data.text) {
    await publish(
      telegramChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Telegram node: Message text is required");
  }

  if (!data.variableName) {
    await publish(
      telegramChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Telegram node: Variable name is missing");
  }

  const rawChatId = Handlebars.compile(data.chatId)(context);
  const chatId = decode(rawChatId).trim();

  const rawText = Handlebars.compile(data.text)(context);
  let text = decode(rawText);

  // Telegram message character limit is 4096
  if (text.length > 4096) {
    text = text.slice(0, 4090) + "\n...";
  }

  try {
    const botToken = await step.run("get-telegram-bot-token", async () => {
      if (data.credentialId) {
        const credential = await prisma.credential.findUnique({
          where: {
            id: data.credentialId,
            userId,
          },
        });

        if (credential?.value) {
          return credential.value.trim();
        }
      }

      if (data.botToken?.trim()) {
        return data.botToken.trim();
      }

      if (process.env.TELEGRAM_BOT_TOKEN) {
        return process.env.TELEGRAM_BOT_TOKEN.trim();
      }

      throw new NonRetriableError(
        "Telegram node: Bot Token is required. Please add a Telegram credential, direct token, or set TELEGRAM_BOT_TOKEN.",
      );
    });

    const result = await step.run("send-telegram-message", async () => {
      const payload: Record<string, unknown> = {
        chat_id: /^-?\d+$/.test(chatId) ? Number(chatId) : chatId,
        text,
      };

      if (data.parseMode && data.parseMode !== "None") {
        payload.parse_mode = data.parseMode;
      }

      const sendMessage = async (body: Record<string, unknown>): Promise<TelegramApiResponse> => {
        try {
          return await ky
            .post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              json: body,
              timeout: 15000,
            })
            .json<TelegramApiResponse>();
        } catch (err) {
          let errorMsg = err instanceof Error ? err.message : "Unknown error";
          let errorDesc = "";
          let errorCode = 0;

          if (err instanceof HTTPError) {
            try {
              const bodyJson = (await err.response.json()) as TelegramApiResponse;
              if (bodyJson?.description) {
                errorDesc = bodyJson.description;
                errorCode = bodyJson.error_code || err.response.status;
              }
            } catch {
              // ignore json parse error
            }
          }

          // If parsing failed with HTML/Markdown entities, attempt sending without parse_mode as fallback
          if (
            body.parse_mode &&
            errorDesc &&
            (errorDesc.toLowerCase().includes("can't parse entities") ||
              errorDesc.toLowerCase().includes("entity") ||
              errorDesc.toLowerCase().includes("parse mode") ||
              errorDesc.toLowerCase().includes("tag"))
          ) {
            const fallbackBody = { ...body };
            delete fallbackBody.parse_mode;
            return await ky
              .post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                json: fallbackBody,
                timeout: 15000,
              })
              .json<TelegramApiResponse>();
          }

          const finalError = errorDesc
            ? `Telegram API error (${errorCode}): ${errorDesc}`
            : `Failed to send Telegram message: ${errorMsg}`;

          throw new NonRetriableError(finalError);
        }
      };

      const responseData = await sendMessage(payload);

      if (!responseData.ok) {
        throw new NonRetriableError(
          `Telegram error: ${responseData.description || "Unknown error"}`,
        );
      }

      return {
        ...context,
        [data.variableName as string]: {
          messageId: responseData.result?.message_id,
          chatId: responseData.result?.chat?.id ?? chatId,
          chatTitle: responseData.result?.chat?.title,
          chatUsername: responseData.result?.chat?.username,
          text: responseData.result?.text ?? text,
          date: responseData.result?.date,
          ok: true,
        },
      };
    });

    await publish(
      telegramChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return result;
  } catch (error) {
    await publish(
      telegramChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw error;
  }
};
