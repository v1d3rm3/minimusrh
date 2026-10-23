import { Competencia, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { DataRegistro, FolhaId, TipoFolhaChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { folhasAlcancadas, type FolhaFechada } from "./alcance-retroativo.js";

function folha(id: string, mes: number, corte: string, tipo = "mensal"): FolhaFechada {
  return { id: id as FolhaId, competencia: Competencia.de(2026, mes), tipo: tipo as TipoFolhaChave, corte: dataRegistro(corte) };
}

const PROMOCAO = { dataEfeito: dataEfeito("2026-02-15"), dataRegistro: dataRegistro("2026-07-10T00:00:00Z") };

function ids(folhas: readonly FolhaFechada[]): string[] {
  return folhas.map((f) => f.id);
}

describe("folhasAlcancadas (efeito <= competência, corte < registro)", () => {
  it("promoção de 15/02 registrada em 10/07: fevereiro a junho; janeiro e julho ficam de fora", () => {
    const folhas = [7, 3, 1, 6, 2, 5, 4].map((mes) => folha(`m${mes}`, mes, `2026-${String(mes + 1).padStart(2, "0")}-01T00:00:00Z`));
    expect(ids(folhasAlcancadas(folhas, PROMOCAO))).toEqual(["m2", "m3", "m4", "m5", "m6"]);
  });

  it("efeito no último dia da competência alcança; no dia seguinte, não", () => {
    const fevereiro = [folha("fev", 2, "2026-03-01T00:00:00Z")];
    const registro = dataRegistro("2026-07-10T00:00:00Z");
    expect(ids(folhasAlcancadas(fevereiro, { dataEfeito: dataEfeito("2026-02-28"), dataRegistro: registro }))).toEqual(["fev"]);
    expect(folhasAlcancadas(fevereiro, { dataEfeito: dataEfeito("2026-03-01"), dataRegistro: registro })).toEqual([]);
  });

  it("corte igual ao registro já sabia (o corte inclui o instante); grafias diferentes do mesmo instante são iguais", () => {
    const junho = [folha("jun", 6, "2026-07-10T00:00:00Z")];
    expect(folhasAlcancadas(junho, PROMOCAO)).toEqual([]);
    const corteNaoCanonico = [{ ...junho[0]!, corte: "2026-07-10T02:00:00+02:00" as DataRegistro }];
    expect(folhasAlcancadas(corteNaoCanonico, PROMOCAO)).toEqual([]);
  });

  it("mesma competência: ordena por tipo de folha", () => {
    const folhas = [folha("sup", 3, "2026-04-01T00:00:00Z", "suplementar"), folha("men", 3, "2026-04-01T00:00:00Z", "mensal")];
    expect(ids(folhasAlcancadas(folhas, PROMOCAO))).toEqual(["men", "sup"]);
  });
});
