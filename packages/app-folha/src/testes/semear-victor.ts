import type { Fato, FatoId, HistoriaId, PessoaId } from "@minimusrh/dominio";
import { fatoRepositorioPg } from "@minimusrh/persistencia";
import { VICTOR_FATOS, VICTOR_HISTORIA_ID, criarCatalogoTiposDeFato } from "@minimusrh/regras-alrn";
import type { Pool } from "pg";
import type { AlvoHistoria } from "../configuracao.js";

// semear-victor.ts — suporte de teste (NÃO é `*.test.ts`): grava a fixture Victor
// (regras-alrn, Módulo 4) no banco pela ÚNICA porta de escrita (`fatoRepositorio.registrar`,
// que valida o conteúdo contra o catálogo). A fixture usa ids legíveis ("vitor"); as colunas
// são uuid, então história e pessoa ganham UUIDs FIXOS (golden estável) e cada fato ganha o
// id que a persistência cunhar — devolvido em `apelidos` para a serialização do golden.

export const VICTOR_HISTORIA_UUID = "00000000-0000-4000-8000-00000000a001" as HistoriaId;
export const VICTOR_PESSOA_UUID = "00000000-0000-4000-8000-00000000b001" as PessoaId;

export const VICTOR_ALVO: AlvoHistoria = { pessoaId: VICTOR_PESSOA_UUID, historiaId: VICTOR_HISTORIA_UUID };

export interface VictorSemeado {
  /** FatoId gravado → fato como gravado (para o extrato descrever os fatos citados). */
  readonly fatos: ReadonlyMap<FatoId, Fato>;
  /** FatoId gravado → nome estável `fato:<tipo>@<dataEfeito>` (para o golden). */
  readonly apelidos: ReadonlyMap<string, string>;
}

export async function semearVictor(pool: Pool, fatosExtras: readonly Fato[] = []): Promise<VictorSemeado> {
  const repositorio = fatoRepositorioPg(pool, criarCatalogoTiposDeFato());
  const fatos = new Map<FatoId, Fato>();
  const apelidos = new Map<string, string>();

  for (const original of [...VICTOR_FATOS, ...fatosExtras]) {
    const { id: _idDaFixture, ...semId } = original;
    const novo = {
      ...semId,
      alvo:
        original.alvo.escopo === "historia"
          ? { escopo: "historia" as const, historiaId: original.alvo.historiaId === VICTOR_HISTORIA_ID ? VICTOR_HISTORIA_UUID : original.alvo.historiaId }
          : { escopo: "pessoa" as const, pessoaId: VICTOR_PESSOA_UUID },
      // o schema de `nascimento` é vazio, mas o conteúdo precisa ser um objeto (JSONB NOT NULL).
      conteudo: original.conteudo ?? {},
    };
    const id = await repositorio.registrar(novo);
    // relido do banco: o extrato descreve o fato COMO GRAVADO (instantes na forma canônica).
    fatos.set(id, (await repositorio.buscarPorId(id))!);
    apelidos.set(id, `fato:${original.tipo}@${original.dataEfeito}`);
  }

  return { fatos, apelidos };
}
