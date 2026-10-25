import { dataRegistro } from "@minimusrh/dominio";
import type { Autor, DataEfeito, DataRegistro } from "@minimusrh/dominio";

// convencoes.ts — as convenções EXPLÍCITAS da tradução estado → fatos (Roteiro §3, Marco 3,
// peça 1; §4, "dados legados sem bitemporalidade": "nunca inventar datas de registro
// plausíveis silenciosamente"). Cada uma é uma constante nomeada, citada no DECISOES.

/**
 * DECISOES #1. O legado guarda estado, não quando soube de cada coisa. Quando a fonte não traz
 * a data de registro, o fato é registrado como sabido desde que passou a valer: meia-noite
 * UTC do dia do efeito. O fato gerado mostra a convenção na própria `dataRegistro`
 * (`<dataEfeito>T00:00:00.000Z`) e o autor de importação, e o relatório conta quantos fatos a
 * usaram.
 */
export const CONVENCAO_REGISTRO_DESCONHECIDO = {
  descricao: "data_registro := data_efeito (00:00:00Z do dia do efeito)",
  aplicar(efeito: DataEfeito): DataRegistro {
    return dataRegistro(`${efeito}T00:00:00Z`);
  },
} as const;

/** Autor de todo fato importado (Design §2, `Autor`): o lote, e não um usuário. */
export function autorDoLote(lote: string): Autor {
  return { tipo: "importacao", lote };
}

/** Identificador de lote: curto, sem espaço, seguro para log e nome de arquivo. */
export const FORMATO_LOTE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
