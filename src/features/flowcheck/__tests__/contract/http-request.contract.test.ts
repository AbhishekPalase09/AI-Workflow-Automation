import { describe, expect, it, vi } from "vitest";
import { httpRequestExecutor } from "@/features/executions/components/http-request/executor";
import { getSignature } from "../../signatures";
import { conforms } from "../helpers/conforms";
import { makeFakeStep } from "../helpers/fake-step";

// Mock ky
vi.mock("ky", () => {
  const mockKyFn = vi.fn().mockResolvedValue({
    status: 200,
    statusText: "OK",
    headers: {
      get: (header: string) =>
        header === "content-type" ? "application/json" : null,
    },
    json: async () => ({ id: 42, name: "Test User" }),
    text: async () => JSON.stringify({ id: 42, name: "Test User" }),
  });
  return {
    default: Object.assign(mockKyFn, {
      post: vi.fn(),
      get: mockKyFn,
      put: mockKyFn,
      patch: mockKyFn,
      delete: mockKyFn,
    }),
  };
});

describe("HTTP_REQUEST Contract Test", () => {
  it("output context conforms to signature.output(data)", async () => {
    const data = {
      variableName: "myHttpCall",
      endpoint: "https://api.example.com/users",
      method: "GET" as const,
    };

    const sig = getSignature("HTTP_REQUEST");
    expect(sig).toBeDefined();

    const fakeStep = makeFakeStep();
    const fakePublish = vi.fn().mockResolvedValue(undefined);

    const initialContext = {};
    const resContext = await httpRequestExecutor({
      data,
      nodeId: "node-1",
      userId: "user-1",
      context: initialContext,
      step: fakeStep,
      publish: fakePublish,
    });

    const outputValue = resContext[data.variableName];
    expect(outputValue).toBeDefined();

    if (!sig) throw new Error("Missing HTTP_REQUEST signature");
    const expectedSchema = sig.output(data);
    expect(conforms(outputValue, expectedSchema)).toBe(true);
  });
});
