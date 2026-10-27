import { describe, expect, it, vi } from "vitest";
import { databaseExecutor } from "@/features/executions/components/database/executor";
import { getSignature } from "../../signatures";
import { conforms } from "../helpers/conforms";
import { makeFakeStep } from "../helpers/fake-step";

vi.mock("pg", () => {
  return {
    Client: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({
        rows: [{ id: 1, name: "Sample" }],
        rowCount: 1,
        command: "SELECT",
        fields: [{ name: "id" }, { name: "name" }],
      }),
      end: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe("DATABASE Contract Test", () => {
  it("output context conforms to signature.output(data)", async () => {
    const data = {
      variableName: "dbResult",
      connectionString: "postgresql://localhost/test",
      query: "SELECT id, name FROM users",
    };

    const sig = getSignature("DATABASE");
    expect(sig).toBeDefined();

    const fakeStep = makeFakeStep();
    const fakePublish = vi.fn().mockResolvedValue(undefined);

    const resContext = await databaseExecutor({
      data,
      nodeId: "node-db",
      userId: "user-1",
      context: {},
      step: fakeStep,
      publish: fakePublish,
    });

    const outputValue = resContext[data.variableName];
    expect(outputValue).toBeDefined();

    if (!sig) throw new Error("Missing DATABASE signature");
    const expectedSchema = sig.output(data);
    expect(conforms(outputValue, expectedSchema)).toBe(true);
  });
});
