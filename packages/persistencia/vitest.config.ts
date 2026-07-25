import { defineConfig } from "vitest/config";

// Diferente do dominio/motor: os testes de integração deste pacote precisam de mais
// tempo (subida de container Testcontainers + migrações reais); timeout ampliado só
// para eles. src/testes/ é suporte (sobe ambiente, fixtures), não fonte de lógica
// coberta por unit test.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts", "src/testes/**"],
      thresholds: {
        100: true,
      },
    },
  },
});
