import type { DerivacaoChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { DERIVACAO_CARGO } from "./derivacao-cargo.js";
import { DERIVACAO_DIAS_TRABALHADOS, type DiasTrabalhados } from "./derivacao-dias-trabalhados.js";
import { REGRA_SALARIO_BASE_V1 } from "./regra-salario-base.js";
import { criarContextoFake } from "./testes/contexto-fake.js";

describe("regra salario_base", () => {
  it("quando() é falso sem cargo derivável", () => {
    const ctx = criarContextoFake();
    expect(REGRA_SALARIO_BASE_V1.quando(ctx)).toBe(false);
  });

  it("quando() é verdadeiro com cargo derivável", () => {
    const ctx = criarContextoFake({ derivacoes: new Map([[DERIVACAO_CARGO, "B6"]]) });
    expect(REGRA_SALARIO_BASE_V1.quando(ctx)).toBe(true);
  });

  it("sem dias_trabalhados (derivação não aplicável): paga o valor integral do cargo", () => {
    const ctx = criarContextoFake({ derivacoes: new Map([[DERIVACAO_CARGO, "B6"]]) });
    expect(REGRA_SALARIO_BASE_V1.calcular(ctx).paraString()).toBe("5000.00");
  });

  it("mês cheio (dias === diasNoMes): paga o valor integral, sem passar pela divisão", () => {
    const diasInfo: DiasTrabalhados = { dias: 30, diasNoMes: 30 };
    const ctx = criarContextoFake({
      derivacoes: new Map<DerivacaoChave, unknown>([
        [DERIVACAO_CARGO, "B8"],
        [DERIVACAO_DIAS_TRABALHADOS, diasInfo],
      ]),
    });
    expect(REGRA_SALARIO_BASE_V1.calcular(ctx).paraString()).toBe("6200.00");
  });

  it("entrada no dia 15 (fator 15/30): paga metade do valor integral", () => {
    const diasInfo: DiasTrabalhados = { dias: 15, diasNoMes: 30 };
    const ctx = criarContextoFake({
      derivacoes: new Map<DerivacaoChave, unknown>([
        [DERIVACAO_CARGO, "B6"],
        [DERIVACAO_DIAS_TRABALHADOS, diasInfo],
      ]),
    });
    expect(REGRA_SALARIO_BASE_V1.calcular(ctx).paraString()).toBe("2500.00");
  });

  it("cargo fora da tabela salarial: lança erro explícito", () => {
    const ctx = criarContextoFake({ derivacoes: new Map([[DERIVACAO_CARGO, "Z9"]]) });
    expect(() => REGRA_SALARIO_BASE_V1.calcular(ctx)).toThrow(/Z9/);
  });

  it("calcular() sem cargo algum (defensivo — quando() já teria barrado isso): lança erro explícito", () => {
    const ctx = criarContextoFake();
    expect(() => REGRA_SALARIO_BASE_V1.calcular(ctx)).toThrow(/cargo/);
  });
});
