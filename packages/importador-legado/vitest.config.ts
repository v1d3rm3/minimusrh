import { defineConfig } from "vitest/config";

// Como persistencia e app-folha: os testes de integração (`*.integracao.test.ts`) sobem um
// Postgres via Testcontainers, então o timeout é ampliado. src/testes/ é suporte (ambiente,
// destino em memória) e src/bin/ é o ponto de entrada da CLI (só repassa para `cli.ts`).
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/testes/**", "src/bin/**"],
      thresholds: {
        100: true,
      },
    },
  },
});
