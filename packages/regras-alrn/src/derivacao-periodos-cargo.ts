import { dataEfeito, dataRegistro } from "@minimusrh/dominio";
import type { Competencia, DataEfeito, Derivacao, DerivacaoChave, LinhaDoTempo, VersaoDerivacao } from "@minimusrh/dominio";
import { TIPO_FATO_EXONERACAO, TIPO_FATO_POSSE, TIPO_FATO_PROMOCAO } from "./catalogo-tipos-fato.js";
import { cargoEm } from "./derivacao-cargo.js";
import { partesDataEfeito } from "./data-util.js";

// derivacao-periodos-cargo.ts — a competência fatiada por cargo vigente, nos dias
// trabalhados (DECISOES #14). `cargo` olha só o último dia da competência, então uma
// promoção no meio do mês pagaria o cargo novo no mês inteiro — o furo que o cenário
// Victor (promoção com efeito em 15/02, Fundação §5.3) expõe no Marco 2.
// CONVENÇÕES: o mesmo mês comercial de 30 dias de `dias_trabalhados` (DECISOES #3), com o
// mesmo intervalo trabalhado; a mudança de cargo vale a partir do PRÓPRIO dia do efeito
// (dataEfeito é inclusiva, como em toda vigência do dominio); o dia comercial 30 é o
// último dia real do mês e os dias comerciais além do fim de fevereiro repetem o último dia.
export const DERIVACAO_PERIODOS_CARGO = "periodos_cargo" as DerivacaoChave;

export interface PeriodoCargo {
  readonly cargo: string;
  readonly dias: number;
}

export interface PeriodosCargo {
  /** Em ordem cronológica; cargos consecutivos iguais já agrupados. */
  readonly periodos: readonly PeriodoCargo[];
  readonly diasNoMes: number;
}

const DIAS_NO_MES_COMERCIAL = 30;

function competenciaDoFato(data: DataEfeito): string {
  return data.slice(0, 7);
}

function diaComercial(data: DataEfeito): number {
  return Math.min(partesDataEfeito(data).dia, DIAS_NO_MES_COMERCIAL);
}

/** Data real que representa o dia comercial `dia` (1..30) da competência. */
function dataDoDiaComercial(competencia: Competencia, dia: number): DataEfeito {
  const ultimoDiaReal = partesDataEfeito(competencia.dataReferencia()).dia;
  const diaReal = dia === DIAS_NO_MES_COMERCIAL ? ultimoDiaReal : Math.min(dia, ultimoDiaReal);
  return dataEfeito(`${competencia.toString()}-${String(diaReal).padStart(2, "0")}`);
}

const V1: VersaoDerivacao<PeriodosCargo> = {
  versao: 1,
  dataEfeito: dataEfeito("2026-01-01"),
  dataRegistro: dataRegistro("2026-01-01T00:00:00Z"),
  dependeDe: [TIPO_FATO_POSSE, TIPO_FATO_PROMOCAO, TIPO_FATO_EXONERACAO],
  derivar(linha: LinhaDoTempo, _referencia: DataEfeito, competencia: Competencia): PeriodosCargo | undefined {
    const abertura = linha.aberturaDaHistoria();
    const encerramento = linha.encerramentoDaHistoria();
    const competenciaAtual = competencia.toString();

    if (competenciaDoFato(abertura.dataEfeito) > competenciaAtual) {
      return undefined; // história ainda não existia nesta competência
    }
    if (encerramento !== undefined && competenciaDoFato(encerramento.dataEfeito) < competenciaAtual) {
      return undefined; // história já encerrada antes desta competência
    }

    // mesmo intervalo de `dias_trabalhados`: o dia da entrada não conta, o da saída conta.
    const primeiroDia = competencia.contem(abertura.dataEfeito) ? diaComercial(abertura.dataEfeito) + 1 : 1;
    const ultimoDia =
      encerramento !== undefined && competencia.contem(encerramento.dataEfeito)
        ? diaComercial(encerramento.dataEfeito)
        : DIAS_NO_MES_COMERCIAL;

    const periodos: { cargo: string; dias: number }[] = [];
    for (let dia = primeiroDia; dia <= ultimoDia; dia += 1) {
      const cargo = cargoEm(linha, dataDoDiaComercial(competencia, dia));
      if (cargo === undefined) continue; // abertura sem cargo: não há o que pagar nesse dia
      const ultimo = periodos[periodos.length - 1];
      if (ultimo !== undefined && ultimo.cargo === cargo) ultimo.dias += 1;
      else periodos.push({ cargo, dias: 1 });
    }

    return { periodos, diasNoMes: DIAS_NO_MES_COMERCIAL };
  },
};

export const DERIVACAO_PERIODOS_CARGO_IMPL: Derivacao<PeriodosCargo> = {
  chave: DERIVACAO_PERIODOS_CARGO,
  versoes: [V1],
};
