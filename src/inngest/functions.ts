import { inngest } from "./client";
import prisma from "@/lib/db";

// import { createGoogle } from '@ai-sdk/google';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from "ai";

// const google = createGoogle();
const google = createGoogleGenerativeAI();
const openai = createOpenAI();
const anthropic = createAnthropic();

export const execute = inngest.createFunction(
  { id: "execute-ai" },
  { event: "execute/ai" },
  async ({ event, step }) => {
    await step.sleep("pretend","5s")
    const { steps:geminiSteps } = await step.ai.wrap(
      "gemini-generate-text",
      generateText,
      {
        model:google("gemini-2.5-flash"),
        system:"You are a helpfull assistant",
        prompt:"Write a long paragraph about the movie the sixth sense",
      }
    );
    const { steps:openaiSteps } = await step.ai.wrap(
      "openai-generate-text",
      generateText,
      {
        model:openai("gpt-3.5-turbo"),
        system:"You are a helpfull assistant",
        prompt:"Write a long paragraph about the movie the sixth sense",
      }
    );
    const { steps:anthropicSteps } = await step.ai.wrap(
      "anthropic-generate-text",
      generateText,
      {
        model:anthropic("claude-fable-5"),
        system:"You are a helpfull assistant",
        prompt:"Write a long paragraph about the movie the sixth sense",
      }
    );

    return {
      geminiSteps,
      openaiSteps,
      anthropicSteps
    };
  }
);