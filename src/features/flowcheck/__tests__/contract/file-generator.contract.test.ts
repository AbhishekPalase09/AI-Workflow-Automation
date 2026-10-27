import { describe, expect, it, vi } from "vitest";
import { fileGeneratorExecutor } from "@/features/executions/components/file-generator/executor";
import { getSignature } from "../../signatures";
import { conforms } from "../helpers/conforms";
import { makeFakeStep } from "../helpers/fake-step";

describe("FILE_GENERATOR Contract Test", () => {
  it("output context conforms to signature.output(data)", async () => {
    const data = {
      variableName: "myGeneratedFile",
      format: "CSV" as const,
      filename: "export.csv",
      content: "id,name\n1,Alice",
    };

    const sig = getSignature("FILE_GENERATOR");
    expect(sig).toBeDefined();

    const fakeStep = makeFakeStep();
    const fakePublish = vi.fn().mockResolvedValue(undefined);

    const resContext = await fileGeneratorExecutor({
      data,
      nodeId: "node-fg",
      userId: "user-1",
      context: {},
      step: fakeStep,
      publish: fakePublish,
    });

    const outputValue = resContext[data.variableName];
    expect(outputValue).toBeDefined();

    if (!sig) throw new Error("Missing FILE_GENERATOR signature");
    const expectedSchema = sig.output(data);
    expect(conforms(outputValue, expectedSchema)).toBe(true);
  });
});
