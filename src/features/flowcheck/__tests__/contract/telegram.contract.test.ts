import { describe, expect, it, vi } from "vitest";
import { telegramExecutor } from "@/features/executions/components/telegram/executor";
import { getSignature } from "../../signatures";
import { conforms } from "../helpers/conforms";
import { makeFakeStep } from "../helpers/fake-step";

vi.mock("@/lib/db", () => ({
  default: {
    credential: {
      findUnique: vi.fn().mockResolvedValue({
        id: "cred-1",
        value: "tg-bot-token",
      }),
    },
  },
}));

vi.mock("ky", () => ({
  default: {
    post: vi.fn().mockReturnValue({
      json: async () => ({
        ok: true,
        result: {
          message_id: 999,
          chat: { id: 12345, title: "My Chat" },
          text: "Hello Telegram",
          date: 1600000000,
        },
      }),
    }),
  },
}));

describe("TELEGRAM Contract Test", () => {
  it("output context conforms to signature.output(data)", async () => {
    const data = {
      variableName: "telegramMsg",
      credentialId: "cred-1",
      chatId: "12345",
      text: "Hello Telegram",
    };

    const sig = getSignature("TELEGRAM");
    expect(sig).toBeDefined();

    const fakeStep = makeFakeStep();
    const fakePublish = vi.fn().mockResolvedValue(undefined);

    const resContext = await telegramExecutor({
      data,
      nodeId: "node-tg",
      userId: "user-1",
      context: {},
      step: fakeStep,
      publish: fakePublish,
    });

    const outputValue = resContext[data.variableName];
    expect(outputValue).toBeDefined();

    if (!sig) throw new Error("Missing TELEGRAM signature");
    const expectedSchema = sig.output(data);
    expect(conforms(outputValue, expectedSchema)).toBe(true);
  });
});
