import { defineConfig } from "vitest/config";

// Como motor: quase todo módulo daqui tem lógica executável (catálogos com fábricas,
// derivações, regras, tabela progressiva) — só index.ts (reexports) fica fora do
// denominador de cobertura. testes/contexto-fake.ts é suporte de teste, não fonte de
// lógica de domínio coberta por unit test.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
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
