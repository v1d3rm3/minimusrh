import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Competencia, DataEfeito, Derivacao, DerivacaoChave, LinhaDoTempo, VersaoDerivacao } from "@minimusrh/dominio";
import { TIPO_FATO_EXONERACAO, TIPO_FATO_POSSE } from "./catalogo-tipos-fato.js";
import { partesDataEfeito } from "./data-util.js";

// derivacao-dias-trabalhados.ts — "calendário da competência × abertura/encerramento"
// (playbook, Módulo 4): a proporcionalidade do salário para quem entra/sai no meio do
// mês (Fundação Decisão 2). CONVENÇÃO (ver DECISOES-IMPLEMENTACAO.md #3): mês COMERCIAL de
// 30 dias fixos (não o calendário real do mês) — é a única leitura possível do único dado
// concreto do playbook ("entrada dia 15 ⇒ fator 15/30"). O dia do fato de entrada NÃO
// conta como trabalhado; o dia do fato de saída conta. Efeito colateral documentado:
// entrada no dia 1 produz 29/30, não mês cheio.
export const DERIVACAO_DIAS_TRABALHADOS = "dias_trabalhados" as DerivacaoChave;

export interface DiasTrabalhados {
  readonly dias: number;
  readonly diasNoMes: number;
}

const DIAS_NO_MES_COMERCIAL = 30;

function competenciaDoFato(data: DataEfeito): string {
  return data.slice(0, 7);
}

const V1: VersaoDerivacao<DiasTrabalhados> = {
  versao: 1,
  dataEfeito: dataEfeito("2026-01-01"),
  dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
  dependeDe: [TIPO_FATO_POSSE, TIPO_FATO_EXONERACAO],
  derivar(linha: LinhaDoTempo, _referencia: DataEfeito, competencia: Competencia): DiasTrabalhados | undefined {
    const abertura = linha.aberturaDaHistoria();
    const encerramento = linha.encerramentoDaHistoria();
    const competenciaAtual = competencia.toString();

    if (competenciaDoFato(abertura.dataEfeito) > competenciaAtual) {
      return undefined; // história ainda não existia nesta competência
    }
    if (encerramento !== undefined && competenciaDoFato(encerramento.dataEfeito) < competenciaAtual) {
      return undefined; // história já encerrada antes desta competência
    }

    const aberturaNestaCompetencia = competencia.contem(abertura.dataEfeito) ? abertura : undefined;
    const encerramentoNestaCompetencia =
      encerramento !== undefined && competencia.contem(encerramento.dataEfeito) ? encerramento : undefined;

    const diaEntrada = aberturaNestaCompetencia === undefined ? 0 : partesDataEfeito(aberturaNestaCompetencia.dataEfeito).dia;
    const diaSaida =
      encerramentoNestaCompetencia === undefined
        ? DIAS_NO_MES_COMERCIAL
        : partesDataEfeito(encerramentoNestaCompetencia.dataEfeito).dia;

    return { dias: diaSaida - diaEntrada, diasNoMes: DIAS_NO_MES_COMERCIAL };
  },
};

export const DERIVACAO_DIAS_TRABALHADOS_IMPL: Derivacao<DiasTrabalhados> = {
  chave: DERIVACAO_DIAS_TRABALHADOS,
  versoes: [V1],
};
