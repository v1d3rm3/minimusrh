import { Competencia, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { HistoriaId } from "@minimusrh/dominio";
import { describe, expect, it } from "vitest";
import { TIPO_FATO_EXONERACAO, TIPO_FATO_POSSE, criarCatalogoTiposDeFato } from "./catalogo-tipos-fato.js";
import { DERIVACAO_DIAS_TRABALHADOS_IMPL } from "./derivacao-dias-trabalhados.js";
import { linhaDoTempoEmMemoria } from "./linha-do-tempo-em-memoria.js";
import { criarFato } from "./testes/fabrica-fato.js";

const CATALOGO = criarCatalogoTiposDeFato();
const HISTORIA = "h1" as HistoriaId;
const CORTE = dataRegistro("2026-12-31T00:00:00Z");
const COMPETENCIA_JULHO = Competencia.de(2026, 7);
const V1 = DERIVACAO_DIAS_TRABALHADOS_IMPL.versoes[0]!;

function posseEm(dataDeEntrada: string) {
  return criarFato({
    tipo: TIPO_FATO_POSSE,
    dataEfeito: dataEfeito(dataDeEntrada),
    dataRegistro: dataRegistro(`${dataDeEntrada}T00:00:00Z`),
    conteudo: { cargo: "B6" },
  });
}

function exoneracaoEm(dataDeSaida: string) {
  return criarFato({
    tipo: TIPO_FATO_EXONERACAO,
    dataEfeito: dataEfeito(dataDeSaida),
    dataRegistro: dataRegistro(`${dataDeSaida}T00:00:00Z`),
  });
}

describe("derivacao dias_trabalhados (mês comercial de 30 dias, ver DECISOES)", () => {
  it("entrada no dia 15 da competência ⇒ fator 15/30 (exemplo literal do playbook)", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posseEm("2026-07-15")], CORTE);
    expect(V1.derivar(linha, dataEfeito("2026-07-31"), COMPETENCIA_JULHO)).toEqual({ dias: 15, diasNoMes: 30 });
  });

  it("mês cheio (história aberta antes, sem encerramento) ⇒ 30/30", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posseEm("2020-03-01")], CORTE);
    expect(V1.derivar(linha, dataEfeito("2026-07-31"), COMPETENCIA_JULHO)).toEqual({ dias: 30, diasNoMes: 30 });
  });

  it("edge case documentado: entrada no dia 1 da competência ⇒ 29/30, não mês cheio", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posseEm("2026-07-01")], CORTE);
    expect(V1.derivar(linha, dataEfeito("2026-07-31"), COMPETENCIA_JULHO)).toEqual({ dias: 29, diasNoMes: 30 });
  });

  it("saída no dia 20 da competência (história aberta antes) ⇒ 20/30 (o dia de saída conta)", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posseEm("2020-03-01"), exoneracaoEm("2026-07-20")], CORTE);
    expect(V1.derivar(linha, dataEfeito("2026-07-31"), COMPETENCIA_JULHO)).toEqual({ dias: 20, diasNoMes: 30 });
  });

  it("entrada e saída na mesma competência (dia 10 ao dia 20) ⇒ 10/30", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posseEm("2026-07-10"), exoneracaoEm("2026-07-20")], CORTE);
    expect(V1.derivar(linha, dataEfeito("2026-07-31"), COMPETENCIA_JULHO)).toEqual({ dias: 10, diasNoMes: 30 });
  });

  it("competência anterior à abertura da história: não derivável", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posseEm("2026-07-15")], CORTE);
    expect(V1.derivar(linha, dataEfeito("2026-06-30"), Competencia.de(2026, 6))).toBeUndefined();
  });

  it("competência posterior ao encerramento da história: não derivável", () => {
    const linha = linhaDoTempoEmMemoria(CATALOGO, HISTORIA, [posseEm("2020-03-01"), exoneracaoEm("2026-07-20")], CORTE);
    expect(V1.derivar(linha, dataEfeito("2026-08-31"), Competencia.de(2026, 8))).toBeUndefined();
  });
});
