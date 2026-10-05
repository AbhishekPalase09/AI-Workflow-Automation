import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import ky from "ky";
import type { NodeExecutor } from "@/features/executions/types";
import { emailChannel } from "@/inngest/channels/email";
import prisma from "@/lib/db";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type EmailData = {
  variableName?: string;
  credentialId?: string;
  from?: string;
  to?: string;
  subject?: string;
  body?: string;
};

export const emailExecutor: NodeExecutor<EmailData> = async ({
  data,
  nodeId,
  userId,
  context,
  step,
  publish,
}) => {
  await publish(
    emailChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  if (!data.to) {
    await publish(
      emailChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Email node: Recipient email is required");
  }

  if (!data.subject) {
    await publish(
      emailChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Email node: Subject is required");
  }

  if (!data.body) {
    await publish(
      emailChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Email node: Body content is required");
  }

  if (!data.variableName) {
    await publish(
      emailChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Email node: Variable name is missing");
  }

  const rawTo = Handlebars.compile(data.to)(context);
  const to = decode(rawTo).trim();

  const rawFrom = data.from
    ? Handlebars.compile(data.from)(context)
    : "Acme <onboarding@resend.dev>";
  const from = decode(rawFrom).trim();

  const rawSubject = Handlebars.compile(data.subject)(context);
  const subject = decode(rawSubject).trim();

  const rawBody = Handlebars.compile(data.body)(context);
  const body = decode(rawBody);

  try {
    const apiKey = await step.run("get-resend-api-key", async () => {
      if (data.credentialId) {
        const credential = await prisma.credential.findUnique({
          where: {
            id: data.credentialId,
            userId,
          },
        });

        if (credential?.value) {
          return credential.value;
        }
      }

      if (process.env.RESEND_API_KEY) {
        return process.env.RESEND_API_KEY;
      }

      throw new NonRetriableError(
        "Email node: Resend API key is required. Please add a Resend credential or set RESEND_API_KEY in environment variables.",
      );
    });

    const result = await step.run("send-email", async () => {
      const response = await ky
        .post("https://api.resend.com/emails", {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          json: {
            from,
            to: to.includes(",") ? to.split(",").map((e) => e.trim()) : [to],
            subject,
            html: body,
          },
        })
        .json<{ id: string }>();

      return {
        ...context,
        [data.variableName as string]: {
          id: response.id,
          to,
          from,
          subject,
        },
      };
    });

    await publish(
      emailChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return result;
  } catch (error) {
    await publish(
      emailChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw error;
  }
};
