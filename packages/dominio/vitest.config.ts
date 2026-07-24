import { defineConfig } from "vitest/config";

// Meta de cobertura (PROMPT_Claude_Code_Dominio.md): 100% nos módulos com lógica —
// dinheiro, percentual, tempo (competencia.ts), vigencia, normalizacao-amparo, amparo
// e folha (a tabela TRANSICOES). Módulos só-de-tipos (catalogo*.ts, contexto.ts,
// derivacao.ts, fato.ts, linha-do-tempo.ts, regra.ts, rubrica.ts, registro-calculo.ts,
// tipos.ts) não têm código executável e ficam fora do denominador de cobertura.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "src/dinheiro.ts",
        "src/percentual.ts",
        "src/competencia.ts",
        "src/vigencia.ts",
        "src/normalizacao-amparo.ts",
        "src/amparo.ts",
        "src/folha.ts",
      ],
      thresholds: {
        100: true,
      },
    },
  },
});
