import { Competencia } from "@minimusrh/dominio";
import type {
  Autor,
  DataRegistro,
  EstadoFolha,
  Folha,
  FolhaId,
  TipoAmparoChave,
  TipoFolhaChave,
  TransicaoFolha,
} from "@minimusrh/dominio";
import type { NovaFolha } from "./folha-repositorio.js";
import { reidratarAmparo } from "./mapeamento-fato.js";

// mapeamento-folha.ts — Folha/TransicaoFolha ⇄ linhas de banco. `Competencia.de` é
// fábrica PÚBLICA (ao contrário de Amparo) — sem lacuna de reidratação aqui.

export const SELECT_FOLHA = `
  id, competencia_ano, competencia_mes, tipo, estado,
  to_char(corte AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS corte,
  folhas_consumidas
`;

export interface LinhaFolha {
  readonly id: string;
  readonly competencia_ano: number;
  readonly competencia_mes: number;
  readonly tipo: string;
  readonly estado: EstadoFolha;
  readonly corte: string | null;
  readonly folhas_consumidas: readonly string[] | null;
}

export interface ParametrosInsercaoFolha {
  readonly id: string;
  readonly competencia_ano: number;
  readonly competencia_mes: number;
  readonly tipo: string;
  readonly estado: string;
  readonly corte: string | null;
  readonly folhas_consumidas: readonly string[] | null;
}

export function linhaParaFolha(linha: LinhaFolha): Folha {
  return {
    id: linha.id as FolhaId,
    competencia: Competencia.de(linha.competencia_ano, linha.competencia_mes),
    tipo: linha.tipo as TipoFolhaChave,
    estado: linha.estado,
    ...(linha.corte !== null ? { corte: linha.corte as DataRegistro } : {}),
    ...(linha.folhas_consumidas !== null ? { folhasConsumidas: linha.folhas_consumidas as FolhaId[] } : {}),
  };
}

export function folhaParaParametrosInsercao(id: FolhaId, folha: NovaFolha): ParametrosInsercaoFolha {
  return {
    id,
    competencia_ano: folha.competencia.ano,
    competencia_mes: folha.competencia.mes,
    tipo: folha.tipo,
    estado: folha.estado,
    corte: folha.corte ?? null,
    folhas_consumidas: folha.folhasConsumidas ?? null,
  };
}

export const SELECT_TRANSICAO_FOLHA = `
  folha_id, de, para,
  to_char(instante AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS instante,
  autor, amparo
`;

export interface LinhaTransicaoFolha {
  readonly folha_id: string;
  readonly de: EstadoFolha;
  readonly para: EstadoFolha;
  readonly instante: string;
  readonly autor: Autor;
  readonly amparo: unknown | null;
}

interface AmparoBruto {
  readonly tipo: TipoAmparoChave;
  readonly identificacaoCanonica: string;
  readonly comoInformado: string;
  readonly validadoContraVersao?: number;
}

/** Aqui o amparo é um blob JSONB inteiro (não decomposto — DECISOES #3), então a
 * reidratação parte do objeto já desserializado pelo driver `pg`, não de colunas. */
export function linhaParaTransicao(linha: LinhaTransicaoFolha): TransicaoFolha {
  const amparoBruto = linha.amparo as AmparoBruto | null;
  return {
    folhaId: linha.folha_id as FolhaId,
    de: linha.de,
    para: linha.para,
    instante: linha.instante as DataRegistro,
    autor: linha.autor,
    ...(amparoBruto !== null ? { amparo: reidratarAmparo(amparoBruto) } : {}),
  };
}

export function transicaoParaParametrosInsercao(transicao: TransicaoFolha): {
  readonly folha_id: string;
  readonly de: string;
  readonly para: string;
  readonly instante: string;
  readonly autor: string;
  readonly amparo: string | null;
} {
  return {
    folha_id: transicao.folhaId,
    de: transicao.de,
    para: transicao.para,
    instante: transicao.instante,
    autor: JSON.stringify(transicao.autor),
    amparo: transicao.amparo !== undefined ? JSON.stringify(transicao.amparo) : null,
  };
}
