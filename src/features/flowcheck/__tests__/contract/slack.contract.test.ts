import { describe, expect, it, vi } from "vitest";
import { slackExecutor } from "@/features/executions/components/slack/executor";
import { getSignature } from "../../signatures";
import { conforms } from "../helpers/conforms";
import { makeFakeStep } from "../helpers/fake-step";

vi.mock("ky", () => ({
  default: {
    post: vi.fn().mockResolvedValue({}),
  },
}));

describe("SLACK Contract Test", () => {
  it("output context conforms to signature.output(data)", async () => {
    const data = {
      variableName: "slackMsg",
      webhookUrl: "https://hooks.slack.com/services/test",
      content: "Hello Slack!",
    };

    const sig = getSignature("SLACK");
    expect(sig).toBeDefined();

    const fakeStep = makeFakeStep();
    const fakePublish = vi.fn().mockResolvedValue(undefined);

    const resContext = await slackExecutor({
      data,
      nodeId: "node-slack",
      userId: "user-1",
      context: {},
      step: fakeStep,
      publish: fakePublish,
    });

    const outputValue = resContext[data.variableName];
    expect(outputValue).toBeDefined();

    if (!sig) throw new Error("Missing SLACK signature");
    const expectedSchema = sig.output(data);
    expect(conforms(outputValue, expectedSchema)).toBe(true);
  });
});
