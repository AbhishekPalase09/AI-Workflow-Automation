import { inngest } from "./client";
import prisma from "@/lib/db";
import * as Sentry from "@sentry/node";


// import { createGoogle } from '@ai-sdk/google';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from "ai";

// const google = createGoogle();
const google = createGoogleGenerativeAI();
const openai = createOpenAI();
const anthropic = createAnthropic();

Sentry.setConversationId("my-conversation-123");



export const execute = inngest.createFunction(
  { id: "execute-ai" },
  { event: "execute/ai" },
  async ({ event, step }) => {
    // await step.sleep("pretend", "5s")

    console.warn("This is a warning");
    Sentry.logger.info('User triggered test log',{ log_source:'sentry_test' })

    const { steps: geminiSteps } = await step.ai.wrap(
      "gemini-generate-text",
      generateText,
      {
        model: google("gemini-2.5-flash"),
        system: "You are a helpfull assistant",
        prompt: "Write a long paragraph about the movie the sixth sense",
        experimental_telemetry: {
          isEnabled: true,
          functionId: "joke_agent",
          recordInputs: true,
          recordOutputs: true,
        },
      }
    );
    // const { steps: openaiSteps } = await step.ai.wrap(
    //   "openai-generate-text",
    //   generateText,
    //   {
    //     model: openai("gpt-3.5-turbo"),
    //     system: "You are a helpfull assistant",
    //     prompt: "Write a long paragraph about the movie the sixth sense",
    //     experimental_telemetry: {
    //       isEnabled: true,
    //       recordInputs: true,
    //       recordOutputs: true
    //     }
    //   }
    // );
    // const { steps: anthropicSteps } = await step.ai.wrap(
    //   "anthropic-generate-text",
    //   generateText,
    //   {
    //     model: anthropic("claude-fable-5"),
    //     system: "You are a helpfull assistant",
    //     prompt: "Write a long paragraph about the movie the sixth sense",
    //     experimental_telemetry: {
    //       isEnabled: true,
    //       recordInputs: true,
    //       recordOutputs: true
    //     }
    //   }
    // );

    return {
      geminiSteps,
      // To be used when api keys are give
      // openaiSteps,
      // anthropicSteps
    };
  }
);