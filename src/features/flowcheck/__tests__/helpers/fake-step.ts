import type { NodeExecutor } from "@/features/executions/types";

// Inngest step mock for testing executors in isolation without spinning up Inngest engine
export function makeFakeStep(): Parameters<NodeExecutor>[0]["step"] {
  const fake = {
    run: async <T>(_name: string, fn: () => Promise<T> | T): Promise<T> => fn(),
    ai: {
      wrap: async <T>(
        _name: string,
        fn: (...args: unknown[]) => Promise<T>,
        ...args: unknown[]
      ): Promise<T> => fn(...args),
    },
  };
  // Cast required to satisfy Inngest StepTools interface in isolated test
  return fake as unknown as Parameters<NodeExecutor>[0]["step"];
}
