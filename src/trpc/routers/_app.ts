import { createTRPCRouter } from "../init";
import { workflowRouter } from "@/features/workflows/server/routers";
import { credentialsRouter } from '@/features/credentials/server/routers';
import { executionsRouter } from '@/features/executions/server/routers';

export const appRouter = createTRPCRouter({
    workflows:workflowRouter,
    credentials: credentialsRouter,
    executions: executionsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
