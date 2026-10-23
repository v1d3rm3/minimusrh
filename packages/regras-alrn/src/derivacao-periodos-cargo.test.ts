import { Competencia, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Fato, HistoriaId } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { TIPO_FATO_EXONERACAO, TIPO_FATO_POSSE, TIPO_FATO_PROMOCAO, criarCatalogoTiposDeFato } from "./catalogo-tipos-fato.js";
import { DERIVACAO_PERIODOS_CARGO_IMPL } from "./derivacao-periodos-cargo.js";
import { VICTOR_FATOS, VICTOR_HISTORIA_ID } from "./fixture-victor.js";
import { linhaDoTempoEmMemoria } from "./linha-do-tempo-em-memoria.js";
import { criarFato } from "./testes/fabrica-fato.js";

const CATALOGO = criarCatalogoTiposDeFato();
const HISTORIA = "h1" as HistoriaId;
const CORTE = dataRegistro("2030-12-31T00:00:00Z");
const V1 = DERIVACAO_PERIODOS_CARGO_IMPL.versoes[0]!;

function posseEm(data: string, conteudo: unknown = { cargo: "B6" }): Fato {
  return criarFato({ tipo: TIPO_FATO_POSSE, dataEfeito: dataEfeito(data), dataRegistro: dataRegistro(`${data}T00:00:00Z`), conteudo });
}

function promocaoEm(data: string, cargo: string): Fato {
  return criarFato({ tipo: TIPO_FATO_PROMOCAO, dataEfeito: dataEfeito(data), dataRegistro: dataRegistro(`${data}T00:00:00Z`), conteudo: { cargo } });
}

function exoneracaoEm(data: string): Fato {
  return criarFato({ tipo: TIPO_FATO_EXONERACAO, dataEfeito: dataEfeito(data), dataRegistro: dataRegistro(`${data}T00:00:00Z`) });
}

function derivar(fatos: readonly Fato[], competencia: Competencia, corte = CORTE, historia = HISTORIA) {
  const linha = linhaDoTempoEmMemoria(CATALOGO, historia, fatos, corte);
  return V1.derivar(linha, competencia.dataReferencia(), competencia);
}

describe("derivacao periodos_cargo (mês comercial de 30 dias, ver DECISOES #14)", () => {
  it("Victor em 02/2026: B6 de 01 a 14, B8 a partir do dia do efeito (15/02), fevereiro fechando em 30 dias", () => {
    expect(derivar(VICTOR_FATOS, Competencia.de(2026, 2), CORTE, VICTOR_HISTORIA_ID)).toEqual({
      periodos: [
        { cargo: "B6", dias: 14 },
        { cargo: "B8", dias: 16 },
      ],
      diasNoMes: 30,
    });
  });

  it("Victor em 03/2026: B8 o mês inteiro", () => {
    expect(derivar(VICTOR_FATOS, Competencia.de(2026, 3), CORTE, VICTOR_HISTORIA_ID)).toEqual({
      periodos: [{ cargo: "B8", dias: 30 }],
      diasNoMes: 30,
    });
  });

  it("bitemporal: Victor em 02/2026 com corte anterior ao registro da promoção (10/07) ⇒ B6 o mês inteiro", () => {
    const corte = dataRegistro("2026-03-01T00:00:00Z");
    expect(derivar(VICTOR_FATOS, Competencia.de(2026, 2), corte, VICTOR_HISTORIA_ID)?.periodos).toEqual([{ cargo: "B6", dias: 30 }]);
  });

  it("promoção para o mesmo cargo no meio do mês: um único período (consecutivos iguais agrupados)", () => {
    const fatos = [posseEm("2020-03-01"), promocaoEm("2026-07-10", "B6")];
    expect(derivar(fatos, Competencia.de(2026, 7))?.periodos).toEqual([{ cargo: "B6", dias: 30 }]);
  });

  it("promoção no dia 1 ⇒ cargo novo no mês inteiro", () => {
    const fatos = [posseEm("2020-03-01"), promocaoEm("2026-07-01", "B8")];
    expect(derivar(fatos, Competencia.de(2026, 7))?.periodos).toEqual([{ cargo: "B8", dias: 30 }]);
  });

  it("promoção no dia 31 de um mês de 31 dias ⇒ o dia comercial 30 é o último dia real (1 dia no cargo novo)", () => {
    const fatos = [posseEm("2020-03-01"), promocaoEm("2026-03-31", "B8")];
    expect(derivar(fatos, Competencia.de(2026, 3))?.periodos).toEqual([
      { cargo: "B6", dias: 29 },
      { cargo: "B8", dias: 1 },
    ]);
  });

  it("promoção em 28/02 de ano não bissexto ⇒ os dias comerciais 28 a 30 ficam no cargo novo", () => {
    const fatos = [posseEm("2020-03-01"), promocaoEm("2027-02-28", "B8")];
    expect(derivar(fatos, Competencia.de(2027, 2))?.periodos).toEqual([
      { cargo: "B6", dias: 27 },
      { cargo: "B8", dias: 3 },
    ]);
  });

  it("promoção em 29/02 de ano bissexto ⇒ dias comerciais 29 e 30 no cargo novo", () => {
    const fatos = [posseEm("2020-03-01"), promocaoEm("2028-02-29", "B8")];
    expect(derivar(fatos, Competencia.de(2028, 2))?.periodos).toEqual([
      { cargo: "B6", dias: 28 },
      { cargo: "B8", dias: 2 },
    ]);
  });

  it("entrada no dia 15 ⇒ 15 dias, igual a dias_trabalhados (o dia da entrada não conta)", () => {
    expect(derivar([posseEm("2026-07-15")], Competencia.de(2026, 7))?.periodos).toEqual([{ cargo: "B6", dias: 15 }]);
  });

  it("promoção no dia 10 e saída no dia 20 ⇒ B6 de 01 a 09, B8 de 10 a 20 (o dia da saída conta)", () => {
    const fatos = [posseEm("2020-03-01"), promocaoEm("2026-07-10", "B8"), exoneracaoEm("2026-07-20")];
    expect(derivar(fatos, Competencia.de(2026, 7))?.periodos).toEqual([
      { cargo: "B6", dias: 9 },
      { cargo: "B8", dias: 11 },
    ]);
  });

  it("posse no dia 31 ⇒ nenhum dia comercial trabalhado na competência", () => {
    expect(derivar([posseEm("2026-07-31")], Competencia.de(2026, 7))).toEqual({ periodos: [], diasNoMes: 30 });
  });

  it("abertura sem cargo no conteúdo: dias sem cargo não entram em período algum", () => {
    expect(derivar([posseEm("2020-03-01", {})], Competencia.de(2026, 7))).toEqual({ periodos: [], diasNoMes: 30 });
  });

  it("competência anterior à abertura da história: não derivável", () => {
    expect(derivar([posseEm("2026-07-15")], Competencia.de(2026, 6))).toBeUndefined();
  });

  it("competência posterior ao encerramento da história: não derivável", () => {
    expect(derivar([posseEm("2020-03-01"), exoneracaoEm("2026-07-20")], Competencia.de(2026, 8))).toBeUndefined();
  });

  it("depende dos três tipos que mudam cargo ou intervalo trabalhado", () => {
    expect(V1.dependeDe).toEqual([TIPO_FATO_POSSE, TIPO_FATO_PROMOCAO, TIPO_FATO_EXONERACAO]);
  });
});
