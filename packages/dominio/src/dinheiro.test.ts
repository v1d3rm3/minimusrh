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

    describe("casos de borda ('2.005', '2.675' e seus negativos)", () => {
      it.each([
        ["2.005", "meio_para_cima", "2.01"],
        ["2.005", "truncar", "2.00"],
        ["2.005", "banqueiro", "2.00"],
        ["2.675", "meio_para_cima", "2.68"],
        ["2.675", "truncar", "2.67"],
        ["2.675", "banqueiro", "2.68"],
        ["-2.005", "meio_para_cima", "-2.01"],
        ["-2.005", "truncar", "-2.00"],
        ["-2.005", "banqueiro", "-2.00"],
        ["-2.675", "meio_para_cima", "-2.68"],
        ["-2.675", "truncar", "-2.67"],
        ["-2.675", "banqueiro", "-2.68"],
      ] as const)("%s.arredondar('%s') === '%s'", (valor, politica, esperado) => {
        expect(Dinheiro.de(valor).arredondar(politica).paraString()).toBe(esperado);
      });
    });
  });

  describe("paraString()", () => {
    it("sempre retorna 2 casas decimais", () => {
      expect(Dinheiro.de("10").paraString()).toBe("10.00");
      expect(Dinheiro.de("10.1").paraString()).toBe("10.10");
    });
  });

  describe("o teste-documento do float", () => {
    // number NÃO representa dinheiro: em IEEE-754, 0.10 + 0.20 === 0.30000000000000004,
    // e um loop de 10.000 somas de 0.01 em float acumula erro visível no resultado final.
    // Dinheiro.de() só aceita string/bigint — a aritmética inteira é feita por decimal.js,
    // então essas mesmas contas fecham exatas.
    it("0.10 + 0.20 é exatamente '0.30' (não 0.30000000000000004, como em number)", () => {
      expect(0.1 + 0.2).not.toBe(0.3); // documenta a armadilha que Dinheiro existe para evitar
      expect(Dinheiro.de("0.10").somar(Dinheiro.de("0.20")).paraString()).toBe("0.30");
    });

    it("soma de 10.000 parcelas de '0.01' é exatamente '100.00'", () => {
      let total = Dinheiro.zero();
      for (let i = 0; i < 10_000; i++) {
        total = total.somar(Dinheiro.de("0.01"));
      }
      expect(total.paraString()).toBe("100.00");
    });
  });
});
