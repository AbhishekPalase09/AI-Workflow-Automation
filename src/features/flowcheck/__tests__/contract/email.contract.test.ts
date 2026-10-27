import { describe, expect, it, vi } from "vitest";
import { emailExecutor } from "@/features/executions/components/email/executor";
import { getSignature } from "../../signatures";
import { conforms } from "../helpers/conforms";
import { makeFakeStep } from "../helpers/fake-step";

vi.mock("@/lib/db", () => ({
  default: {
    credential: {
      findUnique: vi.fn().mockResolvedValue({
        id: "cred-1",
        value: "re_123456789",
      }),
    },
  },
}));

vi.mock("ky", () => ({
  default: {
    post: vi.fn().mockReturnValue({
      json: async () => ({ id: "email-msg-123" }),
    }),
  },
}));

describe("EMAIL Contract Test", () => {
  it("output context conforms to signature.output(data)", async () => {
    const data = {
      variableName: "emailSent",
      credentialId: "cred-1",
      to: "recipient@example.com",
      from: "sender@example.com",
      subject: "Test Subject",
      body: "<p>Hello</p>",
    };

    const sig = getSignature("EMAIL");
    expect(sig).toBeDefined();

    const fakeStep = makeFakeStep();
    const fakePublish = vi.fn().mockResolvedValue(undefined);

    const resContext = await emailExecutor({
      data,
      nodeId: "node-email",
      userId: "user-1",
      context: {},
      step: fakeStep,
      publish: fakePublish,
    });

    const outputValue = resContext[data.variableName];
    expect(outputValue).toBeDefined();

    if (!sig) throw new Error("Missing EMAIL signature");
    const expectedSchema = sig.output(data);
    expect(conforms(outputValue, expectedSchema)).toBe(true);
  });
});
