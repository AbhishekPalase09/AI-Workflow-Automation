import { describe, expect, it, vi } from "vitest";
import { googleFormTriggerExecutor } from "@/features/triggers/components/google-form-trigger/executor";
import { manualTriggerExecutor } from "@/features/triggers/components/manual-trigger/executor";
import { stripeTriggerExecutor } from "@/features/triggers/components/stripe-trigger/executor";
import { telegramTriggerExecutor } from "@/features/triggers/components/telegram-trigger/executor";
import { getSignature } from "../../signatures";
import { conforms } from "../helpers/conforms";
import { makeFakeStep } from "../helpers/fake-step";

describe("Trigger Contract Tests", () => {
  const fakeStep = makeFakeStep();
  const fakePublish = vi.fn().mockResolvedValue(undefined);

  it("MANUAL_TRIGGER passes through context", async () => {
    const initialContext = { existing: "value" };
    const res = await manualTriggerExecutor({
      data: {},
      nodeId: "t-manual",
      userId: "u-1",
      context: initialContext,
      step: fakeStep,
      publish: fakePublish,
    });
    expect(res).toEqual(initialContext);
  });

  it("GOOGLE_FORM_TRIGGER context conforms to signature.output()", async () => {
    const seededPayload = {
      googleForm: {
        formId: "form-123",
        formTitle: "Feedback",
        responseId: "resp-1",
        timestamp: "2026-10-27T10:00:00Z",
        respondentEmail: "test@example.com",
        responses: { q1: "great" },
      },
    };

    const sig = getSignature("GOOGLE_FORM_TRIGGER");
    expect(sig).toBeDefined();

    const res = await googleFormTriggerExecutor({
      data: {},
      nodeId: "t-gf",
      userId: "u-1",
      context: seededPayload,
      step: fakeStep,
      publish: fakePublish,
    });

    if (!sig) throw new Error("Missing GOOGLE_FORM_TRIGGER signature");
    const expectedSchema = sig.output({});
    expect(conforms(res.googleForm, expectedSchema)).toBe(true);
  });

  it("STRIPE_TRIGGER context conforms to signature.output()", async () => {
    const seededPayload = {
      stripe: {
        eventId: "evt_123",
        eventType: "payment_intent.succeeded",
        timestamp: 1600000000,
        livemode: false,
      },
    };

    const sig = getSignature("STRIPE_TRIGGER");
    expect(sig).toBeDefined();

    const res = await stripeTriggerExecutor({
      data: {},
      nodeId: "t-stripe",
      userId: "u-1",
      context: seededPayload,
      step: fakeStep,
      publish: fakePublish,
    });

    if (!sig) throw new Error("Missing STRIPE_TRIGGER signature");
    const expectedSchema = sig.output({});
    expect(conforms(res.stripe, expectedSchema)).toBe(true);
  });

  it("TELEGRAM_TRIGGER context conforms to signature.output()", async () => {
    const seededPayload = {
      telegram: {
        updateId: 100,
        messageId: 200,
        text: "/start",
        chatId: 12345,
        chatType: "private",
        sender: {
          id: 12345,
          name: "John Doe",
          username: "johndoe",
          firstName: "John",
          lastName: "Doe",
          isBot: false,
        },
        date: 1600000000,
      },
    };

    const sig = getSignature("TELEGRAM_TRIGGER");
    expect(sig).toBeDefined();

    const res = await telegramTriggerExecutor({
      data: {},
      nodeId: "t-tg",
      userId: "u-1",
      context: seededPayload,
      step: fakeStep,
      publish: fakePublish,
    });

    if (!sig) throw new Error("Missing TELEGRAM_TRIGGER signature");
    const expectedSchema = sig.output({});
    expect(conforms(res.telegram, expectedSchema)).toBe(true);
  });
});
