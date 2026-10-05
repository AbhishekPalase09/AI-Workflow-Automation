import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import type { NodeExecutor } from "@/features/executions/types";
import { fileGeneratorChannel } from "@/inngest/channels/file-generator";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type FileGeneratorData = {
  variableName?: string;
  format?: "CSV" | "JSON" | "TXT" | "HTML" | "MARKDOWN";
  filename?: string;
  content?: string;
};

function convertArrayToCsv(items: Record<string, unknown>[]): string {
  if (!items || items.length === 0) {
    return "";
  }

  const headers = Object.keys(items[0]);
  const headerLine = headers.map((h) => escapeCsvValue(h)).join(",");

  const rows = items.map((item) =>
    headers
      .map((header) => {
        const val = item[header];
        return escapeCsvValue(val);
      })
      .join(","),
  );

  return [headerLine, ...rows].join("\n");
}

function escapeCsvValue(val: unknown): string {
  if (val === null || val === undefined) {
    return '""';
  }
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const MIME_TYPES: Record<string, string> = {
  CSV: "text/csv",
  JSON: "application/json",
  TXT: "text/plain",
  HTML: "text/html",
  MARKDOWN: "text/markdown",
};

export const fileGeneratorExecutor: NodeExecutor<FileGeneratorData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    fileGeneratorChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  if (!data.variableName) {
    await publish(
      fileGeneratorChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("File Generator node: Variable name is required");
  }

  if (!data.content) {
    await publish(
      fileGeneratorChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("File Generator node: Content is required");
  }

  if (!data.filename) {
    await publish(
      fileGeneratorChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("File Generator node: Filename is required");
  }

  const format = data.format || "CSV";

  try {
    const result = await step.run("generate-file", async () => {
      const rawFilename = Handlebars.compile(data.filename)(context);
      const filename = decode(rawFilename).trim();

      // Check if data.content directly references an array variable, e.g. {{dbRetrive.rows}} or {{json dbRetrive.rows}}
      let content = "";
      const trimmed = data.content?.trim() || "";
      const varMatch = trimmed.match(/^\{{2,3}\s*(?:json\s+)?([a-zA-Z0-9_$.]+)\s*\}{2,3}$/);
      let rawArray: Record<string, unknown>[] | undefined;

      if (varMatch) {
        const path = varMatch[1].split(".");
        let curr: any = context;
        for (const p of path) {
          curr = curr?.[p];
        }
        if (Array.isArray(curr)) {
          rawArray = curr as Record<string, unknown>[];
        }
      }

      if (rawArray && format === "CSV") {
        content = convertArrayToCsv(rawArray);
      } else if (rawArray && format === "JSON") {
        content = JSON.stringify(rawArray, null, 2);
      } else {
        const rawContent = Handlebars.compile(data.content)(context);
        content = decode(rawContent);

        // Format-specific transformations
        if (format === "CSV") {
          // Try parsing JSON array from content if applicable
          try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
              content = convertArrayToCsv(parsed);
            }
          } catch {
            // If not raw JSON array, keep the templated CSV text
          }
        } else if (format === "JSON") {
          try {
            const parsed = JSON.parse(content);
            content = JSON.stringify(parsed, null, 2);
          } catch {
            // Keep raw if already string or custom template
          }
        }
      }

      const mimeType = MIME_TYPES[format] || "text/plain";
      const buffer = Buffer.from(content, "utf-8");
      const base64 = buffer.toString("base64");
      const size = buffer.length;

      return {
        ...context,
        [data.variableName as string]: {
          filename,
          format,
          content,
          base64,
          mimeType,
          size,
        },
      };
    });

    await publish(
      fileGeneratorChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return result;
  } catch (error) {
    await publish(
      fileGeneratorChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw error;
  }
};
