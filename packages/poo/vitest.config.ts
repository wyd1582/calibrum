import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/cli.ts", "src/index.ts"],
      thresholds: {
        // Verifier logic must be fully covered (handoff Task B requirement).
        "src/verify.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "src/chain.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "src/physics.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "src/merkle.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "src/tamper.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        "src/canonical.ts": { lines: 100, functions: 100, branches: 100, statements: 100 },
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
});
