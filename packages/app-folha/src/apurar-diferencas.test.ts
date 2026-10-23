import { Dinheiro } from "@minimusrh/dominio";
import type { FolhaId, HistoriaId, RegistroCalculo, RegraChave, RubricaChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { diferencasEntre } from "./apurar-diferencas.js";

function registro(historiaId: string, rubrica: string, valor: string, descricao = "d"): RegistroCalculo {
  return {
    folhaId: "folha" as FolhaId,
    historiaId: historiaId as HistoriaId,
    rubrica: rubrica as RubricaChave,
    versaoRubrica: 1,
    regra: rubrica as string as RegraChave,
    versaoRegra: 1,
    valor: Dinheiro.de(valor),
    explicacao: { descricao, fontes: [] },
  };
}

function resumo(diferencas: ReturnType<typeof diferencasEntre>) {
  return diferencas.map((d) => [d.historiaId, d.rubrica, d.valorPago.paraString(), d.valorDevido.paraString(), d.diferenca.paraString()]);
}

describe("diferencasEntre (devido − pago, história × rubrica)", () => {
  it("subtrai por (história, rubrica), em ordem, e devolve a explicação nova", () => {
    const pago = [registro("h2", "salario", "100.00"), registro("h1", "salario", "5000.00")];
    const devido = [registro("h1", "salario", "6200.00", "nova"), registro("h2", "salario", "90.00", "nova h2")];

    const diferencas = diferencasEntre(pago, devido);

    expect(resumo(diferencas)).toEqual([
      ["h1", "salario", "5000.00", "6200.00", "1200.00"],
      ["h2", "salario", "100.00", "90.00", "-10.00"],
    ]);
    expect(diferencas[0]!.explicacaoNova).toEqual({ descricao: "nova", fontes: [] });
  });

  it("valores iguais não geram diferença", () => {
    expect(diferencasEntre([registro("h", "r", "10.00")], [registro("h", "r", "10.00")])).toEqual([]);
    expect(diferencasEntre([], [])).toEqual([]);
  });

  it("rubrica que passou a ser devida: pago = 0", () => {
    expect(resumo(diferencasEntre([], [registro("h", "auxilio", "300.00")]))).toEqual([["h", "auxilio", "0.00", "300.00", "300.00"]]);
  });

  it("rubrica que deixou de ser devida: devido = 0 e sem explicação nova", () => {
    const [diferenca] = diferencasEntre([registro("h", "auxilio", "300.00")], []);
    expect(resumo([diferenca!])).toEqual([["h", "auxilio", "300.00", "0.00", "-300.00"]]);
    expect(diferenca!.explicacaoNova).toBeUndefined();
  });
});
