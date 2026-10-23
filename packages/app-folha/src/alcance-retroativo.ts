import type { Competencia, DataEfeito, DataRegistro, FolhaId, TipoFolhaChave } from "@minimusrh/dominio";
import { folhaRepositorioPg } from "@minimusrh/persistencia";
import type { Pool } from "pg";
import { canonizarInstante } from "./servico-folha.js";

// alcance-retroativo.ts — dado um fato ou uma versão (de regra, de derivação) recém-
// registrados, quais folhas FECHADAS eles alcançam (Playbook Módulo 6, item 2; Fundação
// §5.3). No MVP é chamada à mão pelo script; o disparo automático é pós-MVP.
//
// Critério bitemporal (DECISOES #11): a folha é alcançada quando (i) o efeito já valia na
// competência (efeito <= último dia da competência) e (ii) a folha NÃO sabia da novidade
// (corte selado < registro). O "efeito <= competência < registro" do playbook usa a
// competência como aproximação do corte; o corte é o que a folha de fato enxergou.

/** O que importa de um fato ou de uma versão para o alcance: os dois eixos do tempo. */
export interface Novidade {
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;
}

export interface FolhaFechada {
  readonly id: FolhaId;
  readonly competencia: Competencia;
  readonly tipo: TipoFolhaChave;
  readonly corte: DataRegistro;
}

function compararFolhas(a: FolhaFechada, b: FolhaFechada): number {
  return a.competencia.toString().localeCompare(b.competencia.toString()) || a.tipo.localeCompare(b.tipo);
}

/** As folhas alcançadas, em ordem de competência e tipo. Função pura. */
export function folhasAlcancadas(folhas: readonly FolhaFechada[], novidade: Novidade): readonly FolhaFechada[] {
  // instantes comparados como texto só são confiáveis na forma canônica (DECISOES #7).
  const registro = canonizarInstante(novidade.dataRegistro);
  return folhas
    .filter((f) => novidade.dataEfeito <= f.competencia.dataReferencia() && canonizarInstante(f.corte) < registro)
    .sort(compararFolhas);
}

/** Todas as folhas no estado `fechada`. Toda folha fechada tem corte (motor DECISOES #9). */
export async function listarFolhasFechadas(pool: Pool): Promise<readonly FolhaFechada[]> {
  const repositorio = folhaRepositorioPg(pool);
  const { rows } = await pool.query<{ id: FolhaId }>(`SELECT id FROM folha WHERE estado = 'fechada' ORDER BY id`);
  const folhas: FolhaFechada[] = [];
  for (const { id } of rows) {
    const folha = (await repositorio.buscarPorId(id))!;
    folhas.push({ id, competencia: folha.competencia, tipo: folha.tipo, corte: folha.corte! });
  }
  return folhas;
}
