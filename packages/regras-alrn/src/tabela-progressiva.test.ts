import { Dinheiro, Percentual } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { aplicarTabelaProgressiva, type FaixaProgressiva } from "./tabela-progressiva.js";

const FAIXAS: readonly FaixaProgressiva[] = [
  { ate: Dinheiro.de("1500.00"), aliquota: Percentual.de("10") },
  { ate: Dinheiro.de("3000.00"), aliquota: Percentual.de("20") },
  { ate: "infinito", aliquota: Percentual.de("30") },
];

describe("aplicarTabelaProgressiva", () => {
  it("base zero não gera contribuição", () => {
    expect(aplicarTabelaProgressiva(FAIXAS, Dinheiro.zero()).paraString()).toBe("0.00");
  });

  it("base dentro da primeira faixa: só a primeira alíquota incide", () => {
    expect(aplicarTabelaProgressiva(FAIXAS, Dinheiro.de("1000.00")).paraString()).toBe("100.00");
  });

  it("base EXATAMENTE na fronteira da 1ª faixa: a fronteira pertence à faixa em que aparece", () => {
    expect(aplicarTabelaProgressiva(FAIXAS, Dinheiro.de("1500.00")).paraString()).toBe("150.00");
  });

  it("base dentro da segunda faixa: soma marginal das duas primeiras faixas", () => {
    // 1500 * 10% + 500 * 20% = 150 + 100
    expect(aplicarTabelaProgressiva(FAIXAS, Dinheiro.de("2000.00")).paraString()).toBe("250.00");
  });

  it("base EXATAMENTE na fronteira da 2ª faixa", () => {
    // 1500 * 10% + 1500 * 20% = 150 + 300
    expect(aplicarTabelaProgressiva(FAIXAS, Dinheiro.de("3000.00")).paraString()).toBe("450.00");
  });

  it("base na faixa 'infinito': soma marginal das três faixas", () => {
    // 1500*10% + 1500*20% + 1000*30% = 150 + 300 + 300
    expect(aplicarTabelaProgressiva(FAIXAS, Dinheiro.de("4000.00")).paraString()).toBe("750.00");
  });

  it("tabela com uma única faixa 'infinito' equivale a alíquota fixa sobre a base inteira", () => {
    const faixaUnica: readonly FaixaProgressiva[] = [{ ate: "infinito", aliquota: Percentual.de("15") }];
    expect(aplicarTabelaProgressiva(faixaUnica, Dinheiro.de("200.00")).paraString()).toBe("30.00");
  });
});
