import { randomUUID } from "node:crypto";
import type { AlvoFato, Autor, DataEfeito, DataRegistro, Fato, FatoId, HistoriaId, TipoFatoChave } from "@minimusrh/dominio";

// fabrica-fato.ts — suporte de teste (NÃO é `*.test.ts`): fábrica mínima de Fato para os
// testes de derivação/regra/linha-do-tempo deste pacote, sem repetir os 8 campos fixos em
// cada teste.
export const AUTOR_TESTE: Autor = { tipo: "humano", usuarioId: "teste" };

export function criarFato<C = unknown>(params: {
  readonly tipo: TipoFatoChave;
  readonly dataEfeito: DataEfeito;
  readonly dataRegistro: DataRegistro;
  readonly conteudo?: C;
  readonly alvo?: AlvoFato;
  readonly historiaId?: HistoriaId;
  readonly substituiFatoId?: FatoId;
  readonly id?: FatoId;
  readonly amparo?: Fato["amparo"];
}): Fato<C> {
  return {
    id: params.id ?? (randomUUID() as FatoId),
    alvo: params.alvo ?? { escopo: "historia", historiaId: params.historiaId ?? ("h1" as HistoriaId) },
    tipo: params.tipo,
    versaoDoTipo: 1,
    conteudo: params.conteudo as C,
    dataEfeito: params.dataEfeito,
    dataRegistro: params.dataRegistro,
    autor: AUTOR_TESTE,
    ...(params.substituiFatoId !== undefined ? { substituiFatoId: params.substituiFatoId } : {}),
    ...(params.amparo !== undefined ? { amparo: params.amparo } : {}),
  };
}
