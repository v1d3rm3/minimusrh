import { dataEfeito, dataRegistro, versaoVigente } from "@minimusrh/dominio";
import type { DerivacaoChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { DERIVACAO_CARGO } from "./derivacao-cargo.js";
import { DERIVACAO_DIAS_TRABALHADOS, type DiasTrabalhados } from "./derivacao-dias-trabalhados.js";
import { DERIVACAO_PERIODOS_CARGO, type PeriodosCargo } from "./derivacao-periodos-cargo.js";
import { REGRA_SALARIO_BASE_V1, REGRA_SALARIO_BASE_V2 } from "./regra-salario-base.js";
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

function ctxComPeriodos(periodos: PeriodosCargo["periodos"]) {
  const info: PeriodosCargo = { periodos, diasNoMes: 30 };
  return criarContextoFake({ derivacoes: new Map<DerivacaoChave, unknown>([[DERIVACAO_PERIODOS_CARGO, info]]) });
}

describe("regra salario_base V2 (períodos de cargo, ver DECISOES #14)", () => {
  it("quando() é falso sem periodos_cargo derivável e verdadeiro com", () => {
    expect(REGRA_SALARIO_BASE_V2.quando(criarContextoFake())).toBe(false);
    expect(REGRA_SALARIO_BASE_V2.quando(ctxComPeriodos([]))).toBe(true);
  });

  it("um cargo no mês inteiro: paga o valor integral", () => {
    expect(REGRA_SALARIO_BASE_V2.calcular(ctxComPeriodos([{ cargo: "B8", dias: 30 }])).paraString()).toBe("6200.00");
  });

  it("Victor em 02/2026: 14/30 de B6 + 16/30 de B8 = 5640,00", () => {
    const ctx = ctxComPeriodos([
      { cargo: "B6", dias: 14 },
      { cargo: "B8", dias: 16 },
    ]);
    expect(REGRA_SALARIO_BASE_V2.calcular(ctx).paraString()).toBe("5640.00");
  });

  it("entrada no dia 15 (um período de 15 dias): mesmo valor da V1 — a V2 só muda o caso de troca de cargo", () => {
    expect(REGRA_SALARIO_BASE_V2.calcular(ctxComPeriodos([{ cargo: "B6", dias: 15 }])).paraString()).toBe("2500.00");
  });

  it("nenhum dia trabalhado: zero", () => {
    expect(REGRA_SALARIO_BASE_V2.calcular(ctxComPeriodos([])).paraString()).toBe("0.00");
  });

  it("cargo fora da tabela salarial: lança erro explícito", () => {
    expect(() => REGRA_SALARIO_BASE_V2.calcular(ctxComPeriodos([{ cargo: "Z9", dias: 30 }]))).toThrow(/Z9/);
  });

  it("calcular() sem periodos_cargo (defensivo — quando() já teria barrado isso): lança erro explícito", () => {
    expect(() => REGRA_SALARIO_BASE_V2.calcular(criarContextoFake())).toThrow(/periodos_cargo/);
  });

  it("vigência: mesmo efeito da V1, publicada depois — corte anterior à publicação ainda resolve a V1", () => {
    const versoes = [REGRA_SALARIO_BASE_V1, REGRA_SALARIO_BASE_V2];
    const em = dataEfeito("2026-02-28");
    expect(REGRA_SALARIO_BASE_V2.dataEfeito).toBe(REGRA_SALARIO_BASE_V1.dataEfeito);
    expect(versaoVigente(versoes, em, dataRegistro("2026-08-01T00:00:00Z"))?.versao).toBe(1);
    expect(versaoVigente(versoes, em, dataRegistro("2026-10-22T00:00:00Z"))?.versao).toBe(2);
  });
});
