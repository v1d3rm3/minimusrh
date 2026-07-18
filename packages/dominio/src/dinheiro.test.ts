import { describe, expect, it } from "vitest";
import { Dinheiro } from "./dinheiro.js";
import { Percentual } from "./percentual.js";

describe("Dinheiro", () => {
  describe("criação", () => {
    it("de() cria a partir de uma string", () => {
      expect(Dinheiro.de("10").paraString()).toBe("10.00");
    });

    it("deCentavos() converte bigint de centavos", () => {
      expect(Dinheiro.deCentavos(1050n).paraString()).toBe("10.50");
    });

    it("zero() é zero", () => {
      expect(Dinheiro.zero().paraString()).toBe("0.00");
      expect(Dinheiro.zero().ehZero()).toBe(true);
    });
  });

  describe("aritmética", () => {
    it("somar() soma dois valores", () => {
      expect(Dinheiro.de("10").somar(Dinheiro.de("5")).paraString()).toBe("15.00");
    });

    it("subtrair() subtrai dois valores", () => {
      expect(Dinheiro.de("10").subtrair(Dinheiro.de("3")).paraString()).toBe("7.00");
    });

    it("subtrair() pode resultar em negativo", () => {
      expect(Dinheiro.de("3").subtrair(Dinheiro.de("10")).paraString()).toBe("-7.00");
    });

    it("vezes() aplica um Percentual", () => {
      expect(Dinheiro.de("200").vezes(Percentual.de("15")).paraString()).toBe("30.00");
    });

    it("dividirPor() divide por um número", () => {
      expect(Dinheiro.de("10").dividirPor(4).paraString()).toBe("2.50");
    });
  });

  describe("comparação", () => {
    it("menorEntre() retorna o menor valor", () => {
      expect(Dinheiro.de("10").menorEntre(Dinheiro.de("5")).paraString()).toBe("5.00");
      expect(Dinheiro.de("5").menorEntre(Dinheiro.de("10")).paraString()).toBe("5.00");
    });

    it("maiorEntre() retorna o maior valor", () => {
      expect(Dinheiro.de("10").maiorEntre(Dinheiro.de("5")).paraString()).toBe("10.00");
      expect(Dinheiro.de("5").maiorEntre(Dinheiro.de("10")).paraString()).toBe("10.00");
    });

    it("maiorQue() compara estritamente", () => {
      expect(Dinheiro.de("10").maiorQue(Dinheiro.de("5"))).toBe(true);
      expect(Dinheiro.de("5").maiorQue(Dinheiro.de("10"))).toBe(false);
      expect(Dinheiro.de("5").maiorQue(Dinheiro.de("5"))).toBe(false);
    });

    it("ehZero() identifica valor zero", () => {
      expect(Dinheiro.de("0").ehZero()).toBe(true);
      expect(Dinheiro.de("1").ehZero()).toBe(false);
    });

    it("ehNegativo() identifica valor negativo", () => {
      expect(Dinheiro.de("-5").ehNegativo()).toBe(true);
      expect(Dinheiro.de("0").ehNegativo()).toBe(false);
      expect(Dinheiro.de("5").ehNegativo()).toBe(false);
    });
  });

  describe("arredondar()", () => {
    it("meio_para_cima arredonda 0.5 para cima", () => {
      expect(Dinheiro.de("2.345").arredondar("meio_para_cima").paraString()).toBe("2.35");
    });

    it("truncar descarta as casas excedentes", () => {
      expect(Dinheiro.de("2.345").arredondar("truncar").paraString()).toBe("2.34");
    });

    it("banqueiro arredonda para o dígito par mais próximo", () => {
      expect(Dinheiro.de("2.345").arredondar("banqueiro").paraString()).toBe("2.34");
      expect(Dinheiro.de("2.355").arredondar("banqueiro").paraString()).toBe("2.36");
    });
  });

  describe("paraString()", () => {
    it("sempre retorna 2 casas decimais", () => {
      expect(Dinheiro.de("10").paraString()).toBe("10.00");
      expect(Dinheiro.de("10.1").paraString()).toBe("10.10");
    });
  });
});
