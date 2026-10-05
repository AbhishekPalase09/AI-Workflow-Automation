import { sendWorkflowExecution } from "@/inngest/utils";
import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { NodeType } from "@/generated/prisma";

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const workflowId = url.searchParams.get("workflowId");

    if (!workflowId) {
      return NextResponse.json(
        { ok: false, error: "Missing required query parameter: workflowId" },
        { status: 400 },
      );
    }

    const body = await request.json();

    const msg =
      body.message ||
      body.edited_message ||
      body.channel_post ||
      body.edited_channel_post ||
      body.callback_query?.message ||
      {};

    const from = body.callback_query?.from || msg.from || {};
    const chat = msg.chat || body.callback_query?.message?.chat || {};

    const fullName =
      [from.first_name, from.last_name].filter(Boolean).join(" ") ||
      from.username ||
      "";

    const text = (msg.text || msg.caption || body.callback_query?.data || "").trim();

    const telegramData = {
      updateId: body.update_id,
      messageId: msg.message_id,
      text,
      chatId: chat.id,
      chatType: chat.type || "private",
      chatTitle: chat.title,
      sender: {
        id: from.id,
        name: fullName,
        username: from.username || "",
        firstName: from.first_name || "",
        lastName: from.last_name || "",
        isBot: !!from.is_bot,
        languageCode: from.language_code,
      },
      date: msg.date,
      callbackData: body.callback_query?.data,
      raw: body,
    };

    // Check if the workflow has a TELEGRAM_TRIGGER node with command filter
    const telegramNode = await prisma.node.findFirst({
      where: {
        workflowId,
        type: NodeType.TELEGRAM_TRIGGER,
      },
    });

    const expectedCommand = (
      telegramNode?.data as { command?: string } | undefined
    )?.command?.trim();

    if (expectedCommand) {
      const isMatch =
        text.toLowerCase() === expectedCommand.toLowerCase() ||
        text.toLowerCase().startsWith(expectedCommand.toLowerCase() + " ");

      if (!isMatch) {
        // Message does not match command (e.g. user sent /start while command is /summary)
        return NextResponse.json(
          {
            ok: true,
            ignored: true,
            reason: `Message '${text}' does not match command '${expectedCommand}'`,
          },
          { status: 200 },
        );
      }
    }

    await sendWorkflowExecution({
      workflowId,
      triggerType: NodeType.TELEGRAM_TRIGGER,
      triggerNodeId: telegramNode?.id,
      initialData: {
        telegram: telegramData,
      },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to process Telegram webhook" },
      { status: 500 },
    );
  }
}
