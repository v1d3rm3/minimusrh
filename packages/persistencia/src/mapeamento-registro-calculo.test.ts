import { Dinheiro } from "@minimusrh/dominio";
import type { FolhaId, HistoriaId, NoExplicacao, RegistroCalculo, RegraChave, RubricaChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import {
  linhaParaRegistroCalculo,
  registroCalculoParaParametrosInsercao,
  type LinhaRegistroCalculo,
} from "./mapeamento-registro-calculo.js";

const EXPLICACAO: NoExplicacao = {
  descricao: "base = soma das rubricas 'incide_previdencia'",
  valor: "1234.56",
  fontes: [
    { tipo: "rubrica", chave: "salario_base" as RubricaChave, valor: "1000.00" },
    { tipo: "no", no: { descricao: "gratificacao", valor: "234.56", fontes: [] } },
  ],
};

function registro(sobrescritas: Partial<RegistroCalculo> = {}): RegistroCalculo {
  return {
    folhaId: "fo1" as FolhaId,
    historiaId: "h1" as HistoriaId,
    rubrica: "salario_base" as RubricaChave,
    versaoRubrica: 1,
    regra: "salario_base" as RegraChave,
    versaoRegra: 1,
    valor: Dinheiro.de("1234.56"),
    explicacao: EXPLICACAO,
    ...sobrescritas,
  };
}

describe("registroCalculoParaParametrosInsercao", () => {
  it("serializa valor via Dinheiro.paraString (nunca number)", () => {
    const params = registroCalculoParaParametrosInsercao(registro());
    expect(params.valor).toBe("1234.56");
    expect(typeof params.valor).toBe("string");
  });

  it("serializa explicacao como JSON", () => {
    const params = registroCalculoParaParametrosInsercao(registro());
    expect(JSON.parse(params.explicacao)).toEqual(EXPLICACAO);
  });

  it("precisao decimal exata: 0.10 + 0.10 + 0.10 bate com Dinheiro, nao com float", () => {
    const tresParcelas = [Dinheiro.de("0.10"), Dinheiro.de("0.10"), Dinheiro.de("0.10")];
    const somaEsperada = tresParcelas.reduce((acc, d) => acc.somar(d), Dinheiro.zero());
    const params = registroCalculoParaParametrosInsercao(registro({ valor: somaEsperada }));
    expect(params.valor).toBe("0.30");
    expect(0.1 + 0.1 + 0.1).not.toBe(0.3); // o perigo que Dinheiro existe para evitar (Roteiro §2.5.2)
  });
});

describe("linhaParaRegistroCalculo", () => {
  function linhaBase(sobrescritas: Partial<LinhaRegistroCalculo> = {}): LinhaRegistroCalculo {
    return {
      folha_id: "fo1",
      historia_id: "h1",
      rubrica: "salario_base",
      versao_rubrica: 1,
      regra: "salario_base",
      versao_regra: 1,
      valor: "1234.56",
      explicacao: EXPLICACAO,
      ...sobrescritas,
    };
  }

  it("reconstroi Dinheiro exato a partir da string do NUMERIC", () => {
    const registroCalculo = linhaParaRegistroCalculo(linhaBase());
    expect(registroCalculo.valor.paraString()).toBe("1234.56");
  });

  it("nao converte o valor por conversao numerica nativa (a string vai direto para Dinheiro.de)", () => {
    const registroCalculo = linhaParaRegistroCalculo(linhaBase({ valor: "0.10" }));
    expect(registroCalculo.valor.paraString()).toBe("0.10");
  });

  it("round-trip completo: registro -> parametros -> linha simulada -> registro", () => {
    const original = registro();
    const params = registroCalculoParaParametrosInsercao(original);
    const linhaSimulada: LinhaRegistroCalculo = {
      folha_id: params.folha_id,
      historia_id: params.historia_id,
      rubrica: params.rubrica,
      versao_rubrica: params.versao_rubrica,
      regra: params.regra,
      versao_regra: params.versao_regra,
      valor: params.valor,
      explicacao: JSON.parse(params.explicacao),
    };
    const reconstruido = linhaParaRegistroCalculo(linhaSimulada);
    expect(reconstruido.valor.paraString()).toBe(original.valor.paraString());
    expect(reconstruido).toEqual({ ...original, valor: reconstruido.valor });
  });
});
