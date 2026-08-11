import { inngest } from "./client";
import prisma from "@/lib/db";

export const helloWorld = inngest.createFunction(
  {
    id: "hello-world", 
    triggers: [
      {
        event: "test/hello.world",
      },
    ],
  },
  async ({ event, step }) => {
    // Fetching the video
    await step.sleep("fetching", "5s");

    // Transcribing
     await step.sleep("transcribing", "5s");

    //sending Trancription to AI
     await step.sleep("sending to Ai", "5s");

    await step.run("create-workflow",()=>{
        return prisma.workflow.create({
            data:{
                name:"workflow-from-inngest",
            },
        });
    });
  },
);