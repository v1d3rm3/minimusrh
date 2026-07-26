import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { HistoriaId } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { TIPO_FATO_EXONERACAO, TIPO_FATO_POSSE, criarCatalogoTiposDeFato } from "./catalogo-tipos-fato.js";
import { linhaDoTempoEmMemoria } from "./linha-do-tempo-em-memoria.js";
import { criarFato } from "./testes/fabrica-fato.js";

const CATALOGO = criarCatalogoTiposDeFato();
const HISTORIA = "h1" as HistoriaId;

describe("linhaDoTempoEmMemoria", () => {
  it("aberturaDaHistoria devolve o fato cujo tipo tem abreHistoria=true", () => {
    const posse = criarFato({
      tipo: TIPO_FATO_POSSE,
      dataEfeito: dataEfeito("2020-03-01"),
      dataRegistro: dataRegistro("2020-03-01T00:00:00Z"),
      conteudo: { cargo: "B6" },
    });
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posse], dataRegistro("2026-01-01T00:00:00Z"));

    expect(linha.aberturaDaHistoria()).toEqual(posse);
  });

  it("aberturaDaHistoria lança se nenhum fato de abertura é conhecido até o corte", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [], dataRegistro("2026-01-01T00:00:00Z"));
    expect(() => linha.aberturaDaHistoria()).toThrow(/nenhum fato de abertura/);
  });

  it("encerramentoDaHistoria devolve undefined quando a história segue aberta", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [], dataRegistro("2026-01-01T00:00:00Z"));
    expect(linha.encerramentoDaHistoria()).toBeUndefined();
  });

  it("encerramentoDaHistoria devolve o fato cujo tipo tem encerraHistoria=true", () => {
    const exoneracao = criarFato({
      tipo: TIPO_FATO_EXONERACAO,
      dataEfeito: dataEfeito("2026-09-30"),
      dataRegistro: dataRegistro("2026-09-30T00:00:00Z"),
    });
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [exoneracao], dataRegistro("2026-10-01T00:00:00Z"));

    expect(linha.encerramentoDaHistoria()).toEqual(exoneracao);
  });

  it("um fato só fica visível a partir do corte incluir sua dataRegistro (bitemporalidade)", () => {
    const posse = criarFato({
      tipo: TIPO_FATO_POSSE,
      dataEfeito: dataEfeito("2020-03-01"),
      dataRegistro: dataRegistro("2020-03-01T00:00:00Z"),
      conteudo: { cargo: "B6" },
    });
    const linhaAntesDoRegistro = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posse], dataRegistro("2020-02-01T00:00:00Z"));
    expect(() => linhaAntesDoRegistro.aberturaDaHistoria()).toThrow();

    const linhaDepois = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posse], dataRegistro("2020-03-01T00:00:00Z"));
    expect(linhaDepois.aberturaDaHistoria()).toEqual(posse);
  });

  it("vigenteEm resolve pelo dataEfeito mais recente <= em, entre os fatos conhecidos até o corte", () => {
    const posse = criarFato({
      tipo: TIPO_FATO_POSSE,
      dataEfeito: dataEfeito("2020-03-01"),
      dataRegistro: dataRegistro("2020-03-01T00:00:00Z"),
      conteudo: { cargo: "B6" },
    });
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posse], dataRegistro("2026-01-01T00:00:00Z"));

    expect(linha.vigenteEm(TIPO_FATO_POSSE, dataEfeito("2021-01-01"))?.conteudo).toEqual({ cargo: "B6" });
    expect(linha.vigenteEm(TIPO_FATO_POSSE, dataEfeito("2019-01-01"))).toBeUndefined();
  });

  it("um fato substituído (com corte que já conhece o substituto) some de todosDoTipo/vigenteEm", () => {
    const original = criarFato({
      tipo: TIPO_FATO_POSSE,
      dataEfeito: dataEfeito("2020-03-01"),
      dataRegistro: dataRegistro("2020-03-01T00:00:00Z"),
      conteudo: { cargo: "B5" },
    });
    const correcao = criarFato({
      tipo: TIPO_FATO_POSSE,
      dataEfeito: dataEfeito("2020-03-01"),
      dataRegistro: dataRegistro("2020-04-01T00:00:00Z"),
      conteudo: { cargo: "B6" },
      substituiFatoId: original.id,
    });

    const linhaAntesDaCorrecao = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [original, correcao], dataRegistro("2020-03-15T00:00:00Z"));
    expect(linhaAntesDaCorrecao.todosDoTipo(TIPO_FATO_POSSE)).toEqual([original]);

    const linhaDepoisDaCorrecao = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [original, correcao], dataRegistro("2026-01-01T00:00:00Z"));
    expect(linhaDepoisDaCorrecao.todosDoTipo(TIPO_FATO_POSSE)).toEqual([correcao]);
  });
});
