import { Dinheiro, dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Contexto, DeclaracaoConsumo, RegraChave, VersaoRegra } from "@minimusrh/dominio";
import { RUBRICA_AUXILIO_SAUDE } from "./catalogo-rubricas.js";
import { TIPO_FATO_COMPROVACAO_PLANO_SAUDE } from "./catalogo-tipos-fato.js";
import { TIPO_FOLHA_MENSAL } from "./catalogo-tipos-folha.js";
import { DERIVACAO_IDADE } from "./derivacao-idade.js";

// regra-auxilio-saude.ts — Fundação §7.8: "quando existe(comprovacao_plano_saude)"; valor
// por faixa etária como tabela versionada sobre a derivação idade. Ausência de comprovação
// vigente = direito cessa (guarda de aplicabilidade, não valor zero).
export const REGRA_AUXILIO_SAUDE = "auxilio_saude" as RegraChave;

interface FaixaEtaria {
  readonly ateIdade: number | "sem_limite";
  readonly valor: Dinheiro;
}

// Tabela reaproveitada LITERALMENTE do exemplo do conceitual §7.8 (ver DECISOES #7).
const TABELA_AUXILIO_SAUDE_POR_IDADE_V1: readonly FaixaEtaria[] = [
  { ateIdade: 29, valor: Dinheiro.de("250.00") },
  { ateIdade: 39, valor: Dinheiro.de("320.00") },
  { ateIdade: 49, valor: Dinheiro.de("410.00") },
  { ateIdade: "sem_limite", valor: Dinheiro.de("520.00") },
];

function buscarPorFaixaEtaria(idade: number): Dinheiro {
  const faixa = TABELA_AUXILIO_SAUDE_POR_IDADE_V1.find((f) => f.ateIdade === "sem_limite" || idade <= f.ateIdade);
  // seguro por construção: a última faixa é 'sem_limite', sempre casa.
  return faixa!.valor;
}

const CONSOME: DeclaracaoConsumo = {
  derivacoes: [DERIVACAO_IDADE],
  rubricas: [],
  classificacoes: [],
  tiposFato: [TIPO_FATO_COMPROVACAO_PLANO_SAUDE],
  janelas: [],
};

const V1: VersaoRegra = {
  regra: REGRA_AUXILIO_SAUDE,
  versao: 1,
  dataEfeito: dataEfeito("2026-01-01"),
  dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
  aplicaSeAFolhas: [TIPO_FOLHA_MENSAL],
  escopo: { tipo: "global" },
  produz: RUBRICA_AUXILIO_SAUDE,
  consome: CONSOME,

  quando(ctx: Contexto): boolean {
    return ctx.existe(TIPO_FATO_COMPROVACAO_PLANO_SAUDE);
  },

  calcular(ctx: Contexto): Dinheiro {
    const idade = ctx.derivacao<number>(DERIVACAO_IDADE);
    if (idade === undefined) {
      throw new Error("auxilio_saude: comprovacao existe mas idade nao e derivavel (sem fato de nascimento)");
    }
    return buscarPorFaixaEtaria(idade);
  },
};

export const REGRA_AUXILIO_SAUDE_V1 = V1;
