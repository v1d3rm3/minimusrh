import { Dinheiro } from "@minimusrh/dominio";
import type { FolhaId, HistoriaId, RegistroCalculo, RegraChave, RubricaChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { serializarRegistros } from "./serializacao.js";

function registro(historiaId: string, rubrica: string, explicacao: RegistroCalculo["explicacao"]): RegistroCalculo {
  return {
    folhaId: "folha-uuid" as FolhaId,
    historiaId: historiaId as HistoriaId,
    rubrica: rubrica as RubricaChave,
    versaoRubrica: 1,
    regra: rubrica as string as RegraChave,
    versaoRegra: 1,
    valor: Dinheiro.de("10.5"),
    explicacao,
  };
}

describe("serializarRegistros", () => {
  it("é canônica: independe da ordem dos registros e da ordem das chaves (como o JSONB devolve)", () => {
    const a = registro("h2", "b", { descricao: "d", valor: "1.00", fontes: [] });
    const b = registro("h1", "z", { descricao: "d", fontes: [] });
    const c = registro("h1", "a", { descricao: "d", fontes: [] });
    const reordenado = { ...a, explicacao: { fontes: [], valor: "1.00", descricao: "d" } };

    expect(serializarRegistros([a, b, c])).toBe(serializarRegistros([c, reordenado, b]));
    expect(JSON.parse(serializarRegistros([a, b, c])).map((r: RegistroCalculo) => [r.historiaId, r.rubrica])).toEqual([
      ["h1", "a"],
      ["h1", "z"],
      ["h2", "b"],
    ]);
  });

  it("valor monetário como string com 2 casas; registros iguais em (história, rubrica) mantêm a ordem; termina em nova linha", () => {
    const texto = serializarRegistros([registro("h", "r", { descricao: "1", fontes: [] }), registro("h", "r", { descricao: "2", fontes: [] })]);
    expect(texto).toContain('"valor": "10.50"');
    expect(texto.indexOf('"descricao": "1"')).toBeLessThan(texto.indexOf('"descricao": "2"'));
    expect(texto.endsWith("]\n")).toBe(true);
  });

  it("troca ids por apelidos em qualquer profundidade, só em valores string exatos", () => {
    const r = registro("h1", "r", { descricao: "d", fontes: [{ tipo: "fato", fatoId: "uuid-1" as never }] });
    const texto = serializarRegistros([r], new Map([["uuid-1", "fato:posse@2020-03-01"], ["folha-uuid", "folha:x"]]));
    expect(texto).toContain('"fatoId": "fato:posse@2020-03-01"');
    expect(texto).toContain('"folhaId": "folha:x"');
    expect(texto).not.toContain("uuid");
  });
});
