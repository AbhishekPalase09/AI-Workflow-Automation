import Handlebars from "handlebars";
import { decode } from "html-entities";
import { NonRetriableError } from "inngest";
import { Client } from "pg";
import type { NodeExecutor } from "@/features/executions/types";
import { databaseChannel } from "@/inngest/channels/database";
import prisma from "@/lib/db";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  const safeString = new Handlebars.SafeString(jsonString);

  return safeString;
});

type DatabaseData = {
  variableName?: string;
  credentialId?: string;
  connectionString?: string;
  query?: string;
  ssl?: "require" | "disable";
};

export const databaseExecutor: NodeExecutor<DatabaseData> = async ({
  data,
  nodeId,
  userId,
  context,
  step,
  publish,
}) => {
  await publish(
    databaseChannel().status({
      nodeId,
      status: "loading",
    }),
  );

  if (!data.query) {
    await publish(
      databaseChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Database node: SQL query is required");
  }

  if (!data.variableName) {
    await publish(
      databaseChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw new NonRetriableError("Database node: Variable name is missing");
  }

  const rawQuery = Handlebars.compile(data.query)(context);
  const query = decode(rawQuery).trim();

  try {
    const connectionString = await step.run("get-database-connection-url", async () => {
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

      if (data.connectionString?.trim()) {
        const rawConn = Handlebars.compile(data.connectionString)(context);
        return decode(rawConn).trim();
      }

      if (process.env.POSTGRES_URL) {
        return process.env.POSTGRES_URL.trim();
      }

      if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL.trim();
      }

      throw new NonRetriableError(
        "Database node: Database connection URL is required. Please select a credential or provide a Postgres connection URL.",
      );
    });

    const result = await step.run("execute-sql-query", async () => {
      const sslConfig =
        data.ssl === "disable"
          ? false
          : { rejectUnauthorized: false };

      const client = new Client({
        connectionString,
        ssl: sslConfig,
        connectionTimeoutMillis: 10000,
        statement_timeout: 30000,
      });

      try {
        await client.connect();
        const res = await client.query(query);

        const rows = res.rows || [];
        const fields = res.fields ? res.fields.map((f) => f.name) : [];

        return {
          ...context,
          [data.variableName as string]: {
            rows,
            rowCount: res.rowCount ?? rows.length,
            firstRow: rows.length > 0 ? rows[0] : null,
            command: res.command,
            fields,
          },
        };
      } catch (err: unknown) {
        const error = err as Error;
        throw new NonRetriableError(`Database execution error: ${error.message}`);
      } finally {
        try {
          await client.end();
        } catch {
          // ignore disconnect errors
        }
      }
    });

    await publish(
      databaseChannel().status({
        nodeId,
        status: "success",
      }),
    );

    return result;
  } catch (error) {
    await publish(
      databaseChannel().status({
        nodeId,
        status: "error",
      }),
    );
    throw error;
  }
};
