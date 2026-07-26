import { Dinheiro } from "@minimusrh/dominio";
import type { Classificacao } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { CLASSIFICACAO_INCIDE_PREVIDENCIA } from "./catalogo-rubricas.js";
import { REGRA_CONTRIBUICAO_PREVIDENCIA_V1 } from "./regra-contribuicao-previdencia.js";
import { criarContextoFake } from "./testes/contexto-fake.js";

function ctxComBase(base: string) {
  return criarContextoFake({
    somasPorClassificacao: new Map<Classificacao, Dinheiro>([[CLASSIFICACAO_INCIDE_PREVIDENCIA, Dinheiro.de(base)]]),
  });
}

describe("regra contribuicao_previdencia", () => {
  it("quando() é falso quando a base (soma por classificação) é zero", () => {
    const ctx = criarContextoFake();
    expect(REGRA_CONTRIBUICAO_PREVIDENCIA_V1.quando(ctx)).toBe(false);
  });

  it("quando() é verdadeiro quando há base positiva", () => {
    expect(REGRA_CONTRIBUICAO_PREVIDENCIA_V1.quando(ctxComBase("5000.00"))).toBe(true);
  });

  it("aplica a tabela progressiva marginal sobre a base somada por classificação", () => {
    // 1500*7.5% + 1500*9% + 1500*12% + 500*14% = 112.50 + 135.00 + 180.00 + 70.00
    expect(REGRA_CONTRIBUICAO_PREVIDENCIA_V1.calcular(ctxComBase("5000.00")).paraString()).toBe("497.50");
  });

  it("base dentro da primeira faixa: só a primeira alíquota incide", () => {
    // 1000 * 7.5%
    expect(REGRA_CONTRIBUICAO_PREVIDENCIA_V1.calcular(ctxComBase("1000.00")).paraString()).toBe("75.00");
  });
});
