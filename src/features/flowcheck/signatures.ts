// Pure node signatures registry for Flowcheck (Phase 2.4)
// Populated strictly from docs/flowcheck/RECON.md.
// Non-Negotiable Rule 4: Zero external imports except local/handlebars.

import { isSchema, S, type Schema } from "./schema";

export interface TemplateInput {
  field: string;
  template: string | undefined;
  accepts: "scalar" | "any";
}

export interface NodeSignature {
  variableName: (data: Record<string, unknown>) => string | undefined;
  inputs: (data: Record<string, unknown>) => TemplateInput[];
  output: (data: Record<string, unknown>) => Schema;
  isTrigger?: boolean;
}

function cleanVarName(val: unknown): string | undefined {
  if (typeof val === "string") {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

export const signatureRegistry: Record<string, NodeSignature> = {
  INITIAL: {
    variableName: () => undefined,
    inputs: () => [],
    output: () => S.unknown,
    isTrigger: true,
  },

  MANUAL_TRIGGER: {
    variableName: () => undefined,
    inputs: () => [],
    output: () => S.unknown,
    isTrigger: true,
  },

  GOOGLE_FORM_TRIGGER: {
    variableName: () => "googleForm",
    inputs: () => [],
    isTrigger: true,
    output: () =>
      S.obj(
        {
          formId: { s: S.str, req: true },
          formTitle: { s: S.str, req: true },
          responseId: { s: S.str, req: true },
          timestamp: { s: S.str, req: true },
          respondentEmail: { s: S.str, req: true },
          responses: { s: S.obj({}, { open: true }), req: true },
          raw: { s: S.unknown, req: false },
        },
        { open: true },
      ),
  },

  STRIPE_TRIGGER: {
    variableName: () => "stripe",
    inputs: () => [],
    isTrigger: true,
    output: () =>
      S.obj(
        {
          eventId: { s: S.str, req: false },
          eventType: { s: S.str, req: false },
          timestamp: { s: S.num, req: false },
          livemode: { s: S.bool, req: false },
          raw: { s: S.unknown, req: false },
        },
        { open: true },
      ),
  },

  TELEGRAM_TRIGGER: {
    variableName: () => "telegram",
    inputs: () => [],
    isTrigger: true,
    output: () =>
      S.obj(
        {
          updateId: { s: S.num, req: false },
          messageId: { s: S.num, req: false },
          text: { s: S.str, req: false },
          chatId: { s: S.union([S.num, S.str]), req: false },
          chatType: { s: S.str, req: false },
          chatTitle: { s: S.str, req: false },
          sender: {
            s: S.obj(
              {
                id: { s: S.union([S.num, S.str]), req: false },
                name: { s: S.str, req: false },
                username: { s: S.str, req: false },
                firstName: { s: S.str, req: false },
                lastName: { s: S.str, req: false },
                isBot: { s: S.bool, req: false },
                languageCode: { s: S.str, req: false },
              },
              { open: true },
            ),
            req: false,
          },
          date: { s: S.num, req: false },
          callbackData: { s: S.str, req: false },
          raw: { s: S.unknown, req: false },
        },
        { open: true },
      ),
  },

  HTTP_REQUEST: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => {
      const inputs: TemplateInput[] = [
        {
          field: "endpoint",
          template: typeof d.endpoint === "string" ? d.endpoint : undefined,
          accepts: "scalar",
        },
      ];
      const method = String(d.method || "GET").toUpperCase();
      if (["POST", "PUT", "PATCH"].includes(method) || !d.method) {
        inputs.push({
          field: "body",
          template: typeof d.body === "string" ? d.body : undefined,
          accepts: "any",
        });
      }
      return inputs;
    },
    output: (d) => {
      const sampleSchema = isSchema(d.sampleSchema)
        ? d.sampleSchema
        : S.unknown;

      return S.obj(
        {
          httpResponse: S.obj(
            {
              status: S.num,
              statusText: { s: S.str, req: false },
              data: sampleSchema,
            },
            { open: false },
          ),
        },
        { open: false },
      );
    },
  },

  OPENAI: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => [
      {
        field: "userPrompt",
        template: typeof d.userPrompt === "string" ? d.userPrompt : undefined,
        accepts: "any",
      },
      {
        field: "systemPrompt",
        template:
          typeof d.systemPrompt === "string" ? d.systemPrompt : undefined,
        accepts: "any",
      },
    ],
    output: () =>
      S.obj(
        {
          text: S.str,
        },
        { open: false },
      ),
  },

  ANTHROPIC: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => [
      {
        field: "userPrompt",
        template: typeof d.userPrompt === "string" ? d.userPrompt : undefined,
        accepts: "any",
      },
      {
        field: "systemPrompt",
        template:
          typeof d.systemPrompt === "string" ? d.systemPrompt : undefined,
        accepts: "any",
      },
    ],
    output: () =>
      S.obj(
        {
          text: S.str,
        },
        { open: false },
      ),
  },

  GEMINI: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => [
      {
        field: "userPrompt",
        template: typeof d.userPrompt === "string" ? d.userPrompt : undefined,
        accepts: "any",
      },
      {
        field: "systemPrompt",
        template:
          typeof d.systemPrompt === "string" ? d.systemPrompt : undefined,
        accepts: "any",
      },
    ],
    output: () =>
      S.obj(
        {
          text: S.str,
        },
        { open: false },
      ),
  },

  DISCORD: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => [
      {
        field: "content",
        template: typeof d.content === "string" ? d.content : undefined,
        accepts: "any",
      },
      {
        field: "username",
        template: typeof d.username === "string" ? d.username : undefined,
        accepts: "scalar",
      },
    ],
    output: () =>
      S.obj(
        {
          messageContent: S.str,
        },
        { open: false },
      ),
  },

  SLACK: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => [
      {
        field: "content",
        template: typeof d.content === "string" ? d.content : undefined,
        accepts: "any",
      },
    ],
    output: () =>
      S.obj(
        {
          messageContent: S.str,
        },
        { open: false },
      ),
  },

  EMAIL: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => [
      {
        field: "to",
        template: typeof d.to === "string" ? d.to : undefined,
        accepts: "scalar",
      },
      {
        field: "from",
        template: typeof d.from === "string" ? d.from : undefined,
        accepts: "scalar",
      },
      {
        field: "subject",
        template: typeof d.subject === "string" ? d.subject : undefined,
        accepts: "scalar",
      },
      {
        field: "body",
        template: typeof d.body === "string" ? d.body : undefined,
        accepts: "any",
      },
    ],
    output: () =>
      S.obj(
        {
          id: S.str,
          to: S.str,
          from: S.str,
          subject: S.str,
          hasAttachment: S.bool,
        },
        { open: false },
      ),
  },

  FILE_GENERATOR: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => [
      {
        field: "filename",
        template: typeof d.filename === "string" ? d.filename : undefined,
        accepts: "scalar",
      },
      {
        field: "content",
        template: typeof d.content === "string" ? d.content : undefined,
        accepts: "any",
      },
    ],
    output: () =>
      S.obj(
        {
          filename: S.str,
          format: S.str,
          content: S.str,
          base64: S.str,
          mimeType: S.str,
          size: S.num,
        },
        { open: false },
      ),
  },

  TELEGRAM: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => [
      {
        field: "chatId",
        template: typeof d.chatId === "string" ? d.chatId : undefined,
        accepts: "scalar",
      },
      {
        field: "text",
        template: typeof d.text === "string" ? d.text : undefined,
        accepts: "any",
      },
    ],
    output: () =>
      S.obj(
        {
          messageId: { s: S.num, req: false },
          chatId: S.union([S.num, S.str]),
          chatTitle: { s: S.str, req: false },
          chatUsername: { s: S.str, req: false },
          text: S.str,
          date: { s: S.num, req: false },
          ok: S.bool,
        },
        { open: false },
      ),
  },

  DATABASE: {
    variableName: (d) => cleanVarName(d.variableName),
    inputs: (d) => [
      {
        field: "query",
        template: typeof d.query === "string" ? d.query : undefined,
        accepts: "any",
      },
      {
        field: "connectionString",
        template:
          typeof d.connectionString === "string"
            ? d.connectionString
            : undefined,
        accepts: "scalar",
      },
    ],
    output: () =>
      S.obj(
        {
          rows: S.arr(S.obj({}, { open: true })),
          rowCount: S.num,
          firstRow: {
            s: S.union([S.obj({}, { open: true }), S.null]),
            req: false,
          },
          command: S.str,
          fields: S.arr(S.str),
        },
        { open: false },
      ),
  },
};

/**
 * Returns signature for a given node type.
 * Unknown node types degrade to S.unknown with no inputs.
 */
export function getSignature(type: string): NodeSignature | undefined {
  return signatureRegistry[type];
}
