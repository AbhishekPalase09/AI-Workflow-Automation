import { describe, expect, it, vi } from "vitest";
import { geminiExecutor } from "@/features/executions/components/gemini/executor";
import { getSignature } from "../../signatures";
import { conforms } from "../helpers/conforms";
import { makeFakeStep } from "../helpers/fake-step";

vi.mock("@/lib/db", () => ({
  default: {
    credential: {
      findUnique: vi.fn().mockResolvedValue({
        id: "cred-1",
        value: "gemini-api-key",
      }),
    },
  },
}));

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: vi
    .fn()
    .mockReturnValue(() => "gemini-2.5-flash-lite"),
}));

vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({
    steps: [
      {
        content: [
          {
            type: "text",
            text: "Hello from Gemini!",
          },
        ],
      },
    ],
  }),
}));

describe("GEMINI Contract Test", () => {
  it("output context conforms to signature.output(data)", async () => {
    const data = {
      variableName: "geminiAi",
      credentialId: "cred-1",
      userPrompt: "Hello Gemini",
    };

    const sig = getSignature("GEMINI");
    expect(sig).toBeDefined();

    const fakeStep = makeFakeStep();
    const fakePublish = vi.fn().mockResolvedValue(undefined);

    const resContext = await geminiExecutor({
      data,
      nodeId: "node-gemini",
      userId: "user-1",
      context: {},
      step: fakeStep,
      publish: fakePublish,
    });

    const outputValue = resContext[data.variableName];
    expect(outputValue).toBeDefined();

    if (!sig) throw new Error("Missing GEMINI signature");
    const expectedSchema = sig.output(data);
    expect(conforms(outputValue, expectedSchema)).toBe(true);
  });
});
