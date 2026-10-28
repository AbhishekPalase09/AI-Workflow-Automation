import { NonRetriableError } from "inngest";
import { FLOWCHECK_BLOCK_ON_ERRORS } from "@/config/constants";
import { getExecutor } from "@/features/executions/lib/executor-registry";
import { analyze, type FlowEdge, type FlowNode } from "@/features/flowcheck";
import { ExecutionStatus, NodeType } from "@/generated/prisma";
import prisma from "@/lib/db";
import { anthropicChannel } from "./channels/anthropic";
import { databaseChannel } from "./channels/database";
import { discordChannel } from "./channels/discord";
import { emailChannel } from "./channels/email";
import { fileGeneratorChannel } from "./channels/file-generator";
import { geminiChannel } from "./channels/gemini";
import { googleFormTriggerChannel } from "./channels/google-form-trigger";
import { httpRequestChannel } from "./channels/http-request";
import { manualTriggerChannel } from "./channels/manual-trigger";
import { openAiChannel } from "./channels/openai";
import { slackChannel } from "./channels/slack";
import { stripeTriggerChannel } from "./channels/stripe-trigger";
import { telegramChannel } from "./channels/telegram";
import { telegramTriggerChannel } from "./channels/telegram-trigger";
import { inngest } from "./client";
import { getTriggerReachableNodes, topologicalSort } from "./utils";

export const executeWorkflow = inngest.createFunction(
  {
    id: "execute-workflow",
    retries: process.env.NODE_ENV === "production" ? 3 : 0,
    onFailure: async ({ event, step }) => {
      return prisma.execution.update({
        where: { inngestEventId: event.data.event.id },
        data: {
          status: ExecutionStatus.FAILED,
          error: event.data.error.message,
          errorStack: event.data.error.stack,
        },
      });
    },
  },
  {
    event: "workflows/execute.workflow",
    channels: [
      httpRequestChannel(),
      manualTriggerChannel(),
      googleFormTriggerChannel(),
      stripeTriggerChannel(),
      telegramTriggerChannel(),
      geminiChannel(),
      openAiChannel(),
      anthropicChannel(),
      discordChannel(),
      slackChannel(),
      emailChannel(),
      fileGeneratorChannel(),
      telegramChannel(),
      databaseChannel(),
    ],
  },
  async ({ event, step, publish }) => {
    const workflowId = event.data.workflowId;
    const inngestEventId = event.id;

    if (!inngestEventId || !workflowId) {
      throw new NonRetriableError("Event ID or workflow ID is missing");
    }

    await step.run("create-execution", async () => {
      return prisma.execution.create({
        data: {
          workflowId,
          inngestEventId,
        },
      });
    });

    if (FLOWCHECK_BLOCK_ON_ERRORS) {
      await step.run("flowcheck-validate", async () => {
        const workflow = await prisma.workflow.findUniqueOrThrow({
          where: { id: workflowId },
          include: {
            nodes: true,
            connections: true,
          },
        });

        const flowNodes: FlowNode[] = workflow.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          data: (n.data as Record<string, unknown>) || {},
        }));
        const flowEdges: FlowEdge[] = workflow.connections.map((c) => ({
          source: c.fromNodeId,
          target: c.toNodeId,
        }));

        const diagnostics = analyze(flowNodes, flowEdges);
        const errors = diagnostics.filter((d) => d.severity === "error");

        if (errors.length > 0) {
          const nodeNameMap = new Map<string, string>();
          for (const n of workflow.nodes) {
            nodeNameMap.set(n.id, n.name || n.type || n.id);
          }
          const messageLines = errors
            .slice(0, 5)
            .map(
              (e) => `${nodeNameMap.get(e.nodeId) || e.nodeId}: ${e.message}`,
            );

          throw new NonRetriableError(
            `Workflow validation failed:\n${messageLines.join("\n")}`,
          );
        }

        return { ok: true };
      });
    }

    const sortedNodes = await step.run("prepare-workflow", async () => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: { id: workflowId },
        include: {
          nodes: true,
          connections: true,
        },
      });

      const triggerType =
        event.data.triggerType ||
        (event.data.initialData?.telegram
          ? NodeType.TELEGRAM_TRIGGER
          : undefined) ||
        (event.data.initialData?.googleForm
          ? NodeType.GOOGLE_FORM_TRIGGER
          : undefined) ||
        (event.data.initialData?.stripe ? NodeType.STRIPE_TRIGGER : undefined);

      return getTriggerReachableNodes(
        workflow.nodes,
        workflow.connections,
        triggerType,
        event.data.triggerNodeId,
      );
    });

    const userId = await step.run("find-user-id", async () => {
      const workflow = await prisma.workflow.findUniqueOrThrow({
        where: { id: workflowId },
        select: {
          userId: true,
        },
      });

      return workflow.userId;
    });

    // Initialize context with any initial data from the trigger
    let context = event.data.initialData || {};

    // Execute each node
    for (const node of sortedNodes) {
      const executor = getExecutor(node.type as NodeType);
      context = await executor({
        data: node.data as Record<string, unknown>,
        nodeId: node.id,
        userId,
        context,
        step,
        publish,
      });
    }

    await step.run("update-execution", async () => {
      return prisma.execution.update({
        where: { inngestEventId, workflowId },
        data: {
          status: ExecutionStatus.SUCCESS,
          completedAt: new Date(),
          output: context,
        },
      });
    });

    return {
      workflowId,
      result: context,
    };
  },
);
