import { defineConfig } from "vitest/config";

// Como persistencia: os testes de integração (golden test, serviço, leitor de janelas)
// sobem um Postgres via Testcontainers, então o timeout é ampliado. src/testes/ é suporte
// (ambiente, semeadura do Victor) e src/demo/ é o script `demo:victor` — nenhum dos dois é
// fonte de lógica coberta por unit test.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/testes/**", "src/demo/**"],
      thresholds: {
        100: true,
      },
    },
  },
});
