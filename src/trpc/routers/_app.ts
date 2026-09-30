import { TRPCError } from "@trpc/server";
import { inngest } from "@/inngest/client";
import prisma from "@/lib/db";
import { baseProcedure, createTRPCRouter, premiumProcedure, protectedProcedure } from "../init";
import { workflowRouter } from "@/features/workflows/server/routers";
import { credentialsRouter } from '@/features/credentials/server/routers';

export const appRouter = createTRPCRouter({
    workflows:workflowRouter,
    credentials: credentialsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
