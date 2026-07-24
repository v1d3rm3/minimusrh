import { defineConfig } from "vitest/config";

// Diferente do dominio, todo módulo de motor tem lógica executável (é o pacote de
// execução) — só index.ts (reexports) fica fora do denominador de cobertura.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: {
        100: true,
      },
    },
  },
});
