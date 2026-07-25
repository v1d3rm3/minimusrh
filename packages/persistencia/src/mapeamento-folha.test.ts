import { Amparo, Competencia } from "@minimusrh/dominio";
import type { Autor, DataRegistro, EstadoFolha, FolhaId, TipoAmparoChave, TipoFolhaChave } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import {
  folhaParaParametrosInsercao,
  linhaParaFolha,
  linhaParaTransicao,
  transicaoParaParametrosInsercao,
  type LinhaFolha,
  type LinhaTransicaoFolha,
} from "./mapeamento-folha.js";
import type { NovaFolha } from "./folha-repositorio.js";

const AUTOR_HUMANO: Autor = { tipo: "humano", usuarioId: "u1" };

describe("linhaParaFolha / folhaParaParametrosInsercao", () => {
  function linhaBase(sobrescritas: Partial<LinhaFolha> = {}): LinhaFolha {
    return {
      id: "fo1",
      competencia_ano: 2026,
      competencia_mes: 7,
      tipo: "mensal",
      estado: "aberta",
      corte: null,
      folhas_consumidas: null,
      ...sobrescritas,
    };
  }

  it("mapeia competencia via Competencia.de (fabrica publica, sem lacuna de reidratacao)", () => {
    const folha = linhaParaFolha(linhaBase());
    expect(folha.competencia.igual(Competencia.de(2026, 7))).toBe(true);
  });

  it("nao inclui corte/folhasConsumidas quando nulos", () => {
    const folha = linhaParaFolha(linhaBase());
    expect(folha.corte).toBeUndefined();
    expect(folha.folhasConsumidas).toBeUndefined();
  });

  it("mapeia corte e folhasConsumidas quando presentes", () => {
    const folha = linhaParaFolha(
      linhaBase({ estado: "em_conferencia", corte: "2026-07-05T00:00:00.000Z", folhas_consumidas: ["a", "b"] }),
    );
    expect(folha.corte).toBe("2026-07-05T00:00:00.000Z" as DataRegistro);
    expect(folha.folhasConsumidas).toEqual(["a", "b"] as FolhaId[]);
  });

  it("round-trip: folhaParaParametrosInsercao -> linhaParaFolha preserva os dados", () => {
    const original: NovaFolha = {
      competencia: Competencia.de(2026, 7),
      tipo: "mensal" as TipoFolhaChave,
      estado: "em_conferencia" as EstadoFolha,
      corte: "2026-07-05T00:00:00.000Z" as DataRegistro,
      folhasConsumidas: ["a" as FolhaId],
    };
    const params = folhaParaParametrosInsercao("fo1" as FolhaId, original);
    const linhaSimulada: LinhaFolha = {
      id: params.id,
      competencia_ano: params.competencia_ano,
      competencia_mes: params.competencia_mes,
      tipo: params.tipo,
      estado: params.estado as EstadoFolha,
      corte: params.corte,
      folhas_consumidas: params.folhas_consumidas,
    };
    const reconstruida = linhaParaFolha(linhaSimulada);
    expect(reconstruida).toEqual({ id: "fo1" as FolhaId, ...original });
  });
});

describe("linhaParaTransicao / transicaoParaParametrosInsercao", () => {
  it("nao inclui amparo quando a coluna e nula", () => {
    const linha: LinhaTransicaoFolha = {
      folha_id: "fo1",
      de: "aberta",
      para: "em_conferencia",
      instante: "2026-07-05T00:00:00.000Z",
      autor: AUTOR_HUMANO,
      amparo: null,
    };
    const transicao = linhaParaTransicao(linha);
    expect(transicao.amparo).toBeUndefined();
  });

  it("reidrata o amparo a partir do blob JSONB (nao decomposto nesta tabela)", () => {
    const linha: LinhaTransicaoFolha = {
      folha_id: "fo1",
      de: "aberta",
      para: "em_conferencia",
      instante: "2026-07-05T00:00:00.000Z",
      autor: AUTOR_HUMANO,
      amparo: { tipo: "processo", identificacaoCanonica: "45/2026", comoInformado: "45/2026" },
    };
    const transicao = linhaParaTransicao(linha);
    expect(transicao.amparo).toBeInstanceOf(Amparo);
    expect(transicao.amparo?.identificacaoCanonica).toBe("45/2026");
  });

  it("round-trip completo com amparo presente", () => {
    const original = {
      folhaId: "fo1" as FolhaId,
      de: "aberta" as EstadoFolha,
      para: "em_conferencia" as EstadoFolha,
      instante: "2026-07-05T00:00:00.000Z" as DataRegistro,
      autor: AUTOR_HUMANO,
      amparo: Amparo.legado("processo" as TipoAmparoChave, "45/2026"),
    };
    const params = transicaoParaParametrosInsercao(original);
    const linhaSimulada: LinhaTransicaoFolha = {
      folha_id: params.folha_id,
      de: params.de as EstadoFolha,
      para: params.para as EstadoFolha,
      instante: params.instante,
      autor: JSON.parse(params.autor),
      amparo: params.amparo === null ? null : JSON.parse(params.amparo),
    };
    const reconstruida = linhaParaTransicao(linhaSimulada);
    expect(reconstruida).toEqual(original);
  });

  it("amparo nulo quando ausente na insercao", () => {
    const params = transicaoParaParametrosInsercao({
      folhaId: "fo1" as FolhaId,
      de: "aberta" as EstadoFolha,
      para: "em_conferencia" as EstadoFolha,
      instante: "2026-07-05T00:00:00.000Z" as DataRegistro,
      autor: AUTOR_HUMANO,
    });
    expect(params.amparo).toBeNull();
  });
});

