import { Competencia, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Dinheiro, Fato, FatoId, LinhaDoTempo, RubricaChave } from "@minimusrh/dominio";
import { criarContexto, instrumentar, resolverParaExecucao, type LeitorDeJanelas } from "@minimusrh/motor";
import {
  CATALOGO_REGRAS,
  TIPO_FOLHA_MENSAL,
  TIPO_FATO_COMPROVACAO_PLANO_SAUDE,
  VICTOR_FATOS,
  VICTOR_HISTORIA_ID,
  criarCatalogoRubricas,
  criarCatalogoTiposDeFato,
  criarRegistroDeDerivacoes,
  linhaDoTempoEmMemoria,
} from "@minimusrh/regras-alrn";
import { describe, expect, it } from "vitest";
import { agruparRegras } from "./configuracao.js";

// fiscalizacao-regras-alrn.test.ts — a fiscalização adiada do Módulo 4 (regras-alrn não
// depende de motor): cada regra da ALRN roda sobre o contexto INSTRUMENTADO do motor, e
// toda leitura que ela faz tem de constar na sua `DeclaracaoConsumo` (Design §7). Uma
// leitura não declarada é um buraco no grafo de dependências (§5.1) e no relatório de
// impacto (§9.3) — exatamente o que a DSL (Módulo 10) vai checar por parse.

const JULHO = Competencia.de(2026, 7);
const CORTE = dataRegistro("2026-08-01T00:00:00.000Z");

const COMPROVACAO: Fato = {
  id: "fato-vitor-plano" as FatoId,
  alvo: { escopo: "historia", historiaId: VICTOR_HISTORIA_ID },
  tipo: TIPO_FATO_COMPROVACAO_PLANO_SAUDE,
  versaoDoTipo: 1,
  conteudo: { operadora: "unimed", mensalidade: "480.00", periodo_fim: "2026-12-31" },
  dataEfeito: dataEfeito("2026-03-01"),
  dataRegistro: dataRegistro("2026-03-05T00:00:00Z"),
  autor: { tipo: "humano", usuarioId: "teste" },
};

// Nenhuma regra da ALRN declara janela hoje — qualquer leitura de janela já seria violação.
const LEITOR_SEM_JANELAS: LeitorDeJanelas = {
  agregado: () => {
    throw new Error("nenhuma regra da ALRN declara janela");
  },
  contagem: () => {
    throw new Error("nenhuma regra da ALRN declara janela");
  },
};

/** Roda as regras resolvidas na ordem do catálogo (já topológica) e devolve, por regra, aplicou? + violações. */
function fiscalizar(linha: LinhaDoTempo) {
  const rubricas = criarCatalogoRubricas();
  const { regrasResolvidas, rubricasResolvidas } = resolverParaExecucao(agruparRegras(CATALOGO_REGRAS), rubricas, JULHO, TIPO_FOLHA_MENSAL, CORTE);
  const rubricasCalculadas = new Map<RubricaChave, Dinheiro>();
  const base = criarContexto({
    linha,
    competencia: JULHO,
    tipoFolha: TIPO_FOLHA_MENSAL,
    dataReferencia: JULHO.dataReferencia(),
    corte: CORTE,
    registroDeDerivacoes: criarRegistroDeDerivacoes(),
    rubricasResolvidas,
    rubricasCalculadas,
    leitorJanelas: LEITOR_SEM_JANELAS,
  });

  return CATALOGO_REGRAS.filter((r) => regrasResolvidas.includes(r)).map((regra) => {
    const instrumentado = instrumentar(base);
    const aplicou = regra.quando(instrumentado.ctx);
    if (aplicou) rubricasCalculadas.set(regra.produz, regra.calcular(instrumentado.ctx));
    return { regra: regra.regra, aplicou, violacoes: instrumentado.violacoes(regra.consome) };
  });
}

describe("fiscalização das regras da ALRN contra a DeclaracaoConsumo (contexto instrumentado do motor)", () => {
  it("as três regras resolvem em 07/2026 — a fiscalização cobre o catálogo inteiro", () => {
    const linha = linhaDoTempoEmMemoria(criarCatalogoTiposDeFato(), VICTOR_HISTORIA_ID, VICTOR_FATOS, CORTE);
    expect(fiscalizar(linha).map((f) => f.regra)).toEqual(CATALOGO_REGRAS.map((r) => r.regra));
  });

  it("Victor com plano de saúde: todas as regras aplicam e nenhuma lê além do declarado", () => {
    const linha = linhaDoTempoEmMemoria(criarCatalogoTiposDeFato(), VICTOR_HISTORIA_ID, [...VICTOR_FATOS, COMPROVACAO], CORTE);
    const resultado = fiscalizar(linha);
    expect(resultado.every((f) => f.aplicou)).toBe(true);
    expect(resultado.filter((f) => f.violacoes.length > 0)).toEqual([]);
  });

  it("Victor sem plano de saúde: o auxílio não se aplica, e o caminho do 'quando' também é fiscalizado", () => {
    const linha = linhaDoTempoEmMemoria(criarCatalogoTiposDeFato(), VICTOR_HISTORIA_ID, VICTOR_FATOS, CORTE);
    const resultado = fiscalizar(linha);
    expect(resultado.find((f) => f.regra === "auxilio_saude")?.aplicou).toBe(false);
    expect(resultado.filter((f) => f.violacoes.length > 0)).toEqual([]);
  });
});
