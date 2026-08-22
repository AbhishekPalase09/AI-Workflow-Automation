import { TRPCError } from "@trpc/server";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { baseProcedure, createTRPCRouter, premiumProcedure, protectedProcedure } from "../init";
import { workflowRouter } from "@/features/workflows/server/routers";

export const appRouter = createTRPCRouter({
    workflows:workflowRouter
});

// export type definition of API
export type AppRouter = typeof appRouter;
