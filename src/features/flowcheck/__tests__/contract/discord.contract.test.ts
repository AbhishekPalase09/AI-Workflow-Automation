import { describe, expect, it, vi } from "vitest";
import { discordExecutor } from "@/features/executions/components/discord/executor";
import { getSignature } from "../../signatures";
import { conforms } from "../helpers/conforms";
import { makeFakeStep } from "../helpers/fake-step";

vi.mock("ky", () => ({
  default: {
    post: vi.fn().mockResolvedValue({}),
  },
}));

describe("DISCORD Contract Test", () => {
  it("output context conforms to signature.output(data)", async () => {
    const data = {
      variableName: "discordMsg",
      webhookUrl: "https://discord.com/api/webhooks/test",
      content: "Hello Discord!",
    };

    const sig = getSignature("DISCORD");
    expect(sig).toBeDefined();

    const fakeStep = makeFakeStep();
    const fakePublish = vi.fn().mockResolvedValue(undefined);

    const resContext = await discordExecutor({
      data,
      nodeId: "node-discord",
      userId: "user-1",
      context: {},
      step: fakeStep,
      publish: fakePublish,
    });

    const outputValue = resContext[data.variableName];
    expect(outputValue).toBeDefined();

    if (!sig) throw new Error("Missing DISCORD signature");
    const expectedSchema = sig.output(data);
    expect(conforms(outputValue, expectedSchema)).toBe(true);
  });
});
