import { Dinheiro, Percentual, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Contexto, DeclaracaoConsumo, RegraChave, VersaoRegra } from "@minimusrh/dominio";
import { CLASSIFICACAO_INCIDE_PREVIDENCIA, RUBRICA_CONTRIBUICAO_PREVIDENCIA } from "./catalogo-rubricas.js";
import { TIPO_FOLHA_MENSAL } from "./catalogo-tipos-folha.js";
import { aplicarTabelaProgressiva, type FaixaProgressiva } from "./tabela-progressiva.js";

// regra-contribuicao-previdencia.ts — Fundação §7.6: "base = soma das rubricas com
// incide_previdencia; resultado aplica tabela_progressiva(...) sobre base". A regra soma
// por CLASSIFICAÇÃO (nunca por nome de rubrica) — verba nova entra na base sem editar
// esta regra (Fundação §3.6).
export const REGRA_CONTRIBUICAO_PREVIDENCIA = "contribuicao_previdencia" as RegraChave;

// Alíquotas marginais INVENTADAS — nenhum valor real disponível nos documentos (ver
// DECISOES #8): placeholder, não usar em produção sem confirmação humana.
const TABELA_PREVIDENCIA_V1: readonly FaixaProgressiva[] = [
  { ate: Dinheiro.de("1500.00"), aliquota: Percentual.de("7.5") },
  { ate: Dinheiro.de("3000.00"), aliquota: Percentual.de("9") },
  { ate: Dinheiro.de("4500.00"), aliquota: Percentual.de("12") },
  { ate: "infinito", aliquota: Percentual.de("14") },
];

const CONSOME: DeclaracaoConsumo = {
  derivacoes: [],
  rubricas: [],
  classificacoes: [CLASSIFICACAO_INCIDE_PREVIDENCIA],
  tiposFato: [],
  janelas: [],
};

const V1: VersaoRegra = {
  regra: REGRA_CONTRIBUICAO_PREVIDENCIA,
  versao: 1,
  dataEfeito: dataEfeito("2026-01-01"),
  dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
  aplicaSeAFolhas: [TIPO_FOLHA_MENSAL],
  escopo: { tipo: "global" },
  produz: RUBRICA_CONTRIBUICAO_PREVIDENCIA,
  consome: CONSOME,

  quando(ctx: Contexto): boolean {
    return !ctx.somaDasRubricasCom(CLASSIFICACAO_INCIDE_PREVIDENCIA).ehZero();
  },

  calcular(ctx: Contexto): Dinheiro {
    const base = ctx.somaDasRubricasCom(CLASSIFICACAO_INCIDE_PREVIDENCIA);
    return aplicarTabelaProgressiva(TABELA_PREVIDENCIA_V1, base);
  },
};

export const REGRA_CONTRIBUICAO_PREVIDENCIA_V1 = V1;
