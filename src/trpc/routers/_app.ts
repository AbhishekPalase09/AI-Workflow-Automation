import { inngest } from "@/inngest/client";
import { resolve } from 'path';
import { createTRPCRouter, protectedProcedure } from '../init';
import prisma from '@/lib/db';
import { email } from 'better-auth';

import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export const appRouter = createTRPCRouter({
  testAi: protectedProcedure.mutation(async () => {
    // const { text } = await generateText({
    //   model: google('gemini-2.5-flash'),
    //   prompt: 'Write a vegetarian lasagna recipe for 4 people.',
    // });

    await inngest.send({
      name:"execute/ai"
    })

    return { success: true, message: "Job queued" }
  }),
  getWorkflows: protectedProcedure.query(({ ctx }) => {
    return prisma.workflow.findMany();
  }),
  createWorkflow: protectedProcedure.mutation(async () => {
    await inngest.send({
      name: "test/hello.world",
      data: {
        email: "mandar@gmail.com",
      }
    })
    return { success: true, message: "Job queued" }

  }),
});

// export type definition of API
export type AppRouter = typeof appRouter;